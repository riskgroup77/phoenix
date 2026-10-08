"""
OpenSearch fragment indeksi — matn + ixtiyoriy E5 vektor (kNN parafraz qidiruv).
"""
from __future__ import annotations

import hashlib
import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


def opensearch_enabled() -> bool:
    if not getattr(settings, 'ANTIPLAG_OPENSEARCH_ENABLED', False):
        return False
    return bool((getattr(settings, 'ANTIPLAG_OPENSEARCH_URL', '') or '').strip())


def _client():
    if not opensearch_enabled():
        return None
    try:
        from opensearchpy import OpenSearch
    except ImportError:
        logger.warning('opensearch-py o\'rnatilmagan')
        return None

    from urllib.parse import urlparse

    url = (settings.ANTIPLAG_OPENSEARCH_URL or '').strip()
    parsed = urlparse(url if '://' in url else f'http://{url}')
    host = parsed.hostname or 'localhost'
    port = parsed.port or (443 if parsed.scheme == 'https' else 9200)
    use_ssl = parsed.scheme == 'https'

    auth = None
    user = (getattr(settings, 'ANTIPLAG_OPENSEARCH_USER', '') or '').strip()
    password = (getattr(settings, 'ANTIPLAG_OPENSEARCH_PASSWORD', '') or '').strip()
    if user and password:
        auth = (user, password)

    return OpenSearch(
        hosts=[{'host': host, 'port': port}],
        http_auth=auth,
        use_ssl=use_ssl,
        verify_certs=bool(getattr(settings, 'ANTIPLAG_OPENSEARCH_VERIFY_CERTS', False)),
        ssl_show_warn=False,
        timeout=30,
    )


def index_name() -> str:
    return (getattr(settings, 'ANTIPLAG_OPENSEARCH_INDEX', '') or 'phoenix_antiplag_fragments').strip()


def ensure_index(client, dim: int = 384) -> None:
    name = index_name()
    if client.indices.exists(index=name):
        return

    body: dict[str, Any] = {
        'settings': {
            'index': {
                'number_of_shards': 1,
                'number_of_replicas': 0,
                'knn': True,
            },
        },
        'mappings': {
            'properties': {
                'doc_id': {'type': 'keyword'},
                'chunk_id': {'type': 'keyword'},
                'title': {'type': 'text'},
                'url': {'type': 'keyword'},
                'fragment': {'type': 'text'},
                'module_id': {'type': 'keyword'},
                'source_type': {'type': 'keyword'},
                'is_public': {'type': 'boolean'},
                'author_id': {'type': 'keyword'},
                'embedding': {
                    'type': 'knn_vector',
                    'dimension': dim,
                    'method': {
                        'name': 'hnsw',
                        'space_type': 'cosinesimil',
                        'engine': 'nmslib',
                    },
                },
            },
        },
    }
    client.indices.create(index=name, body=body)
    logger.info('OpenSearch indeks yaratildi: %s', name)


def _chunk_id(doc_id: str, chunk: str, idx: int) -> str:
    h = hashlib.sha256(f'{doc_id}|{idx}|{chunk[:120]}'.encode()).hexdigest()[:24]
    return f'{doc_id}:{idx}:{h}'


def bulk_index_fragments(docs: list[dict[str, Any]], *, with_embeddings: bool = False) -> int:
    """
    docs: doc_id, title, url, fragment, module_id, source_type [, embedding]
    """
    client = _client()
    if not client:
        return 0

    from apps.articles.antiplagiat_embeddings import embed_passages, embedding_dimension

    dim = embedding_dimension() or 384
    ensure_index(client, dim=dim)

    actions: list[dict] = []
    texts_for_embed: list[str] = []
    embed_indices: list[int] = []

    for i, doc in enumerate(docs):
        body = {
            'doc_id': doc['doc_id'],
            'chunk_id': doc.get('chunk_id') or _chunk_id(doc['doc_id'], doc['fragment'], i),
            'title': doc.get('title', '')[:500],
            'url': doc.get('url', '')[:500],
            'fragment': doc['fragment'][:4000],
            'module_id': doc.get('module_id', 'milliy_reestr'),
            'source_type': doc.get('source_type', 'platform'),
            'is_public': bool(doc.get('is_public')),
            'author_id': doc.get('author_id', ''),
        }
        if with_embeddings:
            texts_for_embed.append(doc['fragment'])
            embed_indices.append(len(actions))
        actions.append(body)

    if with_embeddings and texts_for_embed:
        vectors = embed_passages(texts_for_embed)
        if vectors:
            for action_idx, vec in zip(embed_indices, vectors):
                if vec:
                    actions[action_idx]['embedding'] = vec

    name = index_name()
    indexed = 0
    batch = 400
    for start in range(0, len(actions), batch):
        chunk = actions[start : start + batch]
        bulk_body: list[Any] = []
        for row in chunk:
            bulk_body.append({'index': {'_index': name, '_id': row['chunk_id']}})
            bulk_body.append(row)
        try:
            resp = client.bulk(body=bulk_body, refresh=False)
            if resp.get('errors'):
                logger.warning('OpenSearch bulk qism xato: %s', resp.get('items', [])[:2])
            indexed += len(chunk)
        except Exception as exc:
            logger.error('OpenSearch bulk xato: %s', exc)
            break

    try:
        client.indices.refresh(index=name)
    except Exception:
        pass
    return indexed


def search_text_fragments(query: str, *, size: int = 12, module_id: str | None = None) -> list[dict[str, Any]]:
    client = _client()
    if not client or not query.strip():
        return []

    must: list[dict] = [
        {
            'multi_match': {
                'query': query[:600],
                'fields': ['fragment^3', 'title^2'],
                'type': 'best_fields',
                'minimum_should_match': '60%',
            },
        },
    ]
    if module_id:
        must.append({'term': {'module_id': module_id}})

    body = {'size': size, 'query': {'bool': {'must': must}}}
    try:
        resp = client.search(index=index_name(), body=body)
    except Exception as exc:
        logger.warning('OpenSearch text qidiruv xato: %s', exc)
        return []

    out: list[dict] = []
    for hit in resp.get('hits', {}).get('hits', []):
        src = hit.get('_source') or {}
        out.append({
            **src,
            '_score': float(hit.get('_score') or 0),
        })
    return out


def search_knn_fragments(query: str, *, k: int = 8) -> list[dict[str, Any]]:
    client = _client()
    if not client or not query.strip():
        return []

    from apps.articles.antiplagiat_embeddings import embed_passages

    vecs = embed_passages([query])
    if not vecs or not vecs[0]:
        return []

    vector = vecs[0]
    body = {
        'size': k,
        'query': {
            'knn': {
                'embedding': {
                    'vector': vector,
                    'k': k,
                },
            },
        },
    }
    try:
        resp = client.search(index=index_name(), body=body)
    except Exception as exc:
        logger.warning('OpenSearch kNN xato: %s', exc)
        return search_text_fragments(query, size=k)

    out: list[dict] = []
    for hit in resp.get('hits', {}).get('hits', []):
        src = hit.get('_source') or {}
        out.append({
            **src,
            '_knn_score': float(hit.get('_score') or 0),
        })
    return out
