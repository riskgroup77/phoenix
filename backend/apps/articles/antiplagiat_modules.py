"""
Antiplagiat tekshirish modullari — antiplagiat.uz / Antiplagiat.ru uslubida keng katalog.
Frontend: frontend/constants/antiplagiatModules.ts bilan sinxron saqlang.
"""

MODULE_CATALOG: list[dict[str, str]] = [
    # --- Asosiy (mavjud) ---
    {'id': 'elibrary_translations', 'label': 'Публикации eLIBRARY (переводы и перефразирования)'},
    {'id': 'shablon_iboralar', 'label': 'Shablon iboralar'},
    {'id': 'elibrary_ru', 'label': 'eLIBRARY.RU'},
    {'id': 'bmk_dissertatsiyalari', 'label': 'BMK dissertatsiyalari'},
    {'id': 'ips_adilet', 'label': 'ИПС Адилет'},
    {'id': 'tabobat', 'label': 'Tabobat'},
    {'id': 'patentlar', 'label': 'Patentlar'},
    {'id': 'rdk_toplami', 'label': "RDK to'plami"},
    {'id': 'elektron_kutubxona', 'label': 'Elektron-kutubxona tizimlari'},
    {'id': 'garant_aht', 'label': 'Garant AHT'},
    {'id': 'iqtibos_keltirish', 'label': 'Iqtibos keltirish'},
    {'id': 'sps_garant', 'label': 'СПС Гарант: нормативно-правовая документация'},
    {'id': 'ieee', 'label': 'IEEE'},
    {'id': 'nbu_kolleksiya', 'label': 'Коллекция НБУ'},
    {'id': 'unilibrary', 'label': 'unilibrary'},
    {'id': 'garant_analytics', 'label': 'Переводные заимствования по коллекции Гарант: аналитика'},
    {'id': 'garant_paraphrase', 'label': 'Перефразирования по СПС ГАРАНТ: аналитика'},
    {'id': 'otm_halqasi', 'label': 'OTMlar halqasi'},
    {'id': 'smi_russia_cis', 'label': 'СМИ России и СНГ'},
    {'id': 'internet_ru_paraphrase', 'label': 'Перефразированные заимствования по коллекции Интернет в русском сегменте'},
    {'id': 'internet_en_paraphrase', 'label': 'Перефразированные заимствования по коллекции Интернет в английском сегменте'},
    {'id': 'springer', 'label': 'springer'},
    {'id': 'internet_ru_translation', 'label': 'Переводные заимствования по коллекции Интернет в русском сегменте'},
    {'id': 'internet_en_translation', 'label': 'Переводные заимствования по коллекции Интернет в английском сегменте'},
    {'id': 'crosslang_rsl_2022', 'label': 'crosslang_rsl_2022'},
    {'id': 'internet_plus', 'label': 'Search module INTERNET PLUS'},
    {'id': 'crosslang_vuzring', 'label': 'crosslang vuzring'},
    {'id': 'ieee_search', 'label': 'Search module of IEEE'},
    {'id': 'company_collection', 'label': 'Собственная коллекция компании'},
    {'id': 'milliy_reestr', 'label': 'Phoenix Milliy reestr (ilmiyfaoliyat.uz)'},
    {'id': 'ieee_crosslang', 'label': 'IEEE Cross language'},
    # --- Global ochiq ilmiy bazalar ---
    {'id': 'crossref', 'label': 'Crossref (DOI va nashr metadata)'},
    {'id': 'openalex', 'label': 'OpenAlex (316M+ ilmiy ishlar)'},
    {'id': 'core_ac', 'label': 'CORE (ochiq kirish aggregator)'},
    {'id': 'pubmed', 'label': 'PubMed / PubMed Central'},
    {'id': 'arxiv', 'label': 'arXiv preprintlar'},
    {'id': 'doaj', 'label': 'DOAJ (Directory of Open Access Journals)'},
    {'id': 'semantic_scholar', 'label': 'Semantic Scholar'},
    {'id': 'datacite', 'label': 'DataCite repozitoriyalari'},
    {'id': 'hal_archives', 'label': 'HAL (Fransiya ochiq arxiv)'},
    {'id': 'ssrn', 'label': 'SSRN (working papers)'},
    # --- Publisher bazalar ---
    {'id': 'scopus', 'label': 'Scopus (Elsevier)'},
    {'id': 'wos', 'label': 'Web of Science (Clarivate)'},
    {'id': 'elsevier', 'label': 'ScienceDirect (Elsevier)'},
    {'id': 'wiley', 'label': 'Wiley Online Library'},
    {'id': 'taylor_francis', 'label': 'Taylor & Francis'},
    {'id': 'nature', 'label': 'Nature Portfolio'},
    {'id': 'mdpi', 'label': 'MDPI jurnallari'},
    {'id': 'acm_digital', 'label': 'ACM Digital Library'},
    # --- MDH va Rossiya bazalar ---
    {'id': 'nlb_belarus', 'label': 'NLB (Belarus Milliy kutubxonasi)'},
    {'id': 'rsl_full', 'label': 'RSL (Rossiya Davlat kutubxonasi)'},
    {'id': 'dissercat', 'label': 'DisserCat dissertatsiyalar'},
    {'id': 'cyberleninka', 'label': 'CyberLeninka'},
    {'id': 'vak_dissertatsiyalari', 'label': 'VAK Rossiya dissertatsiyalari'},
    # --- O'zbekiston milliy bazalar ---
    {'id': 'slib_uz', 'label': "SLIB.UZ (O'zbekiston ilmiy kutubxona)"},
    {'id': 'ziyonet_uz', 'label': 'ZiyoNET'},
    {'id': 'ziyouz_uz', 'label': 'Ziyouz.uz'},
    {'id': 'lex_uz', 'label': 'Lex.uz (qonunchilik bazasi)'},
    {'id': 'normativ_uz', 'label': 'Normativ.uz'},
    {'id': 'oak_journals_uz', 'label': "OAK ro'yxatidagi mahalliy jurnallar"},
    {'id': 'olis_uz', 'label': "OLIS O'zbekiston"},
    {'id': 'dissertation_uz', 'label': "O'zbekiston dissertatsiyalari (OTM)"},
    {'id': 'internet_uz', 'label': "Internet (o'zbek segmenti)"},
    {'id': 'internet_kk', 'label': 'Internet (qoraqalpoq segmenti)'},
    {'id': 'internet_tr', 'label': 'Internet (turk segmenti)'},
    # --- AI generatsiya aniqlash ---
    {'id': 'chatgpt_ai', 'label': 'ChatGPT / GPT-4 AI matn aniqlash'},
    {'id': 'gemini_ai', 'label': 'Google Gemini AI matn'},
    {'id': 'claude_ai', 'label': 'Claude AI matn'},
    {'id': 'ai_detection', 'label': 'Umumiy AI generatsiya moduli'},
    # --- Ijtimoiy ilmiy tarmoqlar ---
    {'id': 'researchgate', 'label': 'ResearchGate'},
    {'id': 'academia_edu', 'label': 'Academia.edu'},
    # --- Patent (qo'shimcha) ---
    {'id': 'patent_uspto', 'label': 'USPTO (AQSh patentlar)'},
    {'id': 'patent_epo', 'label': 'EPO (Yevropa patentlar)'},
    # --- Cross-language qo'shimcha ---
    {'id': 'crosslang_uz_ru', 'label': "Cross-language: o'zbek ↔ rus"},
    {'id': 'crosslang_uz_en', 'label': "Cross-language: o'zbek ↔ ingliz"},
    # --- Qo'shimcha global bazalar (2025 kengaytma) ---
    {'id': 'google_scholar', 'label': 'Google Scholar'},
    {'id': 'lens_org', 'label': 'Lens.org (patent + ilmiy matn)'},
    {'id': 'base_bielefeld', 'label': 'BASE (Bielefeld Academic Search)'},
    {'id': 'dblp', 'label': 'DBLP (informatika va AI)'},
    {'id': 'eric', 'label': 'ERIC (ta\'lim fanlari)'},
    {'id': 'europe_pmc', 'label': 'Europe PMC (biotibbiyot)'},
    {'id': 'zenodo', 'label': 'Zenodo (CERN ochiq arxiv)'},
    {'id': 'figshare', 'label': 'Figshare'},
    {'id': 'jstor', 'label': 'JSTOR'},
    {'id': 'worldcat', 'label': 'WorldCat (kutubxonalar katalogi)'},
    {'id': 'osti', 'label': 'OSTI.GOV (AQSh energetika ilmi)'},
    {'id': 'cnki', 'label': 'CNKI (Xitoy ilmiy bazasi)'},
    {'id': 'dimensions_ai', 'label': 'Dimensions.ai'},
    {'id': 'orcid_works', 'label': 'ORCID ishlar ro\'yxati'},
    # --- O'zbekiston milliy bazalar (kengaytma) ---
    {'id': 'natlib_uz', 'label': "O'zbekiston Milliy kutubxonasi (dissertatsiyalar)"},
    {'id': 'edu_uz', 'label': 'edu.uz — OTM ilmiy portallari'},
    {'id': 'science_uz', 'label': 'science.gov.uz — ilmiy loyihalar'},
    {'id': 'arb_uz', 'label': 'Arxiv.uz — ochiq arxiv'},
    {'id': 'adliya_uz', 'label': 'Adliya va qonunchilik bazasi'},
    {'id': 'mygov_uz', 'label': 'my.gov.uz ochiq ma\'lumotlar'},
    {'id': 'tiiame_uz', 'label': 'TIIAME ilmiy nashrlar'},
    {'id': 'agrar_uz', 'label': "O'zbekiston agrar ilm-fanlar bazasi"},
    {'id': 'medportal_uz', 'label': "O'zbekiston tibbiyot ilmiy jurnallar"},
    {'id': 'phoenix_archive', 'label': 'Phoenix ichki arxiv (barcha nashrlar)'},
    # --- Markaziy Osiyo va MDH ---
    {'id': 'kazakh_nauka', 'label': 'Kazakhstan Science (kazakhstan science portal)'},
    {'id': 'elibrary_kz', 'label': 'e-lib.kz (Qozog\'iston elektron kutubxona)'},
    {'id': 'kyrgyz_elibrary', 'label': 'Qirg\'iziston elibrary'},
    {'id': 'tajik_dissertation', 'label': 'Tojikiston dissertatsiyalar'},
    {'id': 'turkmen_library', 'label': 'Turkmaniston ilmiy kutubxona'},
    {'id': 'elibrary_am', 'label': 'Armaniston elibrary'},
    {'id': 'e_library_by', 'label': 'Belarus e-library'},
    # --- Preprint va ochiq nashrlar ---
    {'id': 'biorxiv', 'label': 'bioRxiv (biologiya preprint)'},
    {'id': 'medrxiv', 'label': 'medRxiv (tibbiyot preprint)'},
    {'id': 'osf_io', 'label': 'OSF Preprints (Open Science Framework)'},
    {'id': 'copernicus', 'label': 'Copernicus Publications'},
    {'id': 'plos_journals', 'label': 'PLOS ONE / PLOS journals'},
    {'id': 'biomed_central', 'label': 'BioMed Central'},
    {'id': 'openaire', 'label': 'OpenAIRE (Yevropa ochiq ilm)'},
    {'id': 'redalyc', 'label': 'Redalyc (Lotin Amerikasi)'},
    {'id': 'ingentaconnect', 'label': 'IngentaConnect'},
    {'id': 'proquest', 'label': 'ProQuest dissertatsiyalar'},
    {'id': 'sabinet', 'label': 'Sabinet (Afrika ilmiy bazasi)'},
    # --- Cross-language qo'shimcha ---
    {'id': 'internet_ar', 'label': 'Internet (arab segmenti)'},
    {'id': 'internet_fa', 'label': 'Internet (fors segmenti)'},
    {'id': 'crosslang_uz_kk', 'label': "Cross-language: o'zbek ↔ qoraqalpoq"},
    {'id': 'crosslang_uz_ar', 'label': "Cross-language: o'zbek ↔ arab"},
    # --- Antiplagiat ekotizim ---
    {'id': 'antiplagiat_ru_db', 'label': 'Antiplagiat.ru ma\'lumotlar bazasi'},
]

