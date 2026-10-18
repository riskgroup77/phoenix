"""
Avtomatik UDK aniqlash (taqrizchisiz).

1) Leksik moslik: ish sarlavhasi / annotatsiya / kalit so'zlar / fayl matni ↔ UDK kitobi tavsiflari (UdcClass, lotinga
   o'girilgan). TF-IDF ga o'xshash ball; ota-klass tavsiflari ham hisobga olinadi (to'g'ri bo'limdagi chuqur kod ustun).
2) Rus tilidagi ishlar uchun: perviy-vestnik.ru UDK bazasi (436 ming kod) qidiruv API si — qo'shimcha nomzodlar.
3) AI (Claude/Gemini, kalit sozlangan bo'lsa): nomzodlar ro'yxatidan eng mosini tanlaydi. AI javobi faqat nomzodlar
   ichidan qabul qilinadi; AI bo'lmasa — eng yuqori leksik ball.
"""
from __future__ import annotations

import json
import logging
import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from functools import lru_cache

import requests
from django.conf import settings

from .translit import cyr_to_latin

logger = logging.getLogger(__name__)

PERVIY_API = 'https://udc-api.perviy-vestnik.ru/api/search'
_UZ_CYR = set('ўқғҳ')
_RU_ONLY = set('ыэщъ')

STOPWORDS = {
    # o'zbek
    'va', 'bilan', 'uchun', 'ham', 'bu', 'shu', 'ushbu', 'hamda', 'yoki', 'kabi', 'orqali', 'asosida', 'asosiy',
    'haqida', 'boyicha', 'buyicha', 'ning', 'dagi', 'lar', 'larning', 'ular', 'uning', 'bir', 'har', 'qilish',
    'etish', 'qilingan', 'etilgan', 'muammolari', 'masalalari', 'umumiy', 'tarzda', 'turlari', 'boshqa', 'boshqalar',
    'maqola', 'maqolada', 'tadqiqot', 'tadqiqotda', 'ilmiy', 'ish', 'ishda', 'tahlil', 'zamonaviy', 'yangi',
    'rivojlantirish', 'takomillashtirish', 'samaradorligini', 'oshirish', 'roli', 'ahamiyati', 'xususiyatlari',
    'jarayonida', 'jarayoni', 'sohasida', 'tizimida', 'mavzu', 'natijalar', 'xulosa', 'kirish',
    # rus
    'и', 'в', 'на', 'с', 'по', 'для', 'как', 'что', 'это', 'из', 'от', 'при', 'или', 'его', 'их', 'также',
    'статья', 'статье', 'исследование', 'анализ', 'вопросы', 'проблемы', 'современные', 'развитие',
    # ingliz
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'its', 'into', 'study', 'analysis', 'paper',
    'article', 'research', 'based', 'using', 'issues', 'problems', 'development', 'modern',
}


@dataclass
class Candidate:
    code: str
    title: str  # o'zbekcha (lotin) yoki ruscha (perviy-vestnik)
    score: float
    source: str  # book | perviy


@dataclass
class UdkResult:
    code: str
    description: str
    method: str  # ai | lexical | perviy
    candidates: list


def normalize(text: str) -> str:
    text = cyr_to_latin(text or '') if re.search(r'[ўқғҳЎҚҒҲ]', text or '') else (text or '')
    text = text.lower()
    text = re.sub(r"[‘’ʻʼ'`ʻ’]", '', text)  # o‘ → o, g‘ → g
    return text


# O'zbek qo'shimchalari (apostrofsiz normal shaklda), uzunlari birinchi
_UZ_SUFFIXES = sorted({
    'larining', 'laridagi', 'laridan', 'larini', 'larida', 'lariga', 'larning', 'lardan', 'larga', 'larda',
    'lari', 'lar', 'ining', 'ning', 'idagi', 'dagi', 'ligi', 'likni', 'lik', 'ida', 'iga', 'ini', 'idan',
    'dan', 'ni', 'ga', 'ka', 'qa', 'da', 'si', 'chi', 'gan', 'ish', 'moq',
}, key=len, reverse=True)


def _stem(w: str) -> str:
    for _ in range(2):
        for suf in _UZ_SUFFIXES:
            if w.endswith(suf) and len(w) - len(suf) >= 4:
                w = w[: -len(suf)]
                break
        else:
            break
    return w[:6]


_STOP_STEMS = {'ishi', 'tashki', 'etish', 'qilish', 'xususi', 'asosla', 'samara'}


def stems(text: str) -> list[str]:
    out = []
    for w in re.findall(r'[a-zа-яё]{3,}', normalize(text)):
        if w in STOPWORDS:
            continue
        st = _stem(w)
        if st not in _STOP_STEMS:
            out.append(st)
    return out


