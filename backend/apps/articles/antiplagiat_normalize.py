"""
Antiplagiat uchun matn normalizatsiyasi (o'zbek tiliga moslashtirilgan).

Maqsad: bir xil matnning turli yozilishlari bir xil "token"larga aylansin:
  - kirill → lotin (o'zbek va rus kirilli): «Иқтисодиёт» == «Iqtisodiyot»;
  - apostroflar (' ʻ ʼ ‘ ’ `) olib tashlanadi: «o‘zbek», «o'zbek», «ozbek» bir xil;
  - kichik harf, NFKC;
  - qo'shimchalar kesiladi (o'zbek: -lar, -ning, -dagi, -dan...; rus: -ami, -ogo...; ingliz: -ing, -ed, -s):
    «iqtisodiyotning», «iqtisodiyoti», «iqtisodiyotda» → «iqtisodiyot»;
  - yordamchi so'zlar (va, bilan, uchun, и, в, the, of...) tashlanadi — moslik mazmunli so'zlarda qidiriladi.

Asl matndagi joylashuv (offset) saqlanadi — hisobotda aynan qaysi qism mos kelgani ko'rsatiladi.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache

# ---------------------------------------------------------------- kirill → lotin

_CYR_TO_LAT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i',
    'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
    'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '', 'ы': 'i', 'ь': '',
    'э': 'e', 'ю': 'yu', 'я': 'ya',
    # o'zbek kirilining maxsus harflari
    'ў': 'o', 'қ': 'q', 'ғ': 'g', 'ҳ': 'h',
    # qozoq/qoraqalpoq harflari (ba'zi manbalarda uchraydi)
    'ә': 'a', 'ө': 'o', 'ү': 'u', 'ң': 'n', 'і': 'i',
}

_APOSTROPHES = "'’ʻʼ‘`´"
_APOS_RE = re.compile(f'[{re.escape(_APOSTROPHES)}]')
# So'z: harflar/raqamlar va so'z ichidagi apostrof (o‘zbek, ma'lumot)
WORD_RE = re.compile(rf"[^\W_]+(?:[{re.escape(_APOSTROPHES)}][^\W_]+)*", re.UNICODE)


def translit_to_latin(text: str) -> str:
    out = []
    for ch in text:
        low = ch.lower()
        rep = _CYR_TO_LAT.get(low)
        out.append(rep if rep is not None else ch)
    return ''.join(out)


def normalize_word(word: str) -> str:
    """Bitta so'z: NFKC, kichik harf, kirill → lotin, apostroflarsiz."""
    w = unicodedata.normalize('NFKC', word).lower()
    w = translit_to_latin(w)
    w = _APOS_RE.sub('', w)
    # lotin harflaridagi diakritikani olib tashlash (é → e) — kirill allaqachon lotinga o'tgan
    w = ''.join(c for c in unicodedata.normalize('NFKD', w) if not unicodedata.combining(c))
    return w


def normalize_text(text: str) -> str:
    """Butun matn: faqat normallashtirilgan so'zlar, bitta bo'shliq bilan."""
    return ' '.join(normalize_word(m.group(0)) for m in WORD_RE.finditer(text or ''))


# ---------------------------------------------------------------- yordamchi so'zlar

