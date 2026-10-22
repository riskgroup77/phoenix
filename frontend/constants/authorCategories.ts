/**
 * Nashr turlari va soha kategoriyalari — muallif uchun gorizontal menyu.
 * Jurnal adminida har bir jurnalga shu nomlar bilan kategoriya tanlanishi mumkin.
 */

/** Nashr turi (8 ta) */
export const PUBLICATION_TYPES = [
  'Mahalliy OAK jurnallari',
  'Xalqaro OAK jurnallari',
  'Mahalliy jurnallar',
  'Xalqaro jurnallar',
  'Mahalliy konferensiyalar',
  'Xalqaro konferensiyalar',
  'Scopus jurnallari',
  'Scopus konferensiyalar',
] as const;

/** Soha / fan yo‘nalishlari (30 ta) */
export const SUBJECT_AREAS = [
  'Pedagogika va ta’lim',
  'Psixologiya',
  'Filologiya va tilshunoslik',
  'Tarix',
  'Falsafa',
  'Iqtisodiyot',
  'Menejment va biznes',
  'Huquq',
  'Siyosatshunoslik',
  'Sotsiologiya',
  'Axborot texnologiyalari (IT)',
  'Matematika',
  'Fizika',
  'Kimyo',
  'Biologiya',
  'Tibbiyot',
  'Qishloq xo‘jaligi',
  'Arxitektura va qurilish',
  'Transport va logistika',
  'San’at va madaniyat',
  'Jurnalistika va ommaviy kommunikatsiya',
  'Turizm va mehmondo‘stlik',
  'Sport va jismoniy tarbiya',
  'Ekologiya va atrof-muhit muhofazasi',
  'Texnika fanlari',
  'Energetika',
  'Harbiy fanlar va xavfsizlik',
  'Dinshunoslik',
  'Gender tadqiqotlari',
  'Multidissiplinar (fanlararo) yo‘nalishlar',
] as const;

export type PublicationType = (typeof PUBLICATION_TYPES)[number];
export type SubjectArea = (typeof SUBJECT_AREAS)[number];

/** Slug uchun (URL) */
export function categoryToSlug(name: string): string {
  return encodeURIComponent(name.trim());
}

export function slugToCategory(slug: string): string {
  return decodeURIComponent(slug);
}

/** Taqqoslash uchun normal shakl: kichik harf, apostrof turlari olib tashlangan (’ ‘ ʻ ' bir xil) */
export function normCategory(name: string | null | undefined): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bb\u02bc'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nashr turini solishtirish kaliti: birlik/ko'plik va egalik qo'shimchalari farq qilmaydi.
 * Bazada "Mahalliy OAK jurnali", filtr ro'yxatida "Mahalliy OAK jurnallari" — avval mos kelmay, filtr bo'sh chiqardi.
 */
export function publicationTypeKey(name: string | null | undefined): string {
  return normCategory(name)
    .split(' ')
    .map((w) => (w.length > 5 ? w.replace(/(lari|lar|si|i)$/, '') : w))
    .join(' ');
}

export const sameCategory = (a: string | null | undefined, b: string | null | undefined): boolean =>
  publicationTypeKey(a) === publicationTypeKey(b);

export const isPublicationType = (name: string | null | undefined): boolean =>
  PUBLICATION_TYPES.some((p) => sameCategory(p, name));
