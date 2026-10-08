"""
Matn kesishmalari va hujjat bo'yicha belgi ulushi (antiplag.uz uslubi).
"""
from __future__ import annotations

import re
from functools import lru_cache
from typing import Any


def normalize_compact(text: str) -> str:
    return re.sub(r'\s+', '', (text or '').lower())


def word_tokens(text: str) -> list[str]:
    return re.findall(r"[\w']+", (text or '').lower(), flags=re.UNICODE)


def _longest_common_run_span(a: str, b: str) -> tuple[int, int]:
    """(uzunlik, b dagi boshlanish indeksi) — ketma-ket umumiy so'zlar."""
    wa = word_tokens(a)
    wb = word_tokens(b)
    if len(wa) < 4 or len(wb) < 4:
        return 0, 0
    best, best_j = 0, 0
    max_i = min(len(wa), 120)
    # Manba uzun bo'lishi mumkin (korpus hujjati) — so'z indeksi orqali faqat mos joylarni tekshiramiz
    positions: dict[str, list[int]] = {}
    for j, w in enumerate(wb):
        positions.setdefault(w, []).append(j)
    for i in range(max_i):
        for j in positions.get(wa[i], ()):
            run = 0
            while (
                i + run < len(wa)
                and j + run < len(wb)
                and wa[i + run] == wb[j + run]
            ):
                run += 1
            if run > best:
                best, best_j = run, j
    return best, best_j


def longest_common_word_run(a: str, b: str) -> int:
    """Ketma-ket umumiy so'zlar soni (taxminiy kesishma)."""
    return _longest_common_run_span(a, b)[0]


def matched_source_window(doc_sentence: str, source_text: str, *, pad_words: int = 6, max_words: int = 45) -> str:
    """
    Manba matnidan AYNAN mos kelgan qism (atrofidagi bir necha so'z bilan).
    Hisobotda manba hujjatining boshqa qismlari ko'rsatilmasligi uchun.
    """
    run, start = _longest_common_run_span(doc_sentence, source_text)
    if run <= 0:
        return ''
    words = word_tokens(source_text)
    lo = max(0, start - pad_words)
    hi = min(len(words), start + run + pad_words, lo + max_words)
    return ' '.join(words[lo:hi])


def _raw_overlap_score(doc_sentence: str, source_text: str) -> float:
    run = longest_common_word_run(doc_sentence, source_text)
    dw = len(word_tokens(doc_sentence))
    if dw < 4:
        return 0.0
    ratio = run / max(4, min(dw, 40))
    if ratio < 0.22:
        return 0.0
    return min(1.0, ratio * 1.15)


@lru_cache(maxsize=512)
def _stem_seq(text: str) -> tuple[str, ...]:
    from apps.articles.antiplagiat_normalize import stems

    return tuple(stems(text))


def _stem_overlap_score(doc_sentence: str, source_text: str) -> float:
    """
    Normallashtirilgan o'zaklar bo'yicha: kirill/lotin, apostrof, qo'shimcha farqlari moslikni buzmaydi.
    Ketma-ket umumiy o'zaklar + qisqa manbalarda (annotatsiya, snippet) gap o'zaklarining qamrab olinishi.
    """
    a = _stem_seq(doc_sentence)
    if len(a) < 4:
        return 0.0
    b = _stem_seq(source_text[:200_000])
    if len(b) < 3:
        return 0.0
    positions: dict[str, list[int]] = {}
    for j, w in enumerate(b):
        positions.setdefault(w, []).append(j)
    best = 0
    for i in range(min(len(a), 120)):
        for j in positions.get(a[i], ()):
            run = 0
            while i + run < len(a) and j + run < len(b) and a[i + run] == b[j + run]:
                run += 1
            best = max(best, run)
    run_score = 0.0
    if best >= 3:
        run_score = min(1.0, best / max(4, min(len(a), 30)) * 1.15)
    contain_score = 0.0
    if len(b) <= 160:
        sa, sb = set(a), set(b)
        common = len(sa & sb)
        if common >= 4:
            containment = common / len(sa)
            if containment >= 0.6:
                contain_score = containment * 0.9
    score = max(run_score, contain_score)
    return score if score >= 0.22 else 0.0


def sentence_overlap_score(doc_sentence: str, source_text: str) -> float:
    """0..1 — gap va manba matni o'rtasidagi moslik (asl so'zlar va normallashtirilgan o'zaklar bo'yicha)."""
    return max(_raw_overlap_score(doc_sentence, source_text), _stem_overlap_score(doc_sentence, source_text))


