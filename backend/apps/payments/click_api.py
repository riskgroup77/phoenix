"""Click Merchant API chaqiruvlari (ClickPaymentService mixin)."""
from django.conf import settings
from django.utils import timezone
import hashlib
import time
import requests
from .models import Transaction
from .fulfillment import _fulfill_after_payment
import logging

logger = logging.getLogger(__name__)


def _click_timeout():
    return int(getattr(settings, 'CLICK_HTTP_TIMEOUT_SEC', 45) or 45)


class ClickMerchantApiMixin:
    """Click Merchant API (HTTP): imzo, invoice, holat, qaytarish, karta tokeni."""

    def get_secret_key_for_service(self, service_id):
        """Get secret key for specific service_id
        
        Click'dan kelgan service_id ga mos secret key qaytaradi
        """
        service_id_str = str(service_id).strip()
        if service_id_str in self.service_secret_keys:
            return self.service_secret_keys[service_id_str]
        # Default secret key
        return self.secret_key
    
    def generate_auth_header(self):
        """Generate Auth header for Click API requests"""
        timestamp = str(int(time.time()))
        digest_string = timestamp + self.secret_key
        digest = hashlib.sha1(digest_string.encode('utf-8')).hexdigest()
        return f"{self.merchant_user_id}:{digest}:{timestamp}"
    
    def generate_signature(self, *args):
        """Generate signature for Click request
        According to Click API: sign_string = md5(args + secret_key)
        Uses default secret key
        """
        # Concatenate all arguments as strings
        sign_string = ''.join(str(arg) for arg in args)
        # Append secret key
        sign_string += self.secret_key
        # Generate MD5 hash
        return hashlib.md5(sign_string.encode('utf-8')).hexdigest()
    
    def generate_signature_with_key(self, secret_key, *args):
        """Generate signature with specific secret key
        
        Args:
            secret_key: Secret key to use for this signature
            *args: Arguments to include in signature
        """
        # Concatenate all arguments as strings
        sign_string = ''.join(str(arg) for arg in args)
        # Append secret key
        sign_string += secret_key
        # Generate MD5 hash
        return hashlib.md5(sign_string.encode('utf-8')).hexdigest()
    
    def create_invoice(self, service_id, amount, phone_number, merchant_trans_id):
        """Create invoice (sчет-фактура) via Click API"""
        url = f"{self.api_url}/invoice/create"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Auth': self.generate_auth_header()
        }
        
        # Ensure service_id is a valid integer string
        # Use provided service_id or fallback to self.service_id
        service_id_to_use = service_id if service_id else self.service_id
        
        try:
            # Convert to string, strip whitespace, then to int
            service_id_str = str(service_id_to_use).strip()
            if not service_id_str:
                logger.error(f"service_id is empty - provided: {service_id}, self.service_id: {self.service_id}")
                return {
                    'error_code': -1,
                    'error_note': 'service_id is empty or invalid',
                    'invoice_id': None,
                    'invoice_url': None
                }
            service_id_int = int(service_id_str)
        except (ValueError, TypeError) as e:
            logger.error(f"Invalid service_id: {service_id_to_use} (type: {type(service_id_to_use)}), error: {e}")
            return {
                'error_code': -1,
                'error_note': f'Invalid service_id: {service_id_to_use}',
                'invoice_id': None,
                'invoice_url': None
            }
        
        # Ensure phone_number is in correct format (998XXXXXXXXX) and not empty
        if not phone_number or phone_number.strip() == '':
            logger.error(f"Phone number is empty - cannot create invoice")
            return {
                'error_code': -1,
                'error_note': 'Phone number is required for invoice creation',
                'invoice_id': None,
                'invoice_url': None
            }
        
        # Phone number should be in format 998XXXXXXXXX (12 digits total)
        phone_str = str(phone_number).strip()
        phone_digits = ''.join(filter(str.isdigit, phone_str))
        
        if not phone_digits or len(phone_digits) < 9:
            logger.error(f"Invalid phone number format: {phone_number}")
            return {
                'error_code': -1,
                'error_note': f'Invalid phone number format: {phone_number}. Phone number must be in format 998XXXXXXXXX',
                'invoice_id': None,
                'invoice_url': None
            }
        
        # Ensure phone number is in 998XXXXXXXXX format
        if phone_digits.startswith('998') and len(phone_digits) == 12:
            formatted_phone = phone_digits
        elif phone_digits.startswith('9') and len(phone_digits) == 9:
            formatted_phone = '998' + phone_digits
        elif len(phone_digits) >= 9:
            formatted_phone = '998' + phone_digits[-9:]  # Take last 9 digits
        else:
            logger.error(f"Cannot format phone number: {phone_number}")
            return {
                'error_code': -1,
                'error_note': f'Cannot format phone number: {phone_number}',
                'invoice_id': None,
                'invoice_url': None
            }
        
        data = {
            'service_id': service_id_int,
            'amount': float(amount),
            'phone_number': formatted_phone,
            'merchant_trans_id': str(merchant_trans_id)
        }
        
        logger.info(f"Creating invoice with formatted phone number: {formatted_phone} (original: {phone_number})")
        
        logger.info(f"Creating invoice via Click API: URL={url}, Data={data}")
        
        try:
            response = requests.post(url, json=data, headers=headers, timeout=_click_timeout())
            logger.info(f"Click API response status: {response.status_code}, content: {response.text[:500]}")
            
            # Try to parse JSON response
            try:
                result = response.json()
            except ValueError:
                # If response is not JSON, return error
                logger.error(f"Click API returned non-JSON response: {response.text}")
                return {
                    'error_code': -1,
                    'error_note': f'Invalid response from Click API: {response.text[:200]}',
                    'invoice_id': None,
                    'invoice_url': None
                }
            
            # Check response status code
            if response.status_code != 200:
                error_code = result.get('error_code') or result.get('error') or -1
                error_note = result.get('error_note') or result.get('error') or f'HTTP {response.status_code}'
                logger.error(f"Click API error: {error_code} - {error_note}")
                return {
                    'error_code': error_code,
                    'error_note': error_note,
                    'invoice_id': None,
                    'invoice_url': None
                }
            
            # Check if result has error
            if 'error_code' in result and result.get('error_code') != 0:
                error_code = result.get('error_code', -1)
                error_note = result.get('error_note') or result.get('error') or 'Unknown error'
                logger.error(f"Click API returned error: {error_code} - {error_note}")
                return {
                    'error_code': error_code,
                    'error_note': error_note,
                    'invoice_id': result.get('invoice_id'),
                    'invoice_url': None
                }
            
            logger.info(f"Invoice created successfully: {result}")
            return result
            
        except requests.exceptions.Timeout:
            logger.error("Click API request timeout")
            return {
                'error_code': -1,
                'error_note': 'Request timeout: Click API did not respond in time',
                'invoice_id': None,
                'invoice_url': None
            }
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Click API connection error: {str(e)}")
            return {
                'error_code': -1,
                'error_note': f'Connection error: Could not reach Click API - {str(e)}',
                'invoice_id': None,
                'invoice_url': None
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Click API request exception: {str(e)}")
            return {
                'error_code': -1,
                'error_note': f'Request failed: {str(e)}',
                'invoice_id': None,
                'invoice_url': None
            }
        except Exception as e:
            logger.error(f"Unexpected error creating invoice: {str(e)}", exc_info=True)
            return {
                'error_code': -9,
                'error_note': f'Unexpected error: {str(e)}',
                'invoice_id': None,
                'invoice_url': None
            }
    
    def check_invoice_status(self, service_id, invoice_id):
        """Check invoice status"""
        url = f"{self.api_url}/invoice/status/{service_id}/{invoice_id}"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Auth': self.generate_auth_header()
        }
        
        response = requests.get(url, headers=headers, timeout=_click_timeout())
        return response.json()
    
    def check_payment_status(self, service_id, payment_id):
        """Check payment status"""
        url = f"{self.api_url}/payment/status/{service_id}/{payment_id}"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Auth': self.generate_auth_header()
        }
        
        response = requests.get(url, headers=headers, timeout=_click_timeout())
        return response.json()
    
    def check_payment_status_by_mti(self, service_id, merchant_trans_id, date):
        """Check payment status by merchant_trans_id"""
        url = f"{self.api_url}/payment/status_by_mti/{service_id}/{merchant_trans_id}/{date}"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Auth': self.generate_auth_header()
        }
        
        response = requests.get(url, headers=headers, timeout=_click_timeout())
        return response.json()

    @staticmethod
    def _click_payment_is_paid(result):
        """Click Merchant API javobida to'lov tasdiqlanganini aniqlash."""
        if not isinstance(result, dict):
            return False
        error_code = result.get('error_code')
        if error_code is not None:
            try:
                if int(error_code) != 0:
                    return False
            except (TypeError, ValueError):
                return False
        payment_status = result.get('payment_status')
        if payment_status is not None:
            try:
                return int(payment_status) == 2
            except (TypeError, ValueError):
                pass
        status = result.get('status')
        if isinstance(status, str) and status.lower() in ('paid', 'confirmed', 'completed', 'success'):
            return True
        if isinstance(status, int) and status == 2:
            return True
        return False

    def sync_transaction_from_click(self, transaction):
        """Click API orqali to'lov holatini tekshirib, DB ni yangilash (callback kelmasa ham)."""
        from django.db import transaction as db_transaction

        if transaction.status == 'completed':
            return {
                'error_code': 0,
                'error_note': 'Already completed',
                'payment_status': 2,
                'synced': True,
            }

        service_id = str(getattr(transaction, 'click_service_id', None) or self.service_id).strip()
        merchant_trans_id = str(transaction.merchant_trans_id or transaction.id)
        click_result = None

        if transaction.click_paydoc_id:
            try:
                click_result = self.check_payment_status(service_id, transaction.click_paydoc_id)
            except Exception as e:
                logger.warning('Click check_payment_status failed: %s', e)

        if not self._click_payment_is_paid(click_result):
            created = transaction.created_at or timezone.now()
            dates_to_try = []
            for fmt in ('%Y-%m-%d', '%d.%m.%Y'):
                dates_to_try.append(timezone.localtime(created).strftime(fmt))
            seen = set()
            for date_str in dates_to_try:
                if date_str in seen:
                    continue
                seen.add(date_str)
                try:
                    candidate = self.check_payment_status_by_mti(
                        service_id, merchant_trans_id, date_str
                    )
                    click_result = candidate
                    if self._click_payment_is_paid(candidate):
                        break
                except Exception as e:
                    logger.warning('Click status_by_mti failed (%s): %s', date_str, e)

        if not self._click_payment_is_paid(click_result):
            note = (click_result or {}).get('error_note') or 'Payment not completed yet'
            ec = (click_result or {}).get('error_code', -1)
            return {
                'error_code': ec,
                'error_note': note,
                'payment_status': 0,
                'synced': False,
            }

        paydoc = (
            click_result.get('payment_id')
            or click_result.get('click_paydoc_id')
            or click_result.get('paydoc_id')
            or transaction.click_paydoc_id
        )
        click_trans = click_result.get('click_trans_id') or transaction.click_trans_id

        with db_transaction.atomic():
            locked = Transaction.objects.select_for_update().get(pk=transaction.pk)
            if locked.status != 'completed':
                locked.status = 'completed'
                locked.completed_at = timezone.now()
                if paydoc:
                    locked.click_paydoc_id = str(paydoc)
                if click_trans:
                    locked.click_trans_id = str(click_trans)
                locked.error_note = ''
                locked.save(
                    update_fields=[
                        'status',
                        'completed_at',
                        'click_paydoc_id',
                        'click_trans_id',
                        'error_note',
                    ]
                )
            transaction = locked

        _fulfill_after_payment(transaction)

        return {
            'error_code': 0,
            'error_note': 'Success',
            'payment_status': 2,
            'synced': True,
        }
    
    def reverse_payment(self, service_id, payment_id):
        """Reverse (cancel) payment"""
        url = f"{self.api_url}/payment/reversal/{service_id}/{payment_id}"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Auth': self.generate_auth_header()
        }
        
        response = requests.delete(url, headers=headers, timeout=_click_timeout())
        return response.json()
    
    def request_card_token(self, service_id, card_number, expire_date, temporary=1):
        """Request card token"""
        url = f"{self.api_url}/card_token/request"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        data = {
            'service_id': service_id,
            'card_number': card_number,
            'expire_date': expire_date,
            'temporary': temporary
        }
        
        response = requests.post(url, json=data, headers=headers, timeout=_click_timeout())
        return response.json()
    
    def verify_card_token(self, service_id, card_token, sms_code):
        """Verify card token"""
        url = f"{self.api_url}/card_token/verify"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Auth': self.generate_auth_header()
        }
        data = {
            'service_id': service_id,
            'card_token': card_token,
            'sms_code': sms_code
        }
        
        response = requests.post(url, json=data, headers=headers, timeout=_click_timeout())
        return response.json()
    
    def pay_with_card_token(self, service_id, card_token, amount, merchant_trans_id):
        """Pay with card token"""
        url = f"{self.api_url}/card_token/payment"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Auth': self.generate_auth_header()
        }
        data = {
            'service_id': service_id,
            'card_token': card_token,
            'amount': amount,
            'merchant_trans_id': merchant_trans_id
        }
        
        response = requests.post(url, json=data, headers=headers, timeout=_click_timeout())
        return response.json()
    
    def delete_card_token(self, service_id, card_token):
        """Delete card token"""
        url = f"{self.api_url}/card_token/{service_id}/{card_token}"
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Auth': self.generate_auth_header()
        }
        
        response = requests.delete(url, headers=headers, timeout=_click_timeout())
        return response.json()
