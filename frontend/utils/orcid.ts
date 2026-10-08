/**
 * ORCID iD: format va nazorat raqami (ISO 7064 Mod 11-2) tekshiruvi — backend apps/users/orcid.py bilan bir xil.
 */
export function orcidChecksumOk(digits16: string): boolean {
  let total = 0;
  for (const ch of digits16.slice(0, -1)) {
    total = (total + Number(ch)) * 2;
  }
  const result = (12 - (total % 11)) % 11;
  const expected = result === 10 ? 'X' : String(result);
  return digits16.slice(-1) === expected;
}

/** "https://orcid.org/0000-0002-1825-0097" yoki "0000000218250097" → "0000-0002-1825-0097"; noto'g'ri bo'lsa null. Bo'sh → "". */
export function normalizeOrcid(value: string): string | null {
  const raw = (value || '').trim().replace(/^(https?:\/\/)?(www\.)?orcid\.org\//i, '').toUpperCase();
  if (!raw) return '';
  const m = raw.match(/^(\d{4})-?(\d{4})-?(\d{4})-?(\d{3}[\dX])$/);
  if (!m) return null;
  const digits = m.slice(1).join('');
  if (!orcidChecksumOk(digits)) return null;
  return m.slice(1).join('-');
}

export const orcidUrl = (id: string) => (id ? `https://orcid.org/${id}` : '');