def estimate_overlap_chars(doc_fragment: str, source_text: str) -> int:
    """Taxminiy belgilar soni (bo'shliqsiz)."""
    score = sentence_overlap_score(doc_fragment, source_text)
    if score <= 0:
        return 0
    compact = normalize_compact(doc_fragment)
    return max(0, int(len(compact) * min(1.0, score)))


def assign_hit_char_shares(
    hits: list[dict[str, Any]],
    total_doc_chars: int,
) -> list[dict[str, Any]]:
    """Har bir hit uchun hisobotdagi ulush (%)."""
    total_doc_chars = max(total_doc_chars, 1)
    for hit in hits:
        oc = int(hit.get('overlap_chars') or 0)
        if oc <= 0:
            frag = hit.get('document_fragment') or hit.get('snippet') or ''
            src = hit.get('source_fragment') or hit.get('source_text') or hit.get('snippet') or ''
            oc = estimate_overlap_chars(frag, src)
            hit['overlap_chars'] = oc
        # Ulush cheklanmaydi: bitta manbadan 30% ko'chirilgan bo'lsa — 30% ko'rinishi kerak
        pct = round(min(100.0, (oc / total_doc_chars) * 100), 2)
        hit['similarity'] = pct
    hits.sort(key=lambda h: float(h.get('similarity') or 0), reverse=True)
    return hits


def _ranges_union_chars(ranges: list[tuple[int, int]], text: str) -> int:
    total, cur_a, cur_b = 0, None, None
    for a, b in sorted((int(a), int(b)) for a, b in ranges):
        if cur_b is None or a > cur_b:
            if cur_b is not None:
                total += len(re.sub(r'\s+', '', text[cur_a:cur_b]))
            cur_a, cur_b = a, b
        else:
            cur_b = max(cur_b, b)
    if cur_b is not None:
        total += len(re.sub(r'\s+', '', text[cur_a:cur_b]))
    return total


def compute_verified_coverage(
    hits: list[dict[str, Any]],
    total_doc_chars: int,
    *,
    text: str | None = None,
) -> dict[str, float]:
    """
    Haqiqiy kesishmalar bo'yicha qoplanish.
    Bitta gap bir nechta manbada topilsa, u BIR MARTA hisoblanadi: eng katta kesishma bilan, yoki
    (text berilgan va hitlarda doc_ranges bo'lsa) manbalar qoplagan qismlar birlashmasi bilan —
    gapning bir yarmi bir manbadan, ikkinchi yarmi boshqasidan bo'lsa ham to'g'ri sanaladi.
    O'z-o'ziga iqtibos alohida hisoblanadi va o'zlashtirishga qo'shilmaydi.
    """
    total_doc_chars = max(total_doc_chars, 1)
    verified = [h for h in hits if h.get('match_type') == 'verified' and int(h.get('overlap_chars') or 0) > 0]

    per_fragment: dict[str, tuple[int, bool]] = {}
    ranges_by_key: dict[tuple[str, bool], list] = {}
    for h in verified:
        key = normalize_compact(h.get('document_fragment') or h.get('snippet') or '')[:200]
        if not key:
            continue
        oc = int(h.get('overlap_chars') or 0)
        is_self = bool(h.get('self_citation'))
        if text and h.get('doc_ranges'):
            ranges_by_key.setdefault((key, is_self), []).extend(h['doc_ranges'])
        prev = per_fragment.get(key)
        # Begona manba bilan moslik o'z-o'ziga iqtibosdan ustun (o'zlashtirish sifatida hisoblanadi)
        if prev is None or (prev[1] and not is_self) or (prev[1] == is_self and oc > prev[0]):
            per_fragment[key] = (oc, is_self)
    if text:
        for key, (oc, is_self) in list(per_fragment.items()):
            ranges = ranges_by_key.get((key, is_self))
            if ranges:
                per_fragment[key] = (max(oc, _ranges_union_chars(ranges, text)), is_self)

    covered = sum(oc for oc, is_self in per_fragment.values() if not is_self)
    self_covered = sum(oc for oc, is_self in per_fragment.values() if is_self)

    plagiarism_pct = round(min(100.0, (covered / total_doc_chars) * 100), 2)
    self_citation_pct = round(min(100.0 - plagiarism_pct, (self_covered / total_doc_chars) * 100), 2)
    return {
        'verified_hit_count': len(verified),
        'verified_plagiarism_pct': plagiarism_pct,
        'verified_self_citation_pct': self_citation_pct,
        'verified_covered_chars': covered,
        'verified_fragments': len(per_fragment),
    }


def dedupe_hits(hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for h in hits:
        frag = (h.get('document_fragment') or h.get('snippet') or '')[:100].lower()
        url = (h.get('source') or h.get('title') or '')[:120].lower()
        key = f'{url}|{frag}'
        if key in seen:
            continue
        seen.add(key)
        out.append(h)
    return out
