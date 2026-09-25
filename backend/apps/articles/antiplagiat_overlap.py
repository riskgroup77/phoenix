"""
Matn kesishmalari va hujjat bo'yicha belgi ulushi (antiplag.uz uslubi).
"""
from __future__ import annotations

import re
from typing import Any


def normalize_compact(text: str) -> str:
    return re.sub(r'\s+', '', (text or '').lower())


def word_tokens(text: str) -> list[str]:
    return re.findall(r"[\w']+", (text or '').lower(), flags=re.UNICODE)


def longest_common_word_run(a: str, b: str) -> int:
    """Ketma-ket umumiy so'zlar soni (taxminiy kesishma)."""
    wa = word_tokens(a)
    wb = word_tokens(b)
    if len(wa) < 4 or len(wb) < 4:
        return 0
    best = 0
    max_i = min(len(wa), 120)
    max_j = min(len(wb), 120)
    for i in range(max_i):
        for j in range(max_j):
            if wa[i] != wb[j]:
                continue
            run = 0
            while (
                i + run < len(wa)
                and j + run < len(wb)
                and wa[i + run] == wb[j + run]
            ):
                run += 1
            if run > best:
                best = run
    return best


def sentence_overlap_score(doc_sentence: str, source_text: str) -> float:
    """0..1 — gap va manba matni o'rtasidagi moslik."""
    run = longest_common_word_run(doc_sentence, source_text)
    dw = len(word_tokens(doc_sentence))
    if dw < 4:
        return 0.0
    ratio = run / max(4, min(dw, 40))
    if ratio < 0.22:
        return 0.0
    return min(1.0, ratio * 1.15)


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
        pct = round(min(2.81, (oc / total_doc_chars) * 100), 2)
        hit['similarity'] = pct
    hits.sort(key=lambda h: float(h.get('similarity') or 0), reverse=True)
    return hits


def compute_verified_coverage(
    hits: list[dict[str, Any]],
    total_doc_chars: int,
) -> dict[str, float]:
    """Haqiqiy topilgan kesishmalar bo'yicha qoplanish (greedy, qisqacha)."""
    total_doc_chars = max(total_doc_chars, 1)
    verified = [h for h in hits if h.get('match_type') == 'verified' and int(h.get('overlap_chars') or 0) > 0]
    verified.sort(key=lambda h: int(h.get('overlap_chars') or 0), reverse=True)

    covered = 0
    for h in verified[:400]:
        covered += int(h.get('overlap_chars') or 0)

    plagiarism_pct = round(min(99.0, (covered / total_doc_chars) * 100), 2)
    return {
        'verified_hit_count': len(verified),
        'verified_plagiarism_pct': plagiarism_pct,
        'verified_covered_chars': covered,
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
