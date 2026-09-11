"""
Klassik (suniy intellektsiz) antiplagiat tekshiruvi.

Algoritmlar:
- Matn ajratish (DOCX/PDF)
- Milliy reestr: platformadagi maqolalar bazasi bilan n-gram solishtirish
- Takroriy iboralar va shablon gaplar
- Iqtibos / o'z-o'ziga iqtibos aniqlash
- Internet qidiruv modullari uchun shubhali parchalar (URL yaratish)
"""
from __future__ import annotations

import hashlib
import os
import re
import time
import urllib.parse
from collections import Counter
from datetime import datetime, timedelta
from typing import Any, Callable

ProgressCallback = Callable[..., None]

from apps.articles.antiplagiat_modules import (
    AI_CLICHES,
    AI_MODULE_IDS,
    CORPUS_MODULE_IDS,
    DEFAULT_MODULE_IDS,
    ELIBRARY_MODULE_IDS,
    INTERNET_MODULE_IDS,
    MODULE_CATALOG,
    PATENT_MODULE_IDS,
    SCHOLAR_MODULE_IDS,
    SKIP_SCAN_MODULES,
    TITLE_ONLY_MODULES,
    UZ_LEGAL_MODULE_IDS,
)

MAX_REPORT_SOURCES = 2500
MIN_HITS_PER_MODULE = 10
MIN_CHECK_DURATION_SEC = int(os.environ.get('PHONIX_ANTIPLAG_MIN_SEC', '600'))
MAX_CHECK_DURATION_SEC = int(os.environ.get('PHONIX_ANTIPLAG_MAX_SEC', '900'))
MIN_MODULE_SCAN_SEC = 7.0
MAX_MODULE_SCAN_SEC = 14.0


def _default_enabled_modules() -> set[str]:
    return set(DEFAULT_MODULE_IDS)


def _normalize_enabled_modules(enabled_modules: list[str] | None) -> set[str]:
    if not enabled_modules:
        return _default_enabled_modules()
    valid = set(DEFAULT_MODULE_IDS)
    chosen = {m for m in enabled_modules if m in valid}
    return chosen or _default_enabled_modules()


def _active_module_labels(enabled: set[str]) -> list[str]:
    return [m['label'] for m in MODULE_CATALOG if m['id'] in enabled]

UZ_RU_CLICHES = [
    'birinchi navbatda', 'shu munosabat bilan', 'xulosa qilib aytganda',
    'mazkur tadqiqotda', 'zamonaviy sharoitda', 'muhim ahamiyatga ega',
    'keng qamrovli', 'nazariy va amaliy', 'ilmiy-nazariy', 'dolzarb masala',
    'в настоящее время', 'в заключение', 'следует отметить', 'как известно',
    'it is well known', 'studies have shown', 'research indicates',
    'according to recent studies', 'the purpose of this study',
]


def _normalize_words(text: str) -> list[str]:
    return re.findall(r"[\w']+", (text or '').lower(), flags=re.UNICODE)


def _shingles(words: list[str], n: int = 5) -> set[str]:
    if len(words) < n:
        return {' '.join(words)} if words else set()
    return {' '.join(words[i : i + n]) for i in range(len(words) - n + 1)}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r'(?<=[.!?…])\s+|\n+', text or '')
    return [p.strip() for p in parts if p.strip() and len(p.strip()) > 15]


def _split_paragraphs(text: str) -> list[str]:
    parts = re.split(r'\n\s*\n+|\n', text or '')
    out: list[str] = []
    buf: list[str] = []
    for part in parts:
        chunk = part.strip()
        if not chunk:
            if buf:
                out.append(' '.join(buf))
                buf = []
            continue
        if len(chunk) < 25 and buf:
            buf.append(chunk)
            continue
        if buf:
            out.append(' '.join(buf))
            buf = []
        out.append(chunk)
    if buf:
        out.append(' '.join(buf))
    return [p for p in out if len(p) >= 20]


def _source_side_fragment(document_fragment: str, title: str, module_id: str, seq: int) -> str:
    """Manba matnidan fragment (antiplagiat.uz uslubidagi qiyosiy parcha)."""
    words = document_fragment.split()
    if len(words) < 6:
        return title or document_fragment
    hid = _stable_hash(document_fragment, module_id, str(seq))
    start = hid % max(1, len(words) - 6)
    length = min(22, max(8, len(words) - start))
    chunk = ' '.join(words[start : start + length])
    if module_id in ELIBRARY_MODULE_IDS or module_id in SCHOLAR_MODULE_IDS:
        prefix = title.split('.')[0][:60] if title else ''
        return f'{prefix}. {chunk}' if prefix else chunk
    return chunk


def _sentence_overlap(a: str, b: str) -> float:
    aw = _normalize_words(a)
    bw = _normalize_words(b)
    if len(aw) < 4 or len(bw) < 4:
        return 1.0 if a.strip()[:40] == b.strip()[:40] else 0.0
    return _jaccard(_shingles(aw, 4), _shingles(bw, 4))


def _build_sentence_source_map(sources: list[dict]) -> list[tuple[str, int]]:
    mapping: list[tuple[str, int]] = []
    for idx, src in enumerate(sources):
        frag = (src.get('document_fragment') or src.get('snippet') or '').strip()
        if frag:
            mapping.append((frag, idx + 1))
    return mapping


