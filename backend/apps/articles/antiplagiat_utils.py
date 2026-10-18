"""Mustaqil antiplagiat tekshiruvi maqolalarini aniqlash (arxiv, maqolalar ro'yxati)."""
from __future__ import annotations


def _normalize_keywords(keywords) -> list[str]:
    if not keywords:
        return []
    if isinstance(keywords, str):
        return [k.strip() for k in keywords.split(',') if k.strip()]
    return [str(k).strip() for k in keywords if str(k).strip()]


def looks_like_standalone_antiplagiat(article) -> bool:
    """Bazaga murojaatsiz tezkor tekshiruv (ro'yxat serializerlari uchun): sarlavha, kalit so'z, izoh, hisobot belgisi."""
    title = (getattr(article, 'title', None) or '').strip().lower()
    if title.startswith('plagiarism check'):
        return True
    if 'plagiarism' in [k.lower() for k in _normalize_keywords(getattr(article, 'keywords', None))]:
        return True
    abstract = (getattr(article, 'abstract', '') or '').lower()
    if 'tekshiruv uchun yuborilgan' in abstract or 'hujjat turi:' in abstract:
        return True
    report = getattr(article, 'plagiarism_report', None) or {}
    return isinstance(report, dict) and bool(report.get('is_standalone'))


def standalone_antiplagiat_state(article) -> str | None:
    """
    Mustaqil antiplagiat hujjatining holati ("Ishlarim" uchun): awaiting_payment / checking / failed / done.
    Oddiy maqola bo'lsa — None.
    """
    if not looks_like_standalone_antiplagiat(article):
        return None
    report = getattr(article, 'plagiarism_report', None) or {}
    check_status = report.get('check_status') if isinstance(report, dict) else None
    if check_status == 'failed':
        return 'failed'
    if getattr(article, 'plagiarism_checked_at', None) and check_status != 'processing':
        return 'done'
    if getattr(article, 'status', '') == 'Draft':
        return 'awaiting_payment'
    return 'checking'


def is_standalone_antiplagiat(article) -> bool:
    """
    Jurnalga yuborilgan haqiqiy maqoladan farqlash:
    antiplagiat xizmati uchun yaratilgan vaqtinchalik Article yozuvlari.
    """
    title = (getattr(article, 'title', None) or '').strip().lower()
    if title.startswith('plagiarism check'):
        return True

    kw_lower = [k.lower() for k in _normalize_keywords(getattr(article, 'keywords', None))]
    if 'plagiarism' in kw_lower:
        return True

    abstract = (getattr(article, 'abstract', '') or '').lower()
    if 'tekshiruv uchun yuborilgan' in abstract or 'hujjat turi:' in abstract:
        return True

    report = getattr(article, 'plagiarism_report', None) or {}
    if isinstance(report, dict) and report.get('is_standalone'):
        return True
    if isinstance(report, dict) and (
        report.get('pending_enabled_modules')
        or report.get('archive_ready')
        or report.get('document_type')
        or report.get('document_name')
    ):
        try:
            from apps.payments.models import Transaction

            has_pub = Transaction.objects.filter(
                article_id=article.id,
                service_type='publication_fee',
            ).exists()
            if not has_pub:
                return True
        except Exception:
            return True

    try:
        from apps.payments.models import Transaction

        has_lang = Transaction.objects.filter(
            article_id=article.id,
            service_type='language_editing',
            status='completed',
        ).exists()
        has_pub = Transaction.objects.filter(
            article_id=article.id,
            service_type='publication_fee',
        ).exists()
        if has_lang and not has_pub:
            return True
    except Exception:
        pass

    return False


# Eski nom — importlar buzilmasin
def _is_standalone_antiplagiat(article) -> bool:
    return is_standalone_antiplagiat(article)
