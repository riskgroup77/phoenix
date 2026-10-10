"""
Muallif yordamchisi — tilni tushunish (LLM'siz, bepul, deterministik).

Matn normallashtiriladi: kichik harf, kirill → lotin (o'zbek va rus), apostroflar olib tashlanadi —
shuning uchun «тўлов», «to'lov», «tolov» va «оплата» (→ «oplata») bitta qoidalar to'plami bilan tushuniladi.
Natija: niyatlar (bir xabarda bir nechtasi bo'lishi mumkin: «UDK va DOI olib ber») va har bir xizmat
formasi uchun maydon qiymatlari (slotlar).
"""
from __future__ import annotations

import re
from typing import Any

from apps.articles.antiplagiat_normalize import translit_to_latin

APOS_RE = re.compile(r"[’ʻʼ‘`´']")


def norm(text: str) -> str:
    t = translit_to_latin((text or '').lower())
    t = APOS_RE.sub('', t)
    return re.sub(r'\s+', ' ', t).strip()


# ---------------------------------------------------------------- niyatlar katalogi

# Xizmat niyatlari — o'ng panelda forma ochiladi. «path» — frontend marshruti.
SERVICE_INTENTS: dict[str, dict[str, Any]] = {
    'submit_article': {'path': '/submit', 'label': "Maqolani jurnalga yuborish", 'service_key': None},
    'plagiarism_check': {'path': '/plagiarism-check', 'label': 'Antiplagiat tekshiruvi', 'service_key': 'plagiarism_check'},
    'udk': {'path': '/udk-olish', 'label': "UDK olish", 'service_key': 'udk_request'},
    'doi': {'path': '/doi-olish', 'label': "DOI olish", 'service_key': 'doi_request'},
    'translation': {'path': '/translation-service', 'label': 'Ilmiy tarjima', 'service_key': 'translation_per_word'},
    'book': {'path': '/submit-book', 'label': 'Kitob nashr etish', 'service_key': None},
    'article_sample': {'path': '/maqola-namuna-olish', 'label': 'Maqola namunasi (yozib berish)', 'service_key': None},
}

# Ma'lumot niyatlari — chatda karta bilan javob (kerak bo'lsa sahifa ham ochiladi)
INFO_INTENTS = ('status', 'payments', 'prices', 'journals', 'archive', 'profile', 'operator', 'help', 'greeting', 'thanks', 'cancel')

