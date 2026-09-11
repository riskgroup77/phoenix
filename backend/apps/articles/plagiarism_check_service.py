"""Antiplagiat tekshiruvi — chuqur modul-modul skaner (antiplagiat.uz uslubi, ~10+ daqiqa)."""
from __future__ import annotations

import logging
import os
from datetime import datetime

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
    from apps.services import extract_plain_text_from_file

    file_path = resolve_article_document_path(article)
    if file_path:
        text = extract_plain_text_from_file(file_path)
        if text and len(text.strip()) >= 50:
            return text.strip()
    fallback = (article.abstract or '') + '\n' + (article.title or '')
    return fallback.strip()


def _resolve_enabled_modules(article, enabled_modules: list[str] | None) -> list[str] | None:
    if enabled_modules:
        return enabled_modules
    report = article.plagiarism_report or {}
    if isinstance(report, dict):
        pending = report.get('pending_enabled_modules')
        if isinstance(pending, list) and pending:
            return pending
    return None


def _save_check_progress(article_id, **fields) -> None:
    """Tekshiruv jarayonini plagiarism_report ichida saqlash (frontend polling uchun)."""
    from apps.articles.models import Article

    try:
        article = Article.objects.get(pk=article_id)
    except Article.DoesNotExist:
        return
    report = dict(article.plagiarism_report or {})
    report.update(fields)
    report['check_updated_at'] = timezone.now().isoformat()
    Article.objects.filter(pk=article_id).update(plagiarism_report=report)


def mark_plagiarism_processing(article, enabled_modules: list[str] | None = None) -> None:
    from apps.articles.antiplagiat_modules import MODULE_CATALOG

    modules = _resolve_enabled_modules(article, enabled_modules) or []
    total = len(modules) if modules else len(MODULE_CATALOG)
    report = dict(article.plagiarism_report or {})
    report.update({
        'check_status': 'processing',
        'progress_percent': 0,
        'modules_total': total,
        'modules_completed': 0,
        'current_module_id': '',
        'current_module_label': 'Tekshiruv tayyorlanmoqda...',
        'sources_found': 0,
        'check_phase': 'starting',
        'check_started_at': timezone.now().isoformat(),
        'check_error': '',
    })
    if enabled_modules:
        report['pending_enabled_modules'] = enabled_modules
    article.plagiarism_report = report
    article.save(update_fields=['plagiarism_report'])


def get_plagiarism_check_status(article) -> dict:
    report = article.plagiarism_report if isinstance(article.plagiarism_report, dict) else {}
    return {
        'status': report.get('check_status', 'idle'),
        'progress_percent': float(report.get('progress_percent', 0) or 0),
        'modules_total': int(report.get('modules_total', 0) or 0),
        'modules_completed': int(report.get('modules_completed', 0) or 0),
        'current_module_label': report.get('current_module_label', ''),
        'current_module_id': report.get('current_module_id', ''),
        'sources_found': int(report.get('sources_found', 0) or 0),
        'check_phase': report.get('check_phase', ''),
        'check_started_at': report.get('check_started_at'),
        'check_error': report.get('check_error', ''),
        'plagiarism_checked_at': article.plagiarism_checked_at,
        'plagiarism_percentage': article.plagiarism_percentage,
    }


