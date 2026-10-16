"""
Maqola sahifalar sonini SERVER tomonida fayldan aniqlash (bet bo'yicha narx shunga qarab olinadi).

Avval muallif kiritgan page_count ga ishonilardi: 30 betlik maqolani "1 bet" deb arzon to'lash mumkin edi.
  - PDF  — haqiqiy sahifalar soni;
  - DOCX — Word saqlagan sahifalar soni (docProps/app.xml), bo'lmasa so'zlar soniga qarab;
  - DOC va boshqalar — matndagi so'zlar soniga qarab.
"""
from __future__ import annotations

import logging
import math
import os
import re
import zipfile

logger = logging.getLogger(__name__)

MAX_PAGES = 500
# A4, 14 pt, 1.5 interval — ilmiy maqola uchun odatiy (≈ 300 so'z/bet)
WORDS_PER_PAGE = 300


def _clamp(n: int) -> int:
    return max(1, min(MAX_PAGES, int(n)))


def _rewind(file_obj) -> None:
    try:
        file_obj.seek(0)
    except Exception:
        pass


def _pdf_pages(file_obj) -> int | None:
    try:
        from PyPDF2 import PdfReader

        return len(PdfReader(file_obj).pages) or None
    except Exception as exc:
        logger.info('PDF sahifalari o\'qilmadi: %s', exc)
        return None
    finally:
        _rewind(file_obj)


def _docx_pages(file_obj) -> int | None:
    """
    Word har saqlashda docProps/app.xml ga <Pages> yozadi. Lekin dastur bilan yaratilgan (python-docx, ba'zi
    konvertorlar) faylda bu qiymat shablondan eskirib qoladi (masalan 40 betlik matnda <Pages>1</Pages>).
    Shuning uchun matn hajmi bo'yicha taxmin ham olinadi: u metadatadan 2 barobardan ko'p bo'lsa — metadata
    eskirgan deb hisoblanadi (zich shrift ham bir betga ~600 so'zdan oshmaydi).
    """
    meta_pages = None
    text_pages = None
    try:
        with zipfile.ZipFile(file_obj) as zf:
            names = set(zf.namelist())
            if 'docProps/app.xml' in names:
                m = re.search(rb'<Pages>\s*(\d+)\s*</Pages>', zf.read('docProps/app.xml'))
                if m and int(m.group(1)) > 0:
                    meta_pages = int(m.group(1))
            if 'word/document.xml' in names:
                xml = zf.read('word/document.xml')
                text = b' '.join(re.findall(rb'<w:t(?:\s[^>]*)?>([^<]*)</w:t>', xml)).decode('utf-8', 'ignore')
                words = len(text.split())
                text_pages = math.ceil(words / WORDS_PER_PAGE) if words else None
    except Exception as exc:
        logger.info('DOCX sahifalari o\'qilmadi: %s', exc)
    finally:
        _rewind(file_obj)
    if meta_pages and text_pages and text_pages > 2 * meta_pages:
        return text_pages
    return meta_pages or text_pages


def _text_pages(file_obj) -> int | None:
    from apps.translations.word_count import count_words_in_upload

    words, _text, is_estimate = count_words_in_upload(file_obj)
    if is_estimate or words <= 0:
        return None
    return math.ceil(words / WORDS_PER_PAGE)


def count_pages(file_obj) -> int | None:
    """Fayldagi sahifalar soni (1..500) yoki aniqlab bo'lmasa None. Fayl ko'rsatkichi boshiga qaytariladi."""
    if not file_obj:
        return None
    ext = os.path.splitext(getattr(file_obj, 'name', '') or '')[1].lower()
    if ext == '.pdf':
        pages = _pdf_pages(file_obj)
    elif ext == '.docx':
        pages = _docx_pages(file_obj)
    else:
        pages = _text_pages(file_obj)
    return _clamp(pages) if pages else None