PATTERNS: dict[str, list[str]] = {
    'plagiarism_check': [r'antiplag', r'\bplag', r'originall', r'oxshashlik', r'unikall', r'unikaln', r'plagiarism'],
    'udk': [r'\budk\b', r'\budc\b', r'\budk[a-z]*', r'universal onlik'],
    'doi': [r'\bdoi\b', r'\bdoi[a-z]*'],
    'translation': [r'tarjim', r'perevod', r'perevest', r'translat'],
    'book': [r'\bkitob', r'darslik', r'monografi', r'oquv qollanma', r'\bkniga', r'\bknig', r'uchebnik', r'\bbook\b',
             r'\bnusxa', r'tirazh', r'\bisbn'],
    'article_sample': [r'namuna', r'yozib ber', r'yozdir', r'maqola yoz', r'obrazets', r'napisat stat', r'napishite',
                       r'write (me )?(an |a )?(article|paper)', r'sample'],
    'submit_article': [r'jurnal\w{0,3}ga\b', r'\bjurnal(da|ga)? (nashr|chop|chiqar)', r'maqola\w* (yubor|jonat|joyla|topshir)',
                       r'(yubor|jonat)\w* .{0,25}maqola', r'nashr (qil|et)', r'chop (et|qil)', r'otprav', r'opublik',
                       r'podat stat', r'\bsubmit', r'\bpublish'],
    'status': [r'qayerda', r'\bholat', r'bosqich', r'qachon', r'nima boldi', r'korib chiq', r'taqriz\w* (natija|qachon)',
               r'\bstatus', r'\bgde\b', r'kogda', r'\bstage', r'where is', r'my article'],
    'payments': [r'tolov', r'\bchek', r'kvitans', r'oplat', r'\bplatezh', r'payment', r'receipt', r'pul\w* (qaytar|yechil)'],
    'prices': [r'\bnarx', r'qancha', r'necha pul', r'necha som', r'tsena', r'stoimost', r'skolko', r'\bprice', r'\bcost',
               r'how much'],
    'journals': [r'qaysi jurnal', r'jurnallar', r'jurnal tavsiya', r'mos jurnal', r'kakoy jurnal', r'zhurnal',
                 r'\bjurnal\b', r'which journal', r'journals?\b'],
    'archive': [r'sertifikat', r'\barxiv', r'malumotnoma', r'spravk', r'certificate', r'archive'],
    'profile': [r'\bparol', r'\bprofil', r'telefon\w* tasdiq', r'\bparol', r'password', r'profile'],
    'operator': [r'\boperator', r'murojaat', r'shikoyat', r'odam bilan', r'jonli', r'support', r'podderzhk', r'zhalob'],
    'greeting': [r'^(salom|assalomu|assalom|hayrli|privet|zdravstv|hello|hi|hey)\b'],
    'thanks': [r'\b(rahmat|raxmat|tashakkur|spasibo|thanks|thank you)\b'],
    'help': [r'yordam', r'nima qila ol', r'nimalar qil', r'imkoniyat', r'pomosh', r'chto ty umee', r'\bhelp\b',
             r'what can you'],
    'cancel': [r'^(bekor|kerak emas|toxta|stop|otmena|cancel)\b'],
}

_COMPILED = {k: [re.compile(p) for p in v] for k, v in PATTERNS.items()}

# Bir xabarda bir nechta xizmat bo'lsa — matndagi tartibi saqlanadi
SERVICE_ORDER = list(SERVICE_INTENTS)


def detect_intents(text: str) -> list[str]:
    """Matndagi niyatlar, paydo bo'lish tartibida. Xizmatlar ma'lumot niyatlaridan ustun."""
    t = norm(text)
    found: list[tuple[int, str]] = []
    for intent, pats in _COMPILED.items():
        positions = [m.start() for p in pats for m in [p.search(t)] if m]
        if positions:
            found.append((min(positions), intent))
    found.sort()
    intents = [i for _p, i in found]

    services = [i for i in intents if i in SERVICE_INTENTS]
    # «kitob» bor bo'lsa — oddiy «nashr qilish» maqola emas, kitob
    if 'book' in services and 'submit_article' in services:
        services.remove('submit_article')
    # «maqola yozib bering» — namuna; «maqola yubor» bilan aralashmasin
    if 'article_sample' in services and 'submit_article' in services and not re.search(r'jurnalga|yubor|jonat', t):
        services.remove('submit_article')
    # «sertifikat» antiplagiat bilan birga bo'lsa — antiplagiat xizmati
    if services:
        info = [i for i in intents if i in ('prices',)]  # «UDK narxi qancha» → narx savoli
        if info and not re.search(r'olib ber|olmoqchi|kerak|qil|yubor|buyurtma|zakaz|xochu|want', t):
            return ['prices'] + services
        return services
    if 'journals' in intents and 'status' in intents:
        intents.remove('journals')
    return intents


# ---------------------------------------------------------------- slotlar

UZ_REGIONS = {
    'toshkent': 'Toshkent', 'tashkent': 'Toshkent', 'samarqand': 'Samarqand', 'samarkand': 'Samarqand',
    'buxoro': 'Buxoro', 'buhara': 'Buxoro', 'bukhara': 'Buxoro', 'andijon': 'Andijon', 'andijan': 'Andijon',
    'fargona': "Farg'ona", 'fergana': "Farg'ona", 'namangan': 'Namangan', 'navoiy': 'Navoiy', 'navoi': 'Navoiy',
    'qashqadaryo': 'Qashqadaryo', 'qarshi': 'Qashqadaryo', 'surxondaryo': 'Surxondaryo', 'termiz': 'Surxondaryo',
    'xorazm': 'Xorazm', 'urganch': 'Xorazm', 'jizzax': 'Jizzax', 'sirdaryo': 'Sirdaryo', 'guliston': 'Sirdaryo',
    'qoraqalpog': "Qoraqalpog'iston", 'nukus': "Qoraqalpog'iston",
}

