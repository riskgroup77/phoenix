"""Internet / Garant / studfiles snippet skaneri."""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings

from apps.articles.antiplagiat_modules import INTERNET_MODULE_IDS, MODULE_CATALOG, UZ_LEGAL_MODULE_IDS
from apps.articles.antiplagiat_opensearch import opensearch_enabled, search_text_fragments
from apps.articles.antiplagiat_overlap import estimate_overlap_chars, sentence_overlap_score
from apps.articles.antiplagiat_web_search import (
    GARANT_MODULE_IDS,
    search_for_module,
    web_search_configured,
)

logger = logging.getLogger(__name__)


def _module_label(module_id: str) -> str:
    for m in MODULE_CATALOG:
        if m['id'] == module_id:
            return m['label']
    return module_id


def _web_modules_enabled(enabled: set[str]) -> set[str]:
    return enabled & (INTERNET_MODULE_IDS | GARANT_MODULE_IDS | UZ_LEGAL_MODULE_IDS)


def scan_web_snippet_hits(
    candidates: list[tuple[int, str]],
    enabled: set[str],
    *,
    limit: int = 45,
) -> list[dict[str, Any]]:
    mods = _web_modules_enabled(enabled)
    if not mods:
        return []

    hits: list[dict[str, Any]] = []
    max_queries = int(getattr(settings, 'ANTIPLAG_WEB_MAX_QUERIES', 35))
    max_sent = int(getattr(settings, 'ANTIPLAG_WEB_MAX_SENTENCES', max_queries))
    queries = 0

    mod_list = sorted(mods)[:8]
    # Har gap uchun BITTA so'rov, modullar navbat bilan (avval har gapga 8 ta so'rov ketib,
    # butun budjet hujjatning 4-5 ta gapiga sarflanardi)
    eligible = [(i, s) for i, s in candidates if len(s.split()) >= 8][:max_sent]

    for n, (_idx, sent) in enumerate(eligible):
        if len(hits) >= limit or queries >= max_queries:
            break
        for module_id in (mod_list[n % len(mod_list)],):
            queries += 1

            if web_search_configured():
                snippets = search_for_module(sent, module_id, num=2)
            elif opensearch_enabled():
                snippets = [
                    {
                        'title': r.get('title', ''),
                        'url': r.get('url', ''),
                        'snippet': r.get('fragment', ''),
                    }
                    for r in search_text_fragments(sent, size=2, module_id=module_id)
                ]
            else:
                continue

            for sn in snippets:
                body = sn.get('snippet') or sn.get('title') or ''
                if len(body) < 25:
                    continue
                lex = sentence_overlap_score(sent, body)
                if lex < 0.26:
                    continue
                oc = estimate_overlap_chars(sent, body)
                hits.append({
                    'title': (sn.get('title') or body[:120])[:300],
                    'source': sn.get('url') or '',
                    'snippet': sent[:220],
                    'document_fragment': sent[:360],
                    'source_fragment': body[:360],
                    'source_text': body[:8000],
                    'search_module': _module_label(module_id),
                    'module_id': module_id,
                    'match_type': 'verified',
                    'match_subtype': 'web_snippet',
                    'overlap_chars': oc,
                    'similarity': 0.0,
                })
                if len(hits) >= limit:
                    break

    return hits
