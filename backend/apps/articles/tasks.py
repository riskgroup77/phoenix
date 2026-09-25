"""Celery vazifalari — antiplagiat tekshiruvi."""
from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=1, default_retry_delay=60)
def run_plagiarism_check_task(
    self,
    article_id: str,
    user_id: str,
    enabled_modules: list[str] | None = None,
    force: bool = True,
) -> dict:
    from django.contrib.auth import get_user_model

    from apps.articles.models import Article
    from apps.articles.plagiarism_check_service import run_plagiarism_check

    User = get_user_model()
    try:
        article = Article.objects.get(pk=article_id)
        user = User.objects.get(pk=user_id)
    except (Article.DoesNotExist, User.DoesNotExist):
        logger.warning('plagiarism task: article=%s user=%s topilmadi', article_id, user_id)
        return {'status': 'not_found'}

    try:
        return run_plagiarism_check(
            article,
            user,
            force=force,
            enabled_modules=enabled_modules,
        )
    except Exception as exc:
        logger.error('plagiarism task failed %s: %s', article_id, exc, exc_info=True)
        raise self.retry(exc=exc) from exc


def enqueue_plagiarism_check(
    article_id: str,
    user_id: str,
    *,
    enabled_modules: list[str] | None = None,
    force: bool = True,
) -> bool:
    """
    Celery navbatiga qo'yish. Muvaffaqiyatsiz bo'lsa False (thread fallback uchun).
    """
    from django.conf import settings

    if not getattr(settings, 'ANTIPLAG_USE_CELERY', True):
        return False
    try:
        run_plagiarism_check_task.delay(
            str(article_id),
            str(user_id),
            enabled_modules,
            force,
        )
        return True
    except Exception as exc:
        logger.warning('Celery plagiat navbatiga qo\'yib bo\'lmadi (thread fallback): %s', exc)
        return False