DEFAULT_MODULE_IDS = [m['id'] for m in MODULE_CATALOG]

# Bot va frontend presetlari
MILLIY_MODULE_IDS = [
    'milliy_reestr', 'phoenix_archive', 'company_collection', 'otm_halqasi',
    'slib_uz', 'ziyonet_uz', 'ziyouz_uz', 'oak_journals_uz', 'olis_uz', 'dissertation_uz',
    'natlib_uz', 'edu_uz', 'science_uz', 'arb_uz', 'adliya_uz', 'mygov_uz',
    'lex_uz', 'normativ_uz', 'tiiame_uz', 'agrar_uz', 'medportal_uz',
    'internet_uz', 'internet_kk', 'internet_tr', 'crosslang_uz_ru', 'crosslang_uz_en',
    'crosslang_uz_kk', 'crosslang_uz_ar', 'nbu_kolleksiya', 'elektron_kutubxona',
    'rdk_toplami', 'tabobat', 'unilibrary',
]

CORE_MODULE_IDS = [
    'milliy_reestr', 'phoenix_archive', 'elibrary_ru', 'elibrary_translations', 'openalex', 'crossref',
    'semantic_scholar', 'google_scholar', 'core_ac', 'doaj', 'arxiv', 'pubmed', 'biorxiv', 'medrxiv',
    'scopus', 'wos', 'ieee', 'springer', 'slib_uz', 'ziyonet_uz', 'oak_journals_uz', 'natlib_uz',
    'internet_uz', 'internet_ru_paraphrase', 'internet_en_paraphrase', 'internet_plus',
    'shablon_iboralar', 'chatgpt_ai', 'gemini_ai', 'ai_detection',
    'dissertation_uz', 'cyberleninka', 'patentlar', 'researchgate', 'academia_edu',
    'crosslang_uz_ru', 'crosslang_uz_en', 'bmk_dissertatsiyalari', 'otm_halqasi',
    'company_collection', 'antiplagiat_ru_db', 'science_uz', 'edu_uz',
]

