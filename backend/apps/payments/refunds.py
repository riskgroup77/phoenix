"""
Click orqali to'lovni avtomatik qaytarish (Merchant API: DELETE /payment/reversal/:service_id/:payment_id).

Hujjat (docs.click.uz/en/merchant-api/requests): Auth = merchant_user_id:sha1(timestamp + secret_key):timestamp.
Shartlar: to'lov muvaffaqiyatli bo'lishi; faqat joriy hisobot oyidagi to'lov (o'tgan oyniki — faqat oyning
1-kunida); onlayn karta bilan qilingan bo'lishi; UZCARD rad etishi mumkin. Shuning uchun Click rad etsa,
moliyachi pulni avvalgidek kabinetda qo'lda qaytarib, "qaytarildi" deb belgilaydi.
"""
from __future__ import annotations

import hashlib
import logging
import time

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

CLICK_API_URL = 'https://api.click.uz/v2/merchant'


class ClickRefundError(Exception):
    """Click qaytarishni bajarmadi — sababi foydalanuvchiga ko'rsatiladi."""


def _service_credentials(service_id: str) -> tuple[str, str]:
    """Xizmat (service_id) uchun merchant_user_id va secret_key; xizmatga xos bo'lmasa — umumiy."""
    sid = str(service_id).strip()
    user_id = getattr(settings, f'CLICK_SERVICE_{sid}_MERCHANT_USER_ID', '') or getattr(settings, 'CLICK_MERCHANT_USER_ID', '')
    secret = getattr(settings, f'CLICK_SERVICE_{sid}_SECRET_KEY', '') or getattr(settings, 'CLICK_SECRET_KEY', '')
    return str(user_id or '').strip(), str(secret or '').strip()


def _auth_header(merchant_user_id: str, secret_key: str, now: float | None = None) -> str:
    timestamp = str(int(now if now is not None else time.time()))
    digest = hashlib.sha1((timestamp + secret_key).encode('utf-8')).hexdigest()
    return f'{merchant_user_id}:{digest}:{timestamp}'


def _request(method: str, path: str, service_id: str) -> dict:
    user_id, secret = _service_credentials(service_id)
    if not user_id or not secret:
        raise ClickRefundError("Click merchant ma'lumotlari (merchant_user_id / secret_key) sozlanmagan.")
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Auth': _auth_header(user_id, secret),
    }
    timeout = int(getattr(settings, 'CLICK_HTTP_TIMEOUT_SEC', 45) or 45)
    try:
        response = requests.request(method, f'{CLICK_API_URL}{path}', headers=headers, timeout=timeout)
        data = response.json()
    except requests.RequestException as exc:
        raise ClickRefundError(f"Click bilan bog'lanib bo'lmadi: {exc}") from exc
    except ValueError as exc:
        raise ClickRefundError("Click noto'g'ri javob qaytardi.") from exc
    return data if isinstance(data, dict) else {}


def click_refund_available(tx) -> bool:
    return tx.status == 'completed' and (tx.payment_provider == 'click' or bool(tx.click_trans_id or tx.click_paydoc_id))


def _resolve_payment_id(tx, service_id: str) -> str:
    """
    Click'dagi payment_id: avval merchant_trans_id (bizning tranzaksiya) va to'lov sanasi bo'yicha Click'dan
    so'raladi (status_by_mti) — Shop API callback'idagi qaysi ID mos kelishiga taxmin qilinmaydi.
    """
    merchant_trans_id = str(tx.merchant_trans_id or tx.id)
    paid_at = timezone.localtime(tx.completed_at or tx.created_at)
    try:
        found = _request('GET', f'/payment/status_by_mti/{service_id}/{merchant_trans_id}/{paid_at:%Y-%m-%d}', service_id)
        if int(found.get('error_code', -1)) == 0 and found.get('payment_id'):
            return str(found['payment_id'])
    except (ClickRefundError, TypeError, ValueError) as exc:
        logger.warning('Click status_by_mti for refund %s failed: %s', tx.pk, exc)
    if tx.click_paydoc_id:
        return str(tx.click_paydoc_id)
    raise ClickRefundError("Click'dagi to'lov raqami (payment_id) topilmadi.")


def reverse_click_payment(tx) -> dict:
    """To'lovni Click orqali qaytaradi. Muvaffaqiyatsiz bo'lsa ClickRefundError (Click sababi bilan)."""
    if not click_refund_available(tx):
        raise ClickRefundError("Bu to'lov Click orqali qilinmagan yoki yakunlanmagan.")
    service_id = str(tx.click_service_id or getattr(settings, 'CLICK_SERVICE_ID', '') or '').strip()
    if not service_id:
        raise ClickRefundError('Click service_id aniqlanmadi.')
    payment_id = _resolve_payment_id(tx, service_id)
    result = _request('DELETE', f'/payment/reversal/{service_id}/{payment_id}', service_id)
    try:
        ok = int(result.get('error_code', -1)) == 0
    except (TypeError, ValueError):
        ok = False
    if not ok:
        note = result.get('error_note') or f"xato kodi {result.get('error_code')}"
        logger.warning('Click reversal rejected tx=%s payment_id=%s: %s', tx.pk, payment_id, result)
        raise ClickRefundError(f'Click qaytarishni rad etdi: {note}')
    logger.info('Click reversal ok tx=%s payment_id=%s', tx.pk, payment_id)
    return {'payment_id': payment_id, 'response': result}