@lru_cache(maxsize=1)
def _index():
    """(classes, idf, doc_vectors) — UdcClass dan bir marta quriladi."""
    from .models import UdcClass

    rows = list(UdcClass.objects.values_list('code', 'title_latin', 'parent_code'))
    by_code = {c: (t, p) for c, t, p in rows}
    own = {c: Counter(stems(t)) for c, t, _ in rows}
    pairs = {c: set(_bigrams(stems(t))) for c, t, _ in rows}
    df = Counter()
    for vec in own.values():
        df.update(vec.keys())
    n = max(1, len(rows))
    idf = {s: math.log(1 + n / f) for s, f in df.items()}
    docs = {}
    for code, (title, parent) in by_code.items():
        vec = defaultdict(float)
        for s in own[code]:
            vec[s] += 1.0
        p, w = parent, 0.35
        while p and p in by_code and w > 0.05:
            for s in own[p]:
                vec[s] += w
            p, w = by_code[p][1], w * 0.6
        docs[code] = dict(vec)
    return by_code, idf, docs, pairs


def reset_index():
    _index.cache_clear()


def _bigrams(seq: list[str]) -> list[tuple[str, str]]:
    return list(zip(seq, seq[1:]))


def lexical_candidates(query: Counter, limit: int = 30, query_pairs=None) -> list[Candidate]:
    by_code, idf, docs, pairs = _index()
    if not query:
        return []
    q_pairs = set(query_pairs or ())
    scored = []
    for code, vec in docs.items():
        hit, matched = 0.0, 0
        for s, qw in query.items():
            dw = vec.get(s)
            if dw:
                hit += qw * dw * idf.get(s, 1.0)
                matched += dw >= 0.9  # qamrov faqat klassning o'z tavsifidagi mosliklar bo'yicha
        if hit <= 0:
            continue
        norm = (sum(vec.values()) ** 0.75) or 1.0  # uzun tavsiflar tasodifiy mosliklardan ball yig'masin
        depth_bonus = 1 + 0.04 * min(code.count('.') + len(code.split('.')[0]), 8)
        coverage = 1 + 0.6 * (matched - 1)  # bir nechta atama mos kelsa — bitta tasodifiy so'zdan ustun
        for a, b in q_pairs & pairs.get(code, set()):  # ibora to'liq mos ("oliy ta'lim") — kuchli belgi
            hit += 2.0 * (idf.get(a, 1.0) + idf.get(b, 1.0))
        scored.append((hit / norm * depth_bonus * coverage, code))
    scored.sort(reverse=True)
    return [Candidate(code=c, title=by_code[c][0], score=round(s, 4), source='book') for s, c in scored[:limit]]


def _is_russian(text: str) -> bool:
    low = (text or '').lower()
    cyr = sum(1 for ch in low if 'а' <= ch <= 'я' or ch in 'ёўқғҳ')
    if cyr < 20 or any(ch in _UZ_CYR for ch in low):
        return False
    return any(ch in _RU_ONLY for ch in low)


def perviy_candidates(terms: list[str], limit: int = 15) -> list[Candidate]:
    """perviy-vestnik.ru UDK bazasidan ruscha atamalar bo'yicha qidiruv (tarmoq xatosi — bo'sh ro'yxat)."""
    if not getattr(settings, 'UDK_PERVIY_SEARCH_ENABLED', True):
        return []
    hits: dict[str, Candidate] = {}
    for term in terms[:6]:
        try:
            r = requests.get(PERVIY_API, params={'request': term}, timeout=6)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            logger.info('[UDK] perviy-vestnik qidiruvi ishlamadi (%s): %s', term, e)
            continue
        for item in (data or [])[:20]:
            code = str(item.get('code') or '').strip()
            if not code or not code[0].isdigit():
                continue
            c = hits.get(code)
            if c:
                c.score += 1
            else:
                hits[code] = Candidate(code=code, title=str(item.get('title') or '')[:300], score=1.0, source='perviy')
    # Teng ballda — umumiyroq (qisqa) kod: "378 Oliy ta'lim" ni "378.31 Oliy ta'lim fondlari" dan ustun qo'yamiz
    out = sorted(hits.values(), key=lambda c: (-c.score, len(c.code)))
    return out[:limit]


