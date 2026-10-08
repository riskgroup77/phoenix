"""OpenSearch indeksiga yuklash uchun fragmentlar ro'yxati."""
from __future__ import annotations

from typing import Any

from apps.articles.antiplagiat_corpus import load_platform_corpus
from apps.articles.antiplagiat_text_chunk import iter_text_chunks


def build_fragment_documents(*, exclude_article_id=None) -> list[dict[str, Any]]:
    corpus = load_platform_corpus(exclude_article_id)
    documents: list[dict[str, Any]] = []

    for entry in corpus:
        doc_id = str(entry.get('id') or '')
        title = entry.get('title') or ''
        url = entry.get('doi') or ''
        if url and not str(url).startswith('http'):
            url = f'https://doi.org/{url}'
        if not url.startswith('http'):
            url = f'https://ilmiyfaoliyat.uz/#/articles/{doc_id}'

        source_type = entry.get('source_type') or 'platform'
        module_id = 'milliy_reestr' if source_type == 'platform' else 'natlib_uz'

        for idx, chunk in enumerate(iter_text_chunks(entry.get('text') or '')):
            documents.append({
                'doc_id': doc_id,
                'chunk_id': f'{doc_id}:c{idx}',
                'title': title[:500],
                'url': url[:500],
                'fragment': chunk,
                'module_id': module_id,
                'source_type': source_type,
                # Hisobotda nashr etilmagan matnni yashirish va o'z hujjatini chiqarib tashlash uchun
                'is_public': bool(entry.get('is_public')),
                'author_id': str(entry.get('author_id') or ''),
            })

    return documents
