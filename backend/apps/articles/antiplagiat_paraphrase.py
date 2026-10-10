"""Parafraz aniqlash — E5 + OpenSearch kNN + lexical filter."""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings

from apps.articles.antiplagiat_embeddings import (
    embeddings_available,
    is_paraphrase_pair,
)
from apps.articles.antiplagiat_modules import MODULE_CATALOG
from apps.articles.antiplagiat_opensearch import (
    opensearch_enabled,
    search_knn_fragments,
    search_text_fragments,
)
from apps.articles.antiplagiat_normalize import guess_lang
from apps.articles.antiplagiat_overlap import estimate_overlap_chars, sentence_overlap_score
from apps.articles.antiplagiat_privacy import is_own_or_excluded, safe_source_fields

logger = logging.getLogger(__name__)

PARAPHRASE_MODULE_IDS = {
    'semantic_paraphrase',
    'internet_ru_paraphrase',
    'internet_en_paraphrase',
    'garant_paraphrase',
    'garant_analytics',
    'elibrary_translations',
}


def _module_label(module_id: str) -> str:
    for m in MODULE_CATALOG:
        if m['id'] == module_id:
            return m['label']
    return module_id


def _pick_paraphrase_module(enabled: set[str]) -> str:
    for mid in (
        'internet_ru_paraphrase',
        'garant_paraphrase',
        'internet_en_paraphrase',
        'garant_analytics',
        'elibrary_translations',
    ):
        if mid in enabled:
            return mid
    return 'internet_ru_paraphrase'


def scan_paraphrase_hits(
    candidates: list[tuple[int, str]],
    enabled: set[str],
    *,
    limit: int = 35,
    exclude_article_id: str | None = None,
    exclude_author_id: str | None = None,
) -> list[dict[str, Any]]:
    if not (enabled & PARAPHRASE_MODULE_IDS):
        return []
    if not embeddings_available() and not opensearch_enabled():
        return []
    if not opensearch_enabled():
        # OpenSearch yo'q — lokal vektor indeksi (bepul): parafraz va tarjima plagiati
        from apps.articles.antiplagiat_vectors import local_vectors_ready

        if local_vectors_ready():
            return scan_local_vector_hits(
                candidates, limit=limit, exclude_article_id=exclude_article_id, exclude_author_id=exclude_author_id,
            )
        return []

    hits: list[dict[str, Any]] = []
    max_sent = int(getattr(settings, 'ANTIPLAG_PARAPHRASE_MAX_SENTENCES', 35))

    for _idx, sent in candidates[:max_sent]:
        sources: list[dict] = []
        if opensearch_enabled():
            sources.extend(search_knn_fragments(sent, k=6))
            if not sources:
                sources.extend(search_text_fragments(sent, size=4))
        else:
            continue

        for src in sources:
            if is_own_or_excluded(src, exclude_article_id=exclude_article_id, exclude_author_id=exclude_author_id):
                continue
            frag = src.get('fragment') or src.get('title') or ''
            if len(frag) < 40:
                continue
            lex = sentence_overlap_score(sent, frag)
            is_para, cos = is_paraphrase_pair(sent, frag, lexical_score=lex)
            if not is_para:
                continue
            oc = estimate_overlap_chars(sent, frag)
            if oc <= 0:
                oc = max(20, int(len(sent) * 0.35))
            # Parafraz ichki indeksdan (OpenSearch) topiladi — manba bazasi indeksdagi modul bo'yicha
            src_module = src.get('module_id') or 'milliy_reestr'
            hits.append({
                **safe_source_fields(
                    sentence=sent,
                    source_text=frag,
                    title=src.get('title') or '',
                    url=src.get('url') or '',
                    is_public=bool(src.get('is_public')),
                ),
                'snippet': sent[:220],
                'document_fragment': sent[:360],
                'search_module': f'{_module_label(src_module)} (parafraz)',
                'module_id': src_module,
                'match_type': 'verified',
                'match_subtype': 'paraphrase',
                'embedding_score': round(cos, 4),
                'lexical_score': round(lex, 4),
                'overlap_chars': oc,
                'similarity': 0.0,
            })
            if len(hits) >= limit:
                return hits

    return hits


def scan_local_vector_hits(
    candidates: list[tuple[int, str]],
    *,
    limit: int = 35,
    exclude_article_id: str | None = None,
    exclude_author_id: str | None = None,
) -> list[dict[str, Any]]:
    """
    Lokal vektor indeksi (antiplagiat_vectors) bo'yicha:
      - bir xil til: leksik o'xshashlik past, ma'no o'xshashligi yuqori → parafraz;
      - boshqa til (ru/en manba, uz matn va h.k.): ma'no o'xshashligi juda yuqori → tarjima plagiati.
    Leksik jihatdan aynan mos jumlalar bu yerda hisoblanmaydi — ularni asosiy (barmoq izi) qatlam topadi.
    """
    from apps.articles.antiplagiat_vectors import search_fragments

    max_sent = int(getattr(settings, 'ANTIPLAG_PARAPHRASE_MAX_SENTENCES', 35))
    para_thr = float(getattr(settings, 'ANTIPLAG_PARAPHRASE_THRESHOLD', 0.78))
    cross_thr = float(getattr(settings, 'ANTIPLAG_CROSSLINGUAL_THRESHOLD', 0.84))
    max_lex = float(getattr(settings, 'ANTIPLAG_PARAPHRASE_MAX_LEXICAL', 0.34))

    sents = [s for _i, s in candidates[:max_sent] if len(s or '') >= 40]
    if not sents:
        return []
    results = search_fragments(sents, top_k=3, min_score=min(para_thr, cross_thr))
    hits: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for sent, sources in zip(sents, results):
        sent_lang = guess_lang(sent)
        for src in sources:
            if is_own_or_excluded(src, exclude_article_id=exclude_article_id, exclude_author_id=exclude_author_id):
                continue
            frag = src.get('fragment') or ''
            if len(frag) < 40:
                continue
            cos = float(src.get('score') or 0.0)
            cross = guess_lang(frag) != sent_lang
            if cross:
                if cos < cross_thr:
                    continue
                lex = 0.0
            else:
                lex = sentence_overlap_score(sent, frag)
                if lex > max_lex or cos < para_thr:
                    continue
            key = (sent[:120], str(src.get('doc_id') or src.get('title') or ''))
            if key in seen:
                continue
            seen.add(key)
            oc = estimate_overlap_chars(sent, frag) if not cross else 0
            if oc <= 0:
                oc = max(20, int(len(sent) * (0.6 if cross else 0.35)))
            src_module = src.get('module_id') or 'milliy_reestr'
            hits.append({
                **safe_source_fields(
                    sentence=sent,
                    source_text=frag,
                    title=src.get('title') or '',
                    url=src.get('url') or '',
                    is_public=bool(src.get('is_public')),
                ),
                'snippet': sent[:220],
                'document_fragment': sent[:360],
                'search_module': f"{_module_label(src_module)} ({'tarjima' if cross else 'parafraz'})",
                'module_id': src_module,
                'match_type': 'verified',
                'match_subtype': 'translation' if cross else 'paraphrase',
                'embedding_score': round(cos, 4),
                'lexical_score': round(lex, 4),
                'overlap_chars': oc,
                'similarity': 0.0,
            })
            if len(hits) >= limit:
                return hits
    return hits