def _russian_terms(title: str, keywords: list[str]) -> list[str]:
    terms = [k.strip() for k in keywords if k and len(k.strip()) > 3]
    words = [w for w in re.findall(r'[а-яё]{5,}', (title or '').lower()) if w not in STOPWORDS]
    terms += [' '.join(words[i:i + 2]) for i in range(0, max(0, len(words) - 1))] + words
    seen, out = set(), []
    for t in terms:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def _ai_json(prompt: str) -> dict | None:
    from apps.services import ai_provider, get_gemini_service

    if not ai_provider():
        return None
    try:
        raw = get_gemini_service()._generate_text(prompt) or ''
    except Exception:
        logger.exception('[UDK] AI chaqiruvi xatosi')
        return None
    m = re.search(r'\{.*\}', raw, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except ValueError:
        return None


def _work_block(title: str, abstract: str, keywords: list[str]) -> str:
    return f"Sarlavha: {title}\nKalit so'zlar: {', '.join(keywords)}\nAnnotatsiya: {(abstract or '')[:2500]}"


def _ai_search_terms(title: str, abstract: str, keywords: list[str]) -> list[str]:
    """AI mavzuni rus tilidagi 3–6 ta UDK qidiruv atamasiga aylantiradi (perviy-vestnik bazasi ruscha)."""
    data = _ai_json(
        "Ilmiy ish uchun UDK kodini rus tilidagi UDK bazasidan qidirish kerak.\n\n"
        f"{_work_block(title, abstract, keywords)}\n\n"
        "Ishning asosiy mavzusini ifodalovchi 3-6 ta qisqa ruscha qidiruv atamasini ber (1-3 so'zdan, UDK "
        "tavsiflaridagi terminlar uslubida, masalan: \"хлопчатник\", \"высшее образование\", \"узбекский язык\"). "
        'Faqat JSON: {"terms": ["...", "..."]}'
    )
    terms = (data or {}).get('terms') or []
    return [str(t).strip() for t in terms if str(t).strip()][:6]


def _ai_pick(title: str, abstract: str, keywords: list[str], candidates: list[Candidate]) -> tuple[str, str] | None:
    if not candidates:
        return None
    lines = '\n'.join(f'{c.code} — {c.title}' for c in candidates)
    data = _ai_json(
        "Sen kutubxonachi-klassifikatorsan. Ilmiy ish uchun UDK (Universal o'nli klassifikatsiya) kodini tanla.\n\n"
        f"{_work_block(title, abstract, keywords)}\n\n"
        f"NOMZODLAR (faqat shulardan birini tanla):\n{lines}\n\n"
        "Ishning asosiy mavzusiga eng aniq mos keladigan (iloji boricha batafsil) kodni tanla va uning tavsifini "
        "o'zbek tilida (lotin yozuvida) qisqa yoz. "
        'Faqat JSON: {"code": "<kod>", "description_uz": "<tavsif>"}'
    )
    if not data:
        return None
    code = str(data.get('code') or '').strip()
    if code not in {c.code for c in candidates}:
        return None
    return code, str(data.get('description_uz') or '').strip()[:300]


def classify(title: str, abstract: str = '', keywords=None, body_text: str = '') -> UdkResult | None:
    """Eng mos UDK kodini qaytaradi; hech narsa topilmasa — None (so'rov qo'lda ko'rib chiqishga qoladi)."""
    if isinstance(keywords, str):
        keywords = [k.strip() for k in re.split(r'[,;]', keywords) if k.strip()]
    keywords = list(keywords or [])
    query, q_pairs = Counter(), set()
    for weight, text in ((3.0, title), (2.0, ' '.join(keywords)), (1.0, abstract), (0.4, (body_text or '')[:6000])):
        st = stems(text)
        for s in st:
            query[s] += weight
        if weight >= 1.0:
            q_pairs.update(_bigrams(st))
    for kw in keywords:
        q_pairs.update(_bigrams(stems(kw)))

    candidates = lexical_candidates(query, query_pairs=q_pairs)
    full_text = ' '.join([title or '', abstract or '', ' '.join(keywords)])
    ru_terms = _ai_search_terms(title, abstract, keywords)
    if not ru_terms and (_is_russian(full_text) or not candidates):
        ru_terms = _russian_terms(title, keywords) if _is_russian(full_text) else keywords
    if ru_terms:
        seen = {c.code for c in candidates}
        candidates += [c for c in perviy_candidates(ru_terms) if c.code not in seen]
    if not candidates:
        return None

    by_code = {c.code: c for c in candidates}
    picked = _ai_pick(title, abstract, keywords, candidates)
    if picked:
        code, description = picked
        method = 'ai'
    else:
        book = [c for c in candidates if c.source == 'book']
        code = (book or candidates)[0].code
        description = ''
        method = 'lexical' if book else 'perviy'
    best = by_code[code]
    if best.source == 'book' or not description:
        description = _book_title(code) or description or best.title
    return UdkResult(code=code, description=description, method=method,
                     candidates=[{'code': c.code, 'title': c.title, 'score': c.score, 'source': c.source}
                                 for c in candidates[:12]])


def _book_title(code: str) -> str:
    entry = _index()[0].get(code)
    return entry[0] if entry else ''


def file_text(file_field) -> str:
    """Yuklangan fayl matni (PDF/DOCX/TXT) — xato bo'lsa bo'sh satr."""
    if not file_field:
        return ''
    try:
        from apps.services import extract_plain_text_from_file

        return extract_plain_text_from_file(file_field.path) or ''
    except Exception:
        logger.info('[UDK] fayl matnini olib bo\'lmadi', exc_info=True)
        return ''


def as_json(result: UdkResult) -> str:
    return json.dumps(result.__dict__, ensure_ascii=False)
