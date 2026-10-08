"""
Chuqur antiplagiat skaneri (algoritm 5.0).

Ilgari (4.0): ko'pi bilan 220 gap tanlanardi, har gapga bitta "eng yaqin" manba, faqat so'zma-so'z
ketma-ketlik, ochiq API'larda 11-22 gap, faqat annotatsiyalar bilan solishtirish.

Endi:
  - butun hujjat (100%) barmoq izlari indeksi bilan solishtiriladi (antiplagiat_index);
  - normalizatsiya: kirill/lotin, apostroflar, qo'shimchalar, yordamchi so'zlar (antiplagiat_normalize);
  - bir gapda bir nechta manba, gap chegarasidan oshgan ko'chirmalar, qisqa gaplar ham topiladi;
  - so'z tartibi o'zgartirilgan / sinonim qo'yilgan gaplar — o'zaklar to'plami bo'yicha (reordered);
  - ochiq API so'rovlari hujjat bo'ylab eng "o'ziga xos" gaplarga taqsimlanadi (har modulga alohida limit);
  - OpenAlex'dagi ochiq PDF'lar va CORE to'liq matnlari butun hujjat bilan solishtiriladi.
"""
from __future__ import annotations

import hashlib
import logging
import re
import tempfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Callable, Iterable

import requests
from django.conf import settings

from apps.articles.antiplagiat_fingerprint import (
    Span,
    compare_tokens,
    source_fragment,
    span_char_range,
)
from apps.articles.antiplagiat_normalize import Token, tokenize

logger = logging.getLogger(__name__)

UNPUBLISHED_TITLE = "Phoenix ichki bazasi: nashr etilmagan hujjat"
# antiplagiat_engine._split_sentences bilan AYNAN bir xil bo'linish (gap kalitlari mos kelishi uchun)
_SENT_SPLIT = re.compile(r'(?<=[.!?…])\s+|\n+')


def _compact_len(s: str) -> int:
    return len(re.sub(r'\s+', '', s or ''))


@dataclass
class Sentence:
    idx: int
    start: int
    end: int
    text: str

    @property
    def chars(self) -> int:
        return _compact_len(self.text)


def split_sentences_with_offsets(text: str) -> list[Sentence]:
    out: list[Sentence] = []
    cursor = 0
    for part in _SENT_SPLIT.split(text or ''):
        piece = part.strip()
        if not piece:
            continue
        pos = text.find(piece, cursor)
        if pos < 0:
            continue
        cursor = pos + len(piece)
        if len(piece) > 15:
            out.append(Sentence(len(out), pos, pos + len(piece), piece))
    return out


# ---------------------------------------------------------------- mos qismlar → gaplar

def _sentence_overlaps(char_ranges: Iterable[tuple[int, int]], sentences: list[Sentence], text: str) -> dict[int, int]:
    """{gap indeksi: mos kelgan belgilar (bo'shliqsiz)}"""
    out: dict[int, int] = {}
    ranges = sorted(char_ranges)
    for a, b in ranges:
        for s in sentences:
            if s.end <= a:
                continue
            if s.start >= b:
                break
            lo, hi = max(a, s.start), min(b, s.end)
            if hi > lo:
                out[s.idx] = out.get(s.idx, 0) + _compact_len(text[lo:hi])
    return out


def build_span_hits(
    text: str,
    sentences: list[Sentence],
    doc_tokens: list[Token],
    spans: list[Span],
    *,
    title: str,
    url: str,
    module_id: str,
    module_label: str,
    is_public: bool,
    source_text: str = '',
    source_tokens: list[Token] | None = None,
    self_citation: bool = False,
    subtype: str = 'fingerprint',
) -> list[dict[str, Any]]:
    """Bitta manba bilan topilgan mos qismlar → hisobotdagi gaplar bo'yicha hitlar."""
    ranges = [span_char_range(doc_tokens, s) for s in spans]
    per_sentence = _sentence_overlaps(ranges, sentences, text)
    hits: list[dict[str, Any]] = []
    for s in sentences:
        oc = per_sentence.get(s.idx, 0)
        if oc <= 0:
            continue
        # Qo'shni gapga 1-2 so'z bilan "toshib o'tgan" moslik hisobga olinmaydi
        if oc < max(20, 0.2 * s.chars):
            continue
        oc = min(oc, s.chars)
        frag = ''
        if source_tokens:
            for sp, (a, b) in zip(spans, ranges):
                if a < s.end and b > s.start:
                    frag = source_fragment(source_text, source_tokens, sp)
                    break
        hit = {
            'snippet': s.text[:220],
            'document_fragment': s.text[:360],
            'search_module': module_label,
            'module_id': module_id,
            'match_type': 'verified',
            'match_subtype': subtype,
            'overlap_chars': oc,
            'similarity': 0.0,
            'doc_ranges': [(max(a, s.start), min(b, s.end)) for a, b in ranges if a < s.end and b > s.start],
        }
        if self_citation:
            hit['self_citation'] = True
        if is_public:
            hit.update({
                'title': (title or frag[:120] or 'Manba')[:300],
                'source': url or '',
                'source_fragment': (frag or source_text[:360])[:360],
                'source_text': (source_text or '')[:12000],
            })
        else:
            # Nashr etilmagan hujjat: sarlavha, havola va matn yashiriladi (faqat mos qism)
            hit.update({'title': UNPUBLISHED_TITLE, 'source': '', 'source_fragment': frag[:360], 'source_text': ''})
        hits.append(hit)
    return hits


