"""
Antiplagiatni "aldash" usullarini aniqlash va zararsizlantirish.

Keng tarqalgan usullar (MDH antiplagiat tizimlarida ma'lum):
  1. Ko'rinmas belgilar: so'z ichiga zero-width space (U+200B), soft hyphen (U+00AD) va h.k. qo'yiladi —
     ekranda so'z bir xil, lekin dastur uchun "iqtisod​iyot" ikki xil so'z bo'lib qoladi.
  2. Harf almashtirish (homoglif): lotin "a, o, e, p, c, x" o'rniga ko'rinishi bir xil kirill "а, о, е, р, с, х"
     (yoki aksincha) yoziladi.
  3. Yashirin matn: DOCX/PDF da oq rangli, juda mayda (≤1pt) yoki "hidden" belgili matn so'zlar orasiga
     qo'shiladi — ko'zga ko'rinmaydi, lekin matnni "original" qilib ko'rsatadi.

Barcha holatlarda matn tozalanib, tekshiruv asl (ko'rinadigan) matn bo'yicha o'tkaziladi va hisobotda
"bypass_attempts" bo'limida ogohlantirish beriladi.
"""
from __future__ import annotations

import logging
import re
import zipfile
from typing import Any
from xml.etree import ElementTree as ET

logger = logging.getLogger(__name__)

# Ko'rinmas / nol kenglikdagi belgilar (oddiy bo'shliq va NBSP bu yerga kirmaydi)
INVISIBLE_RE = re.compile('[­͏؜ᅟᅠ឴឵᠎​-‏‪-‮'
                          '⁠-⁤⁪-⁯﻿︀-️]')
# G'alati bo'shliqlar (so'zni bo'lib yuborish uchun ishlatiladi) → oddiy bo'shliq
ODD_SPACE_RE = re.compile('[ -   　]')

# Ko'rinishi bir xil harflar: kirill → lotin va lotin → kirill
_CYR2LAT = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'к': 'k', 'м': 'm', 'т': 't',
    'і': 'i', 'ј': 'j', 'ѕ': 's', 'һ': 'h', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w',
    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T',
    'У': 'Y', 'Х': 'X', 'І': 'I', 'Ј': 'J', 'Ѕ': 'S',
}
_LAT2CYR = {v: k for k, v in _CYR2LAT.items() if k in 'аеорсухкмтАВЕКМНОРСТУХ'}

_WORD_RE = re.compile(r'[^\W\d_]+', re.UNICODE)


def _is_cyr(ch: str) -> bool:
    return 'Ѐ' <= ch <= 'ӿ' or 'Ԁ' <= ch <= 'ԯ'


def _is_lat(ch: str) -> bool:
    return ('a' <= ch.lower() <= 'z') or ch in "ʻʼ'"


def _fix_word(word: str) -> tuple[str, bool]:
    """Aralash yozuvli so'z → ko'pchilik yozuvga keltiriladi (faqat ko'rinishi bir xil harflar)."""
    cyr = sum(1 for c in word if _is_cyr(c))
    lat = sum(1 for c in word if 'a' <= c.lower() <= 'z')
    if not cyr or not lat:
        return word, False
    if lat >= cyr:
        fixed = ''.join(_CYR2LAT.get(c, c) for c in word)
    else:
        fixed = ''.join(_LAT2CYR.get(c, c) for c in word)
    return fixed, fixed != word


def clean_text(text: str) -> tuple[str, dict[str, Any]]:
    """
    Matnni tozalash: ko'rinmas belgilar olib tashlanadi, g'alati bo'shliqlar oddiy bo'shliqqa,
    aralash yozuvli so'zlar bir yozuvga keltiriladi. (tozalangan matn, statistika)
    """
    text = text or ''
    invisible = len(INVISIBLE_RE.findall(text))
    odd_spaces = len(ODD_SPACE_RE.findall(text))
    out = INVISIBLE_RE.sub('', text)
    out = ODD_SPACE_RE.sub(' ', out)

    homoglyph_words = 0
    examples: list[str] = []

    def repl(m: re.Match) -> str:
        nonlocal homoglyph_words
        fixed, changed = _fix_word(m.group(0))
        if changed:
            homoglyph_words += 1
            if len(examples) < 5:
                examples.append(m.group(0))
        return fixed

    out = _WORD_RE.sub(repl, out)
    return out, {
        'invisible_chars': invisible,
        'odd_spaces': odd_spaces,
        'homoglyph_words': homoglyph_words,
        'homoglyph_examples': examples,
    }


# ---------------------------------------------------------------- DOCX: yashirin matn

_W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
_WHITE = {'FFFFFF', 'FEFEFE', 'FFFFFE', 'FDFDFD', 'FCFCFC', 'FAFAFA'}


def _run_hidden(rpr) -> str:
    """Yashirinlik sababi ('' — ko'rinadi)."""
    if rpr is None:
        return ''
    van = rpr.find(f'{_W}vanish')
    if van is not None and van.get(f'{_W}val', 'true') not in ('0', 'false'):
        return 'hidden'
    color = rpr.find(f'{_W}color')
    if color is not None and (color.get(f'{_W}val') or '').upper() in _WHITE:
        shd = rpr.find(f'{_W}shd')
        fill = (shd.get(f'{_W}fill') or '').upper() if shd is not None else ''
        if fill in ('', 'AUTO') or fill in _WHITE:
            return 'white'
    sz = rpr.find(f'{_W}sz')
    if sz is not None:
        try:
            if int(sz.get(f'{_W}val') or 99) <= 2:  # yarim punktlarda: ≤ 1pt
                return 'tiny'
        except ValueError:
            pass
    return ''