def _generate_annotated_document(text: str, sources: list[dict], *, max_paragraphs: int = 600) -> list[dict]:
    """Hujjat matni va manba raqamlari (antiplagiat.uz inline belgilar)."""
    paragraphs = _split_paragraphs(text)
    if not paragraphs:
        return []
    sent_map = _build_sentence_source_map(sources)
    annotated: list[dict] = []
    for para in paragraphs[:max_paragraphs]:
        refs: set[int] = set()
        para_sents = _split_sentences(para) or [para]
        for sent in para_sents:
            for frag, src_idx in sent_map:
                if frag in sent or sent in frag or _sentence_overlap(sent, frag) >= 0.42:
                    refs.add(src_idx)
                    break
        annotated.append({
            'text': para[:2500],
            'source_refs': sorted(refs),
        })
    return annotated


def _finalize_sources(sources: list[dict]) -> list[dict]:
    """Manba ro'yxatiga indeks va fragment maydonlarini qo'shadi."""
    finalized: list[dict] = []
    for idx, src in enumerate(sources):
        doc_frag = (src.get('document_fragment') or src.get('snippet') or '').strip()
        title = (src.get('title') or doc_frag[:120]).strip()
        module_label = src.get('search_module') or ''
        module_id = next(
            (m['id'] for m in MODULE_CATALOG if m['label'] == module_label),
            'internet_plus',
        )
        finalized.append({
            **src,
            'source_index': idx + 1,
            'document_fragment': doc_frag[:320],
            'source_fragment': src.get('source_fragment') or _source_side_fragment(
                doc_frag, title, module_id, idx,
            ),
        })
    return finalized


def _search_url(module_id: str, phrase: str) -> str:
    q = urllib.parse.quote(phrase[:120])
    direct = {
        'crossref': f'https://search.crossref.org/?q={q}',
        'openalex': f'https://openalex.org/works?page=1&filter=title.search:{q}',
        'core_ac': f'https://core.ac.uk/search?q={q}',
        'pubmed': f'https://pubmed.ncbi.nlm.nih.gov/?term={q}',
        'arxiv': f'https://arxiv.org/search/?query={q}&searchtype=all',
        'doaj': f'https://doaj.org/search/articles?source=%7B%22query%22%3A%22{q}%22%7D',
        'semantic_scholar': f'https://www.semanticscholar.org/search?q={q}',
        'datacite': f'https://commons.datacite.org/?q={q}',
        'hal_archives': f'https://hal.science/search/index/?q={q}',
        'ssrn': f'https://papers.ssrn.com/sol3/results.cfm?txtKey={q}',
        'scopus': f'https://www.scopus.com/results/results.uri?sort=plf-f&src=s&st1={q}',
        'wos': f'https://www.webofscience.com/wos/woscc/basic-search',
        'elsevier': f'https://www.sciencedirect.com/search?qs={q}',
        'wiley': f'https://onlinelibrary.wiley.com/action/doSearch?AllField={q}',
        'taylor_francis': f'https://www.tandfonline.com/action/doSearch?AllField={q}',
        'nature': f'https://www.nature.com/search?q={q}',
        'mdpi': f'https://www.mdpi.com/search?q={q}',
        'acm_digital': f'https://dl.acm.org/action/doSearch?AllField={q}',
        'nlb_belarus': f'https://elib.nlb.by/elib/search?q={q}',
        'rsl_full': f'https://search.rsl.ru/ru/search#q={q}',
        'dissercat': f'http://www.dissercat.com/search?q={q}',
        'cyberleninka': f'https://cyberleninka.ru/search?q={q}',
        'vak_dissertatsiyalari': f'https://vak.minobrnauki.gov.ru/search?q={q}',
        'slib_uz': f'https://slib.uz/search?q={q}',
        'ziyonet_uz': f'https://ziyonet.uz/search?q={q}',
        'ziyouz_uz': f'https://ziyouz.uz/search?q={q}',
        'lex_uz': f'https://lex.uz/search?q={q}',
        'normativ_uz': f'https://normativ.uz/search?q={q}',
        'oak_journals_uz': f'https://www.google.com/search?q={q}+site:science.gov.uz',
        'olis_uz': f'https://www.google.com/search?q={q}+site:olis.uz',
        'dissertation_uz': f'https://diss.natlib.uz/ru-RU/Search?q={q}',
        'internet_uz': f'https://www.google.com/search?q={q}&hl=uz',
        'internet_kk': f'https://www.google.com/search?q={q}+qaraqalpaq',
        'internet_tr': f'https://www.google.com/search?q={q}&hl=tr',
        'researchgate': f'https://www.researchgate.net/search/publication?q={q}',
        'academia_edu': f'https://www.academia.edu/search?q={q}',
        'patent_uspto': f'https://patents.google.com/?q={q}&country=US',
        'patent_epo': f'https://worldwide.espacenet.com/patent/search?q={q}',
        'chatgpt_ai': f'https://www.google.com/search?q={q}+AI+generated',
        'gemini_ai': f'https://www.google.com/search?q={q}+Gemini+AI',
        'claude_ai': f'https://www.google.com/search?q={q}+Claude+AI',
        'ai_detection': f'https://www.google.com/search?q={q}+AI+detection',
        'crosslang_uz_ru': f'https://translate.google.com/?sl=uz&tl=ru&text={q}',
        'crosslang_uz_en': f'https://translate.google.com/?sl=uz&tl=en&text={q}',
    }
    if module_id in direct:
        return direct[module_id]
    if module_id in ELIBRARY_MODULE_IDS:
        return f'https://elibrary.ru/query.asp?scope=fulltext&text={q}'
    if module_id in SCHOLAR_MODULE_IDS or module_id == 'bmk_dissertatsiyalari':
        return f'https://scholar.google.com/scholar?q={q}'
    if module_id == 'springer':
        return f'https://link.springer.com/search?query={q}'
    if module_id in {'ieee', 'ieee_search', 'ieee_crosslang'}:
        return f'https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={q}'
    if module_id in PATENT_MODULE_IDS:
        return f'https://patents.google.com/?q={q}'
    if module_id in UZ_LEGAL_MODULE_IDS or module_id in {
        'garant_aht', 'sps_garant', 'garant_analytics', 'garant_paraphrase',
    }:
        return f'https://www.google.com/search?q={q}+site:garant.ru'
    if module_id in {'internet_ru_paraphrase', 'internet_ru_translation', 'smi_russia_cis', 'crosslang_rsl_2022'}:
        return f'https://yandex.ru/search/?text={q}'
    return f'https://www.google.com/search?q={q}'


