"""
Bepul monitoring: server xatolari (500) va brauzer xatolari Telegram'ga ogohlantirish sifatida.

- TelegramAlertHandler — logging handler (django.request ERROR va phoenix.client loggerlari):
  bir xil xato 30 daqiqada bir martadan ko'p yuborilmaydi (cache), yuborish fon oqimida.
- client_error — frontend (window.onerror / unhandledrejection) xatolarini qabul qiladi va logga yozadi.

.env: TELEGRAM_BOT_TOKEN, PHONIX_ALERT_CHAT_ID (xabar boradigan chat yoki guruh ID).
Sentry (SENTRY_DSN / VITE_SENTRY_DSN) berilsa — u ham parallel ishlaydi.
"""
from __future__ import annotations

import json
import logging

from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from config.alert_handler import TelegramAlertHandler, send_alert  # noqa: F401  (qayta eksport)

client_logger = logging.getLogger('phoenix.client')


class _ClientErrorThrottle(AnonRateThrottle):
    rate = '30/minute'


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([_ClientErrorThrottle])
def client_error(request):
    """Brauzerdagi JavaScript xatolari (frontend utils/monitoring.ts yuboradi)."""
    data = request.data if isinstance(request.data, dict) else {}

    def clip(key: str, n: int) -> str:
        return str(data.get(key) or '')[:n]

    entry = {
        'message': clip('message', 500),
        'stack': clip('stack', 2000),
        'url': clip('url', 300),
        'source': clip('source', 300),
        'release': clip('release', 60),
        'ua': (request.META.get('HTTP_USER_AGENT') or '')[:200],
    }
    if entry['message']:
        client_logger.error('client error: %s at %s', entry['message'], entry['url'] or entry['source'],
                            extra={'client': json.dumps(entry, ensure_ascii=False)})
    return Response(status=204)
