"""
Internet / Garant / studfiles — snippet API (Google CSE, Bing) + cache.
"""
from __future__ import annotations

import logging
import re
import time
import urllib.parse
from typing import Any

import requests
from django.conf import settings

from apps.articles.antiplagiat_cache import get_cached, set_cached

logger = logging.getLogger(__name__)

USER_AGENT = 'PhoenixAntiplag/1.0 (https://ilmiyfaoliyat.uz)'

GARANT_MODULE_IDS = {
    'garant_aht', 'sps_garant', 'garant_analytics', 'garant_paraphrase',
}

STUDFILES_HINT_HOSTS = ('studfiles.ru', 'studfile.net', 'helpiks.org', 'allbest.ru', 'klerk.ru')

MODULE_SEARCH_PROFILE: dict[str, dict[str, Any]] = {
    'internet_plus': {'site': None, 'lang': 'ru'},
    'internet_ru_paraphrase': {'site': None, 'lang': 'ru', 'boost_hosts': STUDFILES_HINT_HOSTS},
    'internet_en_paraphrase': {'site': None, 'lang': 'en'},
    'internet_ru_translation': {'site': None, 'lang': 'ru'},
    'internet_uz': {'site': None, 'lang': 'uz', 'extra': 'site:uz OR o\'zbekiston'},
    'smi_russia_cis': {'site': None, 'lang': 'ru', 'extra': 'новости'},
    'garant_aht': {'site': 'ivo.garant.ru', 'lang': 'ru'},
    'sps_garant': {'site': 'ivo.garant.ru', 'lang': 'ru'},
    'garant_analytics': {'site': 'garant.ru', 'lang': 'ru'},
    'garant_paraphrase': {'site': 'garant.ru', 'lang': 'ru'},
    'lex_uz': {'site': 'lex.uz', 'lang': 'uz'},
    'normativ_uz': {'site': 'norma.uz', 'lang': 'uz'},
}


def web_search_configured() -> bool:
    g_key = (getattr(settings, 'GOOGLE_CSE_API_KEY', '') or '').strip()
    g_cx = (getattr(settings, 'GOOGLE_CSE_CX', '') or '').strip()
    b_key = (getattr(settings, 'BING_SEARCH_API_KEY', '') or '').strip()
    return bool((g_key and g_cx) or b_key)


def _rate_sleep() -> None:
    time.sleep(float(getattr(settings, 'ANTIPLAG_WEB_SEARCH_DELAY_SEC', 0.4)))


def _build_query(sentence: str, module_id: str) -> str:
    profile = MODULE_SEARCH_PROFILE.get(module_id, {'site': None, 'lang': 'ru'})
    words = sentence.split()[:14]
    q = ' '.join(words)
    site = profile.get('site')
    if site:
        q = f'site:{site} {q}'
    extra = profile.get('extra')
    if extra:
        q = f'{q} {extra}'
    hosts = profile.get('boost_hosts')
    if hosts and module_id == 'internet_ru_paraphrase':
        q = f'{q} ({" OR ".join(f"site:{h}" for h in hosts[:3])})'
    return q[:240]


def search_google_cse(query: str, *, num: int = 4) -> list[dict[str, str]]:
    key = (getattr(settings, 'GOOGLE_CSE_API_KEY', '') or '').strip()
    cx = (getattr(settings, 'GOOGLE_CSE_CX', '') or '').strip()
    if not key or not cx:
        return []

    cached = get_cached('google_cse', query)
    if cached is not None:
        return cached

    params = {
        'key': key,
        'cx': cx,
        'q': query,
        'num': min(10, num),
    }
    try:
        _rate_sleep()
        resp = requests.get(
            'https://www.googleapis.com/customsearch/v1',
            params=params,
            timeout=12,
            headers={'User-Agent': USER_AGENT},
        )
        resp.raise_for_status()
        items = resp.json().get('items') or []
    except Exception as exc:
        logger.warning('Google CSE xato: %s', exc)
        return []

    results = []
    for it in items:
        snippet = re.sub(r'\s+', ' ', (it.get('snippet') or '')).strip()
        if len(snippet) < 30:
            continue
        results.append({
            'title': (it.get('title') or '')[:300],
            'url': (it.get('link') or '')[:500],
            'snippet': snippet[:1500],
        })

    set_cached('google_cse', query, results)
    return results


def search_bing(query: str, *, count: int = 4) -> list[dict[str, str]]:
    key = (getattr(settings, 'BING_SEARCH_API_KEY', '') or '').strip()
    if not key:
        return []

    cached = get_cached('bing_search', query)
    if cached is not None:
        return cached

    try:
        _rate_sleep()
        resp = requests.get(
            'https://api.bing.microsoft.com/v7.0/search',
            params={'q': query, 'count': count, 'textDecorations': False},
            headers={'Ocp-Apim-Subscription-Key': key, 'User-Agent': USER_AGENT},
            timeout=12,
        )
        resp.raise_for_status()
        web = resp.json().get('webPages', {}).get('value') or []
    except Exception as exc:
        logger.warning('Bing qidiruv xato: %s', exc)
        return []

    results = []
    for it in web:
        snippet = re.sub(r'\s+', ' ', (it.get('snippet') or '')).strip()
        if len(snippet) < 30:
            continue
        results.append({
            'title': (it.get('name') or '')[:300],
            'url': (it.get('url') or '')[:500],
            'snippet': snippet[:1500],
        })

    set_cached('bing_search', query, results)
    return results


def fetch_web_snippets(query: str, *, num: int = 4) -> list[dict[str, str]]:
    rows = search_google_cse(query, num=num)
    if rows:
        return rows
    return search_bing(query, count=num)


def search_for_module(sentence: str, module_id: str, *, num: int = 3) -> list[dict[str, str]]:
    q = _build_query(sentence, module_id)
    cache_key = f'{module_id}|{q}'
    cached = get_cached('web_mod', cache_key)
    if cached is not None:
        return cached
    rows = fetch_web_snippets(q, num=num)
    set_cached('web_mod', cache_key, rows)
    return rows
