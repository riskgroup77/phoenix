"""
Matn "barmoq izlari" (fingerprint) — butun hujjatni butun korpus bilan tez va chuqur solishtirish.

Usul (Turnitin/MOSS kabi tizimlardagi "winnowing"):
  1. Matn normallashtiriladi va mazmunli so'zlar o'zagiga keltiriladi (antiplagiat_normalize).
  2. Ketma-ket K ta o'zakdan iborat bo'laklar (shingle) xeshlanadi (64 bit).
  3. Korpus hujjatlari uchun har W ta ketma-ket xeshdan eng kichigi saqlanadi (winnowing) — indeks
     ~3 marta kichrayadi, lekin uzunligi K+W-1 (=8) mazmunli so'zdan oshgan HAR QANDAY umumiy qism topiladi.
  4. Tekshirilayotgan hujjatning BARCHA xeshlari indeksdan qidiriladi → mos hujjatlar va qismlar.
  5. Mos qismlar so'zlar oralig'iga birlashtiriladi va asl matndagi belgilar oralig'iga qaytariladi.

Bu usul gap chegaralariga bog'liq emas: qisqa gaplar, bir necha gapga cho'zilgan ko'chirmalar,
bir gapda bir nechta manba — hammasi topiladi. Qo'shimchalar o'zgarishi, kirill/lotin, apostroflar
normalizatsiya tufayli moslikni buzmaydi.
"""
from __future__ import annotations

import hashlib
from collections import Counter
from dataclasses import dataclass, field
from typing import Iterable

from apps.articles.antiplagiat_normalize import Token, tokenize

K = 4  # shingle uzunligi (mazmunli so'z)
W = 5  # winnowing oynasi → kafolatlangan topish chegarasi K + W - 1 = 8 so'z
MIN_SPAN_TOKENS = 5  # bundan qisqa moslik (tasodif) hisobga olinmaydi
MERGE_GAP_TOKENS = 3  # mos qismlar orasidagi kichik uzilish (1-2 so'z almashtirilgan) birlashtiriladi


def shingle_hash(stems: Iterable[str]) -> int:
    """64-bitli ishorali butun son (PostgreSQL BIGINT ga sig'adi)."""
    digest = hashlib.blake2b(' '.join(stems).encode('utf-8'), digest_size=8).digest()
    return int.from_bytes(digest, 'big', signed=True)


def shingles(tokens: list[Token], k: int = K) -> list[tuple[int, int]]:
    """[(xesh, birinchi token indeksi)] — barcha shingle'lar."""
    if len(tokens) < k:
        return []
    words = [t.stem for t in tokens]
    return [(shingle_hash(words[i : i + k]), i) for i in range(len(words) - k + 1)]


def winnow(hashes: list[tuple[int, int]], w: int = W) -> list[tuple[int, int]]:
    """Har W ta ketma-ket xeshdan eng kichigi (o'ngdagisi) — takrorsiz."""
    if not hashes:
        return []
    if len(hashes) <= w:
        return [min(hashes, key=lambda h: (h[0], -h[1]))]
    picked: dict[int, tuple[int, int]] = {}
    for i in range(len(hashes) - w + 1):
        window = hashes[i : i + w]
        best = min(window, key=lambda h: (h[0], -h[1]))
        picked[best[1]] = best
    return sorted(picked.values(), key=lambda h: h[1])


@dataclass
class Span:
    """Tekshirilayotgan hujjatdagi mos qism (token indekslari, [start, end))."""

    start: int
    end: int
    # manbadagi siljish (manba token indeksi − hujjat token indeksi) har bir mos shingle uchun;
    # eng ko'p uchragani — haqiqiy tekislash (umumiy iboralar boshqa joylarda ham uchrasa ham)
    offsets: list[int] = field(default_factory=list)

    @property
    def source_offset(self) -> int | None:
        return Counter(self.offsets).most_common(1)[0][0] if self.offsets else None

    @property
    def length(self) -> int:
        return self.end - self.start


def covered_spans(
    matched_query_positions: Iterable[int],
    *,
    k: int = K,
    merge_gap: int = MERGE_GAP_TOKENS,
    source_map: dict[int, list[int]] | None = None,
) -> list[Span]:
    """Mos shingle boshlanishlari → birlashtirilgan so'zlar oraliqlari."""
    positions = sorted(set(matched_query_positions))
    spans: list[Span] = []
    for p in positions:
        lo, hi = p, p + k
        offs = [sp - p for sp in (source_map or {}).get(p, [])]
        if spans and lo <= spans[-1].end + merge_gap:
            spans[-1].end = max(spans[-1].end, hi)
            spans[-1].offsets.extend(offs)
        else:
            spans.append(Span(lo, hi, offs))
    return [s for s in spans if s.length >= MIN_SPAN_TOKENS]


def span_char_range(tokens: list[Token], span: Span) -> tuple[int, int]:
    end_tok = min(span.end, len(tokens)) - 1
    return tokens[span.start].start, tokens[end_tok].end


@dataclass
class TextMatch:
    """Ikki matn orasidagi moslik natijasi."""

    spans: list[Span]
    matched_tokens: int
    query_tokens: int

    @property
    def ratio(self) -> float:
        return self.matched_tokens / self.query_tokens if self.query_tokens else 0.0


def compare_tokens(query_tokens: list[Token], source_tokens: list[Token], *, k: int = K) -> TextMatch:
    """Xotirada to'liq solishtirish (winnowingsiz) — API annotatsiyalari, PDF va veb-sahifalar uchun."""
    src_index: dict[int, list[int]] = {}
    for h, pos in shingles(source_tokens, k):
        src_index.setdefault(h, []).append(pos)
    matched: dict[int, list[int]] = {}
    for h, pos in shingles(query_tokens, k):
        if h in src_index:
            matched[pos] = src_index[h]
    spans = covered_spans(matched.keys(), k=k, source_map=matched)
    return TextMatch(spans, sum(s.length for s in spans), len(query_tokens))


def compare_texts(query_text: str, source_text: str, *, k: int = K) -> TextMatch:
    return compare_tokens(tokenize(query_text), tokenize(source_text), k=k)


def source_fragment(source_text: str, source_tokens: list[Token], span: Span, *, k: int = K, pad: int = 4,
                    max_chars: int = 360) -> str:
    """Manba matnidan aynan mos kelgan qism (atrofidagi bir necha so'z bilan)."""
    off = span.source_offset
    if off is None or not source_tokens:
        return ''
    lo = max(0, min(len(source_tokens) - 1, span.start + off - pad))
    hi = max(lo, min(len(source_tokens), span.end + off + pad) - 1)
    a, b = source_tokens[lo].start, source_tokens[hi].end
    frag = source_text[a:b].strip()
    return frag[:max_chars]
