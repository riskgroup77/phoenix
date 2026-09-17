"""
Phoenix / ilmiyfaoliyat.uz ichki ma'lumotlar bazasi (milliy reestr corpus).
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

CORPUS_ARTICLE_LIMIT = 5000
CORPUS_PDF_TEXT_LIMIT = 120


def _keywords_text(keywords: Any) -> str:
    if not keywords:
        return ''
    if isinstance(keywords, list):
        return ' '.join(str(k) for k in keywords if k)
    return str(keywords)


def load_platform_corpus(exclude_article_id=None) -> list[dict[str, Any]]:
    key = str(exclude_article_id) if exclude_article_id else ''
    return _load_platform_corpus_cached(key)


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
        if len(body) < 40 and art.final_pdf_path and pdf_extracted < CORPUS_PDF_TEXT_LIMIT:
            try:
                from apps.services import extract_plain_text_from_file

                path = art.final_pdf_path.path if hasattr(art.final_pdf_path, 'path') else str(art.final_pdf_path)
                extra = extract_plain_text_from_file(path)
                if extra and len(extra.strip()) >= 80:
                    body = f'{body} {extra.strip()[:12000]}'
                    pdf_extracted += 1
            except Exception:
                pass
        if len(body) < 40:
            continue
        corpus.append({
            'id': str(art.id),
            'title': (art.title or '')[:500],
            'text': body[:50000],
            'status': art.status,
            'doi': (art.doi or '')[:120],
            'journal': (getattr(journal, 'name', '') if journal else '')[:200],
        })

    logger.info('platform corpus: %s hujjat (pdf=%s)', len(corpus), pdf_extracted)
    return corpus
