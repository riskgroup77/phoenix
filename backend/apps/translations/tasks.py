"""Celery vazifasi — AI tarjima (oddiy / o'rta)."""
from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0)
def run_ai_translation_task(self, request_id: str) -> str:
    from .ai_translate import run_ai_translation

    return run_ai_translation(request_id)


def enqueue_ai_translation(request_id: str) -> bool:
    """Celery navbatiga qo'yish; worker yo'q bo'lsa False (thread fallback)."""
    from apps.articles.tasks import celery_workers_available

    if not celery_workers_available():
        logger.warning('Celery worker javob bermadi — AI tarjima thread rejimida')
        return False
    try:
        run_ai_translation_task.delay(request_id)
        return True
    except Exception as exc:
        logger.warning("AI tarjimani navbatga qo'yib bo'lmadi: %s", exc)
        return False
