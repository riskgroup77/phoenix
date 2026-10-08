"""Tarjima narxi uchun so'zlar sonini server tomonida hisoblash (mijoz yuborgan word_count ga ishonilmaydi)."""
from __future__ import annotations

import logging
import os
import tempfile

from apps.services import extract_plain_text_from_file

logger = logging.getLogger(__name__)

# Agar matn chiqarib bo‘lmasa: fayl hajmi asosida taxmin (DOCX siqilgan — eski 150 so‘z/KB noto‘g‘ri edi)
FALLBACK_WORDS_PER_KB = 18
MAX_FALLBACK_WORDS = 120_000


def estimate_words_from_size(size_bytes: int) -> int:
    size_kb = max((size_bytes or 0) / 1024, 0.001)
    return min(max(int(size_kb * FALLBACK_WORDS_PER_KB), 50), MAX_FALLBACK_WORDS)


def count_words_in_upload(file_obj) -> tuple[int, str, bool]:
    """
    Yuklangan fayldagi so'zlar soni.
    Qaytaradi: (word_count, text, is_estimate). Fayl ko'rsatkichi boshiga qaytariladi.
    """
    ext = os.path.splitext(getattr(file_obj, 'name', '') or '')[1].lower()[:10]
    tmp_path = None
    text = ''
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp_path = tmp.name
            for chunk in file_obj.chunks():
                tmp.write(chunk)
        text = extract_plain_text_from_file(tmp_path) or ''
    except Exception as exc:
        logger.warning('Tarjima fayli tahlil qilinmadi: %s', exc)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
        try:
            file_obj.seek(0)
        except Exception:
            pass

    word_count = len(text.split())
    if word_count > 0:
        return word_count, text, False
    return estimate_words_from_size(getattr(file_obj, 'size', 0)), text, True
