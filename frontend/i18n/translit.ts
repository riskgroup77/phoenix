/**
 * O'zbek lotin → kirill transliteratsiyasi (interfeys matnlari uchun).
 * Qoidalar: sh→ш, ch→ч, o‘→ў, g‘→ғ, yo/yu/ya/ye→ё/ю/я/е, so'z boshidagi e→э, tutuq belgisi→ъ.
 * Xalqaro qisqartmalar (DOI, ISSN, PDF...) va brend nomlari o'zgartirilmaydi.
 */

const KEEP = new Set([
  'DOI', 'ISSN', 'ISBN', 'ORCID', 'PDF', 'DOCX', 'XML', 'URL', 'QR', 'AI', 'SI',
  'Click', 'Payme', 'Phoenix', 'Telegram', 'Google', 'Scholar', 'Crossref', 'OpenAlex', 'Email', 'E-mail',
  'Ctrl', 'K', 'Enter', 'Esc',
]);

const APOS = "'’ʻʼ‘`";

const SINGLE: Record<string, string> = {
  a: 'а', b: 'б', c: 'с', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л',
  m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'х',
  y: 'й', z: 'з',
};

const VOWELS = 'aeiouAEIOU';

function applyCase(src: string, out: string, nextIsUpper: boolean): string {
  if (src.length > 1 && src === src.toUpperCase() && src !== src.toLowerCase()) return out.toUpperCase();
  if (src[0] !== src[0].toLowerCase()) {
    // "Sh" + keyingi harf katta bo'lsa ("SHAHAR") — butunlay katta
    return nextIsUpper ? out.toUpperCase() : out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

function translitWord(word: string): string {
  // Brendlar, raqamli kodlar va domen/email ko'rinishidagi so'zlar o'zgarmaydi
  if (KEEP.has(word) || /\d/.test(word) || /[@/.]/.test(word)) {
    return word;
  }
  let out = '';
  let i = 0;
  while (i < word.length) {
    const ch = word[i];
    const lower = ch.toLowerCase();
    const next = word[i + 1] || '';
    const nextLower = next.toLowerCase();
    const after = word[i + 2] || '';
    const nextIsUpper = !!after && after !== after.toLowerCase() && after === after.toUpperCase();

    // o‘ / g‘
    if ((lower === 'o' || lower === 'g') && next && APOS.includes(next)) {
      out += applyCase(ch, lower === 'o' ? 'ў' : 'ғ', false);
      i += 2;
      continue;
    }
    if (lower === 's' && nextLower === 'h') {
      out += applyCase(ch + next, 'ш', nextIsUpper);
      i += 2;
      continue;
    }
    if (lower === 'c' && nextLower === 'h') {
      out += applyCase(ch + next, 'ч', nextIsUpper);
      i += 2;
      continue;
    }
    if (lower === 'y' && 'oauOAU'.includes(next) && next) {
      const map: Record<string, string> = { o: 'ё', a: 'я', u: 'ю' };
      out += applyCase(ch + next, map[nextLower], nextIsUpper);
      i += 2;
      continue;
    }
    if (lower === 'y' && nextLower === 'e') {
      out += applyCase(ch + next, 'е', nextIsUpper);
      i += 2;
      continue;
    }
    if (lower === 'e') {
      const prev = word[i - 1] || '';
      const atStart = i === 0 || !/[a-zA-Z]/.test(prev) || VOWELS.includes(prev);
      out += applyCase(ch, atStart ? 'э' : 'е', false);
      i += 1;
      continue;
    }
    if (APOS.includes(ch)) {
      // tutuq belgisi (ma'lumot → маълумот); so'z chetidagi tirnoqlar o'zgarmaydi
      out += i > 0 && i < word.length - 1 ? 'ъ' : ch;
      i += 1;
      continue;
    }
    const mapped = SINGLE[lower];
    out += mapped ? applyCase(ch, mapped, false) : ch;
    i += 1;
  }
  return out;
}

/** Matnni so'zlarga ajratib transliteratsiya qiladi; {o'zgaruvchi} joylari tegilmaydi. */
export function toCyrillic(text: string): string {
  if (!text) return text;
  return text
    .split(
      /(\{[^}]+\}|https?:\/\/\S+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+|[A-Za-z0-9-]+\.(?:uz|com|org|net|ru)\b|[^\s.,;:!?()«»"“”\-–—/]+)/u,
    )
    .map((part) => {
      if (!part || part.startsWith('{') || part.startsWith('http')) return part;
      if (/^[\s.,;:!?()«»"“”\-–—/]+$/u.test(part)) return part;
      return translitWord(part);
    })
    .join('');
}
