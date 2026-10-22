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

const subjectHead = (subject: string) => normCategory(subject).split(' va ')[0].split(' (')[0];

export const journalMatchesSubject = (j: TaxonomyJournal, subject: string): boolean => {
  if (!subject) return true;
  const target = normCategory(subject);
  const fields = (j.scientific_field_names || []).map(normCategory);
  if (fields.includes(target)) return true;
  // Eski ma'lumot: soha rukn nomi sifatida ("Pedagogika" ~ "Pedagogika va ta’lim")
  const cat = normCategory(j.category_name);
  if (cat && (cat === target || target.startsWith(cat) || cat.startsWith(subjectHead(subject)))) return true;
  return false;
};