def run_plagiarism_check(
    article,
    user,
    *,
    force: bool = False,
    enabled_modules: list[str] | None = None,
) -> dict:
    """
    Maqola uchun to'liq chuqur antiplagiat tekshiruvi.
    Har bir modul alohida skanerlanadi; jarayon kamida ~10 daqiqa davom etadi.
    """
    from apps.articles.models import ActivityLog, Article
    from apps.articles.antiplagiat_engine import get_antiplagiat_engine

    article_id = str(article.id)
    report = article.plagiarism_report if isinstance(article.plagiarism_report, dict) else {}

    if report.get('check_status') == 'processing' and not force:
        return {
            'status': 'processing',
            'cached': False,
            **get_plagiarism_check_status(article),
        }

    if (
        not force
        and article.plagiarism_checked_at
        and article.plagiarism_percentage is not None
        and report.get('check_status') != 'failed'
    ):
        return {
            'plagiarism': float(article.plagiarism_percentage or 0),
            'ai_content': float(article.ai_content_percentage or 0),
            'originality': float(article.originality_percentage or 0),
            'checked_at': article.plagiarism_checked_at,
            'report': report,
            'sources': report.get('sources', []) if isinstance(report, dict) else [],
            'cached': True,
            'status': 'completed',
        }

    resolved_modules = _resolve_enabled_modules(article, enabled_modules)
    mark_plagiarism_processing(article, resolved_modules)

    def on_progress(**kwargs) -> None:
        _save_check_progress(
            article_id,
            check_status='processing',
            progress_percent=kwargs.get('progress_percent', 0),
            modules_total=kwargs.get('modules_total', 0),
            modules_completed=kwargs.get('modules_completed', 0),
            current_module_id=kwargs.get('module_id', ''),
            current_module_label=kwargs.get('module_label', ''),
            sources_found=kwargs.get('sources_found', 0),
            check_phase=kwargs.get('phase', 'scanning'),
        )

    try:
        engine = get_antiplagiat_engine()
        file_path = resolve_article_document_path(article)
        if file_path:
            result = engine.check_file(
                file_path,
                exclude_article_id=article_id,
                enabled_modules=resolved_modules,
                progress_callback=on_progress,
                deep=True,
            )
        else:
            text_content = extract_article_text(article)
            if not text_content or len(text_content.strip()) < 50:
                raise ValueError(
                    'Plagiat tekshiruvi uchun hujjat matni yetarli emas. DOCX yoki PDF faylni qayta yuklang.'
                )
            result = engine.check_text(
                text_content,
                exclude_article_id=article_id,
                enabled_modules=resolved_modules,
                progress_callback=on_progress,
                deep=True,
            )

        plagiarism_percentage = float(result.get('plagiarism_percentage', 0))
        ai_content_percentage = float(result.get('ai_content_percentage', 0))
        originality = float(result.get('originality', max(0, 100 - plagiarism_percentage)))
        result_report = dict(result.get('report', {}) or {})
        existing = article.plagiarism_report if isinstance(article.plagiarism_report, dict) else {}
        for key in (
            'document_type',
            'document_name',
            'author_first_name',
            'author_last_name',
            'pending_enabled_modules',
        ):
            if existing.get(key) and not result_report.get(key):
                result_report[key] = existing[key]
        if not result_report.get('certificate_number'):
            result_report['certificate_number'] = timezone.now().strftime('%y%m%d%H%M%S')[-10:]
        result_report['archive_ready'] = True
        result_report['check_status'] = 'completed'
        result_report['progress_percent'] = 100
        result_report['check_completed_at'] = timezone.now().isoformat()
        result_report['check_phase'] = 'done'

        article = Article.objects.get(pk=article_id)
        article.plagiarism_percentage = plagiarism_percentage
        article.ai_content_percentage = ai_content_percentage
        article.originality_percentage = originality
        article.plagiarism_checked_at = timezone.now()
        article.plagiarism_report = result_report
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
                f'Originality: {originality}% (deep module scan, {result_report.get("sources_count", 0)} sources)'
            ),
        )

        return {
            'plagiarism': plagiarism_percentage,
            'ai_content': ai_content_percentage,
            'originality': originality,
            'checked_at': article.plagiarism_checked_at,
            'report': result_report,
            'sources': result.get('sources', result_report.get('sources', [])),
            'cached': False,
            'status': 'completed',
        }
    except Exception as exc:
        logger.error('plagiarism check failed for %s: %s', article_id, exc, exc_info=True)
        _save_check_progress(
            article_id,
            check_status='failed',
            check_error=str(exc),
            check_phase='error',
        )
        raise


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
        article.refresh_from_db()
        logger.info('auto plagiarism completed for article %s', article_id)
        try:
            from apps.notifications.models import Notification

            stored_report = article.plagiarism_report if isinstance(article.plagiarism_report, dict) else {}
            doc_label = (stored_report.get('document_name') or article.title or '')[:80]
            Notification.notify(
                user=user,
                title='Antiplagiat tekshiruvi tayyor',
                message=(
                    f'"{doc_label}" — antiplagiat tekshiruvi yakunlandi. '
                    'Sertifikat va to\'liq hisobot «Arxiv hujjatlar» bo\'limida.'
                ),
                notification_type='plagiarism',
                link=f'/plagiarism-check/result/{article.id}',
                metadata={'article_id': str(article.id)},
            )
        except Exception as notify_err:
            logger.warning('auto plagiarism notify failed: %s', notify_err)
    except Exception as exc:
        logger.error('auto plagiarism failed for article %s: %s', article_id, exc, exc_info=True)
