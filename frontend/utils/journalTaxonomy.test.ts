import { describe, expect, it } from 'vitest';
import { journalMatchesSearch, journalMatchesSubject, journalMatchesType } from './journalTaxonomy';
import { PUBLICATION_TYPES, SUBJECT_AREAS, isPublicationType, sameCategory } from '../constants/authorCategories';

const ALL_FIELDS = [
  'Arxitektura va qurilish', 'Axborot texnologiyalari', 'Axborot texnologiyalari (IT)', 'Biologiya', 'Dinshunoslik',
  'Ekologiya va atrof-muhit muhofazasi', 'Energetika', 'Falsafa', 'Filologiya', 'Filologiya va tilshunoslik', 'Fizika',
  'Gender tadqiqotlari', 'Harbiy fanlar va xavfsizlik', 'Huquq', 'Iqtisodiyot', 'Jurnalistika va ommaviy kommunikatsiya',
  'Kimyo', 'Matematika', 'Menejment va biznes', 'Multidissiplinar (fanlararo) yo‘nalishlar', 'Pedagogika',
  'Pedagogika va ta’lim', 'Psixologiya', 'Qishloq xo‘jaligi', 'San’at va madaniyat', 'Siyosatshunoslik', 'Sotsiologiya',
  'Sport va jismoniy tarbiya', 'Tarix', 'Texnika fanlari', 'Tibbiyot', 'Transport va logistika', 'Turizm va mehmondo‘stlik',
];

/** Productiondagi jurnallar (nomi, rukni, sohalari) — aynan bazadagi yozilishi bilan */
const J = {
  A: { name: 'Axborot texnologiyalari va raqamli tizimlar', category_name: 'Axborot texnologiyalari', scientific_field_names: ['Axborot texnologiyalari (IT)'] },
  B: { name: 'Filologiya va tilshunoslik masalalari', category_name: 'Filologiya', scientific_field_names: ['Filologiya va tilshunoslik'] },
  C: { name: 'INTERNATIONAL JOURNAL OF BUSINESS MANAGEMENT AND SCIENTIFIC RESEARCH', category_name: 'Xalqaro jurnallar', scientific_field_names: ['Sport va jismoniy tarbiya', 'Tarix', 'Texnika fanlari', 'Tibbiyot', 'Transport va logistika', 'Turizm va mehmondo‘stlik'] },
  D: { name: 'INTERNATIONAL JOURNAL OF SCIENTIFIC & EDUCATIONAL RESEARCH', category_name: 'Xalqaro jurnallar', scientific_field_names: ALL_FIELDS },
  E: { name: 'Iqtisodiyot va innovatsion texnologiyalar', category_name: 'Iqtisodiyot', scientific_field_names: ['Iqtisodiyot'] },
  F: { name: 'TA’LIM, TARBIYA VA INNOVATSIYALAR JURNALI', category_name: 'Mahalliy OAK jurnali', scientific_field_names: [] },
  G: { name: "Tibbiyot va sog'liqni saqlash", category_name: 'Tibbiyot', scientific_field_names: ['Tibbiyot'] },
  H: { name: 'YANGI O‘ZBEKISTON, YANGI TADQIQOTLAR JURNALI', category_name: 'Mahalliy OAK jurnali', scientific_field_names: [], issn: '3060-4567' },
  I: { name: "Zamonaviy ta'lim va pedagogika", category_name: 'Pedagogika', scientific_field_names: ['Pedagogika va ta’lim'] },
};
type Key = keyof typeof J;
const KEYS = Object.keys(J) as Key[];
const pick = (type = '', subject = '', q = '') =>
  KEYS.filter((k) => journalMatchesType(J[k], type) && journalMatchesSubject(J[k], subject) && journalMatchesSearch(J[k], q)).join('');

describe('maqola yuborish filtri — productiondagi jurnallar bilan', () => {
  it('filtrsiz hamma jurnal chiqadi', () => {
    expect(pick()).toBe('ABCDEFGHI');
  });

  it.each([
    ['Mahalliy OAK jurnallari', 'FH'],
    ['Xalqaro OAK jurnallari', ''],
    ['Mahalliy jurnallar', ''],
    ['Xalqaro jurnallar', 'CD'],
    ['Mahalliy konferensiyalar', ''],
    ['Xalqaro konferensiyalar', ''],
    ['Scopus jurnallari', ''],
    ['Scopus konferensiyalar', ''],
  ])('nashr turi: %s → %s', (type, expected) => {
    expect(pick(type)).toBe(expected);
  });

  it.each([
    ['Pedagogika va ta’lim', 'DI'],
    ['Iqtisodiyot', 'DE'],
    ['Tibbiyot', 'CDG'],
    ['Axborot texnologiyalari (IT)', 'AD'],
    ['Filologiya va tilshunoslik', 'BD'],
    ['Tarix', 'CD'],
    ['Huquq', 'D'],
    ['Turizm va mehmondo‘stlik', 'CD'],
    ['Multidissiplinar (fanlararo) yo‘nalishlar', 'D'],
  ])('soha: %s → %s', (subject, expected) => {
    expect(pick('', subject)).toBe(expected);
  });

  it('har bir soha uchun xato chiqmaydi va sohasi belgilangan jurnal (D) doim topiladi', () => {
    for (const subject of SUBJECT_AREAS) expect(pick('', subject)).toContain('D');
  });

  it('nashr turi + soha birga', () => {
    expect(pick('Xalqaro jurnallar', 'Tibbiyot')).toBe('CD');
    expect(pick('Xalqaro jurnallar', 'Iqtisodiyot')).toBe('D');
    expect(pick('Mahalliy OAK jurnallari', 'Tibbiyot')).toBe('');
  });

  it.each([
    ["o'zbekiston", 'H'],
    ['O‘ZBEKISTON', 'H'],
    ['yangi tadqiqot', 'H'],
    ["ta'lim", 'DFI'],
    ['international', 'CD'],
    ['tibbiyot', 'CDG'],
    ['3060', 'H'],
    ['3060-4567', 'H'],
    ['  ', 'ABCDEFGHI'],
    ['mavjud emas', ''],
  ])('qidiruv: "%s" → %s', (q, expected) => {
    expect(pick('', '', q)).toBe(expected);
  });

  it('qidiruv + filtr birga', () => {
    expect(pick('Mahalliy OAK jurnallari', '', 'yangi')).toBe('H');
    expect(pick('Xalqaro jurnallar', 'Tibbiyot', 'business')).toBe('C');
  });
});

describe("ro'yxatlar o'zaro aralashmaydi", () => {
  it('8 ta nashr turi bir-biridan farqli', () => {
    for (const p of PUBLICATION_TYPES) expect(PUBLICATION_TYPES.filter((q) => sameCategory(p, q))).toEqual([p]);
    expect(isPublicationType('Mahalliy OAK jurnali')).toBe(true);
    expect(sameCategory('Xalqaro konferensiya', 'Xalqaro konferensiyalar')).toBe(true);
  });

  it('30 ta soha bir-biridan farqli (qisqa shakl boshqa sohaga tegmaydi)', () => {
    for (const s of SUBJECT_AREAS) {
      const j = { category_name: '', scientific_field_names: [s] };
      expect(SUBJECT_AREAS.filter((other) => journalMatchesSubject(j, other))).toEqual([s]);
    }
  });
});
