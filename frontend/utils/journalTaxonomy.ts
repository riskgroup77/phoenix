/**
 * Jurnal filtrlari: rukn (nashr turi) va soha alohida.
 * Soha — jurnalning scientific_field_names ro'yxati (admin formasida tanlanadi). Eski jurnallarda soha rukn
 * sifatida saqlangan bo'lishi mumkin ("Iqtisodiyot") — ular ham hisobga olinadi. Apostrof turlari farq qilmaydi.
 */
import { normCategory, sameCategory } from '../constants/authorCategories';

export interface TaxonomyJournal {
  category_name?: string | null;
  scientific_field_names?: string[] | null;
  name?: string | null;
  description?: string | null;
}

export const journalMatchesType = (j: TaxonomyJournal, typeName: string): boolean =>
  !typeName || sameCategory(j.category_name, typeName);

/** "Pedagogika va ta’lim" → "pedagogika", "Axborot texnologiyalari (IT)" → "axborot texnologiyalari" */
const subjectHead = (subject: string | null | undefined) => normCategory(subject).split(' va ')[0].split(' (')[0].trim();

/** Soha nomlari bir xilmi: to'liq yoki qisqa shakl ("Pedagogika" ~ "Pedagogika va ta’lim") */
const sameSubject = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const na = normCategory(a);
  const nb = normCategory(b);
  if (!na || !nb) return false;
  return na === nb || subjectHead(a) === subjectHead(b);
};

export const journalMatchesSubject = (j: TaxonomyJournal, subject: string): boolean => {
  if (!subject) return true;
  // Bazada eski qisqa soha nomlari ham bor ("Axborot texnologiyalari", "Pedagogika", "Filologiya")
  if ((j.scientific_field_names || []).some((f) => sameSubject(f, subject))) return true;
  // Eski ma'lumot: soha rukn nomi sifatida saqlangan ("Iqtisodiyot", "Pedagogika")
  return sameSubject(j.category_name, subject);
};

/**
 * Jurnal qidiruvi: nomi, tavsifi, rukni, sohalari va ISSN. Apostrof turlari va katta-kichik harf farq qilmaydi
 * ("o'zbekiston" → "O‘ZBEKISTON"). Avval ‘ bilan yozilgan nomlar oddiy ' bilan qidirilganda topilmasdi.
 */
export const journalMatchesSearch = (j: TaxonomyJournal & { issn?: string | null }, query: string): boolean => {
  const q = normCategory(query);
  if (!q) return true;
  const qIssn = q.replace(/[^0-9x]/g, '');
  const issn = String(j.issn || '').toLowerCase().replace(/[^0-9x]/g, '');
  if (qIssn.length >= 4 && issn.includes(qIssn)) return true;
  return [j.name, j.description, j.category_name, ...(j.scientific_field_names || [])]
    .some((text) => normCategory(text).includes(q));
};