GLOBAL_MODULE_IDS = [
    m['id'] for m in MODULE_CATALOG
    if m['id'] in {
        'crossref', 'openalex', 'core_ac', 'pubmed', 'arxiv', 'doaj', 'semantic_scholar',
        'datacite', 'hal_archives', 'ssrn', 'scopus', 'wos', 'elsevier', 'wiley',
        'taylor_francis', 'nature', 'mdpi', 'acm_digital', 'google_scholar', 'lens_org',
        'base_bielefeld', 'dblp', 'eric', 'europe_pmc', 'zenodo', 'figshare', 'jstor',
        'worldcat', 'osti', 'cnki', 'dimensions_ai', 'orcid_works', 'springer', 'ieee',
        'ieee_search', 'ieee_crosslang', 'milliy_reestr',
    }
]

MODULE_PRESETS: dict[str, list[str]] = {
    'all': DEFAULT_MODULE_IDS,
    'core': CORE_MODULE_IDS,
    'global': GLOBAL_MODULE_IDS,
    'milliy': MILLIY_MODULE_IDS,
}

def module_catalog_count() -> int:
    return len(MODULE_CATALOG)

CORPUS_MODULE_IDS = {
    'milliy_reestr', 'phoenix_archive', 'otm_halqasi', 'company_collection',
    'slib_uz', 'ziyonet_uz', 'ziyouz_uz', 'oak_journals_uz', 'olis_uz', 'dissertation_uz',
    'natlib_uz', 'edu_uz', 'science_uz', 'arb_uz', 'nbu_kolleksiya', 'elektron_kutubxona',
    'rdk_toplami', 'tabobat', 'tiiame_uz', 'agrar_uz', 'medportal_uz',
}

