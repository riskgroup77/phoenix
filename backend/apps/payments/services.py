"""
Click Payment Integration Service

Barcha to'lovlar bitta Click service orqali (Ilmiyfaoliyat.uz — service_id 82154).
Callback URL'lar Click merchant panelda quyidagicha bo'lishi kerak:
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/
"""
from django.conf import settings
from .click_api import ClickMerchantApiMixin
from .click_callbacks import ClickCallbackMixin
from .click_checkout import ClickCheckoutUrlMixin
import logging

logger = logging.getLogger(__name__)


class ClickPaymentService(ClickCallbackMixin, ClickCheckoutUrlMixin, ClickMerchantApiMixin):
    """Service for Click payment integration"""
    
    def __init__(self):
        merchant_id_raw = settings.CLICK_MERCHANT_ID or '45730'
        service_id_raw = settings.CLICK_SERVICE_ID or '82154'
        secret_key_raw = (getattr(settings, 'CLICK_SECRET_KEY', None) or '').strip()
        merchant_user_id_raw = settings.CLICK_MERCHANT_USER_ID or '63536'

        self.merchant_id = str(merchant_id_raw).strip()
        self.service_id = str(service_id_raw).strip()
        self.secret_key = str(secret_key_raw).strip()
        self.merchant_user_id = str(merchant_user_id_raw).strip()
        self.api_url = "https://api.click.uz/v2/merchant"

        self.service_secret_keys = {
            k: v
            for k, v in {
                '82154': (getattr(settings, 'CLICK_SERVICE_82154_SECRET_KEY', '') or '').strip(),
                '82155': (getattr(settings, 'CLICK_SERVICE_82155_SECRET_KEY', '') or '').strip(),
                '89248': (getattr(settings, 'CLICK_SERVICE_89248_SECRET_KEY', '') or '').strip(),
                '88045': (getattr(settings, 'CLICK_SERVICE_88045_SECRET_KEY', '') or '').strip(),
            }.items()
            if v
        }

        if not self.secret_key:
            logger.error(
                "CLICK_SECRET_KEY is empty — set it in .env (Click merchant). Service-specific keys may still work."
            )
        
        # Validate that all required fields are set (non-empty after strip)
        if not self.service_id:
            logger.error("CLICK_SERVICE_ID is empty, using default: 82154")
            self.service_id = '82154'
        if not self.merchant_user_id:
            logger.error("CLICK_MERCHANT_USER_ID is empty, using default: 63536")
            self.merchant_user_id = '63536'
        if not self.merchant_id:
            logger.error("CLICK_MERCHANT_ID is empty, using default: 45730")
            self.merchant_id = '45730'
        
        logger.info(f"ClickPaymentService initialized - service_id: {self.service_id}, merchant_user_id: {self.merchant_user_id}, merchant_id: {self.merchant_id}")


# Eski import yo'llari (payme_service, testlar, buyruqlar) o'zgarmasin
from .click_api import _click_timeout  # noqa: E402,F401
from .click_callbacks import (  # noqa: E402,F401
    _click_amount_matches,
    _click_signature_ok,
    _find_transaction_by_merchant_trans_id,
)
from .fulfillment import _fulfill_after_payment  # noqa: E402,F401
from .click_checkout import _build_click_return_url  # noqa: E402,F401
