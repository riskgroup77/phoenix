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
            # Ochiq kirishdagi to'liq matn (PDF) — butun hujjat bilan solishtirish uchun
            'pdf_url': _openalex_pdf_url(item),
        })

    set_cached('openalex', query, results)
    return results


def _openalex_pdf_url(item: dict) -> str:
    for loc in (item.get('best_oa_location'), item.get('primary_location')):
        if isinstance(loc, dict) and loc.get('pdf_url'):
            return str(loc['pdf_url'])
    oa = item.get('open_access') or {}
    if oa.get('is_oa') and oa.get('oa_url'):
        return str(oa['oa_url'])
    return ''


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
    url = f'https://api.semanticscholar.org/graph/v1/paper/search?query={q}&limit={limit}&fields=title,abstract,url,externalIds,openAccessPdf'
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
            'pdf_url': ((item.get('openAccessPdf') or {}).get('url') or ''),
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
        full_text = (item.get('fullText') or '')[:200000]
        body = full_text or abstract
        url = (item.get('downloadUrl') or item.get('sourceFulltextUrls') or [''])[0]
        if isinstance(url, list):
            url = url[0] if url else ''
        results.append({
            'title': title[:300],
            'abstract': body[:200000],
            'url': url or '',
            'doi': item.get('doi') or '',
        })

    set_cached('core', query, results)
    return results


# ---------------------------------------------------------------- qo'shimcha BEPUL manbalar (kalitsiz)

