"""Click prepare/complete callbacklari va to'lovdan keyingi xizmatni bajarish (ClickPaymentService mixin)."""
from django.utils import timezone
import hashlib
import hmac
import uuid as uuid_module
from .models import Transaction
from .fulfillment import _fulfill_after_payment
import logging

logger = logging.getLogger(__name__)


def _find_transaction_by_merchant_trans_id(merchant_trans_id):
    """
    Find Transaction by merchant_trans_id (transaction_param from Click).
    Click sends our transaction.id (UUID string). Normalize and try id then merchant_trans_id field.
    """
    if not merchant_trans_id:
        return None
    raw = str(merchant_trans_id).strip()
    # Try as primary key (UUID) — support different casing
    for val in (raw, raw.lower(), raw.upper()):
        try:
            uuid_val = uuid_module.UUID(val)
            return Transaction.objects.get(id=uuid_val)
        except (ValueError, Transaction.DoesNotExist):
            pass
    try:
        return Transaction.objects.get(id=raw)
    except (Transaction.DoesNotExist, ValueError):
        pass
    try:
        return Transaction.objects.get(merchant_trans_id=raw)
    except Transaction.DoesNotExist:
        pass
    try:
        return Transaction.objects.get(merchant_trans_id=merchant_trans_id)
    except Transaction.DoesNotExist:
        return None


def _click_signature_ok(received, expected) -> bool:
    """Click imzosini doimiy vaqtda solishtirish; imzo yo'q bo'lsa — rad."""
    if not received or not expected:
        return False
    return hmac.compare_digest(str(received).strip().lower(), str(expected).lower())


def _click_amount_matches(click_amount_raw, our_amount) -> bool:
    """Click odatda so'mda yuboradi; ba'zan tiyinda (×100). Kichik farqqa ruxsat."""
    try:
        click_amount = float(click_amount_raw)
    except (TypeError, ValueError):
        return False
    our = float(our_amount)
    if our <= 0:
        return False
    if abs(click_amount - our) <= 0.02:
        return True
    return click_amount >= 100 and abs((click_amount / 100) - our) <= 0.02


