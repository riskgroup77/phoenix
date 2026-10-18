"""
Hujjatlar tili: har qanday yaratiladigan hujjat foydalanuvchining interfeys tilida (uz / ru / en) shakllanadi.
Til frontenddan `lang` parametri (yoki Accept-Language sarlavhasi) bilan keladi; noma'lum bo'lsa — 'uz'.
"""
from __future__ import annotations

import re

LANGS = ('uz', 'ru', 'en')
UZ_CYRL = 'uz-cyrl'  # o'zbek kirill: o'zbekcha matn kirillga o'giriladi (frontend i18n/translit.ts bilan bir xil)
DEFAULT_LANG = 'uz'


def normalize_lang(value) -> str:
    v = str(value or '').strip().lower().replace('_', '-')
    v = v.split(',')[0].split(';')[0].strip()
    if v.startswith('uz-cyr'):
        return UZ_CYRL
    v = v.split('-')[0]
    return v if v in LANGS else DEFAULT_LANG


# ---- lotin → kirill (frontend/i18n/translit.ts porti)
_KEEP = {'DOI', 'ISSN', 'ISBN', 'ORCID', 'PDF', 'DOCX', 'XML', 'URL', 'QR', 'AI', 'Click', 'Payme', 'Phoenix',
         'Telegram', 'Google', 'Scholar', 'Crossref', 'OpenAlex', 'Email', 'E-mail', 'OAK', 'Scopus'}
_APOS = "'\u2019\u02bb\u02bc\u2018`"
_SINGLE = dict(zip('abcdefghijklmnopqrstuvwxyz', 'абсдефгҳижклмнопқрстуввхйз'))
_VOWELS = 'aeiouAEIOU'


def _case(src: str, out: str, next_upper: bool) -> str:
    if len(src) > 1 and src.isupper():
        return out.upper()
    if src[0].isupper():
        return out.upper() if next_upper else out[:1].upper() + out[1:]
    return out


def _word_to_cyr(word: str) -> str:
    if word in _KEEP or re.search(r'[\d@/.]', word):
        return word
    out, i = '', 0
    while i < len(word):
        ch, low = word[i], word[i].lower()
        nxt = word[i + 1] if i + 1 < len(word) else ''
        after = word[i + 2] if i + 2 < len(word) else ''
        next_upper = bool(after) and after.isupper()
        if low in 'og' and nxt and nxt in _APOS:
            out += _case(ch, 'ў' if low == 'o' else 'ғ', False)
            i += 2
        elif low == 's' and nxt.lower() == 'h':
            out += _case(ch + nxt, 'ш', next_upper)
            i += 2
        elif low == 'c' and nxt.lower() == 'h':
            out += _case(ch + nxt, 'ч', next_upper)
            i += 2
        elif low == 'y' and nxt and nxt.lower() in 'oau':
            out += _case(ch + nxt, {'o': 'ё', 'a': 'я', 'u': 'ю'}[nxt.lower()], next_upper)
            i += 2
        elif low == 'y' and nxt.lower() == 'e':
            out += _case(ch + nxt, 'е', next_upper)
            i += 2
        elif low == 'e':
            prev = word[i - 1] if i else ''
            at_start = i == 0 or not prev.isascii() or not prev.isalpha() or prev in _VOWELS
            out += _case(ch, 'э' if at_start else 'е', False)
            i += 1
        elif ch in _APOS:
            out += 'ъ' if 0 < i < len(word) - 1 else ch
            i += 1
        else:
            m = _SINGLE.get(low)
            out += _case(ch, m, False) if m else ch
            i += 1
    return out.upper() if word.isupper() else out  # "MA’LUMOTNOMA" → "МАЪЛУМОТНОМА"


def to_cyrillic(text: str) -> str:
    if not text:
        return text
    # Havola, email va domen ("ilmiyfaoliyat.uz") butunligicha qoladi (frontend translit.ts bilan bir xil)
    parts = re.split(
        r'(\{[^}]+\}|https?://\S+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+|[A-Za-z0-9-]+\.(?:uz|com|org|net|ru)\b'
        r'|[^\s.,;:!?()«»"“”\-–—/]+)',
        text,
    )
    return ''.join(p if (not p or p.startswith(('{', 'http')) or re.fullmatch(r'[\s.,;:!?()«»"“”\-–—/]+', p))
                   else _word_to_cyr(p) for p in parts)


def request_lang(request) -> str:
    """?lang= → Accept-Language → 'uz'."""
    explicit = getattr(request, 'GET', {}).get('lang') if request is not None else None
    if explicit:
        return normalize_lang(explicit)
    header = request.META.get('HTTP_ACCEPT_LANGUAGE', '') if request is not None else ''
    return normalize_lang(header)


class Dictionary:
    """{kalit: (uz, ru, en)} lug'ati: d.t('key', lang, **fmt). 'uz-cyrl' — o'zbekcha matn kirillda."""

    def __init__(self, entries: dict[str, tuple[str, str, str]]):
        self.entries = entries

    def t(self, key: str, lang: str, **fmt) -> str:
        lang = normalize_lang(lang)
        row = self.entries.get(key)
        if row is None:
            text = key
        elif lang == UZ_CYRL:
            text = to_cyrillic(row[0])
        else:
            text = row[LANGS.index(lang)] or row[0]
        return text.format(**fmt) if fmt else text
