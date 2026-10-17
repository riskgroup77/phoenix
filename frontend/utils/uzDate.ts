/**
 * O'zbekcha sana: ko'p brauzerlarda `uz-UZ` locale oy nomlarini bermaydi ("M10 8" chiqadi),
 * shuning uchun oy nomlari qo'lda.
 */
import { toCyrillic } from '../i18n/translit';

const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

/** Interfeys tili (LanguageContext bilan bir xil kalit) — sana shu tilda chiqadi */
function currentLang(): string {
  try {
    return localStorage.getItem('phoenix-lang') || 'uz';
  } catch {
    return 'uz';
  }
}

/** "8-oktabr" yoki withYear bo'lsa "8-oktabr, 2026"; rus/ingliz interfeysida — "8 октября" / "8 October" */
export function formatUzDate(value?: string | number | Date | null, withYear = false): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const lang = currentLang();
  if (lang === 'ru' || lang === 'en') {
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) };
    return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', opts).format(d).replace(/\s*г\.$/, '');
  }
  const base = `${d.getDate()}-${MONTHS[d.getMonth()]}`;
  const text = withYear ? `${base}, ${d.getFullYear()}` : base;
  return lang === 'uz-Cyrl' ? toCyrillic(text) : text;
}

/** "14.10.2026" — hujjatlardagi sana (backend PDF bilan bir xil format) */
export function formatDocDate(value?: string | number | Date | null): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** "11-oktabr, 2026 21:59" — brauzer locale'iga bog'liq bo'lmagan sana va vaqt */
export function formatUzDateTime(value?: string | number | Date | null): string {
  const date = formatUzDate(value, true);
  if (!date) return '';
  const d = value instanceof Date ? value : new Date(value as string | number);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