class ClickCallbackMixin:
    """Click Shop API callbacklari: prepare va complete (imzo, summa, idempotentlik)."""

    def prepare_payment(self, transaction, use_invoice=False):
        """Prepare payment data for Click (OSON TO'LOV - invoice yaratmasdan)
        
        Args:
            transaction: Transaction object
            use_invoice: If True, try to create invoice. If False, create direct payment URL (default: False)
        
        Returns:
            dict with payment_url
        """
        return self.create_direct_payment_url(transaction, use_invoice=use_invoice)
    
    def handle_prepare(self, data):
        """Handle Click prepare request
        According to Click API documentation:
        sign_string = md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
        
        IMPORTANT: SECRET_KEY comes AFTER service_id and BEFORE merchant_trans_id!
        click_paydoc_id is NOT included in signature for Prepare callback.
        """
        try:
            click_trans_id = data.get('click_trans_id')
            service_id = data.get('service_id')
            click_paydoc_id = data.get('click_paydoc_id')  # Present but NOT in signature
            merchant_trans_id = data.get('merchant_trans_id')
            amount = data.get('amount')
            action = data.get('action')
            sign_time = data.get('sign_time')
            sign_string = data.get('sign_string')
            
            # Get secret key for this specific service_id (Click'dan kelgan)
            service_secret_key = self.get_secret_key_for_service(service_id)
            logger.debug("Click prepare: service_id=%s secret_key_len=%s", service_id, len(service_secret_key or ""))

            # Verify signature - Click dokumentatsiyasiga ko'ra:
            # md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)

            logger.debug("=== SIGNATURE DEBUG START ===")
            logger.debug("click_trans_id=%s service_id=%s", click_trans_id, service_id)
            logger.debug("merchant_trans_id=%s amount=%s action=%s sign_time=%s", merchant_trans_id, amount, action, sign_time)
            logger.debug("Received sign_string=%s", sign_string)
            
            # To'g'ri signature generatsiya - Click dokumentatsiyasiga ko'ra
            # Format: md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
            sign_parts = [
                str(click_trans_id),
                str(service_id),
                service_secret_key,  # SECRET_KEY service_id dan keyin!
                str(merchant_trans_id),
                str(amount),
                str(action),
                str(sign_time)
            ]
            sign_string_to_hash = ''.join(sign_parts)
            _safe_parts = [str(p) if i != 2 else "***" for i, p in enumerate(sign_parts)]
            logger.debug("Sign parts (secret redacted): %s len=%s", _safe_parts, len(sign_string_to_hash))

            expected_sign = hashlib.md5(sign_string_to_hash.encode('utf-8')).hexdigest()

            logger.debug("Expected=%s received=%s", expected_sign, sign_string)
            logger.debug("=== SIGNATURE DEBUG END ===")
            
            if not service_secret_key:
                logger.error('Click prepare: service_id=%s uchun secret key sozlanmagan', service_id)
                return {'error': -1, 'error_note': 'Invalid signature'}
            if not _click_signature_ok(sign_string, expected_sign):
                logger.error('Click prepare signature mismatch (service_id=%s, merchant_trans_id=%s)', service_id, merchant_trans_id)
                return {'error': -1, 'error_note': 'Invalid signature'}

            if str(action) != '0':
                return {'error': -3, 'error_note': 'Action not found'}

            # Find transaction - merchant_trans_id = transaction_param (bizning transaction.id)
            transaction = _find_transaction_by_merchant_trans_id(merchant_trans_id)
            if not transaction:
                logger.warning(f"Transaction not found for merchant_trans_id={merchant_trans_id}")
                return {'error': -5, 'error_note': 'Transaction not found'}

            if transaction.status == 'completed':
                return {'error': -4, 'error_note': 'Already paid'}
            if transaction.status == 'cancelled':
                return {'error': -9, 'error_note': 'Transaction cancelled'}

            if not _click_amount_matches(amount, transaction.amount):
                logger.warning(f"Amount mismatch: Click sent {amount}, we have {transaction.amount}")
                return {'error': -2, 'error_note': f'Invalid amount: expected {float(transaction.amount)}, got {amount}'}

            # Tuzatishdan oldin mijoz summasi bilan yaratilgan arzon buyurtmalar to'lanmasin
            from .pricing import is_underpriced
            if is_underpriced(transaction):
                logger.warning('Click prepare: underpriced transaction %s (amount=%s)', transaction.id, transaction.amount)
                return {'error': -2, 'error_note': 'Incorrect parameter amount'}
            
            # Save Click transaction ID and prepare status
            transaction.click_trans_id = click_trans_id
            if click_paydoc_id:
                transaction.click_paydoc_id = str(click_paydoc_id)
            transaction.merchant_trans_id = str(transaction.id) if not transaction.merchant_trans_id else transaction.merchant_trans_id
            # Save service_id for complete callback (complete'da service_id kelmaydi)
            transaction.click_service_id = str(service_id)
            transaction.status = 'pending'  # Still pending until complete
            transaction.save()
            
            return {
                'click_trans_id': click_trans_id,
                'merchant_trans_id': str(transaction.id),
                'merchant_prepare_id': str(transaction.id),
                'error': 0,
                'error_note': 'Success'
            }
            
        except Exception as e:
            logger.error(f"Error in handle_prepare: {str(e)}", exc_info=True)
            return {'error': -9, 'error_note': 'Server xatolik'}
    
    def handle_complete(self, data):
        """Handle Click complete request
        According to Click API documentation:
        sign_string = md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
        
        IMPORTANT: SECRET_KEY comes AFTER service_id and BEFORE merchant_trans_id!
        error parameter is NOT included in signature!
        """
        from django.db import transaction as db_transaction
        
        try:
            click_trans_id = data.get('click_trans_id')
            service_id = data.get('service_id')  # Complete'da ham service_id keladi!
            merchant_trans_id = data.get('merchant_trans_id')
            merchant_prepare_id = data.get('merchant_prepare_id')
            amount = data.get('amount')
            action = data.get('action')
            error = data.get('error')
            sign_time = data.get('sign_time')
            sign_string = data.get('sign_string')
            
            # Find transaction (same logic as prepare — UUID / merchant_trans_id)
            transaction = _find_transaction_by_merchant_trans_id(merchant_trans_id)
            if not transaction:
                return {'error': -5, 'error_note': 'Transaction not found'}

            # Get service_id from request or transaction (saved during prepare) or use default
            service_id_for_complete = service_id or getattr(transaction, 'click_service_id', None) or self.service_id

            # Get secret key for this service
            service_secret_key = self.get_secret_key_for_service(service_id_for_complete)
            logger.debug(
                "Click complete: service_id=%s secret_key_len=%s",
                service_id_for_complete,
                len(service_secret_key or ""),
            )

            logger.debug("=== COMPLETE SIGNATURE DEBUG START ===")
            logger.debug(
                "click_trans_id=%s merchant_trans_id=%s merchant_prepare_id=%s",
                click_trans_id,
                merchant_trans_id,
                merchant_prepare_id,
            )
            logger.debug("amount=%s action=%s sign_time=%s error=%s", amount, action, sign_time, error)
            logger.debug("Received sign_string=%s", sign_string)
            
            sign_parts = [
                str(click_trans_id),
                str(service_id_for_complete),
                service_secret_key,  # SECRET_KEY service_id dan keyin!
                str(merchant_trans_id),
                str(merchant_prepare_id),
                str(amount),
                str(action),
                str(sign_time)
            ]
            sign_string_to_hash = ''.join(sign_parts)
            _safe_complete = [str(p) if i != 2 else "***" for i, p in enumerate(sign_parts)]
            logger.debug("Complete sign parts (secret redacted): %s", _safe_complete)

            expected_sign = hashlib.md5(sign_string_to_hash.encode('utf-8')).hexdigest()

            logger.debug("Complete signature: expected=%s received=%s", expected_sign, sign_string)
            logger.debug("=== COMPLETE SIGNATURE DEBUG END ===")
            
            # Imzo MAJBURIY: sign_string yuborilmasa ham rad etiladi (aks holda istalgan kishi
            # tranzaksiyani "to'langan" qilib qo'yishi mumkin edi).
            if not service_secret_key or not _click_signature_ok(sign_string, expected_sign):
                logger.error(
                    'Click complete signature invalid/missing (service_id=%s, merchant_trans_id=%s)',
                    service_id_for_complete,
                    merchant_trans_id,
                )
                return {'error': -1, 'error_note': 'Invalid signature'}

            if str(action) != '1':
                return {'error': -3, 'error_note': 'Action not found'}

            # merchant_prepare_id — prepare javobida biz qaytargan transaction.id
            if str(merchant_prepare_id or '').strip().lower() != str(transaction.id).lower():
                logger.warning(
                    'Click complete: merchant_prepare_id mismatch tx=%s got=%s',
                    transaction.id,
                    merchant_prepare_id,
                )
                return {'error': -6, 'error_note': 'Transaction does not exist'}

            if not _click_amount_matches(amount, transaction.amount):
                logger.warning('Click complete amount mismatch: Click %s, tx %s', amount, transaction.amount)
                return {'error': -2, 'error_note': 'Incorrect parameter amount'}

            if transaction.status == 'cancelled':
                return {'error': -9, 'error_note': 'Transaction cancelled'}

            # Click may send error as int 0 or string "0"
            try:
                error_int = int(error) if error is not None else -1
            except (TypeError, ValueError):
                error_int = -1

            # select_for_update() faqat atomic() ichida (PostgreSQL); aks holda xatolik va Click "to'lov xatosi" ko'rsatadi
            skip_fulfill = False
            with db_transaction.atomic():
                locked = Transaction.objects.select_for_update().get(pk=transaction.pk)
                if error_int == 0 and locked.status == 'completed':
                    logger.info(
                        'Click complete idempotent: transaction %s allaqachon completed',
                        locked.id,
                    )
                    transaction = locked
                    skip_fulfill = True
                elif error_int == 0:
                    locked.status = 'completed'
                    locked.completed_at = timezone.now()
                    locked.click_paydoc_id = data.get('click_paydoc_id', locked.click_paydoc_id or '')
                    locked.click_trans_id = click_trans_id
                    locked.error_note = ''
                    locked.save(
                        update_fields=['status', 'completed_at', 'click_paydoc_id', 'click_trans_id', 'error_note']
                    )
                    logger.info("Transaction %s status updated to '%s'", locked.id, locked.status)
                    transaction = locked
                else:
                    if locked.status == 'completed':
                        logger.warning(
                            'Click complete: failure callback for already-completed transaction %s — ignored',
                            locked.id,
                        )
                        transaction = locked
                        skip_fulfill = True
                    else:
                        locked.status = 'failed'
                        locked.error_note = str(data.get('error_note', ''))[:500]
                        locked.save(
                            update_fields=['status', 'completed_at', 'click_paydoc_id', 'click_trans_id', 'error_note']
                        )
                        logger.info("Transaction %s status updated to '%s'", locked.id, locked.status)
                        transaction = locked

            if skip_fulfill:
                return {
                    'click_trans_id': click_trans_id,
                    'merchant_trans_id': str(transaction.id),
                    'merchant_confirm_id': str(transaction.id),
                    'error': 0,
                    'error_note': 'Success',
                }

            if error_int == 0:
                _fulfill_after_payment(transaction)
            
            return {
                'click_trans_id': click_trans_id,
                'merchant_trans_id': str(transaction.id),
                'merchant_confirm_id': str(transaction.id),
                'error': 0,
                'error_note': 'Success'
            }
            
        except Transaction.DoesNotExist:
            logger.error(f"Transaction not found in handle_complete: merchant_trans_id={merchant_trans_id}")
            return {'error': -5, 'error_note': 'Transaction not found'}
        except Exception as e:
            import traceback
            logger.error(f"Error in handle_complete: {str(e)}", exc_info=True)
            return {'error': -9, 'error_note': 'Server xatolik'}
