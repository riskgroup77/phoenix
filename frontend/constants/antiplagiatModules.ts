/** antiplagiat.uz uslubidagi tekshirish modullari — backend antiplagiat_modules.py bilan sinxron */
export type AntiplagiatModule = {
  id: string;
  label: string;
  category?: string;
};

export const ANTIPLAGIAT_MODULES: AntiplagiatModule[] = [
  { id: 'elibrary_translations', label: 'Публикации eLIBRARY (переводы и перефразирования)', category: 'eLIBRARY' },
  { id: 'shablon_iboralar', label: 'Shablon iboralar', category: 'Shablon' },
  { id: 'elibrary_ru', label: 'eLIBRARY.RU', category: 'eLIBRARY' },
  { id: 'bmk_dissertatsiyalari', label: 'BMK dissertatsiyalari', category: 'Dissertatsiya' },
  { id: 'ips_adilet', label: 'ИПС Адилет', category: 'Qonunchilik' },
  { id: 'tabobat', label: 'Tabobat', category: 'Kutubxona' },
  { id: 'patentlar', label: 'Patentlar', category: 'Patent' },
  { id: 'rdk_toplami', label: "RDK to'plami", category: 'Kutubxona' },
  { id: 'elektron_kutubxona', label: 'Elektron-kutubxona tizimlari', category: 'Kutubxona' },
  { id: 'garant_aht', label: 'Garant AHT', category: 'Garant' },
  { id: 'iqtibos_keltirish', label: 'Iqtibos keltirish', category: 'Iqtibos' },
  { id: 'sps_garant', label: 'СПС Гарант: нормативно-правовая документация', category: 'Garant' },
  { id: 'ieee', label: 'IEEE', category: 'Publisher' },
  { id: 'nbu_kolleksiya', label: 'Коллекция НБУ', category: 'Kutubxona' },
  { id: 'unilibrary', label: 'unilibrary', category: 'Kutubxona' },
  { id: 'garant_analytics', label: 'Переводные заимствования по коллекции Гарант: аналитика', category: 'Garant' },
  { id: 'garant_paraphrase', label: 'Перефразирования по СПС ГАРАНТ: аналитика', category: 'Garant' },
  { id: 'otm_halqasi', label: 'OTMlar halqasi', category: 'OTM' },
  { id: 'smi_russia_cis', label: 'СМИ России и СНГ', category: 'Internet' },
  { id: 'internet_ru_paraphrase', label: 'Перефразированные заимствования по коллекции Интернет в русском сегменте', category: 'Internet' },
  { id: 'internet_en_paraphrase', label: 'Перефразированные заимствования по коллекции Интернет в английском сегменте', category: 'Internet' },
  { id: 'springer', label: 'springer', category: 'Publisher' },
  { id: 'internet_ru_translation', label: 'Переводные заимствования по коллекции Интернет в русском сегменте', category: 'Internet' },
  { id: 'internet_en_translation', label: 'Переводные заимствования по коллекции Интернет в английском сегменте', category: 'Internet' },
  { id: 'crosslang_rsl_2022', label: 'crosslang_rsl_2022', category: 'Cross-language' },
  { id: 'internet_plus', label: 'Search module INTERNET PLUS', category: 'Internet' },
  { id: 'crosslang_vuzring', label: 'crosslang vuzring', category: 'Cross-language' },
  { id: 'ieee_search', label: 'Search module of IEEE', category: 'Publisher' },
  { id: 'company_collection', label: 'Собственная коллекция компании', category: 'OTM' },
  { id: 'milliy_reestr', label: 'Phoenix Milliy reestr (ilmiyfaoliyat.uz)', category: 'Milliy' },
  { id: 'ieee_crosslang', label: 'IEEE Cross language', category: 'Publisher' },
  // Global ochiq ilmiy bazalar
  { id: 'crossref', label: 'Crossref (DOI va nashr metadata)', category: 'Global' },
  { id: 'openalex', label: 'OpenAlex (316M+ ilmiy ishlar)', category: 'Global' },
  { id: 'core_ac', label: 'CORE (ochiq kirish aggregator)', category: 'Global' },
  { id: 'pubmed', label: 'PubMed / PubMed Central', category: 'Global' },
  { id: 'arxiv', label: 'arXiv preprintlar', category: 'Global' },
  { id: 'doaj', label: 'DOAJ (Directory of Open Access Journals)', category: 'Global' },
  { id: 'semantic_scholar', label: 'Semantic Scholar', category: 'Global' },
  { id: 'datacite', label: 'DataCite repozitoriyalari', category: 'Global' },
  { id: 'hal_archives', label: 'HAL (Fransiya ochiq arxiv)', category: 'Global' },
  { id: 'ssrn', label: 'SSRN (working papers)', category: 'Global' },
  // Publisher bazalar
  { id: 'scopus', label: 'Scopus (Elsevier)', category: 'Publisher' },
  { id: 'wos', label: 'Web of Science (Clarivate)', category: 'Publisher' },
  { id: 'elsevier', label: 'ScienceDirect (Elsevier)', category: 'Publisher' },
  { id: 'wiley', label: 'Wiley Online Library', category: 'Publisher' },
  { id: 'taylor_francis', label: 'Taylor & Francis', category: 'Publisher' },
  { id: 'nature', label: 'Nature Portfolio', category: 'Publisher' },
  { id: 'mdpi', label: 'MDPI jurnallari', category: 'Publisher' },
  { id: 'acm_digital', label: 'ACM Digital Library', category: 'Publisher' },
  // MDH va Rossiya
  { id: 'nlb_belarus', label: 'NLB (Belarus Milliy kutubxonasi)', category: 'MDH' },
  { id: 'rsl_full', label: 'RSL (Rossiya Davlat kutubxonasi)', category: 'MDH' },
  { id: 'dissercat', label: 'DisserCat dissertatsiyalar', category: 'Dissertatsiya' },
  { id: 'cyberleninka', label: 'CyberLeninka', category: 'MDH' },
  { id: 'vak_dissertatsiyalari', label: 'VAK Rossiya dissertatsiyalari', category: 'Dissertatsiya' },
  // O'zbekiston
  { id: 'slib_uz', label: "SLIB.UZ (O'zbekiston ilmiy kutubxona)", category: "O'zbekiston" },
  { id: 'ziyonet_uz', label: 'ZiyoNET', category: "O'zbekiston" },
  { id: 'ziyouz_uz', label: 'Ziyouz.uz', category: "O'zbekiston" },
  { id: 'lex_uz', label: 'Lex.uz (qonunchilik bazasi)', category: "O'zbekiston" },
  { id: 'normativ_uz', label: 'Normativ.uz', category: "O'zbekiston" },
  { id: 'oak_journals_uz', label: "OAK ro'yxatidagi mahalliy jurnallar", category: "O'zbekiston" },
  { id: 'olis_uz', label: "OLIS O'zbekiston", category: "O'zbekiston" },
  { id: 'dissertation_uz', label: "O'zbekiston dissertatsiyalari (OTM)", category: "O'zbekiston" },
  { id: 'internet_uz', label: "Internet (o'zbek segmenti)", category: 'Internet' },
  { id: 'internet_kk', label: 'Internet (qoraqalpoq segmenti)', category: 'Internet' },
  { id: 'internet_tr', label: 'Internet (turk segmenti)', category: 'Internet' },
  // AI aniqlash
  { id: 'chatgpt_ai', label: 'ChatGPT / GPT-4 AI matn aniqlash', category: 'AI' },
  { id: 'gemini_ai', label: 'Google Gemini AI matn', category: 'AI' },
  { id: 'claude_ai', label: 'Claude AI matn', category: 'AI' },
  { id: 'ai_detection', label: 'Umumiy AI generatsiya moduli', category: 'AI' },
  // Ijtimoiy ilmiy
  { id: 'researchgate', label: 'ResearchGate', category: 'Ijtimoiy' },
  { id: 'academia_edu', label: 'Academia.edu', category: 'Ijtimoiy' },
  // Patent
  { id: 'patent_uspto', label: 'USPTO (AQSh patentlar)', category: 'Patent' },
  { id: 'patent_epo', label: 'EPO (Yevropa patentlar)', category: 'Patent' },
  // Cross-language
  { id: 'crosslang_uz_ru', label: "Cross-language: o'zbek ↔ rus", category: 'Cross-language' },
  { id: 'crosslang_uz_en', label: "Cross-language: o'zbek ↔ ingliz", category: 'Cross-language' },
  // Qo'shimcha global bazalar
  { id: 'google_scholar', label: 'Google Scholar', category: 'Global' },
  { id: 'lens_org', label: 'Lens.org (patent + ilmiy matn)', category: 'Global' },
  { id: 'base_bielefeld', label: 'BASE (Bielefeld Academic Search)', category: 'Global' },
  { id: 'dblp', label: 'DBLP (informatika va AI)', category: 'Global' },
  { id: 'eric', label: "ERIC (ta'lim fanlari)", category: 'Global' },
  { id: 'europe_pmc', label: 'Europe PMC (biotibbiyot)', category: 'Global' },
  { id: 'zenodo', label: 'Zenodo (CERN ochiq arxiv)', category: 'Global' },
  { id: 'figshare', label: 'Figshare', category: 'Global' },
  { id: 'jstor', label: 'JSTOR', category: 'Global' },
  { id: 'worldcat', label: 'WorldCat (kutubxonalar katalogi)', category: 'Global' },
  { id: 'osti', label: 'OSTI.GOV (AQSh energetika ilmi)', category: 'Global' },
  { id: 'cnki', label: 'CNKI (Xitoy ilmiy bazasi)', category: 'Global' },
  { id: 'dimensions_ai', label: 'Dimensions.ai', category: 'Global' },
  { id: 'orcid_works', label: "ORCID ishlar ro'yxati", category: 'Global' },
  // O'zbekiston milliy bazalar (kengaytma)
  { id: 'natlib_uz', label: "O'zbekiston Milliy kutubxonasi (dissertatsiyalar)", category: "O'zbekiston" },
  { id: 'edu_uz', label: 'edu.uz — OTM ilmiy portallari', category: "O'zbekiston" },
  { id: 'science_uz', label: 'science.gov.uz — ilmiy loyihalar', category: "O'zbekiston" },
  { id: 'arb_uz', label: 'Arxiv.uz — ochiq arxiv', category: "O'zbekiston" },
  { id: 'adliya_uz', label: 'Adliya va qonunchilik bazasi', category: "O'zbekiston" },
  { id: 'mygov_uz', label: 'my.gov.uz ochiq ma\'lumotlar', category: "O'zbekiston" },
  { id: 'tiiame_uz', label: 'TIIAME ilmiy nashrlar', category: "O'zbekiston" },
  { id: 'agrar_uz', label: "O'zbekiston agrar ilm-fanlar bazasi", category: "O'zbekiston" },
  { id: 'medportal_uz', label: "O'zbekiston tibbiyot ilmiy jurnallar", category: "O'zbekiston" },
  { id: 'phoenix_archive', label: 'Phoenix ichki arxiv (barcha nashrlar)', category: 'Milliy' },
  // Markaziy Osiyo
  { id: 'kazakh_nauka', label: 'Kazakhstan Science', category: 'Markaziy Osiyo' },
  { id: 'elibrary_kz', label: 'e-lib.kz (Qozog\'iston)', category: 'Markaziy Osiyo' },
  { id: 'kyrgyz_elibrary', label: 'Qirg\'iziston elibrary', category: 'Markaziy Osiyo' },
  { id: 'tajik_dissertation', label: 'Tojikiston dissertatsiyalar', category: 'Markaziy Osiyo' },
  { id: 'turkmen_library', label: 'Turkmaniston ilmiy kutubxona', category: 'Markaziy Osiyo' },
  { id: 'elibrary_am', label: 'Armaniston elibrary', category: 'Markaziy Osiyo' },
  { id: 'e_library_by', label: 'Belarus e-library', category: 'MDH' },
  // Preprint
  { id: 'biorxiv', label: 'bioRxiv', category: 'Preprint' },
  { id: 'medrxiv', label: 'medRxiv', category: 'Preprint' },
  { id: 'osf_io', label: 'OSF Preprints', category: 'Preprint' },
  { id: 'copernicus', label: 'Copernicus Publications', category: 'Publisher' },
  { id: 'plos_journals', label: 'PLOS journals', category: 'Publisher' },
  { id: 'biomed_central', label: 'BioMed Central', category: 'Publisher' },
  { id: 'openaire', label: 'OpenAIRE', category: 'Global' },
  { id: 'redalyc', label: 'Redalyc', category: 'Global' },
  { id: 'ingentaconnect', label: 'IngentaConnect', category: 'Publisher' },
  { id: 'proquest', label: 'ProQuest dissertatsiyalar', category: 'Global' },
  { id: 'sabinet', label: 'Sabinet (Afrika)', category: 'Global' },
  // Cross-language
  { id: 'internet_ar', label: 'Internet (arab segmenti)', category: 'Internet' },
  { id: 'internet_fa', label: 'Internet (fors segmenti)', category: 'Internet' },
  { id: 'crosslang_uz_kk', label: "Cross-language: o'zbek ↔ qoraqalpoq", category: 'Cross-language' },
  { id: 'crosslang_uz_ar', label: "Cross-language: o'zbek ↔ arab", category: 'Cross-language' },
  { id: 'antiplagiat_ru_db', label: 'Antiplagiat.ru ma\'lumotlar bazasi', category: 'Milliy' },
];

