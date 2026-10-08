"""
Haqiqiy overlap skaner (algoritm 5.0): ichki baza + OpenAlex/Crossref/Semantic Scholar/CORE + to'liq matnlar
+ shablon + o'z-o'ziga iqtibos + web. Simulyatsiyasiz manbalar (match_type=verified).

Ichki baza:
  - barmoq izlari indeksi mavjud bo'lsa (build_antiplag_index) — BUTUN hujjat indeks bilan solishtiriladi;
  - indeks hali qurilmagan bo'lsa — korpus xotiraga yuklanib, BUTUN hujjat har bir korpus hujjati bilan
    barmoq izlari usulida solishtiriladi (sekinroq, kichik bazalar uchun).
Ochiq API'lar: har modulga alohida so'rov limiti, hujjat bo'ylab tanlangan gaplar, parallel oqimlar;
topilgan har bir ish (annotatsiya, ochiq PDF) butun hujjat bilan solishtiriladi.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Callable

from django.conf import settings

from apps.articles.antiplagiat_deep_scan import (
    Sentence,
    _pick_corpus_module,
    compare_source,
    fetch_fulltext,
    html_to_text,
    query_text,
    run_parallel,
    scan_index_hits,
    select_query_sentences,
    split_sentences_with_offsets,
)
from apps.articles.antiplagiat_modules import (
    CORPUS_MODULE_IDS,
    INTERNET_MODULE_IDS,
    MODULE_CATALOG,
    UZ_LEGAL_MODULE_IDS,
)
from apps.articles.antiplagiat_normalize import tokenize
from apps.articles.antiplagiat_open_api import (
    search_arxiv,
    search_core,
    search_crossref,
    search_doaj,
    search_europe_pmc,
    search_openalex,
    search_semantic_scholar,
    search_wikipedia,
)
from apps.articles.antiplagiat_opensearch import opensearch_enabled
from apps.articles.antiplagiat_opensearch_scan import scan_opensearch_hits
from apps.articles.antiplagiat_overlap import (
    assign_hit_char_shares,
    compute_verified_coverage,
    dedupe_hits,
)
from apps.articles.antiplagiat_paraphrase import scan_paraphrase_hits
from apps.articles.antiplagiat_template_phrases import find_template_hits_in_sentence
from apps.articles.antiplagiat_web_scan import scan_web_snippet_hits
from apps.articles.antiplagiat_web_search import GARANT_MODULE_IDS, web_search_configured

logger = logging.getLogger(__name__)

ProgressCallback = Callable[..., None]

OPEN_API_SEARCHERS: dict[str, Callable[..., list[dict[str, Any]]]] = {
    'openalex': search_openalex,
    'crossref': search_crossref,
    'semantic_scholar': search_semantic_scholar,
    'core_ac': search_core,
    # Kalitsiz bepul manbalar
    'doaj': search_doaj,
    'wikipedia': search_wikipedia,
    'arxiv': search_arxiv,
    'europe_pmc': search_europe_pmc,
}

# Modul bo'yicha so'rov profili: qaysi tildagi gaplar, nechta so'rov, so'rovda nechta so'z.
# arXiv / Europe PMC — asosan ingliz tilidagi ishlar (o'zbekcha gap bilan so'rash befoyda);
# DOAJ barcha so'zlarni "VA" bilan qidiradi — qisqa so'rov kerak; arXiv 3 soniyada 1 so'rovga ruxsat beradi.
MODULE_QUERY_PROFILE: dict[str, dict[str, Any]] = {
    'doaj': {'budget': 20, 'words': 6},
    'wikipedia': {'budget': 20, 'words': 8, 'lang_param': True},
    'arxiv': {'budget': 10, 'words': 6, 'langs': {'en'}},
    'europe_pmc': {'budget': 15, 'words': 10, 'langs': {'en'}},
}


def _module_label(module_id: str) -> str:
    for m in MODULE_CATALOG:
        if m['id'] == module_id:
            return m['label']
    return module_id


def _pick_candidate_sentences(sentences: list[str], *, max_count: int) -> list[tuple[int, str]]:
    """Gap bo'yicha ishlaydigan qo'shimcha skanerlar (OpenSearch, parafraz) uchun gaplar (indeks, matn)."""
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


# ---------------------------------------------------------------- ichki baza

def scan_corpus_memory_hits(
    text: str,
    sentences: list[Sentence],
    doc_tokens,
    corpus: list[dict],
    enabled_corpus: set[str],
    *,
    exclude_article_id: str | None,
    exclude_author_id: str | None,
) -> tuple[list[dict[str, Any]], set[str]]:
    """Indeks bo'lmaganda: butun hujjat ↔ har bir korpus hujjati (barmoq izlari usulida, xotirada)."""
    from apps.articles.antiplagiat_fingerprint import shingles

    q_hashes = {h for h, _ in shingles(doc_tokens)}
    doc_stems = {t.stem for t in doc_tokens}
    hits: list[dict[str, Any]] = []
    executed: set[str] = set()
    for entry in corpus:
        if exclude_article_id and str(entry.get('id') or '') in (exclude_article_id, f'import:{exclude_article_id}'):
            continue
        body = entry.get('text') or ''
        if len(body) < 40:
            continue
        source_type = entry.get('source_type') or 'platform'
        if enabled_corpus:
            executed.add(_pick_corpus_module(source_type, enabled_corpus))
        is_self = bool(exclude_author_id and str(entry.get('author_id') or '') == str(exclude_author_id))
        if not is_self and not enabled_corpus:
            continue
        src_tokens = tokenize(body)
        # Tez filtr: umumiy bo'lak ham, yetarli umumiy o'zak ham bo'lmasa — solishtirilmaydi
        if sum(1 for h, _ in shingles(src_tokens) if h in q_hashes) < 2:
            if len(doc_stems & {t.stem for t in src_tokens}) < 4:
                continue
        mid = 'iqtibos_keltirish' if is_self else _pick_corpus_module(source_type, enabled_corpus)
        hits += compare_source(
            text, sentences, doc_tokens, body,
            title=(entry.get('title') or '')[:300], url=_corpus_url(entry),
            module_id=mid, module_label=_module_label(mid), is_public=bool(entry.get('is_public')),
            self_citation=is_self, source_tokens=src_tokens,
        )
    return hits, executed


