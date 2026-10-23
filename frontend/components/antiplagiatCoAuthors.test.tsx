import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AntiplagiatCertificate, { type AntiplagiatCertificateData } from './AntiplagiatCertificate';
import AntiplagiatUploadPanel, {
  MAX_ANTIPLAGIAT_CO_AUTHORS,
  coAuthorsPayload,
  createDefaultAntiplagiatForm,
  hasIncompleteCoAuthor,
} from './AntiplagiatUploadPanel';
import { layoutNameList } from './AntiplagTemplateOverlay';
import { CERTIFICATE_TEMPLATE } from '../constants/antiplagTemplateLayout';
import { antiplagiatAuthors, buildAntiplagiatViewFromArticle } from '../utils/antiplagiatFromArticle';

const cert = (authors: string[]): AntiplagiatCertificateData => ({
  certificateNumber: '2026101234',
  checkDate: '23.10.2026',
  author: authors.join(', '),
  authors,
  workType: 'Dissertatsiya',
  fileName: 'ish.docx',
  citations: '0.0%',
  selfCitation: '0.0%',
  plagiarism: '4.00%',
  originality: '96.00%',
  searchModules: '3 ta bazada tekshirilgan',
});

// Test muhitida canvas yo'q — taxminiy kenglik (Arial bold ~0.6em)
const measure = (text: string, size: number) => text.length * 0.6 * size;
const spec = CERTIFICATE_TEMPLATE.fields.author;
const W = CERTIFICATE_TEMPLATE.width;