STOPWORDS = frozenset(
    # o'zbek (apostrofsiz shaklda)
    'va bilan uchun ham esa bu shu u ular biz siz men sen bir har hech ba bo bol boladi bolgan boladi '
    'yoki lekin ammo biroq chunki agar ya ana mana kabi singari orqali boyicha haqida sababli tufayli '
    'qadar keyin oldin song ichida ustida tomonidan ega emas yoq bor kerak zarur mumkin hamda yana '
    'qanday nima kim qaysi necha qachon qayerda shunday bunday ushbu mazkur hamma barcha butun ayrim '
    'faqat endi hali allaqachon juda eng koproq kam kop ozi oz deb dedi etib etadi etilgan qilib qiladi '
    'qilingan qilish etish bolib bolsa esa-da da de ne ki-ku mi chi ku '
    'bundan tashqari birga yordamida vositasida shuningdek jumladan xususan '
    # rus (lotinga o'girilgan)
    'i v vo ne na s so k ko o ob ot do za iz u po pri dlya kak chto eto etot eta eti tot to ta te '
    'ili a no zhe li by bi uzhe tak takzhe tolko esche bolee menee ego ee ikh ikh im on ona oni my vy '
    'ya ty ves vse vsekh ktory kotoryy kotoraya kotorye kotorykh kotorym byl byla bylo byli budet yavlyaetsya '
    # ingliz
    'the a an of and or in on at to for from by with as is are was were be been being this that these those '
    'it its which who whom whose what when where why how not no but if than then so such can could may might '
    'will would shall should has have had do does did also into about over under between within without'.split()
)


# ---------------------------------------------------------------- o'zak (stemming)

# Uzunidan qisqasiga: avval eng uzun qo'shimcha kesiladi. Ro'yxat o'zbek, rus (lotin) va ingliz uchun.
_SUFFIXES = sorted(
    {
        # o'zbek: ko'plik, egalik, kelishik va ularning birikmalari
        'larining', 'larimizning', 'laringizning', 'laridagi', 'laridan', 'lariga', 'larini', 'larida',
        'larimiz', 'laringiz', 'larning', 'lardagi', 'lardan', 'larga', 'larni', 'larda', 'lari',
        'imizning', 'ingizning', 'ining', 'idagi', 'idan', 'iga', 'ini', 'ida', 'imiz', 'ingiz',
        'ning', 'dagi', 'dan', 'ga', 'ka', 'qa', 'ni', 'da', 'lar', 'si', 'ing', 'im',
        'moqda', 'moqchi', 'gan', 'gani', 'ganlar', 'ganda', 'gach', 'ib', 'adi', 'ydi', 'amiz', 'aydi',
        'dir', 'dirlar', 'mi', 'gina', 'roq',
        # fe'l shakllari: o'tgan zamon, harakat nomi (ko'rsatdi ~ ko'rsatadi, qisqartirishini ~ qisqartiradi)
        'adiki', 'diki', 'di', 'ti', 'ishini', 'ishning', 'ishga', 'ishni', 'ishi', 'ish',
        # rus (lotin yozuvida)
        'iyami', 'iyakh', 'ami', 'yami', 'akh', 'yakh', 'ogo', 'ego', 'omu', 'emu', 'ykh', 'ikh', 'imi', 'ymi',
        'aya', 'yaya', 'oye', 'yeye', 'ogo', 'iye', 'iya', 'iyu', 'ov', 'ev', 'om', 'em', 'oy', 'ey', 'yy', 'iy',
        'aya', 'ye', 'yu', 'ya', 'a', 'y', 'e', 'u', 'o', 'i',
        # ingliz
        'ations', 'ation', 'ings', 'ing', 'edly', 'ed', 'es', 's', 'ly',
    },
    key=len,
    reverse=True,
)
MIN_STEM = 4
# O'zak/normalizatsiya qoidalari o'zgarsa oshiriladi — indeksdagi hujjatlar avtomatik qayta indekslanadi
NORMALIZE_VERSION = 2


def stem(word: str) -> str:
    """Taxminiy o'zak: ko'pi bilan ikki qo'shimcha kesiladi, o'zak kamida 4 harf qoladi."""
    w = word
    for _ in range(2):
        for suf in _SUFFIXES:
            if w.endswith(suf) and len(w) - len(suf) >= MIN_STEM:
                w = w[: -len(suf)]
                break
        else:
            break
    # O'zbekcha tovush almashinuvi: barqarorlik + i → barqarorligi (k → g), qishloq + i → qishlog'i (q → g')
    if w.endswith('lig'):
        w = w[:-1] + 'k'
    return w