# ---------------------------------------------------------------- so'z tartibi / sinonim (o'zaklar to'plami)

@lru_cache(maxsize=20000)
def _stem_set(sentence: str) -> frozenset[str]:
    return frozenset(t.stem for t in tokenize(sentence))


REORDER_MIN_COMMON = 4
REORDER_MIN_CONTAINMENT = 0.65
REORDER_MIN_JACCARD = 0.32
# Qisqa gap uzun manba gapining bir qismi bo'lsa Jaccard past chiqadi — qamrov juda yuqori bo'lsa yumshatiladi
REORDER_STRONG_CONTAINMENT = 0.8
REORDER_STRONG_MIN_JACCARD = 0.2


def reorder_hits(
    text: str,
    sentences: list[Sentence],
    source_text: str,
    *,
    skip_sentence_idx: set[int],
    title: str,
    url: str,
    module_id: str,
    module_label: str,
    is_public: bool,
    self_citation: bool = False,
    max_hits: int = 200,
) -> list[dict[str, Any]]:
    """
    Gap mazmunli so'zlarining katta qismi manbaning BITTA gapida bo'lsa (tartibidan qat'i nazar) —
    "qayta tartiblangan / sinonim bilan o'zgartirilgan" moslik.
    """
    src_sents = split_sentences_with_offsets(source_text)
    src_sets = []
    inverted: dict[str, list[int]] = {}
    for ss in src_sents:
        st = _stem_set(ss.text)
        if len(st) >= REORDER_MIN_COMMON:
            for w in st:
                inverted.setdefault(w, []).append(len(src_sets))
            src_sets.append((ss, st))
    if not src_sets:
        return []
    hits: list[dict[str, Any]] = []
    for s in sentences:
        if s.idx in skip_sentence_idx:
            continue
        a = _stem_set(s.text)
        if len(a) < REORDER_MIN_COMMON:
            continue
        # Teskari indeks: faqat kamida REORDER_MIN_COMMON umumiy o'zagi bor manba gaplari ko'riladi
        counts = Counter(j for w in a for j in inverted.get(w, ()))
        best = None
        best_score = 0.0
        for j, common in counts.items():
            if common < REORDER_MIN_COMMON:
                continue
            ss, b = src_sets[j]
            containment = common / len(a)
            jaccard = common / (len(a) + len(b) - common)
            ok = (containment >= REORDER_MIN_CONTAINMENT and jaccard >= REORDER_MIN_JACCARD) or (
                containment >= REORDER_STRONG_CONTAINMENT and jaccard >= REORDER_STRONG_MIN_JACCARD
            )
            if ok and containment > best_score:
                best, best_score = ss, containment
        if best is None:
            continue
        oc = int(s.chars * best_score)
        hit = {
            'snippet': s.text[:220],
            'document_fragment': s.text[:360],
            'search_module': module_label,
            'module_id': module_id,
            'match_type': 'verified',
            'match_subtype': 'reordered',
            'overlap_chars': oc,
            'similarity': 0.0,
            # doc_ranges yo'q: qamrov aniq belgilar emas, o'zaklar ulushi (overlap_chars) bilan hisoblanadi
        }
        if self_citation:
            hit['self_citation'] = True
        if is_public:
            hit.update({'title': (title or 'Manba')[:300], 'source': url or '',
                        'source_fragment': best.text[:360], 'source_text': source_text[:12000]})
        else:
            hit.update({'title': UNPUBLISHED_TITLE, 'source': '', 'source_fragment': '', 'source_text': ''})
        hits.append(hit)
        if len(hits) >= max_hits:
            break
    return hits