describe('antiplagiat forma: hammualliflar', () => {
  it("standart formada hammuallif yo'q", () => {
    expect(createDefaultAntiplagiatForm().coAuthors).toEqual([]);
  });

  it("serverga faqat to'ldirilgan qatorlar ketadi (bo'shliqlar olib tashlanadi, ko'pi bilan 9 ta)", () => {
    expect(
      coAuthorsPayload([
        { firstName: ' Ali ', lastName: 'Valiyev ' },
        { firstName: '', lastName: '  ' },
        { firstName: 'Vali', lastName: 'Aliyev' },
      ]),
    ).toEqual([
      { first_name: 'Ali', last_name: 'Valiyev' },
      { first_name: 'Vali', last_name: 'Aliyev' },
    ]);
    const many = Array.from({ length: 12 }, (_, i) => ({ firstName: `Ism${i}`, lastName: `Fam${i}` }));
    expect(coAuthorsPayload(many)).toHaveLength(MAX_ANTIPLAGIAT_CO_AUTHORS);
  });

  it("faqat ism yoki faqat familiya — to'liq emas; bo'sh qator — e'tiborsiz", () => {
    expect(hasIncompleteCoAuthor([{ firstName: 'Ali', lastName: '' }])).toBe(true);
    expect(hasIncompleteCoAuthor([{ firstName: '', lastName: 'Valiyev' }])).toBe(true);
    expect(hasIncompleteCoAuthor([{ firstName: '', lastName: '' }])).toBe(false);
    expect(hasIncompleteCoAuthor([{ firstName: 'Ali', lastName: 'Valiyev' }])).toBe(false);
    expect(hasIncompleteCoAuthor(undefined)).toBe(false);
  });

  it("forma: «+» tugmasi, har bir hammuallif qatori va o'chirish tugmasi", () => {
    const values = {
      ...createDefaultAntiplagiatForm(),
      coAuthors: [{ firstName: 'Ali', lastName: 'Valiyev' }, { firstName: 'Vali', lastName: '' }],
    };
    const html = renderToStaticMarkup(
      <AntiplagiatUploadPanel values={values} onChange={() => {}} price={1000} isChecking={false}
        onSubmit={() => {}} onFileSelect={() => {}} />,
    );
    expect(html).toContain("Hammuallif qo&#x27;shish");
    expect(html.match(/data-testid="antiplagiat-coauthor-row"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Hammuallifni o&#x27;chirish"/g)).toHaveLength(2);
    expect(html).toContain('>1-hammuallif<');
    expect(html).toContain('>2-hammuallif<');
    expect(html).toContain('aria-label="2-hammuallif: familiya"');
    expect(html).toContain('value="Valiyev"');
    // 2-qatorda familiya yo'q — ogohlantirish
    expect(html).toContain('Hammuallifning ism va familiyasini kiriting.');
    expect(html).toContain('2 / 9 ta hammuallif');
  });

  it("9 ta hammuallifdan keyin «+» tugmasi o'chiriladi", () => {
    const values = {
      ...createDefaultAntiplagiatForm(),
      coAuthors: Array.from({ length: MAX_ANTIPLAGIAT_CO_AUTHORS }, (_, i) => ({ firstName: `I${i}`, lastName: `F${i}` })),
    };
    const html = renderToStaticMarkup(
      <AntiplagiatUploadPanel values={values} onChange={() => {}} price={1000} isChecking={false}
        onSubmit={() => {}} onFileSelect={() => {}} />,
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Hammuallif qo&#x27;shish/);
  });
});

describe('antiplagiat: mualliflar ro\'yxati', () => {
  it('serverdagi hammualliflar ustun (Click\'dan qaytilganda forma bo\'sh)', () => {
    const report = {
      author_first_name: 'Test', author_last_name: 'Testov',
      co_authors: [{ first_name: 'Ali', last_name: 'Valiyev' }, { first_name: 'Vali', last_name: 'Aliyev' }],
    };
    expect(antiplagiatAuthors(report, { authorFirstName: 'Profil', authorLastName: 'Egasi', coAuthors: [] }))
      .toEqual(['Testov Test', 'Valiyev Ali', 'Aliyev Vali']);
  });

  it("server hammualliflarni hali saqlamagan bo'lsa — formadan", () => {
    expect(antiplagiatAuthors({}, { authorFirstName: 'Test', authorLastName: 'Testov', coAuthors: [{ firstName: 'Ali', lastName: 'Valiyev' }] }))
      .toEqual(['Testov Test', 'Valiyev Ali']);
  });

  it('natija sahifasi: sertifikat va hisobotda barcha mualliflar', () => {
    const view = buildAntiplagiatViewFromArticle({
      id: 'a1', title: 'Plagiarism Check - ish.docx', author_name: 'Egasi Profil', plagiarism_percentage: 4,
      plagiarism_checked_at: '2026-10-23T10:00:00Z',
      plagiarism_report: {
        author_first_name: 'Test', author_last_name: 'Testov', certificate_number: '2026101234',
        co_authors: [{ first_name: 'Ali', last_name: 'Valiyev' }],
      },
    } as any);
    expect(view?.certificateData.authors).toEqual(['Testov Test', 'Valiyev Ali']);
    expect(view?.certificateData.author).toBe('Testov Test, Valiyev Ali');
    expect(view?.fullReportData.authors).toEqual(['Testov Test', 'Valiyev Ali']);
  });
});

describe('sertifikat: bir nechta muallif', () => {
  it('bitta muallif — oddiy shablon «MUALLIF», bitta qator', () => {
    const html = renderToStaticMarkup(<AntiplagiatCertificate data={cert(['Testov Test'])} />);
    expect(html).toContain('/antiplag-templates/sertifikat.jpg');
    expect(html).not.toContain('template-name-list');
    expect(html).toContain('Testov Test');
  });

  it("2 va undan ko'p — «MUALLIFLAR» yorliqli shablon va barcha ismlar", () => {
    const html = renderToStaticMarkup(<AntiplagiatCertificate data={cert(['Testov Test', 'Valiyev Ali', 'Aliyev Vali'])} />);
    expect(html).toContain('/antiplag-templates/sertifikat.authors.jpg');
    expect(html).toContain('data-testid="template-name-list"');
    for (const name of ['Testov Test', 'Valiyev Ali', 'Aliyev Vali']) expect(html).toContain(name);
  });

  it('qisqa ro\'yxat bitta qatorga sig\'adi', () => {
    const { lines, size } = layoutNameList(['Testov Test', 'Valiyev Ali'], spec, W, 3, measure);
    expect(lines).toEqual(['Testov Test, Valiyev Ali']);
    expect(size).toBe(spec.size);
  });

  it("uzun ro'yxat — mualliflar orasidan bo'linadi (ism o'rtasidan emas), 3 qatordan oshmaydi", () => {
    const names = [
      'Abdurahmonov Abdulaziz', 'Xudoyberdiyeva Gulnoza', 'Karimov Karim', 'Rahimova Dilnoza',
      "Yo'ldoshev Sardor", 'Toshmatov Jasur',
    ];
    const { lines, size } = layoutNameList(names, spec, W, 3, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(size).toBeLessThan(spec.size);
    // Har bir ism to'liq bitta qatorda
    for (const name of names) expect(lines.some((l) => l.includes(name))).toBe(true);
    expect(lines.join(' ')).toBe(names.join(', '));
    // Har bir qator ajratilgan kenglikka sig'adi
    for (const l of lines) expect(measure(l, size)).toBeLessThanOrEqual(spec.max_width * W);
  });

  it("10 ta muallif ham 3 qatorga joylashadi", () => {
    const names = Array.from({ length: 10 }, (_, i) => `Familiyaov${i} Ismjon${i}`);
    const { lines } = layoutNameList(names, spec, W, 3, measure);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.join(' ')).toContain('Familiyaov9 Ismjon9');
  });
});
