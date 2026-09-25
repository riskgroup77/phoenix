"""Antiplagiat tashqi API javoblari uchun cache."""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


def _ttl() -> int:
    return int(getattr(settings, 'ANTIPLAG_API_CACHE_TTL', 86400))


def cache_key(namespace: str, query: str) -> str:
    raw = f'{namespace}:{query.strip().lower()[:500]}'
    digest = hashlib.sha256(raw.encode('utf-8', errors='ignore')).hexdigest()[:32]
    return f'antiplag:{namespace}:{digest}'


def get_cached(namespace: str, query: str) -> Any | None:
    try:
        raw = cache.get(cache_key(namespace, query))
        if raw is None:
            return None
        return json.loads(raw) if isinstance(raw, str) else raw
    except Exception as exc:
        logger.debug('antiplag cache get: %s', exc)
        return None


def set_cached(namespace: str, query: str, value: Any) -> None:
    try:
        cache.set(
            cache_key(namespace, query),
            json.dumps(value, ensure_ascii=False),
            timeout=_ttl(),
        )
    except Exception as exc:
        logger.debug('antiplag cache set: %s', exc)
