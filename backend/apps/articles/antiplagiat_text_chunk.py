"""Hujjat matnini qidiruv/indeks uchun fragmentlarga bo'lish."""
from __future__ import annotations

import re


def iter_text_chunks(
    text: str,
    *,
    chunk_chars: int = 520,
    step_chars: int = 380,
) -> list[str]:
    clean = re.sub(r'\s+', ' ', (text or '').strip())
    if len(clean) < 40:
        return []
    if len(clean) <= chunk_chars:
        return [clean]

    chunks: list[str] = []
    start = 0
    while start < len(clean):
        piece = clean[start : start + chunk_chars].strip()
        if len(piece) >= 35:
            chunks.append(piece)
        start += step_chars
        if start >= len(clean):
            break
    return chunks