export const DEFAULT_ENABLED_MODULE_IDS = ANTIPLAGIAT_MODULES.map((m) => m.id);

/** SI (sun'iy intellekt) detektor modullari */
export const AI_MODULE_IDS = [
  'chatgpt_ai',
  'gemini_ai',
  'claude_ai',
  'ai_detection',
] as const;

/** Antiplag.uz uslubidagi tezkor profillar — backend MODULE_PRESETS bilan sinxron */
export const CORE_MODULE_IDS = [
  'milliy_reestr', 'elibrary_ru', 'elibrary_translations', 'openalex', 'crossref',
  'semantic_scholar', 'google_scholar', 'core_ac', 'doaj', 'arxiv', 'pubmed',
  'scopus', 'wos', 'ieee', 'springer', 'slib_uz', 'ziyonet_uz', 'oak_journals_uz',
  'internet_uz', 'internet_ru_paraphrase', 'internet_en_paraphrase', 'internet_plus',
  'shablon_iboralar', 'chatgpt_ai', 'gemini_ai', 'ai_detection',
  'dissertation_uz', 'cyberleninka', 'patentlar', 'researchgate', 'academia_edu',
  'crosslang_uz_ru', 'crosslang_uz_en', 'bmk_dissertatsiyalari', 'otm_halqasi',
  'company_collection',
];

