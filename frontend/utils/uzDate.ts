/**
 * O'zbekcha sana: ko'p brauzerlarda `uz-UZ` locale oy nomlarini bermaydi ("M10 8" chiqadi),
 * shuning uchun oy nomlari qo'lda.
 */
const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

/** "8-oktabr" yoki withYear bo'lsa "8-oktabr, 2026" */
export function formatUzDate(value?: string | number | Date | null, withYear = false): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const base = `${d.getDate()}-${MONTHS[d.getMonth()]}`;
  return withYear ? `${base}, ${d.getFullYear()}` : base;
}

/** "11-oktabr, 2026 21:59" — brauzer locale'iga bog'liq bo'lmagan sana va vaqt */
export function formatUzDateTime(value?: string | number | Date | null): string {
  const date = formatUzDate(value, true);
  if (!date) return '';
  const d = value instanceof Date ? value : new Date(value as string | number);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