def _index_modules(enabled_corpus: set[str]) -> set[str]:
    """Indeksda haqiqatda mavjud manba turlariga mos modullar."""
    from apps.articles.models import AntiplagIndexedDocument

    types = set(
        AntiplagIndexedDocument.objects.exclude(kind='meta').values_list('source_type', flat=True).distinct()
    )
    return {_pick_corpus_module(t, enabled_corpus) for t in types} if enabled_corpus else set()


def scan_template_hits(
    sentences: list[tuple[int, str]],
    *,
    limit: int = 400,
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


# ---------------------------------------------------------------- ochiq API va to'liq matnlar

def _work_key(item: dict) -> str:
    doi = (item.get('doi') or '').lower().replace('https://doi.org/', '').strip()
    return doi or (item.get('url') or '').lower().strip() or (item.get('title') or '').lower().strip()


def scan_api_hits(
    text: str,
    sentences: list[Sentence],
    doc_tokens,
    enabled: set[str],
    *,
    progress_callback: ProgressCallback | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Har bir ochiq API moduli uchun alohida limit (ANTIPLAG_OPEN_API_QUERIES_PER_MODULE), so'rovlar hujjat
    bo'ylab tanlangan "o'ziga xos" gaplardan; modullar parallel. Topilgan har bir ish butun hujjat bilan
    solishtiriladi; ochiq PDF'i borlari (ANTIPLAG_FULLTEXT_MAX_DOCS tagacha) to'liq matni bilan.
    """
    from apps.articles.antiplagiat_normalize import guess_lang

    modules = sorted(m for m in enabled if m in OPEN_API_SEARCHERS)
    stats: dict[str, Any] = {'api_queries': 0, 'api_works_compared': 0, 'fulltext_docs': 0}
    if not modules:
        return [], stats

    default_budget = int(getattr(settings, 'ANTIPLAG_OPEN_API_QUERIES_PER_MODULE', 30))
    lang_of = {s.idx: guess_lang(s.text) for s in sentences}

    def module_queries(mid: str) -> list[tuple[str, str]]:
        prof = MODULE_QUERY_PROFILE.get(mid, {})
        langs = prof.get('langs')
        pool = [s for s in sentences if not langs or lang_of[s.idx] in langs]
        picked = select_query_sentences(pool, min(default_budget, prof.get('budget', default_budget)))
        out = []
        for s in picked:
            q = query_text(s.text, max_words=prof.get('words', 14))
            if len(q.split()) >= 5:
                out.append((q, lang_of[s.idx]))
        return out

    def run_module(mid: str):
        fn = OPEN_API_SEARCHERS[mid]
        lang_param = MODULE_QUERY_PROFILE.get(mid, {}).get('lang_param')
        found, n = [], 0
        for q, lang in module_queries(mid):
            n += 1
            try:
                found.extend((fn(q, lang=lang) if lang_param else fn(q)) or [])
            except Exception as exc:
                logger.warning('%s qidiruv xato: %s', mid, exc)
        return mid, found, n

    outs = run_parallel([(lambda m=m: run_module(m)) for m in modules], workers=max(4, len(modules)))
    stats['api_queries'] = sum(o[2] for o in outs if o)

    works: dict[str, dict[str, Any]] = {}
    for out in outs:
        if not out:
            continue
        mid, results, _n = out
        for item in results:
            key = _work_key(item)
            if not key:
                continue
            if key in works:
                works[key]['count'] += 1
                if not works[key]['item'].get('pdf_url') and item.get('pdf_url'):
                    works[key]['item']['pdf_url'] = item['pdf_url']
                if len(item.get('abstract') or '') > len(works[key]['item'].get('abstract') or ''):
                    works[key]['item']['abstract'] = item['abstract']
                continue
            works[key] = {'mid': mid, 'item': dict(item), 'count': 1, 'hits': []}

    if progress_callback:
        progress_callback(phase='real_scan', progress_percent=55,
                          module_label=f'Ochiq bazalar: {len(works)} ta ish solishtirilmoqda')

    for w in works.values():
        item, mid = w['item'], w['mid']
        body = '\n'.join(p for p in [item.get('title') or '', html_to_text(item.get('abstract') or '')] if p)
        w['hits'] = compare_source(
            text, sentences, doc_tokens, body,
            title=(item.get('title') or 'Ilmiy ish')[:300], url=item.get('url') or '',
            module_id=mid, module_label=_module_label(mid), subtype='abstract',
        )
    stats['api_works_compared'] = len(works)

    # To'liq matn: avval annotatsiyasida moslik topilganlar, keyin ko'p so'rovda chiqqanlar
    max_ft = int(getattr(settings, 'ANTIPLAG_FULLTEXT_MAX_DOCS', 6))
    if getattr(settings, 'ANTIPLAG_FULLTEXT_ENABLED', True) and max_ft > 0:
        ranked = sorted(
            (w for w in works.values() if w['item'].get('pdf_url') or w['item'].get('landing_url')),
            key=lambda w: (sum(int(h.get('overlap_chars') or 0) for h in w['hits']), w['count']),
            reverse=True,
        )[:max_ft]
        texts = run_parallel([(lambda it=w['item']: _work_full_text(it)) for w in ranked], workers=3)
        for w, body in zip(ranked, texts):
            if not body or len(body) < 400:
                continue
            item, mid = w['item'], w['mid']
            ft_hits = compare_source(
                text, sentences, doc_tokens, body,
                title=(item.get('title') or 'Ilmiy ish')[:300],
                url=item.get('url') or item.get('pdf_url') or item.get('landing_url') or '',
                module_id=mid, module_label=_module_label(mid), subtype='full_text',
            )
            stats['fulltext_docs'] += 1
            if ft_hits:
                # To'liq matn annotatsiyani o'z ichiga oladi — shu ish uchun to'liq natija qoldiriladi
                w['hits'] = ft_hits

    hits = [h for w in works.values() for h in w['hits']]
    return hits, stats


def _work_full_text(item: dict) -> str:
    """Ochiq PDF / HTML; PDF havolasi bo'lmasa — jurnal sahifasidagi citation_pdf_url orqali (DOAJ, OJS)."""
    if item.get('pdf_url'):
        return fetch_fulltext(item['pdf_url'])
    from apps.articles.antiplagiat_oai import full_text_for

    return full_text_for(item.get('landing_url') or '')


def scan_web_page_hits(
    text: str,
    sentences: list[Sentence],
    doc_tokens,
    web_hits: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], set[str]]:
    """Web qidiruvda topilgan sahifalarning to'liq matni butun hujjat bilan (ANTIPLAG_WEB_FETCH_PAGES tagacha)."""
    max_pages = int(getattr(settings, 'ANTIPLAG_WEB_FETCH_PAGES', 5))
    if max_pages <= 0 or not web_hits:
        return [], set()
    weight: dict[str, int] = {}
    meta: dict[str, dict] = {}
    for h in web_hits:
        url = h.get('source') or ''
        if not url.startswith(('http://', 'https://')):
            continue
        weight[url] = weight.get(url, 0) + int(h.get('overlap_chars') or 0)
        meta.setdefault(url, h)
    urls = sorted(weight, key=weight.get, reverse=True)[:max_pages]
    bodies = run_parallel([(lambda u=u: fetch_fulltext(u)) for u in urls], workers=3)
    hits: list[dict[str, Any]] = []
    replaced: set[str] = set()
    for url, body in zip(urls, bodies):
        if not body or len(body) < 200:
            continue
        h0 = meta[url]
        page_hits = compare_source(
            text, sentences, doc_tokens, body,
            title=h0.get('title') or url, url=url, module_id=h0.get('module_id') or 'internet',
            module_label=h0.get('search_module') or '', subtype='web_page',
        )
        if page_hits:
            hits += page_hits
            replaced.add(url)
    return hits, replaced


# ---------------------------------------------------------------- asosiy skaner

def _trim_repeated_source_text(hits: list[dict[str, Any]]) -> None:
    """Bitta manbaning to'liq matni hisobotda bir marta saqlanadi (yuzlab gapda takrorlanmasin)."""
    seen: set[str] = set()
    for h in hits:
        key = (h.get('source') or h.get('title') or '')[:300]
        if not h.get('source_text'):
            continue
        if key in seen:
            h['source_text'] = ''
        else:
            seen.add(key)


def run_real_antiplag_scan(
    text: str,
    sentences: list[str],
    *,
    corpus: list[dict] | None,
    enabled: set[str],
    exclude_article_id: str | None = None,
    exclude_author_id: str | None = None,
    progress_callback: ProgressCallback | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not getattr(settings, 'ANTIPLAG_REAL_SCAN_ENABLED', True):
        return [], {}

    from apps.articles.antiplagiat_index import index_ready

    total_chars = len(re.sub(r'\s+', '', text or '')) or len(text or '') or 1
    sents = split_sentences_with_offsets(text)
    doc_tokens = tokenize(text)
    max_sent = int(getattr(settings, 'ANTIPLAG_REAL_SCAN_MAX_SENTENCES', 220))
    candidates = _pick_candidate_sentences(sentences, max_count=max_sent)
    all_pairs = [(s.idx, s.text) for s in sents]

    if progress_callback:
        progress_callback(
            phase='real_scan',
            module_label='Ichki baza: butun hujjat barmoq izlari bo\'yicha',
            module_id='real_scan',
            progress_percent=12,
        )

    hits: list[dict[str, Any]] = []
    enabled_corpus = enabled & CORPUS_MODULE_IDS
    # Haqiqatda bajarilgan modullar — hisobot va sertifikatda faqat shular ko'rsatiladi
    executed: set[str] = set()
    full_scan = False
    index_used = False
    corpus_docs = 0

    if enabled_corpus or exclude_author_id:
        if index_ready():
            index_used = True
            idx_hits, idx_mods = scan_index_hits(
                text, sents, doc_tokens,
                enabled_corpus=enabled_corpus or {'milliy_reestr'},
                module_label=_module_label,
                exclude_article_id=exclude_article_id,
                exclude_author_id=exclude_author_id,
                self_citation_enabled=True,
            )
            if not enabled_corpus:
                # Faqat o'z-o'ziga iqtibos so'ralgan — begona manbalar hisobga olinmaydi
                idx_hits = [h for h in idx_hits if h.get('self_citation')]
            hits += idx_hits
            if enabled_corpus:
                executed |= _index_modules(enabled_corpus) | (idx_mods & CORPUS_MODULE_IDS)
            from apps.articles.models import AntiplagIndexedDocument

            corpus_docs = AntiplagIndexedDocument.objects.exclude(kind='meta').count()
        else:
            corpus_list = corpus or []
            mem_hits, mem_mods = scan_corpus_memory_hits(
                text, sents, doc_tokens, corpus_list, enabled_corpus,
                exclude_article_id=exclude_article_id, exclude_author_id=exclude_author_id,
            )
            hits += mem_hits
            executed |= mem_mods
            corpus_docs = len(corpus_list)
        full_scan = True

    os_hits = scan_opensearch_hits(
        candidates, enabled, exclude_article_id=exclude_article_id, exclude_author_id=exclude_author_id,
    )
    hits.extend(os_hits)
    if opensearch_enabled() and enabled_corpus:
        executed.add(sorted(enabled_corpus)[0] if 'milliy_reestr' not in enabled_corpus else 'milliy_reestr')

    if progress_callback:
        progress_callback(phase='real_scan', progress_percent=35, sources_found=len(hits))

    if exclude_author_id and 'iqtibos_keltirish' in enabled:
        executed.add('iqtibos_keltirish')

    if 'shablon_iboralar' in enabled:
        hits.extend(scan_template_hits(all_pairs))
        executed.add('shablon_iboralar')

    open_enabled = enabled & set(OPEN_API_SEARCHERS)
    api_stats: dict[str, Any] = {}
    if open_enabled:
        if progress_callback:
            progress_callback(phase='real_scan', progress_percent=45,
                              module_label='Ochiq ilmiy bazalar (OpenAlex, Crossref...)')
        api_hits, api_stats = scan_api_hits(text, sents, doc_tokens, open_enabled,
                                            progress_callback=progress_callback)
        hits.extend(api_hits)
        executed |= open_enabled

    para_before = len(hits)
    hits.extend(scan_paraphrase_hits(
        candidates, enabled, exclude_article_id=exclude_article_id, exclude_author_id=exclude_author_id,
    ))
    paraphrase_added = len(hits) - para_before

    web_max = int(getattr(settings, 'ANTIPLAG_WEB_MAX_QUERIES', 35))
    web_candidates = [(s.idx, s.text) for s in select_query_sentences(sents, web_max)]
    web_hits = scan_web_snippet_hits(web_candidates, enabled)
    page_hits, replaced_urls = scan_web_page_hits(text, sents, doc_tokens, web_hits)
    web_hits = [h for h in web_hits if h.get('source') not in replaced_urls] + page_hits
    hits.extend(web_hits)
    web_added = len(web_hits)
    if web_search_configured():
        executed |= set(sorted(enabled & (INTERNET_MODULE_IDS | GARANT_MODULE_IDS | UZ_LEGAL_MODULE_IDS))[:8])

    hits = dedupe_hits(hits)
    _trim_repeated_source_text(hits)
    hits = assign_hit_char_shares(hits, total_chars)
    coverage = compute_verified_coverage(hits, total_chars, text=text)
    coverage['total_chars'] = total_chars
    coverage['real_scan_hits'] = len(hits)
    coverage['paraphrase_hits'] = paraphrase_added
    coverage['web_snippet_hits'] = web_added
    coverage['web_pages_compared'] = len(replaced_urls)
    coverage['opensearch_used'] = opensearch_enabled()
    coverage['executed_modules'] = sorted(executed)
    # Barmoq izlari bilan butun hujjat tekshirilganda — barcha gaplar tekshirilgan
    coverage['checked_sentences'] = len(sentences) if full_scan else len(candidates)
    coverage['total_sentences'] = len(sentences)
    coverage['index_used'] = index_used
    coverage['full_scan'] = full_scan
    coverage['corpus_documents'] = corpus_docs
    coverage.update(api_stats)

    if progress_callback:
        progress_callback(
            phase='real_scan_done',
            progress_percent=80,
            sources_found=len(hits),
            module_label=f'Haqiqiy manbalar: {len(hits)} ta',
        )

    logger.info(
        'real antiplag scan: hits=%s verified_plag=%s%% index=%s',
        len(hits),
        coverage.get('verified_plagiarism_pct'),
        index_used,
    )
    return hits, coverage
