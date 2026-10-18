"""
Jurnal taksonomiyasi: RUKN (nashr turi — JournalCategory) va SOHA (fan yo'nalishi — ScientificField) alohida.
Ro'yxatlar frontend/constants/authorCategories.ts bilan bir xil.
"""
import re

PUBLICATION_TYPES = (
    'Mahalliy OAK jurnallari', 'Xalqaro OAK jurnallari', 'Mahalliy jurnallar', 'Xalqaro jurnallar',
    'Mahalliy konferensiyalar', 'Xalqaro konferensiyalar', 'Scopus jurnallari', 'Scopus konferensiyalar',
)

SUBJECT_AREAS = (
    'Pedagogika va ta’lim', 'Psixologiya', 'Filologiya va tilshunoslik', 'Tarix', 'Falsafa', 'Iqtisodiyot',
    'Menejment va biznes', 'Huquq', 'Siyosatshunoslik', 'Sotsiologiya', 'Axborot texnologiyalari (IT)',
    'Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Tibbiyot', 'Qishloq xo‘jaligi', 'Arxitektura va qurilish',
    'Transport va logistika', 'San’at va madaniyat', 'Jurnalistika va ommaviy kommunikatsiya',
    'Turizm va mehmondo‘stlik', 'Sport va jismoniy tarbiya', 'Ekologiya va atrof-muhit muhofazasi',
    'Texnika fanlari', 'Energetika', 'Harbiy fanlar va xavfsizlik', 'Dinshunoslik', 'Gender tadqiqotlari',
    'Multidissiplinar (fanlararo) yo‘nalishlar',
)


def norm(name: str) -> str:
    """Taqqoslash uchun: kichik harf, apostrof turlari olib tashlangan, ortiqcha bo'shliqsiz."""
    s = re.sub(r"[‘’ʻʼ'`]", '', (name or '').lower())
    return re.sub(r'\s+', ' ', s).strip()


def is_publication_type(name: str) -> bool:
    return norm(name) in {norm(t) for t in PUBLICATION_TYPES}


def match_subject(name: str) -> str | None:
    """Rukn nomi aslida soha bo'lsa (masalan demo "Pedagogika", "Iqtisodiyot") — mos SUBJECT_AREAS nomi."""
    n = norm(name)
    if not n or is_publication_type(name):
        return None
    for area in SUBJECT_AREAS:
        a = norm(area)
        if n == a or a.startswith(n) or n.startswith(a.split(' va ')[0]) or a.split(' (')[0] == n:
            return area
    return None