LANG_WORDS = {
    'uz': [r'ozbek', r'uzbek'],
    'ru': [r'\brus', r'russk', r'russian'],
    'en': [r'ingliz', r'angli', r'english'],
    'fr': [r'frantsuz', r'fransuz', r'frants', r'french'],
    'de': [r'nemis', r'nemets', r'german'],
    'ar': [r'arab'],
    'es': [r'ispan', r'spanish'],
}

DOC_TYPE_WORDS = [
    (r'magistr', 'Magistrlik dissertatsiyasi'),
    (r'doktorlik', 'Doktorlik dissertatsiyasi referati'),
    (r'dissertats', 'Doktorlik dissertatsiyasi referati'),
    (r'kurs ish', 'Kurs ishi'),
    (r'diplom', 'Diplom loyihasi'),
    (r'bitiruv', 'Bitiruvchi Ish'),
    (r'referat', 'Referat'),
    (r'darslik', 'Darslik'),
    (r'oquv qollanma', "O'quv qo'llanma"),
    (r'qollanma', "Qo'llanma"),
    (r'kitob|monografi', 'Kitob'),
    (r'maqola|tezis|stat', 'Maqola'),
]

STRUCTURES = {
    'medicine': 'Kirish, Material va usullar, Natijalar, Muhokama, Xulosa, Adabiyotlar',
    'technical': 'Kirish, Muammo, Usul, Natijalar, Xulosa, Adabiyotlar',
    'full': 'Kirish, Adabiyot sharhi, Tadqiqot usuli, Natijalar, Muhokama, Xulosa, Adabiyotlar',
    'standard': 'Kirish, Asosiy qism, Xulosa, Adabiyotlar',
}

QUOTE_RE = re.compile(r'[«"“„]([^»"”“]{4,300})[»"”]')


def _num_before(t: str, words: str) -> int | None:
    m = re.search(rf'(\d{{1,5}})\s*(?:ta\s*)?(?:{words})', t)
    return int(m.group(1)) if m else None


def _lang_after(t: str, pattern: str) -> str | None:
    """«ingliz tiliga», «на английский» → 'en'"""
    for code, pats in LANG_WORDS.items():
        for p in pats:
            if re.search(p + pattern, t):
                return code
    return None


