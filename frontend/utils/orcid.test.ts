import { describe, expect, it } from 'vitest';
import { normalizeOrcid } from './orcid';

describe('normalizeOrcid', () => {
  it('URL va chiziqchasiz ko‘rinishni qabul qiladi', () => {
    expect(normalizeOrcid('https://orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
    expect(normalizeOrcid('0000000218250097')).toBe('0000-0002-1825-0097');
    expect(normalizeOrcid('0000-0002-1694-233x')).toBe('0000-0002-1694-233X');
  });

  it("noto'g'ri nazorat raqami va formatni rad etadi", () => {
    expect(normalizeOrcid('0000-0002-1825-0098')).toBeNull();
    expect(normalizeOrcid('1234')).toBeNull();
  });

  it("bo'sh qiymat — bo'sh satr", () => {
    expect(normalizeOrcid('  ')).toBe('');
  });
});