def docx_visible_text(path: str) -> tuple[str, dict[str, Any]]:
    """DOCX ning faqat ko'rinadigan matni va yashirin matn statistikasi."""
    stats = {'hidden_chars': 0, 'hidden_reasons': {}}
    try:
        with zipfile.ZipFile(path) as zf:
            xml = zf.read('word/document.xml')
    except Exception as exc:
        logger.info('docx o\'qilmadi %s: %s', path, exc)
        return '', stats
    if b'<!DOCTYPE' in xml[:2048].upper() or b'<!ENTITY' in xml.upper():
        return '', stats
    root = ET.fromstring(xml)
    paras: list[str] = []
    for p in root.iter(f'{_W}p'):
        buf: list[str] = []
        for r in p.iter(f'{_W}r'):
            reason = _run_hidden(r.find(f'{_W}rPr'))
            for node in r:
                if node.tag == f'{_W}t':
                    t = node.text or ''
                elif node.tag == f'{_W}tab':
                    t = '\t'
                elif node.tag in (f'{_W}br', f'{_W}cr'):
                    t = '\n'
                else:
                    continue
                if reason:
                    stats['hidden_chars'] += len(t.strip())
                    stats['hidden_reasons'][reason] = stats['hidden_reasons'].get(reason, 0) + len(t.strip())
                else:
                    buf.append(t)
        paras.append(''.join(buf))
    return '\n'.join(paras).strip(), stats


# ---------------------------------------------------------------- PDF: oq / mayda matn

def _pdf_char_hidden(obj: dict) -> bool:
    if obj.get('object_type') != 'char':
        return False
    if float(obj.get('size') or 10) < 1.5:
        return True
    color = obj.get('non_stroking_color')
    if isinstance(color, (list, tuple)):
        vals = [float(v) for v in color if isinstance(v, (int, float))]
        if len(vals) == 1 and vals[0] >= 0.97:  # kulrang shkala: 1 = oq
            return True
        if len(vals) == 3 and min(vals) >= 0.97:  # RGB oq
            return True
        if len(vals) == 4 and max(vals) <= 0.03:  # CMYK oq
            return True
    return False


def pdf_visible_text(path: str) -> tuple[str, dict[str, Any]]:
    """PDF ning ko'rinadigan matni (oq va ≤1.5pt belgilar tashlanadi). pdfplumber bo'lmasa — ''."""
    stats = {'hidden_chars': 0, 'hidden_reasons': {}}
    try:
        import pdfplumber
    except ImportError:
        return '', stats
    parts: list[str] = []
    try:
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                hidden = [c for c in page.chars if _pdf_char_hidden(c)]
                if hidden:
                    stats['hidden_chars'] += sum(1 for c in hidden if (c.get('text') or '').strip())
                    page = page.filter(lambda o: not _pdf_char_hidden(o))
                parts.append(page.extract_text() or '')
    except Exception as exc:
        logger.info('pdf o\'qilmadi %s: %s', path, exc)
        return '', stats
    if stats['hidden_chars']:
        stats['hidden_reasons']['white_or_tiny'] = stats['hidden_chars']
    return '\n'.join(p for p in parts if p).strip(), stats


def extract_visible_text(path: str) -> tuple[str | None, dict[str, Any]]:
    """
    Fayldagi yashirin matnni aniqlaydi. Yashirin matn topilsa — ko'rinadigan matn qaytariladi,
    aks holda None (odatiy ajratib olish ishlatiladi).
    """
    lower = (path or '').lower()
    if lower.endswith('.docx'):
        text, stats = docx_visible_text(path)
    elif lower.endswith('.pdf'):
        text, stats = pdf_visible_text(path)
    else:
        return None, {'hidden_chars': 0, 'hidden_reasons': {}}
    if stats['hidden_chars'] >= 5 and text:
        return text, stats
    return None, stats


def summarize(text_stats: dict[str, Any], file_stats: dict[str, Any] | None, total_chars: int) -> dict[str, Any]:
    """Hisobot uchun: aniqlangan aldash urinishlari."""
    file_stats = file_stats or {}
    hidden = int(file_stats.get('hidden_chars') or 0)
    inv = int(text_stats.get('invisible_chars') or 0)
    homo = int(text_stats.get('homoglyph_words') or 0)
    odd = int(text_stats.get('odd_spaces') or 0)
    items = []
    if inv >= 3:
        items.append(f"Ko'rinmas belgilar: {inv} ta (so'zlarni bo'lib yuborish uchun qo'yilgan)")
    if homo >= 3:
        items.append(f"Harflari boshqa alifbodagi o'xshash harfga almashtirilgan so'zlar: {homo} ta")
    if odd >= 10:
        items.append(f"G'ayrioddiy bo'shliq belgilari: {odd} ta")
    if hidden >= 5:
        reasons = ', '.join(f'{k}: {v}' for k, v in (file_stats.get('hidden_reasons') or {}).items())
        items.append(f"Yashirin (oq / juda mayda / hidden) matn: {hidden} belgi ({reasons})")
    return {
        'detected': bool(items),
        'items': items,
        'invisible_chars': inv,
        'homoglyph_words': homo,
        'odd_spaces': odd,
        'hidden_text_chars': hidden,
        'hidden_text_percent': round(min(100.0, hidden / max(total_chars, 1) * 100), 2),
        'homoglyph_examples': text_stats.get('homoglyph_examples') or [],
    }
