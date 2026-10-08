"""
Antiplagiat sezgirligini o'lchash: bitta manbadan turli usullarda ko'chirilgan matnlar.

    python manage.py antiplag_benchmark

Har variant uchun eski (4.0: tanlangan gaplar, so'zma-so'z ketma-ketlik) va yangi (5.0: butun hujjat,
normalizatsiya, barmoq izlari, qayta tartiblangan gaplar) algoritm bergan o'zlashtirish foizi chiqariladi.
Ma'lumotlar bazasiga hech narsa yozilmaydi.
"""
from __future__ import annotations

import re

from django.core.management.base import BaseCommand

SOURCE = (
    "Raqamli iqtisodiyot sharoitida kichik biznes subyektlarining moliyaviy barqarorligini ta'minlash uchun "
    "innovatsion boshqaruv mexanizmlarini joriy etish zarur hisoblanadi. Tadqiqot natijalari shuni ko'rsatadiki, "
    "elektron hisob tizimlari korxonalarning operatsion xarajatlarini sezilarli darajada kamaytiradi. "
    "Shu bilan birga, raqamli platformalar orqali kichik korxonalar yangi bozorlarga chiqish imkoniyatiga ega bo'ladi. "
    "Mintaqaviy rivojlanish dasturlarida kichik biznesni qo'llab-quvvatlash choralari alohida o'rin egallaydi."
)

VARIANTS: dict[str, str] = {
    "aynan ko'chirish": SOURCE,
    "qo'shimchalar o'zgargan": (
        "Raqamli iqtisodiyot sharoitlarida kichik biznes subyektlari moliyaviy barqarorligini ta'minlashda "
        "innovatsion boshqaruv mexanizmlari joriy etilishi zarur hisoblanadi. Tadqiqot natijasi shuni ko'rsatadiki, "
        "elektron hisob tizimi korxonalar operatsion xarajatlarini sezilarli darajada kamaytiradi. "
        "Shu bilan birga, raqamli platforma orqali kichik korxona yangi bozorga chiqish imkoniyatiga ega bo'ladi. "
        "Mintaqaviy rivojlanish dasturida kichik biznesni qo'llab-quvvatlash chorasi alohida o'rin egallaydi."
    ),
    "kirill yozuvida": (
        "Рақамли иқтисодиёт шароитида кичик бизнес субъектларининг молиявий барқарорлигини таъминлаш учун "
        "инновацион бошқарув механизмларини жорий этиш зарур ҳисобланади. Тадқиқот натижалари шуни кўрсатадики, "
        "электрон ҳисоб тизимлари корхоналарнинг операцион харажатларини сезиларли даражада камайтиради. "
        "Шу билан бирга, рақамли платформалар орқали кичик корхоналар янги бозорларга чиқиш имкониятига эга бўлади. "
        "Минтақавий ривожланиш дастурларида кичик бизнесни қўллаб-қувватлаш чоралари алоҳида ўрин эгаллайди."
    ),
    "apostrof boshqacha (ʻ)": SOURCE.replace("'", "ʻ"),
    "so'z tartibi + sinonim": (
        "Kichik biznes subyektlarining moliyaviy barqarorligini raqamli iqtisodiyot sharoitida ta'minlash maqsadida "
        "boshqaruvning innovatsion mexanizmlarini tatbiq etish lozim. Olingan natijalar elektron hisob tizimlari "
        "korxonalarning operatsion sarf-xarajatlarini ancha qisqartirishini ko'rsatdi. "
        "Bundan tashqari, kichik korxonalar raqamli platformalar yordamida yangi bozorlarga kira oladi. "
        "Kichik biznesni qo'llab-quvvatlash choralari mintaqaviy rivojlanish dasturlarida muhim o'rin tutadi."
    ),
    "qisqa gaplar (5-7 so'z)": (
        "Elektron hisob tizimlari xarajatlarni kamaytiradi. Kichik biznes moliyaviy barqarorlikka muhtoj. "
        "Raqamli platformalar yangi bozorlarni ochadi."
    ),
    # Aldash usullari: so'z ichiga ko'rinmas belgi (U+200B) va lotin harfi o'rniga o'xshash kirill harfi
    "ko'rinmas belgilar (aldash)": SOURCE.replace('a', 'a\u200b'),
    "o'xshash kirill harflar (aldash)": SOURCE.replace('a', '\u0430').replace('o', '\u043e').replace('e', '\u0435'),
}

UNRELATED = (
    "Ushbu tadqiqotda o'rta asrlar Movarounnahr me'morchiligida ishlatilgan sopol bezaklar tahlil qilindi. "
    "Samarqand va Buxoro yodgorliklaridagi naqshlarning geometrik tuzilishi taqqoslandi. "
    "Natijalar koshinkorlik maktablarining o'zaro ta'sirini ko'rsatadi."
)