INTERNET_MODULE_IDS = {
    'internet_plus', 'internet_ru_paraphrase', 'internet_en_paraphrase',
    'internet_ru_translation', 'internet_en_translation',
    'smi_russia_cis', 'crosslang_rsl_2022', 'crosslang_vuzring',
    'internet_uz', 'internet_kk', 'internet_tr', 'internet_ar', 'internet_fa',
    'crosslang_uz_ru', 'crosslang_uz_en', 'crosslang_uz_kk', 'crosslang_uz_ar',
}

ELIBRARY_MODULE_IDS = {'elibrary_ru', 'elibrary_translations'}

SCHOLAR_MODULE_IDS = {
    'bmk_dissertatsiyalari', 'springer', 'ieee', 'ieee_search', 'ieee_crosslang',
    'crossref', 'openalex', 'core_ac', 'pubmed', 'arxiv', 'doaj',
    'semantic_scholar', 'datacite', 'hal_archives', 'ssrn',
    'scopus', 'wos', 'elsevier', 'wiley', 'taylor_francis', 'nature', 'mdpi', 'acm_digital',
    'nlb_belarus', 'rsl_full', 'dissercat', 'cyberleninka', 'vak_dissertatsiyalari',
    'researchgate', 'academia_edu',
    'google_scholar', 'lens_org', 'base_bielefeld', 'dblp', 'eric', 'europe_pmc',
    'zenodo', 'figshare', 'jstor', 'worldcat', 'osti', 'cnki', 'dimensions_ai', 'orcid_works',
    'biorxiv', 'medrxiv', 'osf_io', 'copernicus', 'plos_journals', 'biomed_central',
    'openaire', 'redalyc', 'ingentaconnect', 'proquest', 'sabinet', 'antiplagiat_ru_db',
    'kazakh_nauka', 'elibrary_kz', 'kyrgyz_elibrary', 'cyberleninka',
}

UZ_LEGAL_MODULE_IDS = {'lex_uz', 'normativ_uz', 'ips_adilet'}

AI_MODULE_IDS = {'chatgpt_ai', 'gemini_ai', 'claude_ai', 'ai_detection'}

PATENT_MODULE_IDS = {'patentlar', 'patent_uspto', 'patent_epo'}

TITLE_ONLY_MODULES = {
    'unilibrary', 'otm_halqasi', 'crosslang_vuzring', 'shablon_iboralar',
    'patentlar', 'company_collection', 'researchgate', 'academia_edu', 'ssrn',
}

SKIP_SCAN_MODULES = {'iqtibos_keltirish'}

# AI va shablon iboralar (GPT/Claude/Gemini uslubi)
AI_CLICHES = [
    'as an ai language model', 'it is important to note', 'in conclusion',
    'in today\'s world', 'plays a crucial role', 'delve into', 'Furthermore,',
    'Moreover,', 'comprehensive overview', 'it is worth noting',
    'bu mavzuda', 'umuman olganda', 'shuni ta\'kidlash joiz',
    'birinchi navbatda', 'xulosa qilib aytganda', 'zamonaviy sharoitda',
]
