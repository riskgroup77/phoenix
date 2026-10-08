"""
Phoenix / ilmiyfaoliyat.uz ichki ma'lumotlar bazasi (milliy reestr corpus).
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

CORPUS_ARTICLE_LIMIT = int(os.environ.get('PHONIX_CORPUS_ARTICLE_LIMIT', '8000'))
CORPUS_PDF_EXTRACT_LIMIT = int(os.environ.get('PHONIX_CORPUS_PDF_LIMIT', '600'))
CORPUS_IMPORTED_LIMIT = int(os.environ.get('PHONIX_CORPUS_IMPORT_LIMIT', '3000'))
CORPUS_TEXT_MAX = 80000


def _keywords_text(keywords: Any) -> str:
    if not keywords:
        return ''
    if isinstance(keywords, list):
        return ' '.join(str(k) for k in keywords if k)
    return str(keywords)


def _resolve_pdf_path(art) -> str | None:
    if not art.final_pdf_path:
        return None
    try:
        if hasattr(art.final_pdf_path, 'path'):
            path = art.final_pdf_path.path
            if path and os.path.isfile(path):
                return path
    except Exception:
        pass
    from django.conf import settings as dj_settings

    rel = str(art.final_pdf_path).lstrip('/')
    path = os.path.join(dj_settings.MEDIA_ROOT, rel)
    if os.path.isfile(path):
        return path
    return None


def _load_imported_corpus() -> list[dict[str, Any]]:
    try:
        from apps.articles.models import AntiplagCorpusDocument
    except Exception:
        return []

    out: list[dict[str, Any]] = []
    qs = (
        AntiplagCorpusDocument.objects.filter(is_active=True)
        .order_by('-updated_at')[:CORPUS_IMPORTED_LIMIT]
    )
    for doc in qs:
        text = (doc.full_text or '').strip()
        if len(text) < 80:
            continue
        out.append({
            'id': f'import:{doc.external_key}',
            'title': (doc.title or '')[:500],
            'text': text[:CORPUS_TEXT_MAX],
            'doi': '',
            'journal': doc.get_source_type_display() if hasattr(doc, 'get_source_type_display') else doc.source_type,
            'author_id': str(doc.author_user_id) if doc.author_user_id else '',
            'author_names': doc.author_names or '',
            'source_type': 'import',
            'is_public': True,
        })
    return out


CORPUS_CACHE_TTL_SEC = int(os.environ.get('PHONIX_CORPUS_CACHE_TTL', '1800'))
_platform_cache: dict[str, Any] = {'at': 0.0, 'data': None}
_imported_cache: dict[str, Any] = {'at': 0.0, 'data': None}


def _cached(store: dict[str, Any], loader):
    """Jarayon ichida bitta nusxa, TTL bilan (eski lru_cache har tekshiruv uchun alohida nusxa saqlardi)."""
    now = time.monotonic()
    if store['data'] is None or now - store['at'] > CORPUS_CACHE_TTL_SEC:
        store['data'] = loader()
        store['at'] = now
    return store['data']


def load_platform_corpus(exclude_article_id=None) -> list[dict[str, Any]]:
    exclude = str(exclude_article_id) if exclude_article_id else ''
    platform = _cached(_platform_cache, _load_platform_corpus)
    imported = _cached(_imported_cache, _load_imported_corpus)
    merged = [c for c in platform if c['id'] != exclude]
    seen_ids = {c['id'] for c in merged}
    for entry in imported:
        if entry['id'] not in seen_ids:
            merged.append(entry)
    return merged


def _looks_like_standalone_check(art) -> bool:
    """
    Mustaqil antiplagiat tekshiruvi uchun yuklangan hujjat (nashr emas) — korpusga kiritilmaydi.
    is_standalone_antiplagiat() dan farqli: DB so'rovsiz (8000 ta maqola uchun tez).
    """
    title = (art.title or '').strip().lower()
    if title.startswith('plagiarism check'):
        return True
    kw = art.keywords if isinstance(art.keywords, list) else []
    if any(str(k).strip().lower() == 'plagiarism' for k in kw):
        return True
    report = art.plagiarism_report if isinstance(art.plagiarism_report, dict) else {}
    return bool(report.get('is_standalone'))


def _load_platform_corpus() -> list[dict[str, Any]]:
    from apps.articles.models import Article

    # Faqat jurnalga yuborilgan maqolalar. Qoralama, rad etilgan va mustaqil antiplagiat
    # tekshiruvlari (boshqa foydalanuvchilarning shaxsiy hujjatlari) korpusga kirmaydi.
    from config.demo import demo_q

    qs = (
        Article.objects.exclude(status__in=('Draft', 'Rejected'))
        .exclude(demo_q('author__') | demo_q('journal__journal_admin__'))
        .only(
            'id', 'title', 'abstract', 'keywords', 'status', 'doi', 'author_id',
            'final_pdf_path', 'plagiarism_report',
        )
        .order_by('-submission_date')
    )

    corpus: list[dict[str, Any]] = []
    pdf_extracted = 0

    for art in qs[:CORPUS_ARTICLE_LIMIT]:
        if _looks_like_standalone_check(art):
            continue
        # Faqat asar matni: sarlavha, annotatsiya, kalit so'zlar, fayl matni.
        # Adabiyotlar ro'yxati (umumiy manbalar → soxta plagiat), taqrizchi izohi (maxfiy),
        # muallif/jurnal nomlari kiritilmaydi.
        parts = [art.title or '', art.abstract or '', _keywords_text(art.keywords)]
        body = ' '.join(p.strip() for p in parts if p and str(p).strip())

        pdf_path = _resolve_pdf_path(art)
        if pdf_path and pdf_extracted < CORPUS_PDF_EXTRACT_LIMIT:
            try:
                from apps.services import extract_plain_text_from_file

                extra = extract_plain_text_from_file(pdf_path)
                if extra and len(extra.strip()) >= 80:
                    body = f'{body} {extra.strip()[:CORPUS_TEXT_MAX]}'
                    pdf_extracted += 1
            except Exception:
                pass

        if len(body) < 40:
            continue
        corpus.append({
            'id': str(art.id),
            'title': (art.title or '')[:500],
            'text': body[:CORPUS_TEXT_MAX],
            'status': art.status,
            'is_public': art.status == 'Published',
            'doi': (art.doi or '')[:120],
            'journal': '',
            'author_id': str(art.author_id) if art.author_id else '',
            'author_names': '',
            'source_type': 'platform',
        })

    logger.info('platform corpus: %s hujjat (pdf=%s)', len(corpus), pdf_extracted)
    return corpus


def invalidate_corpus_cache() -> None:
    _platform_cache['data'] = None
    _imported_cache['data'] = None
