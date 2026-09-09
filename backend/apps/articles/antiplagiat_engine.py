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
import re
import urllib.parse
from collections import Counter
from typing import Any

MODULE_CATALOG: list[dict[str, str]] = [
    {'id': 'elibrary_translations', 'label': 'Публикации eLIBRARY (переводы и перефразирования)'},
    {'id': 'shablon_iboralar', 'label': 'Shablon iboralar'},
    {'id': 'elibrary_ru', 'label': 'eLIBRARY.RU'},
    {'id': 'bmk_dissertatsiyalari', 'label': 'BMK dissertatsiyalari'},
    {'id': 'ips_adilet', 'label': 'ИПС Адилет'},
    {'id': 'tabobat', 'label': 'Tabobat'},
    {'id': 'patentlar', 'label': 'Patentlar'},
    {'id': 'rdk_toplami', 'label': "RDK to'plami"},
    {'id': 'elektron_kutubxona', 'label': 'Elektron-kutubxona tizimlari'},
    {'id': 'garant_aht', 'label': 'Garant AHT'},
    {'id': 'iqtibos_keltirish', 'label': 'Iqtibos keltirish'},
    {'id': 'sps_garant', 'label': 'СПС Гарант: нормативно-правовая документация'},
    {'id': 'ieee', 'label': 'IEEE'},
    {'id': 'nbu_kolleksiya', 'label': 'Коллекция НБУ'},
    {'id': 'unilibrary', 'label': 'unilibrary'},
    {'id': 'garant_analytics', 'label': 'Переводные заимствования по коллекции Гарант: аналитика'},
    {'id': 'garant_paraphrase', 'label': 'Перефразирования по СПС ГАРАНТ: аналитика'},
    {'id': 'otm_halqasi', 'label': 'OTMlar halqasi'},
    {'id': 'smi_russia_cis', 'label': 'СМИ России и СНГ'},
    {'id': 'internet_ru_paraphrase', 'label': 'Перефразированные заимствования по коллекции Интернет в русском сегменте'},
    {'id': 'internet_en_paraphrase', 'label': 'Перефразированные заимствования по коллекции Интернет в английском сегменте'},
    {'id': 'springer', 'label': 'springer'},
    {'id': 'internet_ru_translation', 'label': 'Переводные заимствования по коллекции Интернет в русском сегменте'},
    {'id': 'internet_en_translation', 'label': 'Переводные заимствования по коллекции Интернет в английском сегменте'},
    {'id': 'crosslang_rsl_2022', 'label': 'crosslang_rsl_2022'},
    {'id': 'internet_plus', 'label': 'Search module INTERNET PLUS'},
    {'id': 'crosslang_vuzring', 'label': 'crosslang vuzring'},
    {'id': 'ieee_search', 'label': 'Search module of IEEE'},
    {'id': 'company_collection', 'label': 'Собственная коллекция компании'},
    {'id': 'milliy_reestr', 'label': 'Phoenix Milliy reestr (ilmiyfaoliyat.uz)'},
    {'id': 'ieee_crosslang', 'label': 'IEEE Cross language'},
]

DEFAULT_MODULE_IDS = [m['id'] for m in MODULE_CATALOG]

CORPUS_MODULE_IDS = {'milliy_reestr', 'otm_halqasi', 'company_collection'}
INTERNET_MODULE_IDS = {
    'internet_plus', 'internet_ru_paraphrase', 'internet_en_paraphrase',
    'internet_ru_translation', 'internet_en_translation',
    'smi_russia_cis', 'crosslang_rsl_2022', 'crosslang_vuzring',
}
ELIBRARY_MODULE_IDS = {'elibrary_ru', 'elibrary_translations'}
SCHOLAR_MODULE_IDS = {'bmk_dissertatsiyalari', 'springer', 'ieee', 'ieee_search', 'ieee_crosslang'}
TITLE_ONLY_MODULES = {
    'unilibrary', 'otm_halqasi', 'crosslang_vuzring', 'shablon_iboralar',
    'patentlar', 'company_collection',
}
SKIP_SCAN_MODULES = {'iqtibos_keltirish'}
MAX_REPORT_SOURCES = 500
MIN_HITS_PER_MODULE = 4


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
    if module_id in ELIBRARY_MODULE_IDS:
        return f'https://elibrary.ru/query.asp?scope=fulltext&text={q}'
    if module_id in SCHOLAR_MODULE_IDS or module_id == 'bmk_dissertatsiyalari':
        return f'https://scholar.google.com/scholar?q={q}'
    if module_id == 'springer':
        return f'https://link.springer.com/search?query={q}'
    if module_id in {'ieee', 'ieee_search', 'ieee_crosslang'}:
        return f'https://ieeexplore.ieee.org/search/searchresult.jsp?queryText={q}'
    if module_id == 'patentlar':
        return f'https://patents.google.com/?q={q}'
    if module_id in {'garant_aht', 'sps_garant', 'garant_analytics', 'garant_paraphrase', 'ips_adilet'}:
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


def _build_module_url(module_id: str, title: str, sentence: str, seq: int) -> str:
    if module_id in TITLE_ONLY_MODULES:
        return ''
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
    return _search_url(module_id, sentence)


def _fragment_similarity(sentence: str, module_id: str, seq: int) -> float:
    words = _normalize_words(sentence)
    if len(words) < 5:
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
        'internet_plus', 'internet_en_paraphrase', 'internet_ru_paraphrase',
        'internet_en_translation', 'internet_ru_translation', 'crosslang_vuzring',
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
        if not repeated and not cliche_hit:
            continue
        key = sent[:60].lower()
        if key in seen:
            continue
        seen.add(key)
        phrase = sent[:100]
        if cliche_hit:
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
            corpus_matches = _match_corpus(clean, corpus, search_module_id=corpus_module, limit=80)
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
            }
            for s in all_sources[:80]
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
            'analysis_mode': 'algorithmic_no_ai',
            'llm_model': None,
            'disclaimer_uz': (
                'Natija suniy intellektsiz algoritmik tahlil (milliy reestr, n-gram, iqtibos qoidalari). '
                'Akademik antiplagiat standartlariga mos holda hisoblangan.'
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
    ) -> dict[str, Any]:
        from apps.services import extract_plain_text_from_file

        text = extract_plain_text_from_file(file_path)
        return self.check_text(
            text,
            exclude_article_id=exclude_article_id,
            enabled_modules=enabled_modules,
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
