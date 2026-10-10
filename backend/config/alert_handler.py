"""
Telegram ogohlantirishlari (logging handler). Alohida modul: LOGGING sozlamasi uni Django ishga tushishidan
oldin yuklaydi — shuning uchun bu yerda DRF / modellar import qilinmaydi.
.env: TELEGRAM_BOT_TOKEN, PHONIX_ALERT_CHAT_ID.
"""
from __future__ import annotations

import hashlib
import logging
import threading

import requests
from django.conf import settings

DEDUP_SECONDS = 30 * 60


def _alert_config() -> tuple[str, str]:
    token = (getattr(settings, 'TELEGRAM_BOT_TOKEN', '') or '').strip()
    chat = (getattr(settings, 'PHONIX_ALERT_CHAT_ID', '') or '').strip()
    return token, chat


def send_alert(text: str, *, dedup_key: str | None = None) -> bool:
    """Telegram'ga ogohlantirish (sozlanmagan bo'lsa — hech narsa qilmaydi). True — yuborishga navbatlandi."""
    token, chat = _alert_config()
    if not token or not chat:
        return False
    if dedup_key:
        from django.core.cache import cache

        key = 'phoenix_alert:' + hashlib.sha1(dedup_key.encode('utf-8', 'ignore')).hexdigest()
        try:
            if not cache.add(key, 1, DEDUP_SECONDS):
                return False
        except Exception:
            pass

    def _send():
        try:
            requests.post(
                f'https://api.telegram.org/bot{token}/sendMessage',
                data={'chat_id': chat, 'text': text[:3900], 'disable_web_page_preview': 'true'},
                timeout=10,
            )
        except Exception:
            pass

    threading.Thread(target=_send, name='phoenix-alert', daemon=True).start()
    return True


class TelegramAlertHandler(logging.Handler):
    """ERROR darajadagi yozuvlarni Telegram'ga (takrorlanmasdan) yuboradi."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            if getattr(settings, 'DEBUG', False):
                return
            message = record.getMessage()
            where = ''
            request = getattr(record, 'request', None)
            if request is not None:
                where = f"{getattr(request, 'method', '')} {getattr(request, 'path', '')}"
            exc = ''
            if record.exc_info and record.exc_info[1] is not None:
                exc = f'{type(record.exc_info[1]).__name__}: {record.exc_info[1]}'
            head = '🔴 Phoenix server xatosi' if record.name.startswith('django') else '🟠 Phoenix brauzer xatosi'
            text = '\n'.join(p for p in (head, where, exc or message[:500]) if p)
            # Takrorlanish kaliti: joy + xato turi (har bir foydalanuvchi uchun alohida xabar bo'lmasin)
            send_alert(text, dedup_key=f'{record.name}|{where}|{exc[:200] or message[:200]}')
        except Exception:
            pass
