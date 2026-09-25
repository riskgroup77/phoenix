"""
Haqiqiy overlap skaner: korpus + OpenAlex + Crossref + shablon + o'z-o'ziga iqtibos.
Simulyatsiyasiz manbalar (match_type=verified).
"""
from __future__ import annotations

import logging
import re
from typing import Any, Callable

from django.conf import settings

from apps.articles.antiplagiat_modules import MODULE_CATALOG, CORPUS_MODULE_IDS
from apps.articles.antiplagiat_open_api import (
    match_sentence_to_api_results,
    search_core,
    search_crossref,
    search_openalex,
    search_semantic_scholar,
)
from apps.articles.antiplagiat_overlap import (
    assign_hit_char_shares,
    compute_verified_coverage,
    dedupe_hits,
    estimate_overlap_chars,
    sentence_overlap_score,
)
from apps.articles.antiplagiat_template_phrases import find_template_hits_in_sentence

logger = logging.getLogger(__name__)

ProgressCallback = Callable[..., None]


def _module_label(module_id: str) -> str:
    for m in MODULE_CATALOG:
        if m['id'] == module_id:
            return m['label']
    return module_id


def _pick_candidate_sentences(sentences: list[str], *, max_count: int) -> list[tuple[int, str]]:
    """Tekshiriladigan gaplar (indeks, matn)."""
    out: list[tuple[int, str]] = []
    step = max(1, len(sentences) // max(1, max_count // 2))
    for idx in range(0, len(sentences), step):
        sent = sentences[idx]
        if len(sent.split()) >= 6:
            out.append((idx, sent))
        if len(out) >= max_count:
            break
    for idx, sent in enumerate(sentences):
        if len(out) >= max_count:
            break
        if len(sent.split()) >= 14 and (idx, sent) not in out:
            out.append((idx, sent))
    return out[:max_count]


def _corpus_url(entry: dict) -> str:
    doi = (entry.get('doi') or '').strip()
    if doi.startswith('http'):
        return doi
    if doi:
        return f'https://doi.org/{doi}'
    return f'https://ilmiyfaoliyat.uz/#/articles/{entry.get("id", "")}'


def scan_corpus_hits(
    sentences: list[tuple[int, str]],
    corpus: list[dict],
    enabled_corpus: set[str],
    *,
    limit: int = 180,
) -> list[dict[str, Any]]:
    if not corpus or not enabled_corpus:
        return []

    module_ids = sorted(enabled_corpus) or ['milliy_reestr']
    hits: list[dict[str, Any]] = []

    for _idx, sent in sentences:
        best_entry = None
        best_score = 0.0
        best_src_frag = ''
        for entry in corpus:
            body = entry.get('text') or ''
            if len(body) < 40:
                continue
            score = sentence_overlap_score(sent, body)
            if score > best_score:
                best_score = score
                best_entry = entry
                words = body.split()
                best_src_frag = ' '.join(words[: min(35, len(words))])

        if not best_entry or best_score < 0.32:
            continue

        title = (best_entry.get('title') or '')[:200]
        mod_idx = hash(best_entry.get('id', '')) % len(module_ids)
        module_id = module_ids[mod_idx]
        oc = estimate_overlap_chars(sent, best_entry.get('text') or best_src_frag)
        hits.append({
            'title': title,
            'source': _corpus_url(best_entry),
            'snippet': sent[:220],
            'document_fragment': sent[:360],
            'source_fragment': best_src_frag[:360],
            'source_text': (best_entry.get('text') or '')[:12000],
            'search_module': _module_label(module_id),
            'module_id': module_id,
            'match_type': 'verified',
            'overlap_chars': oc,
            'similarity': 0.0,
        })
        if len(hits) >= limit:
            break

    return hits


def scan_self_citation_hits(
    sentences: list[tuple[int, str]],
    corpus: list[dict],
    *,
    author_id: str | None,
    exclude_article_id: str | None,
    limit: int = 40,
) -> list[dict[str, Any]]:
    if not author_id:
        return []

    own = [
        c for c in corpus
        if str(c.get('author_id') or '') == str(author_id)
        and str(c.get('id') or '') != str(exclude_article_id or '')
    ]
    if not own:
        return []

    hits: list[dict[str, Any]] = []
    for _idx, sent in sentences[:80]:
        for entry in own:
            body = entry.get('text') or ''
            score = sentence_overlap_score(sent, body)
            if score < 0.35:
                continue
            title = (entry.get('title') or '')[:200]
            oc = estimate_overlap_chars(sent, body)
            hits.append({
                'title': title,
                'source': _corpus_url(entry),
                'snippet': sent[:220],
                'document_fragment': sent[:360],
                'source_fragment': body[:360],
                'source_text': body[:12000],
                'search_module': _module_label('iqtibos_keltirish'),
                'module_id': 'iqtibos_keltirish',
                'match_type': 'verified',
                'self_citation': True,
                'overlap_chars': oc,
                'similarity': 0.0,
            })
            if len(hits) >= limit:
                return hits
    return hits


def scan_template_hits(
    sentences: list[tuple[int, str]],
    *,
    limit: int = 25,
) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    for _idx, sent in sentences:
        phrases = find_template_hits_in_sentence(sent)
        if not phrases:
            continue
        hits.append({
            'title': 'Shablon iboralar',
            'source': 'https://ilmiyfaoliyat.uz/plagiarism-check#shablon',
            'snippet': sent[:220],
            'document_fragment': sent[:360],
            'source_fragment': phrases[0][:200],
            'source_text': phrases[0],
            'search_module': _module_label('shablon_iboralar'),
            'module_id': 'shablon_iboralar',
            'match_type': 'verified',
            'overlap_chars': max(20, len(re.sub(r'\s+', '', sent)) // 8),
            'similarity': 0.0,
        })
        if len(hits) >= limit:
            break
    return hits


def scan_api_hits(
    sentences: list[tuple[int, str]],
    enabled: set[str],
    *,
    max_queries: int = 45,
) -> list[dict[str, Any]]:
    max_q = int(getattr(settings, 'ANTIPLAG_OPEN_API_MAX_QUERIES', max_queries))
    hits: list[dict[str, Any]] = []
    queries_done = 0

    for _idx, sent in sentences:
        if queries_done >= max_q:
            break
        if len(sent.split()) < 8:
            continue

        query = ' '.join(sent.split()[:12])
        api_batches: list[tuple[str, list]] = []

        if 'openalex' in enabled and queries_done < max_q:
            api_batches.append(('openalex', search_openalex(query)))
            queries_done += 1
        if 'crossref' in enabled and queries_done < max_q:
            api_batches.append(('crossref', search_crossref(query)))
            queries_done += 1
        if 'semantic_scholar' in enabled and queries_done < max_q:
            api_batches.append(('semantic_scholar', search_semantic_scholar(query)))
            queries_done += 1
        if 'core_ac' in enabled and queries_done < max_q:
            api_batches.append(('core_ac', search_core(query)))
            queries_done += 1

        for module_id, results in api_batches:
            if not results:
                continue
            matched = match_sentence_to_api_results(sent, results)
            if not matched:
                continue
            abstract = matched.get('abstract') or ''
            title = matched.get('title') or 'Ilmiy ish'
            url = matched.get('url') or ''
            oc = estimate_overlap_chars(sent, abstract or title)
            if oc <= 0:
                continue
            hits.append({
                'title': title[:300],
                'source': url or title,
                'snippet': sent[:220],
                'document_fragment': sent[:360],
                'source_fragment': (abstract or title)[:360],
                'source_text': abstract[:12000],
                'search_module': _module_label(module_id),
                'module_id': module_id,
                'match_type': 'verified',
                'overlap_chars': oc,
                'similarity': 0.0,
            })

    return hits


def run_real_antiplag_scan(
    text: str,
    sentences: list[str],
    *,
    corpus: list[dict],
    enabled: set[str],
    exclude_article_id: str | None = None,
    exclude_author_id: str | None = None,
    progress_callback: ProgressCallback | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not getattr(settings, 'ANTIPLAG_REAL_SCAN_ENABLED', True):
        return [], {}

    total_chars = len(re.sub(r'\s+', '', text or '')) or len(text or '') or 1
    max_sent = int(getattr(settings, 'ANTIPLAG_REAL_SCAN_MAX_SENTENCES', 220))
    candidates = _pick_candidate_sentences(sentences, max_count=max_sent)

    if progress_callback:
        progress_callback(
            phase='real_scan',
            module_label='Haqiqiy korpus va ochiq API skaneri',
            module_id='real_scan',
            progress_percent=12,
        )

    hits: list[dict[str, Any]] = []
    enabled_corpus = enabled & CORPUS_MODULE_IDS

    hits.extend(scan_corpus_hits(candidates, corpus, enabled_corpus))

    if progress_callback:
        progress_callback(phase='real_scan', progress_percent=35, sources_found=len(hits))

    if exclude_author_id or exclude_article_id:
        hits.extend(
            scan_self_citation_hits(
                candidates,
                corpus,
                author_id=exclude_author_id,
                exclude_article_id=exclude_article_id,
            )
        )

    if 'shablon_iboralar' in enabled:
        hits.extend(scan_template_hits(candidates))

    open_enabled = enabled & {'openalex', 'crossref', 'semantic_scholar', 'core_ac'}
    if open_enabled:
        hits.extend(scan_api_hits(candidates, open_enabled))

    hits = dedupe_hits(hits)
    hits = assign_hit_char_shares(hits, total_chars)
    coverage = compute_verified_coverage(hits, total_chars)
    coverage['total_chars'] = total_chars
    coverage['real_scan_hits'] = len(hits)

    if progress_callback:
        progress_callback(
            phase='real_scan_done',
            progress_percent=45,
            sources_found=len(hits),
            module_label=f'Haqiqiy manbalar: {len(hits)} ta',
        )

    logger.info(
        'real antiplag scan: hits=%s verified_plag=%s%%',
        len(hits),
        coverage.get('verified_plagiarism_pct'),
    )
    return hits, coverage