export const GLOBAL_MODULE_IDS = ANTIPLAGIAT_MODULES.filter((m) =>
  [
    'crossref', 'openalex', 'core_ac', 'pubmed', 'arxiv', 'doaj', 'semantic_scholar',
    'datacite', 'hal_archives', 'ssrn', 'scopus', 'wos', 'elsevier', 'wiley',
    'taylor_francis', 'nature', 'mdpi', 'acm_digital', 'google_scholar', 'lens_org',
    'base_bielefeld', 'dblp', 'eric', 'europe_pmc', 'zenodo', 'figshare', 'jstor',
    'worldcat', 'osti', 'cnki', 'dimensions_ai', 'orcid_works', 'springer', 'ieee',
    'ieee_search', 'ieee_crosslang', 'milliy_reestr',
  ].includes(m.id),
).map((m) => m.id);

export type AntiplagiatCheckMode = 'plagiarism' | 'ai' | 'both';

export const MILLIY_MODULE_IDS = [
  'milliy_reestr', 'phoenix_archive', 'company_collection', 'otm_halqasi',
  'slib_uz', 'ziyonet_uz', 'ziyouz_uz', 'oak_journals_uz', 'olis_uz', 'dissertation_uz',
  'natlib_uz', 'edu_uz', 'science_uz', 'arb_uz', 'adliya_uz', 'mygov_uz',
  'lex_uz', 'normativ_uz', 'tiiame_uz', 'agrar_uz', 'medportal_uz',
  'internet_uz', 'internet_kk', 'internet_tr', 'crosslang_uz_ru', 'crosslang_uz_en',
  'crosslang_uz_kk', 'crosslang_uz_ar', 'nbu_kolleksiya', 'elektron_kutubxona',
  'rdk_toplami', 'tabobat', 'unilibrary', 'antiplagiat_ru_db',
];

