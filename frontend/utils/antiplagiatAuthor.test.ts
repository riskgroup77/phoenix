import { describe, expect, it } from 'vitest';
import { antiplagiatAuthor, buildAntiplagiatViewFromArticle } from './antiplagiatFromArticle';

const user = { firstName: 'Profil', lastName: 'Egasi' };

describe('antiplagiatAuthor', () => {
  it('serverda saqlangan (formada kiritilgan) ism ustun', () => {
    // Click'dan qaytilganda forma profil ismi bilan qayta to'ldiriladi — sertifikat baribir kiritilgan ismni oladi
    expect(antiplagiatAuthor({ author_first_name: 'Test', author_last_name: 'Testov' }, { authorFirstName: 'Profil', authorLastName: 'Egasi' }, user)).toBe('Testov Test');
  });

  it('server qiymati bo\'lmasa — forma, so\'ng profil', () => {
    expect(antiplagiatAuthor({}, { authorFirstName: 'Ali', authorLastName: 'Valiyev' }, user)).toBe('Valiyev Ali');
    expect(antiplagiatAuthor(null, { authorFirstName: ' ', authorLastName: '' }, user)).toBe('Egasi Profil');
    expect(antiplagiatAuthor(null, null, null)).toBe('');
  });

  it('natija sahifasi sertifikati ham kiritilgan ismni ko\'rsatadi', () => {
    const view = buildAntiplagiatViewFromArticle(
      {
        id: 'a1',
        title: 'Plagiarism Check - ish.docx',
        author_name: 'Egasi Profil',
        plagiarism_percentage: 4,
        plagiarism_checked_at: '2026-10-23T10:00:00Z',
        plagiarism_report: { author_first_name: 'Test', author_last_name: 'Testov', certificate_number: '2026101234' },
      } as any,
      (s: string) => s,
    );
    expect(view?.certificateData.author).toBe('Testov Test');
  });
});