# Ilmiy matnlarda tez-tez almashtiriladigan sinonimlar (so'z tartibi + sinonim bilan "qayta yozish"ni
# aniqlash uchun). Har guruh bitta o'zakka keltiriladi. Faqat ma'nosi aniq teng bo'lgan juftliklar.
_SYNONYM_GROUPS = (
    ('zarur', 'lozim', 'darkor'),
    ('joriy', 'tatbiq'),
    ('kamaytiradi', 'qisqartiradi', 'kamaytirish', 'qisqartirish'),
    ('sezilarli', 'ancha'),
    ('tadqiqot', 'izlanish'),
    ('usul', 'metod', 'uslub'),
    ('muammo', 'masala'),
    ('rivojlanish', 'taraqqiyot'),
    ('muhim', 'asosiy'),
    ('egallaydi', 'tutadi'),
    ('qollash', 'foydalanish'),
    ('xarajat', 'sarf'),
    ('oshirish', 'kuchaytirish'),
    ('korsatadi', 'korsatdi', 'korsatmoqda'),
    ('imkoniyat', 'imkon'),
    ('samaradorlik', 'unumdorlik'),
)


def _build_synonyms() -> dict[str, str]:
    out: dict[str, str] = {}
    for group in _SYNONYM_GROUPS:
        canon = stem(group[0])
        for w in group:
            out[stem(w)] = canon
    return out


SYNONYMS = _build_synonyms()


# ---------------------------------------------------------------- tokenlar (asl joylashuv bilan)

@dataclass(frozen=True)
class Token:
    stem: str
    start: int  # asl matndagi boshlanish (belgi indeksi)
    end: int


def tokenize(text: str, *, keep_stopwords: bool = False) -> list[Token]:
    """
    Mazmunli so'zlar (o'zak shaklida) va ularning asl matndagi o'rni.
    Bitta harfli so'zlar va yordamchi so'zlar tashlanadi; raqamlar saqlanadi (yil, foiz — muhim belgi).
    """
    out: list[Token] = []
    for m in WORD_RE.finditer(text or ''):
        s = _word_stem(m.group(0), keep_stopwords)
        if s:
            out.append(Token(s, m.start(), m.end()))
    return out


@lru_cache(maxsize=300_000)
def _word_stem(word: str, keep_stopwords: bool) -> str:
    """So'z → o'zak (yoki tashlanadigan bo'lsa ''). Keshlanadi: matnda so'zlar ko'p takrorlanadi."""
    norm = normalize_word(word)
    if len(norm) < 2:
        return ''
    if not keep_stopwords and norm in STOPWORDS:
        return ''
    if norm.isdigit():
        return norm
    s = stem(norm)
    return SYNONYMS.get(s, s)


_UZ_HINTS = frozenset('va bilan uchun ushbu hamda boyicha orqali bolgan qilish etish hisoblanadi kerak mumkin'.split())
_EN_HINTS = frozenset('the and of is are with for this that from which these were been has have'.split())


def guess_lang(text: str) -> str:
    """Taxminiy til: 'uz' (lotin yoki kirill), 'ru', 'en'. Qidiruv tizimi tilini tanlash uchun."""
    text = text or ''
    cyr = sum(1 for c in text if '\u0400' <= c <= '\u04ff')
    lat = sum(1 for c in text if 'a' <= c.lower() <= 'z')
    if cyr > lat:
        return 'uz' if any(c in text.lower() for c in 'ўқғҳ') else 'ru'
    words = [normalize_word(w) for w in WORD_RE.findall(text)]
    uz = sum(1 for w in words if w in _UZ_HINTS)
    en = sum(1 for w in words if w in _EN_HINTS)
    if re.search(r"[oOgG][ʻʼ'‘’`]", text):
        uz += 2
    return 'en' if en > uz else 'uz'


def stems(text: str) -> list[str]:
    return [t.stem for t in tokenize(text)]
