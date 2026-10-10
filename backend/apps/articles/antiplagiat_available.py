"""
Hozirgi server sozlamalarida HAQIQATAN tekshiriladigan antiplagiat modullari.

MODULE_CATALOG (antiplagiat_modules.py) eski hisobotlardagi nomlar uchun saqlanadi, lekin u
yerdagi ko'plab bazalar (Scopus, eLIBRARY, ...) tekshirilmaydi. Foydalanuvchiga faqat shu
ro'yxat ko'rsatiladi — sertifikatdagi "tekshirilgan bazalar" bilan bir xil.
"""
from __future__ import annotations

from typing import Any

from django.conf import settings

# Parafraz (semantik o'xshashlik) tugmasi — antiplagiat_paraphrase.PARAPHRASE_MODULE_IDS da ham bor
SEMANTIC_PARAPHRASE_ID = 'semantic_paraphrase'

_BASE_MODULES: list[dict[str, str]] = [
    {
        'id': 'milliy_reestr',
        'label': 'Phoenix ichki bazasi (ilmiyfaoliyat.uz maqolalari)',
        'group': 'Ichki baza',
        'description': "Platformaga jurnal uchun yuborilgan maqolalar bilan solishtiriladi.",
    },
    {
        'id': 'iqtibos_keltirish',
        'label': "Iqtiboslar va o'z-o'ziga iqtibos",
        'group': 'Tahlil',
        'description': "Iqtibos belgisi bor gaplar va muallifning o'z oldingi ishlari alohida hisoblanadi.",
    },
    {
        'id': 'shablon_iboralar',
        'label': 'Shablon iboralar',
        'group': 'Tahlil',
        'description': "Ilmiy matnlardagi umumiy (shablon) iboralar belgilanadi.",
    },
    {
        'id': 'openalex',
        'label': 'OpenAlex (ochiq ilmiy ishlar bazasi)',
        'group': 'Ochiq ilmiy bazalar',
        'description': "Ilmiy ishlar sarlavha va annotatsiyalari bilan solishtiriladi.",
    },
    {
        'id': 'crossref',
        'label': 'Crossref (DOI bazasi)',
        'group': 'Ochiq ilmiy bazalar',
        'description': "DOI'ga ega ilmiy nashrlar sarlavha va annotatsiyalari bilan solishtiriladi.",
    },
    {
        'id': 'semantic_scholar',
        'label': 'Semantic Scholar',
        'group': 'Ochiq ilmiy bazalar',
        'description': "Ilmiy ishlar annotatsiyalari bilan solishtiriladi.",
    },
    {
        'id': 'doaj',
        'label': 'DOAJ (ochiq kirishdagi jurnallar)',
        'group': 'Ochiq ilmiy bazalar',
        'description': "20 mingdan ortiq ochiq jurnal maqolalari; topilgan maqolaning to'liq matni ham solishtiriladi.",
    },
    {
        'id': 'wikipedia',
        'label': "Vikipediya (o'zbek, rus, ingliz)",
        'group': 'Internet',
        'description': "Gap tiliga mos Vikipediya bo'limida qidiriladi, topilgan maqolalar to'liq solishtiriladi.",
    },
    {
        'id': 'arxiv',
        'label': 'arXiv (preprintlar)',
        'group': 'Ochiq ilmiy bazalar',
        'description': "Ingliz tilidagi gaplar arXiv bilan, topilgan ishlar PDF to'liq matni bilan solishtiriladi.",
    },
    {
        'id': 'europe_pmc',
        'label': 'Europe PMC (tibbiyot va biologiya)',
        'group': 'Ochiq ilmiy bazalar',
        'description': "Ingliz tilidagi tibbiyot/biologiya gaplari; ochiq maqolalar to'liq matni bilan.",
    },
    {
        'id': 'ai_detection',
        'label': "SI uslubi tahlili (taxminiy)",
        'group': 'Tahlil',
        'description': "Sun'iy intellektga xos iboralar bo'yicha taxminiy ko'rsatkich (dalil emas).",
    },
]

_WEB_MODULES: list[dict[str, str]] = [
    {'id': 'internet_uz', 'label': "Internet (o'zbek segmenti)", 'group': 'Internet'},
    {'id': 'internet_plus', 'label': 'Internet (umumiy qidiruv)', 'group': 'Internet'},
    {'id': 'lex_uz', 'label': 'Lex.uz (qonunchilik)', 'group': 'Internet'},
    {'id': 'garant_aht', 'label': 'Garant (qonunchilik, RU)', 'group': 'Internet'},
]


def _has_imported_corpus() -> bool:
    try:
        from apps.articles.models import AntiplagCorpusDocument

        return AntiplagCorpusDocument.objects.filter(is_active=True).exclude(source_type='journal').exists()
    except Exception:
        return False


def _has_journal_archive() -> bool:
    try:
        from apps.articles.models import AntiplagCorpusDocument

        return AntiplagCorpusDocument.objects.filter(is_active=True, source_type='journal').exists()
    except Exception:
        return False


def available_modules() -> list[dict[str, Any]]:
    """Joriy sozlamalarda bajariladigan modullar ro'yxati (tartib — UI uchun)."""
    from apps.articles.antiplagiat_opensearch import opensearch_enabled
    from apps.articles.antiplagiat_web_search import web_search_configured

    mods: list[dict[str, Any]] = [dict(m) for m in _BASE_MODULES]

    if _has_journal_archive():
        mods.insert(1, {
            'id': 'oak_journals_uz',
            'label': "O'zbekiston ilmiy jurnallari arxivi (inLibrary, In Academy, O'zMU va b.)",
            'group': 'Ichki baza',
            'description': "OAI-PMH orqali yig'ilgan O'zbekiston jurnallari maqolalari (annotatsiya va to'liq matn).",
        })

    if _has_imported_corpus():
        mods.insert(1, {
            'id': 'natlib_uz',
            'label': "Import qilingan arxivlar (kutubxona, OTM)",
            'group': 'Ichki baza',
            'description': "Administrator import qilgan dissertatsiya va arxiv hujjatlari.",
        })

    if (getattr(settings, 'ANTIPLAG_CORE_API_KEY', '') or '').strip():
        mods.append({
            'id': 'core_ac',
            'label': 'CORE (ochiq kirishdagi maqolalar)',
            'group': 'Ochiq ilmiy bazalar',
            'description': "Ochiq kirishdagi ilmiy maqolalar bilan solishtiriladi.",
        })

    from apps.articles.antiplagiat_vectors import local_vectors_ready

    if local_vectors_ready() and not opensearch_enabled():
        mods.append({
            'id': SEMANTIC_PARAPHRASE_ID,
            'label': "Parafraz va tarjima (ma'no bo'yicha o'xshashlik)",
            'group': 'Tahlil',
            'description': "Qayta yozilgan yoki rus/ingliz tilidan tarjima qilingan parchalar ichki bazada "
                           "ma'no bo'yicha qidiriladi (ko'p tilli E5 modeli).",
        })

    if opensearch_enabled():
        mods.append({
            'id': SEMANTIC_PARAPHRASE_ID,
            'label': "Parafraz (ma'no bo'yicha o'xshashlik)",
            'group': 'Tahlil',
            'description': "Qayta yozilgan (so'zlari o'zgartirilgan) parchalar ichki bazada qidiriladi.",
        })

    if web_search_configured():
        for m in _WEB_MODULES:
            mods.append({**m, 'description': 'Internet qidiruv tizimi natijalari bilan solishtiriladi.'})

    return mods


def available_module_ids() -> list[str]:
    return [m['id'] for m in available_modules()]
