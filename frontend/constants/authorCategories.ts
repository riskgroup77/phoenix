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
