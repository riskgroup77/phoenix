"""
Yuklangan hujjatni tahlil qilish: sarlavha, annotatsiya, kalit so'zlar, til, so'zlar va betlar soni.

Fayl serverda SAQLANMAYDI — vaqtinchalik faylga yoziladi, matni olinadi va darhol o'chiriladi.
Asl fayl brauzerda qoladi va muallif tasdiqlaganda tegishli xizmat formasi orqali yuboriladi.
"""
from __future__ import annotations

import os
import re
import tempfile
from typing import Any

ALLOWED_EXT = {'.doc', '.docx', '.pdf', '.txt', '.rtf', '.odt'}
MAX_BYTES = 25 * 1024 * 1024
WORDS_PER_PAGE = 300

ABSTRACT_HEAD = re.compile(r'^\s*(annotatsiya|annotation|аннотация|abstract)\s*[:.\-—]?\s*', re.I)
KEYWORDS_HEAD = re.compile(
    r'^\s*(kalit\s+so[\'ʻ’‘`]?zlar|tayanch\s+so[\'ʻ’‘`]?zlar|ключевые\s+слова|key\s*words|калит\s+сўзлар)\s*[:.\-—]?\s*', re.I)
STOP_HEADS = re.compile(r'^\s*(kirish|введение|introduction|kalit|ключевые|key\s*words|abstract|аннотация|annotatsiya)\b', re.I)
NOISE_LINE = re.compile(r'(udk|удк|udc|doi|issn|e-?mail|@|https?://|\b\d{4}\b.*\b\d{4}\b)', re.I)


def _lines(text: str) -> list[str]:
    return [ln.strip() for ln in (text or '').replace('\r', '\n').split('\n') if ln.strip()]


def guess_title(lines: list[str]) -> str:
    """Birinchi mazmunli qator: UDK/DOI/email/muallif ro'yxati emas, 15–300 belgi."""
    for ln in lines[:25]:
        if NOISE_LINE.search(ln) or STOP_HEADS.match(ln):
            continue
        letters = sum(c.isalpha() for c in ln)
        if 15 <= len(ln) <= 300 and letters >= 10:
            title = ln.strip(' .')
            # BOSH HARFLI sarlavhani oddiy yozuvga
            if title.isupper():
                title = title[:1] + title[1:].lower()
            return title
    return ''


def _section_after(lines: list[str], head: re.Pattern, max_chars: int) -> str:
    for i, ln in enumerate(lines):
        m = head.match(ln)
        if not m:
            continue
        rest = ln[m.end():].strip()
        chunk = [rest] if rest else []
        for nxt in lines[i + 1:i + 8]:
            if STOP_HEADS.match(nxt):
                break
            chunk.append(nxt)
            if sum(len(c) for c in chunk) >= max_chars:
                break
        return ' '.join(chunk)[:max_chars].strip()
    return ''


def guess_keywords(lines: list[str]) -> list[str]:
    raw = _section_after(lines, KEYWORDS_HEAD, 400)
    if not raw:
        return []
    raw = raw.split('.')[0]
    parts = [p.strip(' ;,.') for p in re.split(r'[;,]', raw)]
    return [p for p in parts if 2 <= len(p) <= 60][:10]


def analyze_text(text: str, filename: str = '') -> dict[str, Any]:
    from apps.articles.antiplagiat_normalize import guess_lang

    lines = _lines(text)
    words = re.findall(r'[^\W_]+', text or '', re.UNICODE)
    title = guess_title(lines) or os.path.splitext(os.path.basename(filename or ''))[0].replace('_', ' ').strip()
    abstract = _section_after(lines, ABSTRACT_HEAD, 1500)
    if not abstract:
        # Annotatsiya sarlavhasi bo'lmasa — sarlavhadan keyingi birinchi uzun paragraf
        for ln in lines[1:20]:
            if len(ln) >= 200 and not NOISE_LINE.search(ln):
                abstract = ln[:1500]
                break
    word_count = len(words)
    return {
        'filename': os.path.basename(filename or '')[:200],
        'title': title[:300],
        'abstract': abstract,
        'keywords': guess_keywords(lines),
        'language': guess_lang(' '.join(lines[:60])) if lines else '',
        'word_count': word_count,
        'page_estimate': max(1, round(word_count / WORDS_PER_PAGE)) if word_count else 0,
        'has_text': bool(word_count),
    }


def analyze_upload(uploaded) -> dict[str, Any]:
    """Django UploadedFile → tahlil. Xato bo'lsa ValueError (foydalanuvchiga ko'rsatiladigan matn bilan)."""
    from apps.services import extract_plain_text_from_file

    name = getattr(uploaded, 'name', '') or 'hujjat'
    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED_EXT:
        raise ValueError("Faqat DOC, DOCX, PDF, RTF, ODT yoki TXT fayllarni tahlil qilish mumkin.")
    if getattr(uploaded, 'size', 0) > MAX_BYTES:
        raise ValueError("Fayl hajmi 25 MB dan oshmasligi kerak.")
    fd, path = tempfile.mkstemp(suffix=ext, prefix='phx-ai-')
    try:
        with os.fdopen(fd, 'wb') as fh:
            for chunk in uploaded.chunks():
                fh.write(chunk)
        try:
            text = extract_plain_text_from_file(path) or ''
        except Exception:
            text = ''
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    result = analyze_text(text, name)
    result['size'] = int(getattr(uploaded, 'size', 0) or 0)
    result['ext'] = ext
    return result
