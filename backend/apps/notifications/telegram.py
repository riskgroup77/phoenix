"""
Bildirishnomalarni Telegram botga yuborish.

Foydalanuvchi botga kirgan bo'lsa (users.TelegramSession), saytdagi har bir bildirishnoma
(maqola holati, to'lov, antiplagiat natijasi...) botga ham xabar sifatida boradi.
Profil sozlamasi: User.telegram_notifications.

Yuborish so'rovni sekinlashtirmasligi uchun tranzaksiya tugagach fon oqimida bajariladi.
TELEGRAM_BOT_TOKEN bo'sh bo'lsa (masalan testlarda) hech narsa yuborilmaydi.
"""
from __future__ import annotations

import html
import json
import logging
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from django.conf import settings
from django.db import close_old_connections, transaction

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix='tg-notify')

TYPE_ICONS = {
    'status_change': '📄',
    'article': '📄',
    'payment': '💳',
    'plagiarism': '🔍',
    'review_assigned': '📝',
    'review_completed': '✅',
    'system': '🔔',
}


def _bot_token() -> str:
    return (getattr(settings, 'TELEGRAM_BOT_TOKEN', '') or '').strip()


def telegram_enabled() -> bool:
    return bool(_bot_token())


def build_site_url(link: str) -> str:
    """Bildirishnoma havolasi (/articles/<id>) → to'liq sayt manzili (HashRouter)."""
    base = (getattr(settings, 'FRONTEND_BASE_URL', '') or '').rstrip('/')
    if not base or not link:
        return ''
    if link.startswith('http://') or link.startswith('https://'):
        return link
    path = link if link.startswith('/') else f'/{link}'
    return f'{base}/#{path}'


def format_message(title: str, message: str, notification_type: str = 'system') -> str:
    icon = TYPE_ICONS.get(notification_type, '🔔')
    title_html = html.escape((title or 'Bildirishnoma').strip())[:200]
    body_html = html.escape((message or '').strip())[:3500]
    return f'{icon} <b>{title_html}</b>\n\n{body_html}'


def send_telegram_message(chat_id: int, text: str, url: str = '') -> bool:
    token = _bot_token()
    if not token:
        return False
    payload = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML',
        'disable_web_page_preview': True,
    }
    # Telegram inline tugmasi faqat https havolani qabul qiladi (localhost emas)
    if url and url.startswith('https://'):
        payload['reply_markup'] = {'inline_keyboard': [[{'text': 'Saytda ochish', 'url': url}]]}
    req = urllib.request.Request(
        f'https://api.telegram.org/bot{token}/sendMessage',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as exc:
        # 403: foydalanuvchi botni bloklagan; 400: chat topilmadi — xatoni yozib, davom etamiz
        logger.info('Telegram sendMessage %s for chat %s', exc.code, chat_id)
    except Exception as exc:  # tarmoq xatosi saytni to'xtatmasin
        logger.warning('Telegram sendMessage failed for chat %s: %s', chat_id, exc)
    return False


def deliver_notification(notification_id) -> int:
    """Bitta bildirishnomani foydalanuvchining barcha bot sessiyalariga yuboradi. Yuborilganlar soni."""
    from apps.notifications.models import Notification
    from apps.users.models import TelegramSession

    close_old_connections()
    try:
        notif = Notification.objects.select_related('user').filter(pk=notification_id).first()
        if not notif or not getattr(notif.user, 'telegram_notifications', True):
            return 0
        chat_ids = list(
            TelegramSession.objects.filter(user_id=notif.user_id).values_list('telegram_id', flat=True)
        )
        if not chat_ids:
            return 0
        text = format_message(notif.title, notif.message, notif.notification_type)
        url = build_site_url(notif.link)
        return sum(1 for chat_id in chat_ids if send_telegram_message(chat_id, text, url))
    finally:
        close_old_connections()


def schedule_delivery(notification_id) -> None:
    """Tranzaksiya muvaffaqiyatli tugagach fon oqimida yuborish."""
    if not telegram_enabled():
        return

    def _submit():
        if getattr(settings, 'TELEGRAM_NOTIFY_SYNC', False):
            deliver_notification(notification_id)
        else:
            _executor.submit(deliver_notification, notification_id)

    transaction.on_commit(_submit)
