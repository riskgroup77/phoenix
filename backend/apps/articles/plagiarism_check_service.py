"""Antiplagiat tekshiruvi — to'lovdan keyin avtomatik va API orqali."""
from __future__ import annotations

import logging
import os

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def resolve_article_document_path(article) -> str | None:
    """Maqola fayl yo'lini topadi (final_pdf_path)."""
    if not getattr(article, 'final_pdf_path', None):
        return None
    try:
        if hasattr(article.final_pdf_path, 'path'):
            path = article.final_pdf_path.path
            if path and os.path.isfile(path):
                return path
    except Exception:
        pass
    rel = str(article.final_pdf_path).lstrip('/')
    path = os.path.join(settings.MEDIA_ROOT, rel)
    if os.path.isfile(path):
        return path
    return None


def extract_article_text(article) -> str:
    from apps.services import get_gemini_service

    gemini = get_gemini_service()
    file_path = resolve_article_document_path(article)
    if file_path:
        text = gemini.extract_text_from_document(file_path)
        if text and len(text.strip()) >= 50:
            return text.strip()
    fallback = (article.abstract or '') + '\n' + (article.title or '')
    return fallback.strip()


def run_plagiarism_check(article, user, *, force: bool = False) -> dict:
    """
    Maqola uchun to'liq antiplagiat tekshiruvi.
    force=False bo'lsa, avval tekshirilgan bo'lsa mavjud natijani qaytaradi.
    """
    from apps.articles.models import ActivityLog
    from apps.services import get_gemini_service

    if (
        not force
        and article.plagiarism_checked_at
        and article.plagiarism_percentage is not None
    ):
        report = article.plagiarism_report or {}
        return {
            'plagiarism': float(article.plagiarism_percentage or 0),
            'ai_content': float(article.ai_content_percentage or 0),
            'originality': float(article.originality_percentage or 0),
            'checked_at': article.plagiarism_checked_at,
            'report': report,
            'sources': report.get('sources', []) if isinstance(report, dict) else [],
            'cached': True,
        }

    text_content = extract_article_text(article)
    if not text_content or len(text_content.strip()) < 50:
        raise ValueError(
            'Plagiat tekshiruvi uchun hujjat matni yetarli emas. DOCX yoki PDF faylni qayta yuklang.'
        )

    gemini_service = get_gemini_service()
    if not (getattr(gemini_service, 'api_key', None) or '').strip():
        raise RuntimeError(
            'AI antiplagiat kaliti (GEMINI_API_KEY / ANTIPLAGIAT_CLOUD_TOKEN) serverda sozlanmagan.'
        )

    result = gemini_service.check_plagiarism_full(text_content)
    plagiarism_percentage = float(result.get('plagiarism_percentage', 0))
    ai_content_percentage = float(result.get('ai_content_percentage', 0))
    originality = float(result.get('originality', max(0, 100 - plagiarism_percentage)))
    report = result.get('report', {}) or {}

    article.plagiarism_percentage = plagiarism_percentage
    article.ai_content_percentage = ai_content_percentage
    article.originality_percentage = originality
    article.plagiarism_checked_at = timezone.now()
    article.plagiarism_report = report
    update_fields = [
        'plagiarism_percentage',
        'ai_content_percentage',
        'originality_percentage',
        'plagiarism_checked_at',
        'plagiarism_report',
    ]
    if article.status == 'PaymentCompleted':
        article.status = 'Accepted'
        update_fields.append('status')
    article.save(update_fields=update_fields)

    ActivityLog.objects.create(
        article=article,
        user=user,
        action='Plagiarism check completed',
        details=(
            f'Plagiarism: {plagiarism_percentage}%, '
            f'AI Content: {ai_content_percentage}%, Originality: {originality}%'
        ),
    )

    return {
        'plagiarism': plagiarism_percentage,
        'ai_content': ai_content_percentage,
        'originality': originality,
        'checked_at': article.plagiarism_checked_at,
        'report': report,
        'sources': result.get('sources', report.get('sources', [])),
        'cached': False,
    }


def run_auto_plagiarism_check(article_id, user_id) -> None:
    """To'lov tasdiqlangach fon rejimida chaqiriladi."""
    from django.contrib.auth import get_user_model

    from apps.articles.models import Article

    User = get_user_model()
    try:
        article = Article.objects.get(pk=article_id)
        user = User.objects.get(pk=user_id)
    except (Article.DoesNotExist, User.DoesNotExist):
        logger.warning('auto plagiarism: article %s or user %s not found', article_id, user_id)
        return

    try:
        run_plagiarism_check(article, user, force=True)
        logger.info('auto plagiarism completed for article %s', article_id)
        try:
            from apps.notifications.models import Notification

            Notification.notify(
                user=user,
                title='Antiplagiat tekshiruvi tayyor',
                message=(
                    f'"{(article.title or "")[:80]}" — AI antiplagiat tekshiruvi yakunlandi. '
                    'Natijalarni Xizmatlar markazidagi sahifadan ko\'ring.'
                ),
                notification_type='plagiarism',
                link='/plagiarism-check',
                metadata={'article_id': str(article.id)},
            )
        except Exception as notify_err:
            logger.warning('auto plagiarism notify failed: %s', notify_err)
    except Exception as exc:
        logger.error('auto plagiarism failed for article %s: %s', article_id, exc, exc_info=True)