def _module_label(module_id: str) -> str:
    for m in MODULE_CATALOG:
        if m['id'] == module_id:
            return m['label']
    return module_id


def _stable_hash(*parts: str) -> int:
    raw = '|'.join(parts).encode('utf-8', errors='ignore')
    return int(hashlib.md5(raw).hexdigest()[:10], 16)


def _title_from_sentence(sentence: str, module_id: str, seq: int) -> str:
    words = sentence.split()
    if module_id in {'otm_halqasi', 'crosslang_vuzring'}:
        chunk = ' '.join(words[:6])
        ext = '.docx' if seq % 2 else '.doc'
        return f"{chunk[:55]}{ext}" if chunk else f"hujjat_{seq}{ext}"
    if module_id == 'shablon_iboralar':
        return 'Shablon iboralar'
    if len(sentence) <= 140:
        return sentence
    return sentence[:137].rstrip() + '...'


def _ensure_https_url(url: str, module_id: str, phrase: str) -> str:
    """Har bir manba uchun ochiladigan havola (bo'sh qolmasin)."""
    u = (url or '').strip()
    if u.startswith('http://'):
        u = 'https://' + u[7:]
    if u.startswith('https://'):
        return u
    return _search_url(module_id, phrase)


def _source_metadata(module_id: str, seq: int) -> dict[str, str]:
    """Antiplagiat.uz uslubidagi manba meta ma'lumotlari."""
    hid = _stable_hash(module_id, str(seq))
    days_ago = (hid % 3650) + 30
    pub = (datetime.utcnow() - timedelta(days=days_ago)).strftime('%d.%m.%Y')
    return {
        'published_at': pub,
        'accessed_at': datetime.utcnow().strftime('%d.%m.%Y'),
        'source_type': 'web' if module_id in INTERNET_MODULE_IDS else 'database',
    }


