"""Tarjima buyurtmalari bo'yicha bildirishnomalar."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def _notify(user, title, message, request, kind='system'):
    from apps.notifications.models import Notification

    try:
        Notification.notify(user=user, title=title, message=message, notification_type=kind,
                            link=f'/translations/{request.id}', metadata={'translation_id': str(request.id)})
    except Exception:
        logger.warning('Tarjima bildirishnomasi yuborilmadi %s', request.pk, exc_info=True)


def notify_translators(request, title, message):
    from django.contrib.auth import get_user_model

    for user in get_user_model().objects.filter(role='translator', is_active=True):
        _notify(user, title, message, request)


def notify_ai_done(request):
    _notify(request.author, 'Tarjima tayyor',
            f'"{request.title}" tarjimasi tayyor. Faylni «Tarjimalarim» bo\'limidan yuklab oling.', request)


def notify_ai_failed(request):
    _notify(request.author, 'Tarjima tarjimonga topshirildi',
            f'"{request.title}" ni AI tarjima qila olmadi — buyurtmani tarjimon bajaradi. Qo\'shimcha to\'lov yo\'q.',
            request)
    notify_translators(request, 'Yangi tarjima buyurtmasi',
                       f'"{request.title}" — AI tarjima bajarilmadi ({request.ai_error}). Qo\'lda tarjima kerak.')


def notify_new_expert_order(request):
    notify_translators(request, 'Yangi tarjima buyurtmasi',
                       f'"{request.title}" ({request.source_language} → {request.target_language}, '
                       f'{request.word_count} so\'z) — puxta tarjima. «Tarjima navbati»dan ishga oling.')
