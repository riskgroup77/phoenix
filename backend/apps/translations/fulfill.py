"""To'lovdan (yoki bepul buyurtma yaratilgandan) keyin tarjimani ishga tushirish."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def start_translation_work(request) -> None:
    """AI turlari — avtomatik tarjima; puxta — tarjimonlarga xabar."""
    from .ai_translate import start_ai_translation
    from .notify import notify_new_expert_order

    if request.status != 'Yangi':
        return
    if request.is_ai and not request.ai_error:
        start_ai_translation(request)
    else:
        notify_new_expert_order(request)


def fulfill_translation(transaction):
    if getattr(transaction, 'service_type', None) != 'translation' or getattr(transaction, 'status', None) != 'completed':
        return
    request = getattr(transaction, 'translation_request', None)
    if request is None:
        logger.warning('translation fulfill: buyurtma topilmadi tx=%s', transaction.pk)
        return
    request.refresh_from_db()
    start_translation_work(request)
