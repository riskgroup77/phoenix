import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DICTIONARIES } from './dictionaries';
import { toCyrillic } from './translit';

/**
 * Interfeys tillari. Kalit — o'zbek (lotin) matnning o'zi: t("Maqola yuborish").
 * - uz: matn o'zgarmaydi
 * - uz-Cyrl: avtomatik transliteratsiya (lug'at shart emas)
 * - ru / en: lug'atdan (dictionaries.ts); topilmasa o'zbekcha qoladi
 */
export type Lang = 'uz' | 'uz-Cyrl' | 'ru' | 'en';

export const LANGUAGES: { code: Lang; short: string; label: string; htmlLang: string }[] = [
  { code: 'uz', short: 'O‘z', label: 'O‘zbekcha', htmlLang: 'uz' },
  { code: 'uz-Cyrl', short: 'Ўз', label: 'Ўзбекча', htmlLang: 'uz-Cyrl' },
  { code: 'ru', short: 'Ру', label: 'Русский', htmlLang: 'ru' },
  { code: 'en', short: 'En', label: 'English', htmlLang: 'en' },
];

const STORAGE_KEY = 'phoenix-lang';

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let text = key;
  if (lang === 'uz-Cyrl') {
    text = toCyrillic(key);
  } else if (lang === 'ru' || lang === 'en') {
    text = DICTIONARIES[lang][key] ?? key;
  }
  return interpolate(text, vars);
}

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'uz' || v === 'uz-Cyrl' || v === 'ru' || v === 'en') return v;
  } catch {
    /* localStorage yopiq bo'lishi mumkin */
  }
  return 'uz';
}

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunction;
  /** Sana uchun locale (Intl) */
  locale: string;
};

const defaultValue: LanguageContextValue = {
  lang: 'uz',
  setLang: () => undefined,
  t: (key, vars) => interpolate(key, vars),
  locale: 'uz-UZ',
};

const LanguageContext = createContext<LanguageContextValue>(defaultValue);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang());

  useEffect(() => {
    const meta = LANGUAGES.find((l) => l.code === lang);
    document.documentElement.lang = meta?.htmlLang || 'uz';
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      locale: lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'uz-UZ',
    }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useT(): LanguageContextValue {
  return useContext(LanguageContext);
}
