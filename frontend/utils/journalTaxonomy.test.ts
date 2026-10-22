import { describe, expect, it } from 'vitest';
import { journalMatchesSubject, journalMatchesType } from './journalTaxonomy';
import { PUBLICATION_TYPES, isPublicationType, sameCategory } from '../constants/authorCategories';

describe('jurnal filtri: nashr turi', () => {
  it("bazadagi birlik shakl («Mahalliy OAK jurnali») filtrdagi ko'plik bilan mos keladi", () => {
    const j = { category_name: 'Mahalliy OAK jurnali', scientific_field_names: [] };
    expect(journalMatchesType(j, 'Mahalliy OAK jurnallari')).toBe(true);
    expect(journalMatchesType(j, 'Xalqaro OAK jurnallari')).toBe(false);
    expect(journalMatchesType(j, 'Mahalliy jurnallar')).toBe(false);
    expect(journalMatchesType(j, '')).toBe(true);
  });

  it('konferensiya shakllari ham mos keladi, turlar bir-biriga aralashmaydi', () => {
    expect(sameCategory('Xalqaro konferensiya', 'Xalqaro konferensiyalar')).toBe(true);
    expect(sameCategory('Scopus jurnali', 'Scopus jurnallari')).toBe(true);
    expect(sameCategory('Scopus jurnallari', 'Scopus konferensiyalar')).toBe(false);
    expect(isPublicationType('Mahalliy OAK jurnali')).toBe(true);
    // 8 ta standart tur o'zaro farqli qoladi
    const keys = new Set(PUBLICATION_TYPES.map((p) => PUBLICATION_TYPES.filter((q) => sameCategory(p, q)).length));
    expect([...keys]).toEqual([1]);
  });

  it('soha filtri oʻzgarmagan', () => {
    const j = { category_name: 'Xalqaro jurnallar', scientific_field_names: ['Tibbiyot', 'Tarix'] };
    expect(journalMatchesSubject(j, 'Tibbiyot')).toBe(true);
    expect(journalMatchesSubject(j, 'Huquq')).toBe(false);
  });
});