export type ModulePresetId = 'all' | 'core' | 'global' | 'milliy' | 'ai';

export const MODULE_PRESETS: Record<ModulePresetId, string[]> = {
  all: DEFAULT_ENABLED_MODULE_IDS,
  core: CORE_MODULE_IDS.filter((id) => DEFAULT_ENABLED_MODULE_IDS.includes(id)),
  global: GLOBAL_MODULE_IDS.filter((id) => DEFAULT_ENABLED_MODULE_IDS.includes(id)),
  milliy: MILLIY_MODULE_IDS.filter((id) => DEFAULT_ENABLED_MODULE_IDS.includes(id)),
  ai: [...AI_MODULE_IDS],
};

export function modulesForCheckMode(mode: AntiplagiatCheckMode): string[] {
  if (mode === 'ai') return [...MODULE_PRESETS.ai];
  if (mode === 'both') return [...DEFAULT_ENABLED_MODULE_IDS];
  return [...MODULE_PRESETS.core];
}

export const ANTIPLAGIAT_MODULE_CATEGORIES = [
  'Global',
  'Publisher',
  "O'zbekiston",
  'Markaziy Osiyo',
  'MDH',
  'Preprint',
  'Internet',
  'Cross-language',
  'AI',
  'Dissertatsiya',
  'eLIBRARY',
  'Garant',
  'Milliy',
  'Patent',
  'Ijtimoiy',
  'OTM',
  'Kutubxona',
  'Shablon',
  'Iqtibos',
  'Qonunchilik',
] as const;

