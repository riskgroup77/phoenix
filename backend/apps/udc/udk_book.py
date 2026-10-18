"""
"UDK kitobi o'zbekchasi" (Universal o'nli klassifikatsiya, qisqartirilgan nashr, 2023) — asosiy jadvallarni
PDF matnidan ajratish. Matn `pdftotext -layout` bilan olinadi: kod qator boshida, tavsif davomi chekinish bilan.
"""
import re
import shutil
import subprocess

from .translit import cyr_to_latin

_CODE_RE = re.compile(r'^\s{0,4}(\d[\d.]*(?:[-/:][\d.]+)*(?:\.0\d+)?)\s{2,}(\S.*)$')


def pdf_layout_text(pdf_path: str, first_page: int = 78, last_page: int = 282) -> str:
    if not shutil.which('pdftotext'):
        raise RuntimeError("pdftotext topilmadi (poppler-utils o'rnating)")
    return subprocess.run(
        ['pdftotext', '-layout', '-f', str(first_page), '-l', str(last_page), pdf_path, '-'],
        check=True, capture_output=True, text=True,
    ).stdout


def _clean_title(t: str) -> str:
    t = re.sub(r'\s+', ' ', re.sub(r'-\s+(?=[а-яўқғҳ])', '', t)).strip()
    t = re.sub(r'\s*Махсус аниқловчилар.*$', '', t)
    t = re.sub(r'\s+(?:Ушбу|Бу ерда|Шу жумладан|Қаранг)\b.*$', '', t)  # izoh jumlalari tavsifga kirmaydi
    words = t.split(' ')
    if words and words[0].isupper():
        # Bo'lim sarlavhasi (KATTA harflarda) — keyingi izoh matnini kesib tashlaymiz
        k = 0
        while k < len(words) and (words[k].isupper() or not any(ch.isalpha() for ch in words[k])):
            k += 1
        t = ' '.join(words[:k])
    return t.rstrip(' .,;')


def parse_main_tables(text: str) -> list[dict]:
    entries, cur, started, example = [], None, False, False
    for line in text.split('\n'):
        if 'АСОСИЙ ЖАДВАЛЛАР' in line:
            started = True
            continue
        if not started:
            continue
        s = line.rstrip()
        if not s.strip() or re.fullmatch(r'\s*\d{1,3}\s*', s):  # bo'sh qator yoki bet raqami
            continue
        m = _CODE_RE.match(s)
        if m:
            cur = {'code': m.group(1).rstrip('.'), 'title': m.group(2).strip(), 'notes': False}
            entries.append(cur)
            example = False
            continue
        t = s.strip()
        if cur is None or '→' in t:  # havolalar ("→ 004.6 ...") tavsifga qo'shilmaydi
            continue
        if t.startswith(('Масалан', 'Мисол')):
            example = True
        if s.startswith(' ' * 6) and not example and not cur['notes']:
            cur['title'] += ' ' + t
        else:
            cur['notes'] = True
    seen, items = set(), []
    for e in entries:
        title = _clean_title(e['title'])
        if not title or e['code'] in seen:
            continue
        seen.add(e['code'])
        items.append({'code': e['code'], 'description': title, 'description_latin': cyr_to_latin(title)})
    return items
