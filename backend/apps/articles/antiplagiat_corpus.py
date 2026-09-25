"""
Phoenix / ilmiyfaoliyat.uz ichki ma'lumotlar bazasi (milliy reestr corpus).
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
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
        })
    return out


def load_platform_corpus(exclude_article_id=None) -> list[dict[str, Any]]:
    key = str(exclude_article_id) if exclude_article_id else ''
    platform = _load_platform_corpus_cached(key)
    imported = _load_imported_corpus_cached()
    if not imported:
        return platform
    seen_ids = {c['id'] for c in platform}
    merged = list(platform)
    for entry in imported:
        if entry['id'] not in seen_ids:
            merged.append(entry)
    return merged


@lru_cache(maxsize=4)
def _load_imported_corpus_cached() -> tuple[dict[str, Any], ...]:
    return tuple(_load_imported_corpus())


@lru_cache(maxsize=8)
def _load_platform_corpus_cached(exclude_key: str) -> list[dict[str, Any]]:
    exclude_article_id = exclude_key or None
    from apps.articles.models import Article

    qs = (
        Article.objects.exclude(status__in=('Draft', 'Rejected'))
        .select_related('journal', 'author')
        .only(
            'id', 'title', 'abstract', 'bibliography', 'keywords', 'review_content',
            'submitted_author_name', 'status', 'doi', 'journal_id', 'author_id', 'final_pdf_path',
        )
        .order_by('-submission_date')
    )
    if exclude_article_id:
        qs = qs.exclude(pk=exclude_article_id)

    corpus: list[dict[str, Any]] = []
    pdf_extracted = 0

    for art in qs[:CORPUS_ARTICLE_LIMIT]:
        parts = [
            art.title or '',
            art.abstract or '',
            art.bibliography or '',
            _keywords_text(art.keywords),
            art.review_content or '',
            art.submitted_author_name or '',
        ]
        journal = getattr(art, 'journal', None)
        if journal:
            parts.append(getattr(journal, 'name', '') or '')
        author = getattr(art, 'author', None)
        author_id = str(author.id) if author else ''
        if author:
            parts.append(
                ' '.join(
                    filter(
                        None,
                        [
                            getattr(author, 'first_name', '') or '',
                            getattr(author, 'last_name', '') or '',
                            getattr(author, 'affiliation', '') or '',
                        ],
                    )
                )
            )
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
        elif pdf_path and len(body) < 200:
            try:
                from apps.services import extract_plain_text_from_file

                extra = extract_plain_text_from_file(pdf_path)
                if extra and len(extra.strip()) >= 80:
                    body = f'{body} {extra.strip()[:CORPUS_TEXT_MAX]}'
            except Exception:
                pass

        if len(body) < 40:
            continue
        corpus.append({
            'id': str(art.id),
            'title': (art.title or '')[:500],
            'text': body[:CORPUS_TEXT_MAX],
            'status': art.status,
            'doi': (art.doi or '')[:120],
            'journal': (getattr(journal, 'name', '') if journal else '')[:200],
            'author_id': author_id,
            'author_names': art.submitted_author_name or '',
            'source_type': 'platform',
        })

    logger.info('platform corpus: %s hujjat (pdf=%s)', len(corpus), pdf_extracted)
    return corpus


def invalidate_corpus_cache() -> None:
    _load_platform_corpus_cached.cache_clear()
    _load_imported_corpus_cached.cache_clear()
