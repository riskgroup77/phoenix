"""Click to'lov sahifasi havolasi (ClickPaymentService mixin)."""

import logging

logger = logging.getLogger(__name__)


def _build_click_return_url(transaction, django_settings=None) -> str:
    """Click to'lovdan keyin foydalanuvchini qaytarish URL'i (xizmat turiga qarab)."""
    from django.conf import settings as default_settings

    settings_obj = django_settings or default_settings
    base = getattr(settings_obj, 'FRONTEND_BASE_URL', 'http://localhost:3000').rstrip('/')
    tx_id = transaction.id
    service_type = getattr(transaction, 'service_type', None)
    if service_type == 'language_editing':
        return f"{base}/#/plagiarism-check?payment_return=1&transaction_id={tx_id}"
    return f"{base}/#/payment/click?transaction_id={tx_id}"


class ClickCheckoutUrlMixin:
    """To'lov sahifasi havolasini yaratish (my.click.uz/services/pay)."""

    def create_direct_payment_url(self, transaction, use_invoice=False):
        """Create direct payment URL without invoice (OSON TO'LOV)
        
        Args:
            transaction: Transaction object
            use_invoice: If True, try to create invoice first. If False, create direct URL.
        
        Returns:
            dict with payment_url
        """
        # Ensure transaction has merchant_trans_id
        if not transaction.merchant_trans_id:
            transaction.merchant_trans_id = str(transaction.id)
            transaction.save()
        
        # Get service_id as integer
        try:
            service_id_int = int(self.service_id)
        except (ValueError, TypeError):
            logger.error(f"Invalid service_id: {self.service_id}")
            return {
                'error_code': -1,
                'error_note': f'Invalid service_id: {self.service_id}',
                'payment_url': None
            }
        
        # If use_invoice is False, create direct payment URL without invoice
        if not use_invoice:
            # Click — Установка кнопки оплаты (Вариант 1 — Переход по ссылке)
            # https://my.click.uz/services/pay?service_id=&merchant_id=&amount=&transaction_param=&return_url=&card_type=
            # Majburiy: merchant_id, service_id, transaction_param, amount. Ixtiyoriy: return_url, card_type
            
            from django.conf import settings as django_settings
            from urllib.parse import quote

            merchant_id_int = int(self.merchant_id)
            transaction_param = str(transaction.id)  # transaction_param = merchant_trans_id (ID заказа)
            amount_formatted = f"{float(transaction.amount):.2f}"  # Format: N.NN
            
            payment_url = (
                f"https://my.click.uz/services/pay"
                f"?merchant_id={merchant_id_int}"
                f"&service_id={service_id_int}"
                f"&transaction_param={transaction_param}"
                f"&amount={amount_formatted}"
            )
            return_url = _build_click_return_url(transaction, django_settings)
            payment_url += f"&return_url={quote(return_url)}"

            logger.info(f"Direct payment URL created (Click format): {payment_url}")
            logger.info(f"Parameters: merchant_id={merchant_id_int}, service_id={service_id_int}, transaction_param={transaction_param}, amount={amount_formatted}")
            
            return {
                'error_code': 0,
                'error_note': 'Success',
                'payment_url': payment_url,
                'invoice_id': None,
                'merchant_trans_id': transaction_param,
                'amount': float(transaction.amount),
                'service_id': service_id_int,
                'merchant_id': merchant_id_int,
                'direct_payment': True  # Invoice yaratilmadi, to'g'ridan-to'g'ri URL
            }
        
        # If use_invoice is True, try to create invoice (old method)
        # Get user phone number from transaction user - format for Click (998XXXXXXXXX)
        phone_number = None
        if transaction.user and hasattr(transaction.user, 'phone'):
            phone_raw = transaction.user.phone
            if phone_raw:
                # Remove any non-digit characters and ensure format is correct (Click requires 998XXXXXXXXX format)
                phone_clean = ''.join(filter(str.isdigit, str(phone_raw)))
                if phone_clean and len(phone_clean) >= 9:
                    # If starts with 998, use as is, otherwise add 998 prefix
                    if phone_clean.startswith('998'):
                        phone_number = phone_clean
                    elif phone_clean.startswith('9'):
                        phone_number = '998' + phone_clean
                    else:
                        phone_number = '998' + phone_clean[-9:]  # Take last 9 digits and add 998
                else:
                    logger.warning(f"Invalid phone number format for user {transaction.user.id}: {phone_raw}")
        
        # If phone number is missing, return direct payment URL
        if not phone_number:
            logger.warning(f"No valid phone number found for user {transaction.user.id if transaction.user else 'unknown'}")
            
            # Try to create invoice with a test phone number (Click may accept this for testing)
            # Test phone number: 998901234567 (Click test number)
            test_phone = '998901234567'
            logger.info(f"Attempting invoice creation with test phone number: {test_phone}")
            
            invoice_result_test = self.create_invoice(
                service_id=service_id_int,
                amount=float(transaction.amount),
                phone_number=test_phone,
                merchant_trans_id=str(transaction.id)
            )
            
            invoice_error_code_test = invoice_result_test.get('error_code')
            if invoice_error_code_test is not None:
                try:
                    invoice_error_code_test = int(invoice_error_code_test)
                except (ValueError, TypeError):
                    invoice_error_code_test = -1
            
            if invoice_error_code_test == 0:
                # Invoice created with test phone number
                invoice_id = invoice_result_test.get('invoice_id')
                payment_url = invoice_result_test.get('invoice_url') or invoice_result_test.get('payment_url')
                if not payment_url:
                    # Create URL in Click format
                    merchant_id_int = int(self.merchant_id)
                    transaction_param = str(transaction.id)
                    amount_formatted = f"{float(transaction.amount):.2f}"
                    payment_url = (
                        f"https://my.click.uz/services/pay"
                        f"?merchant_id={merchant_id_int}"
                        f"&service_id={service_id_int}"
                        f"&transaction_param={transaction_param}"
                        f"&amount={amount_formatted}"
                    )
                logger.info(f"Invoice created with test phone, payment URL: {payment_url}")
                return {
                    'error_code': 0,
                    'error_note': 'Success (invoice created with test phone number)',
                    'payment_url': payment_url,
                    'invoice_id': invoice_id,
                    'merchant_trans_id': str(transaction.id),
                    'amount': float(transaction.amount),
                    'service_id': service_id_int,
                    'warning': 'Invoice created with test phone number (998901234567). User should use their actual Click-registered phone number.'
                }
            
            # If test phone also fails, use direct payment URL (invoice yaratmasdan)
            test_error_note = invoice_result_test.get('error_note') or invoice_result_test.get('error') or 'Failed to create invoice with test phone'
            logger.warning(f"Invoice creation failed: {test_error_note}")
            logger.info("Using direct payment URL instead (without invoice)")
            
            # Create direct payment URL without invoice (Click format)
            merchant_id_int = int(self.merchant_id)
            transaction_param = str(transaction.id)
            amount_formatted = f"{float(transaction.amount):.2f}"
            
            payment_url = (
                f"https://my.click.uz/services/pay"
                f"?merchant_id={merchant_id_int}"
                f"&service_id={service_id_int}"
                f"&transaction_param={transaction_param}"
                f"&amount={amount_formatted}"
            )
            
            return {
                'error_code': 0,
                'error_note': 'Success (direct payment URL, invoice yaratilmadi)',
                'payment_url': payment_url,
                'invoice_id': None,
                'merchant_trans_id': transaction_param,
                'amount': float(transaction.amount),
                'service_id': service_id_int,
                'merchant_id': merchant_id_int,
                'direct_payment': True,
                'warning': 'Invoice yaratilmadi, lekin to\'g\'ridan-to\'g\'ri to\'lov URL yaratildi. User Click sahifasida karta ma\'lumotlarini kiritishi mumkin.'
            }
        
        # Create invoice via Click API (recommended method)
        try:
            service_id_int = int(self.service_id)
        except (ValueError, TypeError):
            logger.error(f"Invalid service_id: {self.service_id}")
            return {
                'error_code': -1,
                'error_note': f'Invalid service_id: {self.service_id}',
                'payment_url': None
            }
        
        # Create invoice via Click API
        invoice_result = self.create_invoice(
            service_id=service_id_int,
            amount=float(transaction.amount),
            phone_number=phone_number,
            merchant_trans_id=str(transaction.id)
        )
        
        logger.info(f"Invoice creation result: {invoice_result}")
        
        # Check if invoice was created successfully
        invoice_error_code = invoice_result.get('error_code')
        
        # Convert error_code to int for comparison
        if invoice_error_code is not None:
            try:
                invoice_error_code = int(invoice_error_code)
            except (ValueError, TypeError):
                invoice_error_code = -1
        
        if invoice_error_code == 0:
            # Invoice created successfully - use invoice_url or payment_url from response
            invoice_id = invoice_result.get('invoice_id')
            payment_url = invoice_result.get('invoice_url') or invoice_result.get('payment_url') or invoice_result.get('url')
            
            # If no payment URL in response, construct it manually based on Click documentation
            # Click payment URL format: https://my.click.uz/services/pay?merchant_id={merchant_id}&service_id={service_id}&transaction_param={transaction_param}&amount={amount}
            if not payment_url:
                merchant_id_int = int(self.merchant_id)
                transaction_param = str(transaction.id)
                amount_formatted = f"{float(transaction.amount):.2f}"
                
                payment_url = (
                    f"https://my.click.uz/services/pay"
                    f"?merchant_id={merchant_id_int}"
                    f"&service_id={service_id_int}"
                    f"&transaction_param={transaction_param}"
                    f"&amount={amount_formatted}"
                )
                if invoice_id:
                    payment_url += f"&invoice_id={invoice_id}"
                logger.info(f"Constructed payment URL manually (Click format): {payment_url}")
            
            logger.info(f"Payment URL from invoice (success): {payment_url}, invoice_id: {invoice_id}")
            
            return {
                'error_code': 0,
                'error_note': 'Success',
                'payment_url': payment_url,
                'invoice_id': invoice_id,
                'merchant_trans_id': str(transaction.id),
                'amount': float(transaction.amount),
                'service_id': service_id_int
            }
        else:
            # Invoice creation failed - cannot proceed without invoice
            error_note = invoice_result.get('error_note') or invoice_result.get('error') or invoice_result.get('error_msg') or 'Failed to create invoice'
            logger.error(f"Invoice creation failed: {invoice_error_code} - {error_note}")
            logger.error(f"Invoice creation is REQUIRED for Click payments. Cannot proceed without invoice.")
            logger.error(f"User phone number: {phone_number}, Transaction ID: {transaction.id}")
            logger.error(f"IMPORTANT: User must register their phone number ({phone_number}) in Click system before making payments.")
            logger.error(f"IMPORTANT: Ensure callback URLs are configured in Click merchant panel (merchant.click.uz)")
            logger.error(f"Callback URLs should be:")
            logger.error(f"  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/")
            logger.error(f"  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/")
            
            # Invoice creation failed - use direct payment URL instead
            logger.warning(f"Invoice creation failed: {invoice_error_code} - {error_note}")
            logger.info("Using direct payment URL instead (without invoice)")
            
            # Create direct payment URL without invoice (Click format)
            merchant_id_int = int(self.merchant_id)
            transaction_param = str(transaction.id)
            amount_formatted = f"{float(transaction.amount):.2f}"
            
            payment_url = (
                f"https://my.click.uz/services/pay"
                f"?merchant_id={merchant_id_int}"
                f"&service_id={service_id_int}"
                f"&transaction_param={transaction_param}"
                f"&amount={amount_formatted}"
            )
            
            return {
                'error_code': 0,
                'error_note': 'Success (direct payment URL, invoice yaratilmadi)',
                'payment_url': payment_url,
                'invoice_id': None,
                'merchant_trans_id': transaction_param,
                'amount': float(transaction.amount),
                'service_id': service_id_int,
                'merchant_id': merchant_id_int,
                'direct_payment': True,
                'warning': f'Invoice yaratilmadi ({error_note}), lekin to\'g\'ridan-to\'g\'ri to\'lov URL yaratildi. User Click sahifasida karta ma\'lumotlarini kiritishi mumkin.'
            }