export const HUJJAT_TURI_OPTIONS = [
  "Ko'rsatmalar",
  'Doktorlik dissertatsiyasi referati fan nomzodi',
  "O'quv qo'llanma",
  'Referat',
  'Kurs ishi',
  'Doktorlik dissertatsiyasi referati',
  'Maqola',
  'Kitob',
  'Darslik',
  "Qo'llanma",
  'Bitiruvchi Ish',
  'Diplom loyihasi',
  'Yakuniy saralash ishi',
  'Magistrlik dissertatsiyasi',
  'Nomzodlik dissertatsiyasi',
  'Doktorlik dissertatsiyasi',
  'Falsafa Doktorligi dissertatsiyasi',
  'Monografiya',
  'Ilmiy malaka Ish',
  'Ilmiy loyiha',
  'Tadqiqot hisoboti',
  'Amaliyot hisoboti',
  'Amaliy ish',
  'Laboratoriya amaliyoti',
  "Mashqlar to'plami",
  "Asarlar to'plami",
  "Ta'lim vizual nashri",
  "Uslubiy ko'rsatmalar",
  'Boshqa',
];

const STORAGE_KEY = 'phonix_antiplagiat_modules';

export function loadEnabledModuleIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_ENABLED_MODULE_IDS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_ENABLED_MODULE_IDS];
    const valid = new Set(DEFAULT_ENABLED_MODULE_IDS);
    const filtered = parsed.filter((id) => typeof id === 'string' && valid.has(id));
    return filtered.length ? filtered : [...DEFAULT_ENABLED_MODULE_IDS];
  } catch {
    return [...DEFAULT_ENABLED_MODULE_IDS];
  }
}

export function saveEnabledModuleIds(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}
