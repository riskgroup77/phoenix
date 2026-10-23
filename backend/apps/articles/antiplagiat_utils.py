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


def antiplagiat_check_active(article) -> bool:
    """Tekshiruv hozir haqiqatan ketyaptimi (processing va qotib qolmagan) — sahifa refreshdan keyin progressni
    davom ettirish uchun. To'langan, lekin hech boshlanmagan / qotib qolgan eski hujjatlar bu yerga kirmaydi."""
    report = getattr(article, 'plagiarism_report', None) or {}
    if not isinstance(report, dict) or report.get('check_status') != 'processing':
        return False
    from .plagiarism_check_service import _is_stale_processing

    return not _is_stale_processing(report)


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


def antiplagiat_author_name(report) -> str:
    """
    Antiplagiat formasida kiritilgan muallif: "Familiya Ism" (plagiarism_report.author_last_name / author_first_name).
    Sertifikat, ma'lumotnoma va QR tekshiruvi shu ismni ko'rsatadi; bo'sh bo'lsa — '' (chaqiruvchi profil ismini oladi).
    """
    if not isinstance(report, dict):
        return ''
    parts = (str(report.get('author_last_name') or '').strip(), str(report.get('author_first_name') or '').strip())
    return ' '.join(p for p in parts if p)


# Formada asosiy muallifdan tashqari qo'shiladigan hammualliflar soni (sertifikatga 10 tagacha ism sig'adi)
MAX_ANTIPLAGIAT_CO_AUTHORS = 9


def clean_antiplagiat_co_authors(raw) -> list[dict]:
    """Formadan kelgan hammualliflar: [{first_name, last_name}] — bo'sh qatorlar tashlanadi, ko'pi bilan 9 ta."""
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        first = ' '.join(str(item.get('first_name') or '').split())[:150]
        last = ' '.join(str(item.get('last_name') or '').split())[:150]
        if first or last:
            out.append({'first_name': first, 'last_name': last})
        if len(out) >= MAX_ANTIPLAGIAT_CO_AUTHORS:
            break
    return out


def antiplagiat_authors(report, fallback: str = '') -> list[str]:
    """Asosiy muallif va hammualliflar ("Familiya Ism") — formadagi tartibda.

    fallback — asosiy muallif ismi kiritilmagan bo'lsa (eski hujjatlar) o'rniga qo'yiladigan ism (profil).
    """
    if not isinstance(report, dict):
        return [fallback] if fallback else []
    names = [antiplagiat_author_name(report) or fallback]
    for co in clean_antiplagiat_co_authors(report.get('co_authors')):
        names.append(' '.join(p for p in (co['last_name'], co['first_name']) if p))
    return [n for n in names if n]
