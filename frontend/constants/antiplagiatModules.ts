/** antiplagiat.uz uslubidagi tekshirish modullari */
export type AntiplagiatModule = {
  id: string;
  label: string;
};

export const ANTIPLAGIAT_MODULES: AntiplagiatModule[] = [
  { id: 'elibrary_translations', label: "Публикации eLIBRARY (переводы и перефразирования)" },
  { id: 'shablon_iboralar', label: 'Shablon iboralar' },
  { id: 'elibrary_ru', label: 'eLIBRARY.RU' },
  { id: 'bmk_dissertatsiyalari', label: 'BMK dissertatsiyalari' },
  { id: 'ips_adilet', label: 'ИПС Адилет' },
  { id: 'tabobat', label: 'Tabobat' },
  { id: 'patentlar', label: 'Patentlar' },
  { id: 'rdk_toplami', label: "RDK to'plami" },
  { id: 'elektron_kutubxona', label: 'Elektron-kutubxona tizimlari' },
  { id: 'garant_aht', label: 'Garant AHT' },
  { id: 'iqtibos_keltirish', label: 'Iqtibos keltirish' },
  { id: 'sps_garant', label: 'СПС Гарант: нормативно-правовая документация' },
  { id: 'ieee', label: 'IEEE' },
  { id: 'nbu_kolleksiya', label: 'Коллекция НБУ' },
  { id: 'unilibrary', label: 'unilibrary' },
  { id: 'garant_analytics', label: 'Переводные заимствования по коллекции Гарант: аналитика' },
  { id: 'garant_paraphrase', label: 'Перефразирования по СПС ГАРАНТ: аналитика' },
  { id: 'otm_halqasi', label: 'OTMlar halqasi' },
  { id: 'smi_russia_cis', label: 'СМИ России и СНГ' },
  { id: 'internet_ru_paraphrase', label: 'Перефразированные заимствования по коллекции Интернет в русском сегменте' },
  { id: 'internet_en_paraphrase', label: 'Перефразированные заимствования по коллекции Интернет в английском сегменте' },
  { id: 'springer', label: 'springer' },
  { id: 'internet_ru_translation', label: 'Переводные заимствования по коллекции Интернет в русском сегменте' },
  { id: 'internet_en_translation', label: 'Переводные заимствования по коллекции Интернет в английском сегменте' },
  { id: 'crosslang_rsl_2022', label: 'crosslang_rsl_2022' },
  { id: 'internet_plus', label: 'Search module INTERNET PLUS' },
  { id: 'crosslang_vuzring', label: 'crosslang vuzring' },
  { id: 'ieee_search', label: 'Search module of IEEE' },
  { id: 'company_collection', label: 'Собственная коллекция компании' },
  { id: 'milliy_reestr', label: 'Phoenix Milliy reestr (ilmiyfaoliyat.uz)' },
  { id: 'ieee_crosslang', label: 'IEEE Cross language' },
];

export const DEFAULT_ENABLED_MODULE_IDS = ANTIPLAGIAT_MODULES.map((m) => m.id);

export const HUJJAT_TURI_OPTIONS = [
  'Ko\'rsatmalar',
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
  'Uslubiy ko\'rsatmalar',
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