def compare_source(
    text: str,
    sentences: list[Sentence],
    doc_tokens: list[Token],
    source_text: str,
    *,
    title: str,
    url: str,
    module_id: str,
    module_label: str,
    is_public: bool = True,
    self_citation: bool = False,
    subtype: str = 'fingerprint',
    source_tokens: list[Token] | None = None,
) -> list[dict[str, Any]]:
    """Hujjat ↔ bitta manba matni: ketma-ket mosliklar + qayta tartiblangan gaplar."""
    if not source_text or len(source_text) < 40:
        return []
    src_tokens = source_tokens if source_tokens is not None else tokenize(source_text)
    match = compare_tokens(doc_tokens, src_tokens)
    common = dict(title=title, url=url, module_id=module_id, module_label=module_label,
                  is_public=is_public, self_citation=self_citation)
    hits = build_span_hits(text, sentences, doc_tokens, match.spans, source_text=source_text,
                           source_tokens=src_tokens, subtype=subtype, **common)
    return merge_reordered(hits, reorder_hits(text, sentences, source_text, skip_sentence_idx=set(), **common))


def merge_reordered(span_hits: list[dict[str, Any]], reordered: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Bitta manba uchun: gapda ketma-ket moslik ham, qayta tartiblangan moslik ham bo'lsa — kattasi qoladi
    (masalan 5 so'z aynan, qolgani almashtirilgan gap to'liqroq qayta tartiblangan sifatida sanaladi).
    """
    by_frag = {h['document_fragment']: i for i, h in enumerate(span_hits)}
    out = list(span_hits)
    for r in reordered:
        i = by_frag.get(r['document_fragment'])
        if i is None:
            out.append(r)
        elif int(r.get('overlap_chars') or 0) > 1.15 * int(out[i].get('overlap_chars') or 0):
            # Aynan ko'chirilgan gap "ko'chirish" bo'lib qoladi; qayta tartiblash sezilarli ko'proq qamrasagina almashadi
            out[i] = r
    return out


# ---------------------------------------------------------------- indeks (ichki baza)

_CORPUS_SOURCE_MODULE = {
    'journal': 'oak_journals_uz',
    'otm': 'dissertation_uz',
    'natlib': 'natlib_uz',
    'import': 'phoenix_archive',
    'other': 'phoenix_archive',
    'platform': 'milliy_reestr',
    'check': 'phoenix_archive',
}


def _pick_corpus_module(source_type: str, enabled_corpus: set[str]) -> str:
    preferred = _CORPUS_SOURCE_MODULE.get(source_type or '', 'milliy_reestr')
    if preferred in enabled_corpus:
        return preferred
    for mid in ('milliy_reestr', 'phoenix_archive'):
        if mid in enabled_corpus:
            return mid
    return sorted(enabled_corpus)[0] if enabled_corpus else 'milliy_reestr'


def scan_index_hits(
    text: str,
    sentences: list[Sentence],
    doc_tokens: list[Token],
    *,
    enabled_corpus: set[str],
    module_label: Callable[[str], str],
    exclude_article_id: str | None,
    exclude_author_id: str | None,
    self_citation_enabled: bool,
) -> tuple[list[dict[str, Any]], set[str]]:
    """Butun hujjat ↔ barmoq izlari indeksi. (hitlar, bajarilgan modullar)"""
    from apps.articles.antiplagiat_index import find_index_matches

    exclude = set()
    if exclude_article_id:
        exclude |= {f'article:{exclude_article_id}', f'check:{exclude_article_id}'}
    matches = find_index_matches(doc_tokens, exclude_doc_keys=exclude,
                                 max_docs=int(getattr(settings, 'ANTIPLAG_INDEX_MAX_SOURCES', 40)))
    hits: list[dict[str, Any]] = []
    executed: set[str] = set()
    for m in matches:
        doc = m.doc
        is_self = bool(exclude_author_id and doc.author_id and doc.author_id == str(exclude_author_id))
        if is_self and not self_citation_enabled:
            continue
        mid = 'iqtibos_keltirish' if is_self else _pick_corpus_module(doc.source_type, enabled_corpus)
        executed.add(mid)
        common = dict(
            title=doc.title, url=doc.url, module_id=mid, module_label=module_label(mid),
            is_public=bool(doc.is_public), self_citation=is_self,
        )
        span_hits = build_span_hits(text, sentences, doc_tokens, m.spans, source_text=doc.text,
                                    source_tokens=m.source_tokens, **common)
        if doc.text:
            span_hits = merge_reordered(
                span_hits, reorder_hits(text, sentences, doc.text, skip_sentence_idx=set(), **common),
            )
        hits += span_hits
    return hits, executed


# ---------------------------------------------------------------- ochiq API: so'rov tanlash

_RARE_WORD = re.compile(r'[^\W\d_]{8,}', re.UNICODE)


def select_query_sentences(sentences: list[Sentence], budget: int) -> list[Sentence]:
    """
    Hujjat bo'ylab teng taqsimlangan eng "o'ziga xos" gaplar: uzun mazmunli so'zlar ko'p, 10-45 so'z.
    Budjet hujjatni bo'laklarga bo'lib har bo'lakdan eng yaxshisini oladi (boshi emas — butun hujjat).
    """
    if budget <= 0 or not sentences:
        return []

    def score(s: Sentence) -> float:
        words = s.text.split()
        if len(words) < 8:
            return -1.0
        rare = len(_RARE_WORD.findall(s.text))
        length_bonus = 1.0 if 10 <= len(words) <= 45 else 0.5
        return rare * length_bonus

    eligible = [s for s in sentences if score(s) > 0]
    if len(eligible) <= budget:
        return eligible
    bucket = len(eligible) / budget
    picked = []
    for i in range(budget):
        chunk = eligible[int(i * bucket): int((i + 1) * bucket)] or eligible[-1:]
        picked.append(max(chunk, key=score))
    return picked


def query_text(sentence: str, max_words: int = 14) -> str:
    """Qidiruv so'rovi: yordamchi so'zlarsiz, eng mazmunli qism (asl yozuvda)."""
    from apps.articles.antiplagiat_normalize import STOPWORDS, normalize_word

    words = [w for w in re.findall(r"[^\W_]+(?:['’ʻʼ‘][^\W_]+)*", sentence, re.UNICODE)
             if normalize_word(w) not in STOPWORDS and len(w) > 2]
    return ' '.join(words[:max_words])


# ---------------------------------------------------------------- to'liq matn (ochiq PDF)

FULLTEXT_MAX_BYTES = 15 * 1024 * 1024


def fetch_fulltext(url: str, *, verify: bool = True) -> str:
    """Ochiq kirishdagi PDF/HTML matni (kesh bilan). Xato bo'lsa — bo'sh satr."""
    from django.core.cache import cache

    if not url or not url.startswith(('http://', 'https://')):
        return ''
    key = 'antiplag_ft:' + hashlib.sha1(url.encode('utf-8')).hexdigest()
    cached = cache.get(key)
    if cached is not None:
        return cached
    text = ''
    try:
        from apps.articles.antiplagiat_open_api import USER_AGENT

        with requests.get(url, headers={'User-Agent': USER_AGENT}, timeout=25, stream=True, allow_redirects=True,
                          verify=verify) as resp:
            resp.raise_for_status()
            ctype = (resp.headers.get('Content-Type') or '').lower()
            data = b''
            for chunk in resp.iter_content(64 * 1024):
                data += chunk
                if len(data) > FULLTEXT_MAX_BYTES:
                    raise ValueError('fayl juda katta')
        if 'pdf' in ctype or data[:5] == b'%PDF-':
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                tmp.write(data)
                tmp_path = tmp.name
            try:
                from apps.services import extract_plain_text_from_file

                text = extract_plain_text_from_file(tmp_path) or ''
            finally:
                import os

                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
        elif 'html' in ctype or data.lstrip()[:1] == b'<':
            text = html_to_text(data.decode(resp.encoding or 'utf-8', errors='ignore'))
    except Exception as exc:
        logger.info('to\'liq matn olinmadi %s: %s', url[:120], exc)
        text = ''
    text = (text or '')[:400_000]
    cache.set(key, text, 7 * 24 * 3600)
    return text


_TAG_RE = re.compile(r'<(script|style|noscript)[^>]*>.*?</\1>|<[^>]+>', re.S | re.I)


def html_to_text(html: str) -> str:
    import html as html_lib

    body = _TAG_RE.sub(' ', html or '')
    return re.sub(r'\s+', ' ', html_lib.unescape(body)).strip()


def run_parallel(tasks: list[Callable[[], Any]], workers: int = 3) -> list[Any]:
    if not tasks:
        return []
    with ThreadPoolExecutor(max_workers=max(1, min(workers, len(tasks)))) as ex:
        futures = [ex.submit(t) for t in tasks]
        out = []
        for f in futures:
            try:
                out.append(f.result())
            except Exception as exc:
                logger.warning('antiplag parallel vazifa xato: %s', exc)
                out.append(None)
        return out
