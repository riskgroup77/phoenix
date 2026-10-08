import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, DICTIONARY_KEYS } from './dictionaries';
import { toCyrillic } from './translit';
import { translate } from './LanguageContext';
import { sidebarNavByRole, bottomNavByRole, roleNames } from '../config/navConfig';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\.tsx?$/.test(name) && !full.includes(`i18n${'\\'}dictionaries`) && !full.includes('i18n/dictionaries')) out.push(full);
  }
  return out;
}

/** Koddagi t('…') / t("…") literal kalitlari */
function literalKeys(): Map<string, string> {
  const pat = /\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
  const keys = new Map<string, string>();
  for (const file of sourceFiles(ROOT)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(pat)) {
      const raw = m[1] ?? m[2] ?? '';
      keys.set(raw.replace(/\\'/g, "'").replace(/\\"/g, '"'), file);
    }
  }
  return keys;
}

describe('i18n lug‘ati', () => {
  it("koddagi har bir t('…') matnining rus va ingliz tarjimasi bor", () => {
    const missing = [...literalKeys()].filter(([k]) => !(k in DICTIONARIES.ru) || !(k in DICTIONARIES.en));
    expect(missing.map(([k, f]) => `${k}  ←  ${f}`)).toEqual([]);
  });

  it('menyu bandlari va rollar tarjima qilingan', () => {
    const labels = new Set<string>();
    Object.values(sidebarNavByRole).forEach((s) => [...s.primary, ...(s.tools ?? []), ...(s.account ?? [])].forEach((i) => labels.add(i.label)));
    Object.values(bottomNavByRole).forEach((items) => items?.forEach((i) => labels.add(i.label)));
    Object.values(roleNames).forEach((r) => labels.add(r));
    const missing = [...labels].filter((k) => !(k in DICTIONARIES.ru) || !(k in DICTIONARIES.en));
    expect(missing).toEqual([]);
  });

  it("lug'atda takroriy kalit yo'q", () => {
    const seen = new Set<string>();
    const dupes = DICTIONARY_KEYS.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
    expect(dupes).toEqual([]);
  });

  it("o'zgaruvchilar tarjimada saqlangan", () => {
    const broken = DICTIONARY_KEYS.filter((k) => {
      const vars = (k.match(/\{\w+\}/g) || []).sort().join();
      return [DICTIONARIES.ru[k], DICTIONARIES.en[k]].some((v) => (v.match(/\{\w+\}/g) || []).sort().join() !== vars);
    });
    expect(broken).toEqual([]);
  });
});

describe('kirill transliteratsiyasi', () => {
  it("asosiy qoidalar", () => {
    expect(toCyrillic("Maqola yuborish")).toBe('Мақола юбориш');
    expect(toCyrillic("O'zbekiston")).toBe('Ўзбекистон');
    expect(toCyrillic("To'lovlar")).toBe('Тўловлар');
    expect(toCyrillic("Ma'lumotnoma")).toBe('Маълумотнома');
    expect(toCyrillic('Shu oy')).toBe('Шу ой');
    expect(toCyrillic('Yangi')).toBe('Янги');
    expect(toCyrillic('Eng yaxshi')).toBe('Энг яхши');
    expect(toCyrillic("g'oya")).toBe('ғоя');
  });

  it("qisqartmalar, havolalar va o'zgaruvchilar o'zgarmaydi", () => {
    expect(toCyrillic('DOI raqami')).toBe('DOI рақами');
    expect(toCyrillic('ilmiyfaoliyat.uz saytida')).toBe('ilmiyfaoliyat.uz сайтида');
    expect(toCyrillic('{n} kun')).toBe('{n} кун');
  });

  it('translate: o‘zgaruvchilarni joylaydi', () => {
    expect(translate('uz-Cyrl', '{n} kun qoldi', { n: 3 })).toBe('3 кун қолди');
    expect(translate('ru', '{n} kun qoldi', { n: 3 })).toBe('осталось 3 дн.');
    expect(translate('en', 'Kirish')).toBe('Sign in');
    expect(translate('en', "Lug'atda yo'q matn")).toBe("Lug'atda yo'q matn");
  });
});
