"""OpenSearch matn qidiruvi — fragment kesishmalar."""
from __future__ import annotations

from typing import Any

from apps.articles.antiplagiat_modules import CORPUS_MODULE_IDS, MODULE_CATALOG
from apps.articles.antiplagiat_opensearch import opensearch_enabled, search_text_fragments
from apps.articles.antiplagiat_overlap import estimate_overlap_chars, sentence_overlap_score
from apps.articles.antiplagiat_privacy import is_own_or_excluded, safe_source_fields


def _module_label(module_id: str) -> str:
    for m in MODULE_CATALOG:
        if m['id'] == module_id:
            return m['label']
    return module_id


def scan_opensearch_hits(
    candidates: list[tuple[int, str]],
    enabled: set[str],
    *,
    limit: int = 90,
    exclude_article_id: str | None = None,
    exclude_author_id: str | None = None,
) -> list[dict[str, Any]]:
    if not opensearch_enabled():
        return []
    if not (enabled & CORPUS_MODULE_IDS):
        return []

    hits: list[dict[str, Any]] = []
    module_ids = sorted(enabled & CORPUS_MODULE_IDS) or ['milliy_reestr']

    for _idx, sent in candidates[:70]:
        if len(hits) >= limit:
            break
        rows = search_text_fragments(sent, size=4)
        for row in rows:
            # Tekshirilayotgan hujjatning o'zi va muallifning o'z ishlari (o'z-o'ziga iqtibos alohida)
            if is_own_or_excluded(row, exclude_article_id=exclude_article_id, exclude_author_id=exclude_author_id):
                continue
            frag = row.get('fragment') or ''
            if len(frag) < 35:
                continue
            lex = sentence_overlap_score(sent, frag)
            if lex < 0.30:
                continue
            mod = row.get('module_id') or ''
            if mod not in enabled:
                mod = module_ids[0]
            oc = estimate_overlap_chars(sent, frag)
            hits.append({
                **safe_source_fields(
                    sentence=sent,
                    source_text=frag,
                    title=row.get('title') or '',
                    url=row.get('url') or '',
                    is_public=bool(row.get('is_public')),
                ),
                'snippet': sent[:220],
                'document_fragment': sent[:360],
                'search_module': _module_label(mod),
                'module_id': mod,
                'match_type': 'verified',
                'match_subtype': 'opensearch',
                'overlap_chars': oc,
                'similarity': 0.0,
            })
            if len(hits) >= limit:
                break

    return hits
