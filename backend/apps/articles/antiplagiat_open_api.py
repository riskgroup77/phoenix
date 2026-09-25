"""
OpenAlex, Crossref, Semantic Scholar, CORE — haqiqiy ochiq API qidiruv.
"""
from __future__ import annotations

import logging
import time
import urllib.parse
from typing import Any

import requests
from django.conf import settings

from apps.articles.antiplagiat_cache import get_cached, set_cached
from apps.articles.antiplagiat_overlap import sentence_overlap_score

logger = logging.getLogger(__name__)

USER_AGENT = 'PhoenixAntiplag/1.0 (https://ilmiyfaoliyat.uz; mailto:support@ilmiyfaoliyat.uz)'
REQUEST_TIMEOUT = 12


def _sleep_rate() -> None:
    time.sleep(float(getattr(settings, 'ANTIPLAG_API_RATE_DELAY_SEC', 0.35)))


def _query_from_sentence(sentence: str, max_words: int = 12) -> str:
    words = sentence.split()
    return ' '.join(words[:max_words]).strip()


def search_openalex(query: str, *, per_page: int = 3) -> list[dict[str, Any]]:
    cached = get_cached('openalex', query)
    if cached is not None:
        return cached

    q = urllib.parse.quote(query[:200])
    url = f'https://api.openalex.org/works?search={q}&per_page={per_page}'
    try:
        _sleep_rate()
        resp = requests.get(url, headers={'User-Agent': USER_AGENT}, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning('OpenAlex qidiruv xato: %s', exc)
        return []

    results: list[dict[str, Any]] = []
    for item in data.get('results') or []:
        title = (item.get('title') or '').strip()
        abstract_inv = item.get('abstract_inverted_index')
        abstract = _reconstruct_abstract(abstract_inv) if abstract_inv else ''
        oa_id = item.get('id') or ''
        doi = item.get('doi') or ''
        landing = item.get('primary_location', {}) or {}
        source_url = landing.get('landing_page_url') or doi or oa_id
        results.append({
            'title': title[:300],
            'abstract': abstract[:8000],
            'url': source_url,
            'openalex_id': oa_id,
            'doi': doi,
        })

    set_cached('openalex', query, results)
    return results


def _reconstruct_abstract(inverted: dict) -> str:
    if not inverted:
        return ''
    max_pos = max(max(positions) for positions in inverted.values() if positions)
    words = [''] * (max_pos + 1)
    for word, positions in inverted.items():
        for p in positions:
            if 0 <= p < len(words):
                words[p] = word
    return ' '.join(w for w in words if w)


def search_crossref(query: str, *, rows: int = 3) -> list[dict[str, Any]]:
    cached = get_cached('crossref', query)
    if cached is not None:
        return cached

    q = urllib.parse.quote(query[:200])
    url = f'https://api.crossref.org/works?query.bibliographic={q}&rows={rows}'
    try:
        _sleep_rate()
        resp = requests.get(
            url,
            headers={'User-Agent': USER_AGENT},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        items = (resp.json().get('message') or {}).get('items') or []
    except Exception as exc:
        logger.warning('Crossref qidiruv xato: %s', exc)
        return []

    results: list[dict[str, Any]] = []
    for item in items:
        titles = item.get('title') or []
        title = titles[0] if titles else ''
        abstract = (item.get('abstract') or '').strip()
        doi = item.get('DOI') or ''
        url_out = f'https://doi.org/{doi}' if doi else ''
        results.append({
            'title': title[:300],
            'abstract': abstract[:8000],
            'url': url_out,
            'doi': doi,
        })

    set_cached('crossref', query, results)
    return results


def search_semantic_scholar(query: str, *, limit: int = 3) -> list[dict[str, Any]]:
    api_key = (getattr(settings, 'ANTIPLAG_SEMANTIC_SCHOLAR_API_KEY', '') or '').strip()
    cached = get_cached('semantic_scholar', query)
    if cached is not None:
        return cached

    q = urllib.parse.quote(query[:200])
    url = f'https://api.semanticscholar.org/graph/v1/paper/search?query={q}&limit={limit}&fields=title,abstract,url,externalIds'
    headers = {'User-Agent': USER_AGENT}
    if api_key:
        headers['x-api-key'] = api_key
    try:
        _sleep_rate()
        resp = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 429:
            time.sleep(2.0)
            resp = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json().get('data') or []
    except Exception as exc:
        logger.warning('Semantic Scholar qidiruv xato: %s', exc)
        return []

    results: list[dict[str, Any]] = []
    for item in data:
        title = (item.get('title') or '').strip()
        abstract = (item.get('abstract') or '').strip()
        ext = item.get('externalIds') or {}
        doi = ext.get('DOI') or ''
        paper_url = item.get('url') or (f'https://doi.org/{doi}' if doi else '')
        results.append({
            'title': title[:300],
            'abstract': abstract[:8000],
            'url': paper_url,
            'doi': doi,
        })

    set_cached('semantic_scholar', query, results)
    return results


def search_core(query: str, *, limit: int = 3) -> list[dict[str, Any]]:
    api_key = (getattr(settings, 'ANTIPLAG_CORE_API_KEY', '') or '').strip()
    if not api_key:
        return []

    cached = get_cached('core', query)
    if cached is not None:
        return cached

    try:
        _sleep_rate()
        resp = requests.post(
            'https://api.core.ac.uk/v3/search/works',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={'q': query[:200], 'limit': limit},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        hits = (resp.json().get('results') or [])
    except Exception as exc:
        logger.warning('CORE qidiruv xato: %s', exc)
        return []

    results: list[dict[str, Any]] = []
    for item in hits:
        title = (item.get('title') or '').strip()
        abstract = (item.get('abstract') or item.get('description') or '').strip()
        full_text = (item.get('fullText') or '')[:12000]
        body = full_text or abstract
        url = (item.get('downloadUrl') or item.get('sourceFulltextUrls') or [''])[0]
        if isinstance(url, list):
            url = url[0] if url else ''
        results.append({
            'title': title[:300],
            'abstract': body[:8000],
            'url': url or '',
        })

    set_cached('core', query, results)
    return results


def match_sentence_to_api_results(
    sentence: str,
    api_results: list[dict[str, Any]],
    *,
    min_score: float = 0.28,
) -> dict[str, Any] | None:
    best: dict[str, Any] | None = None
    best_score = 0.0
    for item in api_results:
        corpus_text = ' '.join(
            filter(None, [item.get('title') or '', item.get('abstract') or '']),
        )
        if len(corpus_text) < 40:
            continue
        score = sentence_overlap_score(sentence, corpus_text)
        if score > best_score and score >= min_score:
            best_score = score
            best = {**item, 'overlap_score': score}
    return best