# Xuddi shu mavzuda, lekin mustaqil yozilgan matn — yolg'on topilma bo'lmasligi kerak
SAME_TOPIC = (
    "Iqtisodiy islohotlar davrida kichik biznes vakillari soliq imtiyozlaridan foydalanib, eksport hajmini "
    "oshirishga harakat qilmoqda. Banklar tomonidan ajratilgan kreditlar hisobiga hududlarda yangi ish o'rinlari "
    "yaratilmoqda. Tadbirkorlik muhitini yaxshilash uchun raqamli xizmatlar va davlat dasturlari qabul qilindi. "
    "Moliyaviy savodxonlikni oshirish kichik korxonalar rahbarlari uchun dolzarb vazifa bo'lib qolmoqda."
)

_FILLER_WORDS = (
    'tuproq unumdorligi sug\'orish tizimi paxta hosildorligi g\'alla navlari meliorativ holat iqlim sharoiti '
    'chorvachilik yem-xashak bog\'dorchilik issiqxona texnologiyasi dehqon xo\'jaligi suv resurslari '
    'agrokimyo tahlili o\'g\'it me\'yori urug\'chilik selektsiya ishlari'
).split()


def _filler(n: int) -> str:
    """Manbaga aloqasi yo'q uzun matn (gaplar har xil — tasodifiy moslik bermasligi uchun)."""
    out = []
    for i in range(n):
        w = [_FILLER_WORDS[(i * 7 + j * 3) % len(_FILLER_WORDS)] for j in range(9)]
        out.append(f"{i + 1}-tajriba maydonida {' '.join(w)} ko'rsatkichlari alohida o'rganildi.")
    return ' '.join(out)


def _legacy_percent(text: str) -> tuple[float, int]:
    """Algoritm 4.0: tanlangan gaplar, asl so'zlar bo'yicha eng uzun ketma-ketlik, chegara 0.32."""
    from apps.articles.antiplagiat_engine import _split_sentences
    from apps.articles.antiplagiat_overlap import _raw_overlap_score, normalize_compact
    from apps.articles.antiplagiat_real_scan import _pick_candidate_sentences

    sentences = _split_sentences(text)
    total = len(normalize_compact(text)) or 1
    covered = found = 0
    for _i, sent in _pick_candidate_sentences(sentences, max_count=220):
        score = _raw_overlap_score(sent, SOURCE)
        if score >= 0.32:
            covered += int(len(normalize_compact(sent)) * min(1.0, score))
            found += 1
    return round(min(100.0, covered / total * 100), 1), found


def _new_percent(text: str) -> tuple[float, int, int]:
    from apps.articles.antiplagiat_deep_scan import compare_source, split_sentences_with_offsets
    from apps.articles.antiplagiat_normalize import tokenize
    from apps.articles.antiplagiat_overlap import compute_verified_coverage

    from apps.articles.antiplagiat_tricks import clean_text

    text = clean_text(text)[0]  # dvigateldagi kabi: aldash belgilari zararsizlantiriladi
    sents = split_sentences_with_offsets(text)
    hits = compare_source(
        text, sents, tokenize(text), SOURCE,
        title='Manba', url='', module_id='milliy_reestr', module_label='Milliy reestr',
    )
    total = len(re.sub(r'\s+', '', text)) or 1
    cov = compute_verified_coverage(hits, total, text=text)
    found = len({h['document_fragment'] for h in hits})
    return cov['verified_plagiarism_pct'], found, len(sents)


class Command(BaseCommand):
    help = 'Antiplagiat sezgirligi: eski (4.0) va yangi (5.0) algoritm taqqoslanishi'

    def handle(self, *args, **opts):
        filler = _filler(400)
        rows = list(VARIANTS.items()) + [
            ('aloqasiz matn', UNRELATED),
            ('shu mavzuda mustaqil matn', SAME_TOPIC),
            ('uzun hujjat oxirida ko\'chirma', filler + ' ' + SOURCE),
        ]
        self.stdout.write(f"{'Variant':34} {'4.0 (eski)':>16} {'5.0 (yangi)':>16}")
        self.stdout.write('-' * 70)
        for name, text in rows:
            old, old_found = _legacy_percent(text)
            new, found, total = _new_percent(text)
            self.stdout.write(
                f'{name:34} {old:>6.1f}% {old_found:>3}/{total:<4} {new:>6.1f}% {found:>3}/{total:<4}'
            )
        self.stdout.write("(foiz — hujjatning o'zlashtirilgan qismi; n/m — topilgan gaplar / jami gaplar)")