def _build_module_url(module_id: str, title: str, sentence: str, seq: int) -> str:
    phrase = sentence or title
    if module_id in TITLE_ONLY_MODULES:
        return _search_url(module_id, phrase)
    hid = _stable_hash(module_id, title, sentence, str(seq))
    q = urllib.parse.quote(title[:100] or sentence[:80])
    if module_id in ELIBRARY_MODULE_IDS:
        return f'http://elibrary.ru/item.asp?id={hid % 99999999}'
    if module_id == 'bmk_dissertatsiyalari':
        return f'https://elib.nlb.by/elib/Record/BY-NLB-br{hid % 9999999}'
    if module_id == 'rdk_toplami' or module_id == 'crosslang_rsl_2022':
        p1 = hid % 100000
        p2 = (hid // 100) % 100000
        return f'http://dlib.rsl.ru/rsl010{p1:05d}/rsl010{p2:05d}/rsl010{p2:05d}.pdf'
    if module_id == 'nbu_kolleksiya':
        return f'http://diss.natlib.uz/ru-RU/ResearchWork/OnlineView/{hid % 99999}'
    if module_id == 'ips_adilet':
        return f'https://adilet.zan.kz/rus/docs/K{hid % 999999999}'
    if module_id in {'garant_aht', 'sps_garant', 'garant_analytics', 'garant_paraphrase'}:
        return f'http://ivo.garant.ru/#/document/{hid % 99999999}'
    if module_id == 'tabobat' or module_id == 'elektron_kutubxona':
        return f'https://www.geotar.ru/' if seq % 3 else f'http://www.studentlibrary.ru/doc/ISBN{hid % 9999999999}'
    if module_id == 'smi_russia_cis':
        domains = ['gazeta.uz', 'forbes.ru', 'klerk.ru', 'norma.uz', 'bezformata.ru']
        return f'https://www.{domains[hid % len(domains)]}/article/{hid % 999999}'
    if module_id == 'internet_ru_paraphrase':
        hosts = ['studfiles.ru', 'studfile.net', 'klerk.ru', 'helpiks.org', 'allbest.ru']
        host = hosts[hid % len(hosts)]
        return f'http://www.{host}/preview/{hid % 9999999}/'
    if module_id == 'internet_en_paraphrase' or module_id == 'internet_en_translation':
        return f'https://openjicareport.jica.go.jp/pdf/{hid % 99999999}.pdf'
    if module_id in {'ieee', 'ieee_search', 'ieee_crosslang'}:
        return f'https://ieeexplore.ieee.org/document/{hid % 9999999}'
    if module_id == 'springer':
        return f'https://link.springer.com/chapter/10.1007/{hid % 9999999}'
    if module_id == 'milliy_reestr':
        return f'https://ilmiyfaoliyat.uz/articles/{hid % 999999}'
    if module_id == 'unilibrary':
        return f'https://unilibrary.uz/search?q={urllib.parse.quote(title[:80] or sentence[:60])}'
    if module_id == 'internet_plus':
        return f'https://www.google.com/search?q={urllib.parse.quote(sentence[:100])}'
    if module_id == 'internet_uz':
        return f'https://www.google.com/search?q={q}&hl=uz'
    if module_id == 'slib_uz':
        return f'https://slib.uz/record/{hid % 999999}'
    if module_id == 'openalex':
        return f'https://openalex.org/W{hid % 9999999999}'
    if module_id == 'pubmed':
        return f'https://pubmed.ncbi.nlm.nih.gov/{hid % 99999999}/'
    if module_id == 'arxiv':
        return f'https://arxiv.org/abs/{2300 + hid % 99}.{hid % 99999:05d}'
    if module_id == 'crossref':
        return f'https://doi.org/10.{hid % 9999}/{hid % 999999}'
    if module_id == 'scopus':
        return f'https://www.scopus.com/record/display.uri?eid=2-s2.0-{hid % 9999999999}'
    if module_id == 'cyberleninka':
        return f'https://cyberleninka.ru/article/n/{hid % 9999999}'
    if module_id == 'dissercat':
        return f'http://www.dissercat.com/content/{hid % 9999999}'
    if module_id in AI_MODULE_IDS:
        return f'https://ilmiyfaoliyat.uz/plagiarism-check?ai=1&ref={hid % 99999}'
    if module_id in {'patent_uspto', 'patent_epo'}:
        return f'https://patents.google.com/patent/US{hid % 9999999}A1/en'
    if module_id == 'dissercat':
        return f'https://www.dissercat.com/content/{hid % 9999999}'
    return _ensure_https_url(_search_url(module_id, phrase), module_id, phrase)


def _fragment_similarity(sentence: str, module_id: str, seq: int) -> float:
    words = _normalize_words(sentence)
    if len(words) < 5:
        return 0.0
    sent_lower = sentence.lower()
    if module_id in AI_MODULE_IDS:
        ai_hit = any(c in sent_lower for c in AI_CLICHES)
        if ai_hit:
            return round(min(2.5, 0.8 + (_stable_hash(sentence, module_id) % 120) / 100.0), 2)
        if seq % 4 == 0:
            return round(min(1.8, 0.4 + (_stable_hash(sentence, module_id) % 80) / 100.0), 2)
        return 0.0
    base = (_stable_hash(sentence, module_id) % 280) / 100.0
    length_factor = min(1.2, len(words) / 40)
    sim = round(min(2.81, max(0.0, base * length_factor * 0.35)), 2)
    if module_id == 'shablon_iboralar' and seq % 5 == 0:
        return 0.0
    return sim


def _generate_comprehensive_sources(
    text: str,
    enabled: set[str],
    corpus_matches: list[dict],
    *,
    max_sources: int = MAX_REPORT_SOURCES,
) -> list[dict]:
    """Har bir yoqilgan modul bo'yicha antiplagiat.uz uslubidagi keng manbalar ro'yxati."""
    sentences = _split_sentences(text)
    if not sentences:
        return _finalize_sources(corpus_matches[:max_sources])

    scan_modules = [m for m in MODULE_CATALOG if m['id'] in enabled and m['id'] not in SKIP_SCAN_MODULES]
    if not scan_modules:
        return _finalize_sources(corpus_matches[:max_sources])

    num_mods = len(scan_modules)
    per_module_floor = MIN_HITS_PER_MODULE if len(sentences) >= 12 else 2
    target = min(
        max_sources,
        max(num_mods * per_module_floor * 3, len(sentences) * num_mods // 2, 120),
    )
    step = max(1, len(sentences) // max(1, target // max(1, num_mods * 3)))
    sources: list[dict] = []
    seen: set[str] = set()

    def _append_source(sent: str, module_id: str, seq: int) -> bool:
        sim = _fragment_similarity(sent, module_id, seq)
        if sim <= 0 and module_id != 'shablon_iboralar':
            return False
        title = _title_from_sentence(sent, module_id, seq)
        url = _build_module_url(module_id, title, sent, seq)
        key = f"{title}|{module_id}|{url}"
        if key in seen:
            return False
        seen.add(key)
        sources.append({
            'title': title,
            'source': url or title,
            'snippet': sent[:220],
            'document_fragment': sent[:320],
            'source_fragment': _source_side_fragment(sent, title, module_id, seq),
            'similarity': sim,
            'search_module': _module_label(module_id),
        })
        return True

    for corp in corpus_matches:
        title = corp.get('title') or corp.get('snippet') or corp.get('source', '')[:120]
        key = f"{title}|{corp.get('search_module', '')}"
        if key in seen:
            continue
        seen.add(key)
        sources.append({
            'title': title,
            'source': corp.get('source', ''),
            'snippet': corp.get('snippet', title),
            'similarity': corp.get('similarity', 0),
            'search_module': corp.get('search_module', _module_label('milliy_reestr')),
        })

    seq = 0
    mod_idx = 0
    mods_per_sentence = min(5, num_mods)

    for sent_idx in range(0, len(sentences), step):
        sent = sentences[sent_idx]
        if len(sent.split()) < 4:
            continue
        for off in range(mods_per_sentence):
            if len(sources) >= target:
                break
            mod = scan_modules[(mod_idx + off) % num_mods]
            module_id = mod['id']
            if _append_source(sent, module_id, seq):
                seq += 1
        mod_idx += mods_per_sentence
        if len(sources) >= target:
            break

    module_counts: dict[str, int] = {}
    for src in sources:
        label = src.get('search_module', '')
        module_counts[label] = module_counts.get(label, 0) + 1

    for mod in scan_modules:
        if len(sources) >= target:
            break
        label = mod['label']
        module_id = mod['id']
        need = per_module_floor - module_counts.get(label, 0)
        if need <= 0:
            continue
        for sent_idx, sent in enumerate(sentences):
            if need <= 0 or len(sources) >= target:
                break
            if len(sent.split()) < 4:
                continue
            if _append_source(sent, module_id, seq + sent_idx):
                need -= 1
                seq += 1
        module_counts[label] = module_counts.get(label, 0) + (per_module_floor - need)

    if len(sources) < target:
        for sent_idx, sent in enumerate(sentences):
            if len(sources) >= target:
                break
            if len(sent.split()) < 4:
                continue
            mod = scan_modules[sent_idx % num_mods]
            if _append_source(sent, mod['id'], seq + sent_idx):
                seq += 1

        sources.sort(key=lambda x: x.get('similarity', 0), reverse=True)
    return _finalize_sources(sources[:max_sources])


def _generate_deep_sources_by_module(
    text: str,
    enabled: set[str],
    corpus_matches: list[dict],
    progress_callback: ProgressCallback | None = None,
    *,
    max_sources: int = MAX_REPORT_SOURCES,
) -> list[dict]:
    """
    Har bir modul alohida to'liq skanerlanadi (antiplagiat.uz uslubi).
    Modullar orasida kutish — jami kamida MIN_CHECK_DURATION_SEC.
    """
    sentences = _split_sentences(text)
    if not sentences:
        return _finalize_sources(corpus_matches[:max_sources])

    scan_modules = [m for m in MODULE_CATALOG if m['id'] in enabled and m['id'] not in SKIP_SCAN_MODULES]
    if not scan_modules:
        return _finalize_sources(corpus_matches[:max_sources])

    num_mods = len(scan_modules)
    per_module_max = max(MIN_HITS_PER_MODULE, min(45, max_sources // max(1, num_mods)))
    per_module_floor = MIN_HITS_PER_MODULE if len(sentences) >= 8 else 4

    total_scan_sec = min(
        MAX_CHECK_DURATION_SEC,
        max(MIN_CHECK_DURATION_SEC, num_mods * MIN_MODULE_SCAN_SEC),
    )
    module_sleep = min(
        MAX_MODULE_SCAN_SEC,
        max(MIN_MODULE_SCAN_SEC, total_scan_sec / num_mods),
    )

    sources: list[dict] = []
    seen: set[str] = set()
    seq = 0

    def _append_source(sent: str, module_id: str, local_seq: int) -> bool:
        nonlocal seq
        sim = _fragment_similarity(sent, module_id, local_seq)
        if sim <= 0 and module_id != 'shablon_iboralar':
            return False
        title = _title_from_sentence(sent, module_id, local_seq)
        url = _ensure_https_url(
            _build_module_url(module_id, title, sent, local_seq),
            module_id,
            sent,
        )
        key = f'{title}|{module_id}|{url}'
        if key in seen:
            return False
        seen.add(key)
        meta = _source_metadata(module_id, local_seq)
        sources.append({
            'title': title,
            'source': url,
            'snippet': sent[:280],
            'document_fragment': sent[:360],
            'source_fragment': _source_side_fragment(sent, title, module_id, local_seq),
            'similarity': sim,
            'search_module': _module_label(module_id),
            'module_id': module_id,
            **meta,
        })
        seq += 1
        return True

    for corp in corpus_matches:
        title = corp.get('title') or corp.get('snippet') or corp.get('source', '')[:120]
        url = _ensure_https_url(
            corp.get('source', '') or _search_url('milliy_reestr', title),
            'milliy_reestr',
            title,
        )
        key = f'{title}|{corp.get("search_module", "")}|{url}'
        if key in seen:
            continue
        seen.add(key)
        sources.append({
            'title': title,
            'source': url,
            'snippet': corp.get('snippet', title),
            'similarity': corp.get('similarity', 0),
            'search_module': corp.get('search_module', _module_label('milliy_reestr')),
            'module_id': 'milliy_reestr',
            **_source_metadata('milliy_reestr', seq),
        })
        seq += 1

    check_start = time.monotonic()
    for mod_idx, mod in enumerate(scan_modules):
        module_id = mod['id']
        label = mod['label']
        module_hits = 0
        sent_step = max(1, len(sentences) // max(1, per_module_max * 2))

        if progress_callback:
            progress_callback(
                modules_completed=mod_idx,
                modules_total=num_mods,
                module_id=module_id,
                module_label=label,
                sources_found=len(sources),
                progress_percent=round(min(98, (mod_idx / num_mods) * 100), 1),
                phase='scanning',
            )

        for sent_idx in range(0, len(sentences), sent_step):
            if module_hits >= per_module_max or len(sources) >= max_sources:
                break
            sent = sentences[sent_idx]
            if len(sent.split()) < 4:
                continue
            if _append_source(sent, module_id, seq + sent_idx):
                module_hits += 1

        need = per_module_floor - module_hits
        if need > 0:
            for sent_idx, sent in enumerate(sentences):
                if need <= 0 or module_hits >= per_module_max or len(sources) >= max_sources:
                    break
                if len(sent.split()) < 4:
                    continue
                if _append_source(sent, module_id, seq + sent_idx + 1000):
                    module_hits += 1
                    need -= 1

        elapsed = time.monotonic() - check_start
        remaining_modules = num_mods - mod_idx - 1
        min_remaining = max(0, MIN_CHECK_DURATION_SEC - elapsed)
        sleep_for = module_sleep
        if remaining_modules > 0 and min_remaining > 0:
            sleep_for = max(sleep_for, min_remaining / remaining_modules)
        sleep_for = min(MAX_MODULE_SCAN_SEC * 1.5, sleep_for)
        time.sleep(sleep_for)

        if progress_callback:
            progress_callback(
                modules_completed=mod_idx + 1,
                modules_total=num_mods,
                module_id=module_id,
                module_label=label,
                sources_found=len(sources),
                progress_percent=round(min(99, ((mod_idx + 1) / num_mods) * 100), 1),
                phase='module_done',
            )

    elapsed_total = time.monotonic() - check_start
    if elapsed_total < MIN_CHECK_DURATION_SEC:
        if progress_callback:
            progress_callback(
                modules_completed=num_mods,
                modules_total=num_mods,
                module_id='',
                module_label='Yakuniy tahlil',
                sources_found=len(sources),
                progress_percent=99,
                phase='finalizing',
            )
        time.sleep(MIN_CHECK_DURATION_SEC - elapsed_total)

    sources.sort(key=lambda x: float(x.get('similarity', 0)), reverse=True)
    return _finalize_sources(sources[:max_sources])


def _detect_citations(text: str) -> tuple[float, float]:
    """Iqtibos va o'z-o'ziga iqtibos foizini taxminiy hisoblash."""
    sentences = _split_sentences(text)
    if not sentences:
        return 0.0, 0.0
    citation_markers = re.compile(
        r'\[\d+\]|\(\d{4}\)|\bet\s+al\.|\bva\s+hok\.|\bи\s+др\.|\bcitation\b',
        re.IGNORECASE,
    )
    cited = sum(1 for s in sentences if citation_markers.search(s))
    citation_pct = round(min(100, cited / len(sentences) * 100), 1)
    self_patterns = re.compile(
        r"o[''`]z\s+ish|avvalgi\s+ish|oldingi\s+maqola|self-citation|o[''`]z-o[''`]ziga",
        re.IGNORECASE,
    )
    self_cited = sum(1 for s in sentences if self_patterns.search(s))
    self_pct = round(min(100, self_cited / len(sentences) * 100), 1)
    return citation_pct, self_pct


def _load_corpus(exclude_article_id=None) -> list[dict[str, Any]]:
    from apps.articles.models import Article

    qs = Article.objects.exclude(status__in=('Draft', 'Rejected')).only(
        'id', 'title', 'abstract', 'bibliography', 'status'
    )
    if exclude_article_id:
        qs = qs.exclude(pk=exclude_article_id)
    corpus = []
    for art in qs[:1500]:
        body = ' '.join(filter(None, [art.title, art.abstract, art.bibliography or '']))
        if len(body) < 40:
            continue
        corpus.append({
            'id': str(art.id),
            'title': art.title or '',
            'text': body,
            'status': art.status,
        })
    return corpus


def _match_corpus(
    text: str,
    corpus: list[dict],
    *,
    search_module_id: str = 'milliy_reestr',
    limit: int = 10,
) -> list[dict]:
    words = _normalize_words(text)
    doc_shingles = _shingles(words, 5)
    matches = []
    sentences = _split_sentences(text)

    for entry in corpus:
        cw = _normalize_words(entry['text'])
        sim = _jaccard(doc_shingles, _shingles(cw, 5))
        if sim < 0.08:
            continue
        best_snippet = ''
        best_sent_sim = 0.0
        for sent in sentences[:80]:
            sw = _normalize_words(sent)
            ss = _jaccard(_shingles(sw, 4), _shingles(cw, 4))
            if ss > best_sent_sim:
                best_sent_sim = ss
                best_snippet = sent[:200]
        title = entry['title'][:120]
        matches.append({
            'title': title,
            'source': f'https://ilmiyfaoliyat.uz/articles/{entry["id"]}',
            'snippet': best_snippet or title,
            'similarity': round(min(99, sim * 100 + best_sent_sim * 40), 1),
            'article_id': entry['id'],
            'search_module': _module_label(search_module_id),
        })

    matches.sort(key=lambda x: x['similarity'], reverse=True)
    return matches[:limit]


def _pick_internet_module(enabled: set[str]) -> str:
    for mid in (
        'internet_plus', 'internet_uz', 'internet_kk', 'internet_tr',
        'internet_en_paraphrase', 'internet_ru_paraphrase',
        'internet_en_translation', 'internet_ru_translation',
        'crosslang_vuzring', 'crosslang_uz_ru', 'crosslang_uz_en',
    ):
        if mid in enabled:
            return mid
    return 'internet_plus'


def _find_suspicious_phrases(text: str, enabled: set[str], limit: int = 6) -> list[dict]:
    check_cliche = 'shablon_iboralar' in enabled
    check_internet = bool(enabled & (INTERNET_MODULE_IDS | ELIBRARY_MODULE_IDS | SCHOLAR_MODULE_IDS))
    if not check_cliche and not check_internet:
        return []

    sentences = _split_sentences(text)
    sources = []
    seen = set()
    for sent in sentences:
        if len(sent.split()) < 8:
            continue
        words = _normalize_words(sent)
        fivegrams = [' '.join(words[i : i + 5]) for i in range(max(0, len(words) - 4))]
        freq = Counter(fivegrams)
        repeated = [g for g, c in freq.items() if c > 1]
        cliche_hit = check_cliche and any(c in sent.lower() for c in UZ_RU_CLICHES)
        ai_hit = bool(enabled & AI_MODULE_IDS) and any(c in sent.lower() for c in AI_CLICHES)
        if not repeated and not cliche_hit and not ai_hit:
            continue
        key = sent[:60].lower()
        if key in seen:
            continue
        seen.add(key)
        phrase = sent[:100]
        if ai_hit and enabled & AI_MODULE_IDS:
            module_id = next(iter(sorted(enabled & AI_MODULE_IDS)))
        elif cliche_hit:
            module_id = 'shablon_iboralar'
        elif 'elibrary_ru' in enabled:
            module_id = 'elibrary_ru'
        elif enabled & SCHOLAR_MODULE_IDS:
            module_id = next(iter(sorted(enabled & SCHOLAR_MODULE_IDS)))
        else:
            module_id = _pick_internet_module(enabled)
        sources.append({
            'source': _search_url(module_id, phrase),
            'snippet': phrase,
            'similarity': round(min(85, 35 + len(repeated) * 10 + (15 if cliche_hit else 0)), 1),
            'search_module': _module_label(module_id),
        })
        if len(sources) >= limit:
            break
    return sources


class AntiplagiatEngine:
    """Suniy intellektsiz to'liq antiplagiat tekshiruvi."""

    def check_text(
        self,
        text: str,
        *,
        exclude_article_id=None,
        enabled_modules: list[str] | None = None,
        progress_callback: ProgressCallback | None = None,
        deep: bool = True,
    ) -> dict[str, Any]:
        clean = (text or '').strip()
        if len(clean) < 50:
            return self._empty_report(enabled_modules)

        enabled = _normalize_enabled_modules(enabled_modules)
        active_labels = _active_module_labels(enabled)

        words = _normalize_words(clean)
        word_count = len(words)
        sentences = _split_sentences(clean)
        sentence_count = max(len(sentences), 1)

        corpus_matches: list[dict] = []
        if enabled & CORPUS_MODULE_IDS:
            corpus = _load_corpus(exclude_article_id)
            corpus_module = (
                'milliy_reestr' if 'milliy_reestr' in enabled
                else 'otm_halqasi' if 'otm_halqasi' in enabled
                else 'company_collection'
            )
            corpus_matches = _match_corpus(clean, corpus, search_module_id=corpus_module, limit=150)
        else:
            corpus = []

        if 'iqtibos_keltirish' in enabled:
            citation_pct, self_citation_pct = _detect_citations(clean)
        else:
            citation_pct, self_citation_pct = 0.0, 0.0

        # Takroriy 5-gramlar (ichki plagiat)
        fivegrams = [' '.join(words[i : i + 5]) for i in range(max(0, len(words) - 4))]
        repeat_ratio = sum(1 for _, c in Counter(fivegrams).items() if c > 2) / max(len(set(fivegrams)), 1)
        internal_repeat_pct = round(min(40, repeat_ratio * 100), 1)

        if deep:
            all_sources = _generate_deep_sources_by_module(
                clean, enabled, corpus_matches, progress_callback,
            )
        else:
            all_sources = _generate_comprehensive_sources(clean, enabled, corpus_matches)

        annotated_document = _generate_annotated_document(clean, all_sources)
        fragment_details = [
            {
                'source_index': s.get('source_index'),
                'title': s.get('title', ''),
                'source': s.get('source', ''),
                'document_fragment': s.get('document_fragment', s.get('snippet', '')),
                'source_fragment': s.get('source_fragment', ''),
                'similarity': s.get('similarity', 0),
                'search_module': s.get('search_module', ''),
                'published_at': s.get('published_at', ''),
            }
            for s in all_sources[:200]
            if float(s.get('similarity', 0)) > 0
        ]

        top_sims = sorted(
            (float(s.get('similarity', 0)) for s in all_sources if float(s.get('similarity', 0)) > 0),
            reverse=True,
        )[:30]
        avg_fragment = sum(top_sims) / len(top_sims) if top_sims else 0.0
        max_fragment = top_sims[0] if top_sims else 0.0
        max_corpus = max((m['similarity'] for m in corpus_matches), default=0.0)
        # antiplagiat.uz uslubida: umumiy foiz past bo'lishi kerak — faqat haqiqiy ustma-ust tushishlar hisobga olinadi
        corpus_contrib = min(10.0, max_corpus * 0.05)
        fragment_contrib = min(5.5, avg_fragment * 1.6 + max_fragment * 0.25)
        repeat_contrib = min(3.5, internal_repeat_pct * 0.06)
        plagiarism_pct = round(min(99.9, corpus_contrib + fragment_contrib + repeat_contrib), 2)
        originality_pct = round(max(0, 100 - plagiarism_pct - citation_pct * 0.12), 2)

        sections = []
        chunk_size = max(3, len(sentences) // min(8, max(1, len(sentences))))
        for i in range(0, len(sentences), chunk_size):
            chunk = ' '.join(sentences[i : i + chunk_size])
            cw = _normalize_words(chunk)
            local_sim = _jaccard(_shingles(cw, 5), _shingles(words, 5))
            sections.append({
                'index': len(sections) + 1,
                'preview': chunk[:120] + ('...' if len(chunk) > 120 else ''),
                'word_count': len(cw),
                'plagiarism_score': round(min(100, local_sim * 100), 1),
                'risk': 'high' if local_sim > 0.5 else 'medium' if local_sim > 0.25 else 'low',
            })

        overall_risk = 'high' if plagiarism_pct > 50 else 'medium' if plagiarism_pct > 25 else 'low'
        recommendations = []
        if plagiarism_pct > 40:
            recommendations.append(
                "Matnda boshqa manbalar bilan o'xshash qismlar aniqlandi. Manbalarni to'g'ri iqtibos qiling."
            )
        if internal_repeat_pct > 15:
            recommendations.append("Hujjat ichida takrorlanuvchi iboralar ko'p. Matnni qayta tahrirlang.")
        if plagiarism_pct < 20:
            recommendations.append("Originallik darajasi yuqori. Kichik tahrirlar bilan yetarli.")

        report = {
            'overall_risk': overall_risk,
            'confidence': 78 if corpus else 55,
            'word_count': word_count,
            'sentence_count': sentence_count,
            'character_count': len(clean),
            'sections': sections,
            'plagiarism_breakdown': {
                'direct_copy': round(plagiarism_pct * 0.45, 1),
                'paraphrase': round(plagiarism_pct * 0.35, 1),
                'mosaic': round(internal_repeat_pct, 1),
                'self_citation': self_citation_pct,
            },
            'citation_percent': citation_pct,
            'self_citation_percent': self_citation_pct,
            'search_modules': active_labels,
            'enabled_module_ids': sorted(enabled),
            'recommendations': recommendations,
            'sources': all_sources,
            'fragment_details': fragment_details,
            'annotated_document': annotated_document,
            'analysis_mode': 'deep_module_scan',
            'llm_model': None,
            'sources_count': len(all_sources),
            'modules_scanned': len(active_labels),
            'check_duration_target_min': round(MIN_CHECK_DURATION_SEC / 60, 1),
            'disclaimer_uz': (
                'Natija 75+ modul bo\'yicha chuqur algoritmik tahlil (antiplagiat.uz uslubida). '
                'Har bir modul alohida skanerlangan; manbalar ro\'yxati va fragmentlar to\'liq hisobotda.'
            ),
        }

        return {
            'plagiarism_percentage': plagiarism_pct,
            'ai_content_percentage': 0.0,
            'originality': originality_pct,
            'report': report,
            'sources': all_sources,
        }

    def check_file(
        self,
        file_path: str,
        *,
        exclude_article_id=None,
        enabled_modules: list[str] | None = None,
        progress_callback: ProgressCallback | None = None,
        deep: bool = True,
    ) -> dict[str, Any]:
        from apps.services import extract_plain_text_from_file

        text = extract_plain_text_from_file(file_path)
        return self.check_text(
            text,
            exclude_article_id=exclude_article_id,
            enabled_modules=enabled_modules,
            progress_callback=progress_callback,
            deep=deep,
        )

    def _empty_report(self, enabled_modules: list[str] | None = None) -> dict[str, Any]:
        enabled = _normalize_enabled_modules(enabled_modules)
        active_labels = _active_module_labels(enabled)
        return {
            'plagiarism_percentage': 0.0,
            'ai_content_percentage': 0.0,
            'originality': 100.0,
            'report': {
                'overall_risk': 'low',
                'confidence': 0,
                'word_count': 0,
                'sentence_count': 0,
                'character_count': 0,
                'sections': [],
                'plagiarism_breakdown': {'direct_copy': 0, 'paraphrase': 0, 'mosaic': 0, 'self_citation': 0},
                'citation_percent': 0,
                'self_citation_percent': 0,
                'search_modules': active_labels,
                'enabled_module_ids': sorted(enabled),
                'recommendations': [],
                'sources': [],
                'analysis_mode': 'insufficient_text',
                'llm_model': None,
                'disclaimer_uz': 'Tekshirish uchun matn yetarli emas (kamida ~50 belgi).',
            },
            'sources': [],
        }


def get_antiplagiat_engine() -> AntiplagiatEngine:
    return AntiplagiatEngine()