def _get_json(url: str, *, params: dict | None = None, namespace: str, query: str) -> Any:
    try:
        _sleep_rate()
        resp = requests.get(url, params=params, headers={'User-Agent': USER_AGENT}, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning('%s qidiruv xato: %s', namespace, exc)
        return None


def search_doaj(query: str, *, page_size: int = 3) -> list[dict[str, Any]]:
    """DOAJ — ochiq kirishdagi jurnallar maqolalari (O'zbekiston jurnallarining bir qismi ham shu yerda)."""
    cached = get_cached('doaj', query)
    if cached is not None:
        return cached
    data = _get_json(
        'https://doaj.org/api/search/articles/' + urllib.parse.quote(query[:200]),
        params={'pageSize': page_size}, namespace='DOAJ', query=query,
    )
    if data is None:
        return []
    results: list[dict[str, Any]] = []
    for item in data.get('results') or []:
        bib = item.get('bibjson') or {}
        doi = next((i.get('id') for i in bib.get('identifier') or [] if i.get('type') == 'doi'), '') or ''
        links = [lnk.get('url') for lnk in bib.get('link') or [] if lnk.get('url')]
        url = (f'https://doi.org/{doi}' if doi else '') or (links[0] if links else '')
        results.append({
            'title': (bib.get('title') or '')[:300],
            'abstract': (bib.get('abstract') or '')[:8000],
            'url': url,
            'doi': doi,
            # Jurnal maqola sahifasi (OJS bo'lsa citation_pdf_url orqali PDF topiladi)
            'pdf_url': next((u for u in links if u.lower().endswith('.pdf')), ''),
            'landing_url': links[0] if links else '',
        })
    set_cached('doaj', query, results)
    return results


def search_europe_pmc(query: str, *, page_size: int = 3) -> list[dict[str, Any]]:
    """Europe PMC — biotibbiyot va hayot fanlari (ochiq maqolalar PDF bilan)."""
    cached = get_cached('europe_pmc', query)
    if cached is not None:
        return cached
    data = _get_json(
        'https://www.ebi.ac.uk/europepmc/webservices/rest/search',
        params={'query': query[:300], 'format': 'json', 'resultType': 'core', 'pageSize': page_size},
        namespace='Europe PMC', query=query,
    )
    if data is None:
        return []
    results: list[dict[str, Any]] = []
    for r in ((data.get('resultList') or {}).get('result') or []):
        urls = [u.get('url') or '' for u in ((r.get('fullTextUrlList') or {}).get('fullTextUrl') or [])]
        pdf = next((u for u in urls if 'pdf=render' in u or u.lower().endswith('.pdf')), '')
        doi = r.get('doi') or ''
        results.append({
            'title': (r.get('title') or '')[:300],
            'abstract': (r.get('abstractText') or '')[:8000],
            'url': f'https://doi.org/{doi}' if doi else (urls[0] if urls else ''),
            'doi': doi,
            'pdf_url': pdf if r.get('isOpenAccess') == 'Y' else '',
        })
    set_cached('europe_pmc', query, results)
    return results


_ATOM = {'a': 'http://www.w3.org/2005/Atom'}


def search_arxiv(query: str, *, max_results: int = 3) -> list[dict[str, Any]]:
    """arXiv — fizika, matematika, informatika, iqtisodiyot preprintlari (PDF har doim ochiq)."""
    from xml.etree import ElementTree as ET

    cached = get_cached('arxiv', query)
    if cached is not None:
        return cached
    words = [w for w in query.split() if len(w) > 2][:6]
    if len(words) < 3:
        return []
    search = ' AND '.join(f'all:{w}' for w in words)
    try:
        time.sleep(3.0)  # arXiv qoidasi: 3 soniyada bitta so'rov
        resp = requests.get('https://export.arxiv.org/api/query',
                            params={'search_query': search, 'max_results': max_results},
                            headers={'User-Agent': USER_AGENT}, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        if b'<!DOCTYPE' in resp.content[:2048].upper() or b'<!ENTITY' in resp.content.upper():
            return []
        root = ET.fromstring(resp.content)
    except Exception as exc:
        logger.warning('arXiv qidiruv xato: %s', exc)
        return []
    results: list[dict[str, Any]] = []
    for e in root.findall('a:entry', _ATOM):
        abs_url = (e.findtext('a:id', default='', namespaces=_ATOM) or '').strip()
        pdf = next((lnk.get('href') for lnk in e.findall('a:link', _ATOM) if lnk.get('title') == 'pdf'), '')
        results.append({
            'title': ' '.join((e.findtext('a:title', default='', namespaces=_ATOM) or '').split())[:300],
            'abstract': ' '.join((e.findtext('a:summary', default='', namespaces=_ATOM) or '').split())[:8000],
            'url': abs_url,
            'doi': '',
            'pdf_url': pdf or '',
        })
    set_cached('arxiv', query, results)
    return results


def search_wikipedia(query: str, *, lang: str | None = None, limit: int = 3) -> list[dict[str, Any]]:
    """Vikipediya (o'zbek / rus / ingliz — gap tiliga qarab). To'liq maqola matni keyin solishtiriladi."""
    from apps.articles.antiplagiat_normalize import guess_lang, translit_to_latin

    lang = lang if lang in ('uz', 'ru', 'en') else guess_lang(query)
    q = translit_to_latin(query) if lang == 'uz' else query
    cache_q = f'{lang}:{q}'
    cached = get_cached('wikipedia', cache_q)
    if cached is not None:
        return cached
    data = _get_json(
        f'https://{lang}.wikipedia.org/w/api.php',
        params={'action': 'query', 'list': 'search', 'srsearch': q[:250], 'srlimit': limit,
                'format': 'json', 'utf8': 1},
        namespace='Wikipedia', query=cache_q,
    )
    if data is None:
        return []
    results: list[dict[str, Any]] = []
    for r in ((data.get('query') or {}).get('search') or []):
        title = r.get('title') or ''
        slug = urllib.parse.quote(title.replace(' ', '_'))
        results.append({
            'title': f'{title} — Vikipediya ({lang})'[:300],
            'abstract': r.get('snippet') or '',
            'url': f'https://{lang}.wikipedia.org/wiki/{slug}',
            'doi': '',
            # REST HTML — to'liq maqola matni (fetch_fulltext HTML'ni ham o'qiydi)
            'pdf_url': f'https://{lang}.wikipedia.org/api/rest_v1/page/html/{slug}',
        })
    set_cached('wikipedia', cache_q, results)
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
