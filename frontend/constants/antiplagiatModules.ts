/**
 * Antiplagiat tekshirish modullari.
 *
 * Haqiqiy ro'yxat backend'dan olinadi: GET /api/v1/articles/antiplagiat-modules/
 * (faqat joriy server sozlamalarida HAQIQATAN tekshiriladigan bazalar). Quyidagi ro'yxat —
 * API javob bermasa ishlatiladigan zaxira (har doim mavjud asosiy modullar).
 */
export type AntiplagiatModule = {
  id: string;
  label: string;
  category?: string;
  description?: string;
};

export const ANTIPLAGIAT_MODULES: AntiplagiatModule[] = [
  { id: 'milliy_reestr', label: 'Phoenix ichki bazasi (ilmiyfaoliyat.uz maqolalari)', category: 'Ichki baza' },
  { id: 'iqtibos_keltirish', label: "Iqtiboslar va o'z-o'ziga iqtibos", category: 'Tahlil' },
  { id: 'shablon_iboralar', label: 'Shablon iboralar', category: 'Tahlil' },
  { id: 'openalex', label: 'OpenAlex (ochiq ilmiy ishlar bazasi)', category: 'Ochiq ilmiy bazalar' },
  { id: 'crossref', label: 'Crossref (DOI bazasi)', category: 'Ochiq ilmiy bazalar' },
  { id: 'semantic_scholar', label: 'Semantic Scholar', category: 'Ochiq ilmiy bazalar' },
  { id: 'ai_detection', label: 'SI uslubi tahlili (taxminiy)', category: 'Tahlil' },
];

export const DEFAULT_ENABLED_MODULE_IDS = ANTIPLAGIAT_MODULES.map((m) => m.id);

/** SI (sun'iy intellekt) uslubi tahlili moduli */
export const AI_MODULE_IDS = ['ai_detection'] as const;

export type AntiplagiatCheckMode = 'plagiarism' | 'ai' | 'both';

export type ModulePresetId = 'all' | 'global' | 'milliy' | 'ai';

export const MODULE_PRESET_LABELS: Record<ModulePresetId, string> = {
  all: 'Barcha mavjud',
  global: 'Ochiq ilmiy bazalar',
  milliy: 'Ichki baza',
  ai: 'SI tahlili',
};

const ANALYSIS_CATEGORY = 'Tahlil';

/** Mavjud modullar ro'yxatidan tezkor profillar */
export function buildModulePresets(modules: AntiplagiatModule[]): Record<ModulePresetId, string[]> {
  const ids = (pred: (m: AntiplagiatModule) => boolean) => modules.filter(pred).map((m) => m.id);
  const analysis = ids((m) => m.category === ANALYSIS_CATEGORY && !AI_MODULE_IDS.includes(m.id as 'ai_detection'));
  return {
    all: modules.map((m) => m.id),
    global: [...ids((m) => m.category === 'Ochiq ilmiy bazalar'), ...analysis],
    milliy: [...ids((m) => m.category === 'Ichki baza'), ...analysis],
    ai: ids((m) => AI_MODULE_IDS.includes(m.id as 'ai_detection')),
  };
}

export const MODULE_PRESETS = buildModulePresets(ANTIPLAGIAT_MODULES);

export function modulesForCheckMode(mode: AntiplagiatCheckMode, modules: AntiplagiatModule[] = ANTIPLAGIAT_MODULES): string[] {
  const presets = buildModulePresets(modules);
  if (mode === 'ai') return [...presets.ai];
  if (mode === 'both') return [...presets.all];
  return presets.all.filter((id) => !presets.ai.includes(id));
}

/** Modullar kategoriyalari (mavjud ro'yxat tartibida) */
export function moduleCategories(modules: AntiplagiatModule[]): string[] {
  return Array.from(new Set(modules.map((m) => m.category).filter((c): c is string => Boolean(c))));
}

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

export function loadEnabledModuleIds(available: AntiplagiatModule[] = ANTIPLAGIAT_MODULES): string[] {
  const all = available.map((m) => m.id);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...all];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...all];
    const valid = new Set(all);
    const filtered = parsed.filter((id) => typeof id === 'string' && valid.has(id));
    return filtered.length ? filtered : [...all];
  } catch {
    return [...all];
  }
}

export function saveEnabledModuleIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* brauzer xotirasi yopiq bo'lishi mumkin */
  }
}