def extract_slots(intent: str, text: str) -> dict[str, Any]:
    """Xabar matnidan shu xizmat formasining maydonlari (faqat aniq topilganlari)."""
    t = norm(text)
    raw = text or ''
    out: dict[str, Any] = {}
    quoted = QUOTE_RE.search(raw)
    if quoted:
        q = quoted.group(1).strip()
        if intent in ('article_sample',):
            out['topic'] = q
        else:
            out['title'] = q

    if intent == 'translation':
        target = _lang_after(t, r'\w*\s*(tiliga|tilga|ga\b)') or _lang_after(t, r'\w*\s*$') \
            or (_lang_after(t, '') if re.search(r'\bna (angl|russ|uzbek|frants|nemet)|\bto (english|russian|uzbek)|into', t) else None)
        m = re.search(r'\b(na|to|into)\s+(\w+)', t)
        if m and not target:
            target = _lang_after(m.group(2), '')
        source = _lang_after(t, r'\w*\s*(tilidan|dan\b)')
        if target:
            out['targetLang'] = target
        if source and source != target:
            out['sourceLang'] = source

    elif intent == 'book':
        pages = _num_before(t, r'bet|sahifa|varaq|stranits|str\b|pages?')
        copies = _num_before(t, r'nusxa|dona|ekzemplyar|tirazh|copies')
        if pages:
            out['pages'] = pages
        if copies:
            out['copies'] = copies
        if re.search(r'qattiq|tverd|hard', t):
            out['coverType'] = 'hard'
        elif re.search(r'yumshoq|myagk|soft', t):
            out['coverType'] = 'soft'
        if re.search(r'\beko\b|\beco\b|arzon|oddiy qogoz|ekonom', t):
            out['paperQuality'] = 'eco'
        elif re.search(r'standart|ofset|sifatli|yaxshi qogoz', t):
            out['paperQuality'] = 'standart'
        if re.search(r'isbn', t) and not re.search(r'isbn\w* (kerak emas|shart emas|siz)|bez isbn|without isbn', t):
            out['isbn'] = True
        # Muqova dizayni: SubmitBook sahifasi muqova rasmi bo'lmasa uni o'zi yoqadi — faqat rad etilsa o'chiramiz
        if re.search(r'dizayn\w* (kerak emas|shart emas|kerakmas)|muqova\w* (rasmi|dizayni) bor|ozim(ning)? muqova|bez dizain|without design', t):
            out['design'] = False
        elif re.search(r'dizayn|dizain|design', t):
            out['design'] = True
        if re.search(r'raqamli|elektron|\bpdf\b|digital|elektronn', t):
            out['publicationType'] = 'raqamli'
        elif re.search(r'bosma|chop|yetkaz|dostav|pechat|print', t):
            out['publicationType'] = 'bosma'
        for key, region in UZ_REGIONS.items():
            if key in t:
                out['shippingRegion'] = region
                break

    elif intent == 'article_sample':
        pages = _num_before(t, r'bet|sahifa|stranits|pages?')
        if pages:
            out['pages'] = pages
        lang = _lang_after(t, r'\w*\s*(tilida|da\b)') or _lang_after(t, r'\w*\s*(maqola|stat)')
        if lang in ('uz', 'ru', 'en'):
            out['language'] = {'uz': "O'zbek", 'ru': 'Rus', 'en': 'Ingliz'}[lang]
        if re.search(r'tezis|tezisy|abstract', t):
            out['articleType'] = 'Tezis'
        elif re.search(r'maqola|stat|article|paper', t):
            out['articleType'] = 'Maqola'
        if re.search(r'tibbiy|meditsin|medical|klinik', t):
            out['structure'] = STRUCTURES['medicine']
        elif re.search(r'texnik|muhandis|tekhnich|engineering', t):
            out['structure'] = STRUCTURES['technical']
        if re.search(r'yuqori sifat|eng yaxshi|premium|vysok', t):
            out['qualityLevel'] = 'yuqori'
        elif re.search(r'arzon|quyi|oddiy|deshev|cheap', t):
            out['qualityLevel'] = 'quyi'
        elif re.search(r'orta|srednee|standart', t):
            out['qualityLevel'] = 'orta'
        m = re.search(r'mavzu\w*[:\s]+(.{6,200}?)(?:\.|,|$)', raw, re.IGNORECASE)
        if m and 'topic' not in out:
            out['topic'] = m.group(1).strip(' "«»')

    elif intent == 'plagiarism_check':
        for pat, value in DOC_TYPE_WORDS:
            if re.search(pat, t):
                out['documentType'] = value
                break

    return out


def mentioned_title_fragment(text: str) -> str | None:
    """«Islomiy moliya maqolam qayerda» → qidirish uchun bo'lak (status savollari uchun)."""
    q = QUOTE_RE.search(text or '')
    if q:
        return q.group(1).strip()
    t = norm(text)
    t = re.sub(r'\b(maqola\w*|qayerda|holati?|qanday|bosqich\w*|qaysi|nima boldi|statusi?|gde|moya|moy|statya|my|article|is|where|the)\b', ' ', t)
    words = [w for w in t.split() if len(w) >= 4]
    return ' '.join(words[:4]) if words else None
