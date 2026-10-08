import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Forma qoralamasini brauzerda avtomatik saqlash (sahifa yopilsa ham yo'qolmaydi).
 * Fayllar saqlanmaydi — faqat matnli maydonlar. Saqlash 600 ms kechikish bilan.
 *
 *   const draft = useFormDraft('submit-article', userId, data, { enabled: true });
 *   draft.restored   — tiklangan qoralama (bir marta, sahifa ochilganda)
 *   draft.savedAt    — oxirgi saqlangan vaqt
 *   draft.clear()    — muvaffaqiyatli yuborilgandan keyin o'chirish
 */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

type Stored<T> = { v: 1; savedAt: number; data: T };

export function draftStorageKey(name: string, userId?: string | number | null): string {
  return `phoenix-draft:${name}:${userId ?? 'anon'}`;
}

export function readDraft<T>(key: string): Stored<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    if (!parsed || parsed.v !== 1 || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function useFormDraft<T>(
  name: string,
  userId: string | number | null | undefined,
  data: T,
  options: { enabled?: boolean; isEmpty?: (d: T) => boolean } = {},
) {
  const { enabled = true, isEmpty } = options;
  const key = draftStorageKey(name, userId);
  const [restored] = useState<Stored<T> | null>(() => (enabled ? readDraft<T>(key) : null));
  const [savedAt, setSavedAt] = useState<number | null>(restored?.savedAt ?? null);
  const timer = useRef<number | null>(null);
  const skipFirst = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    // Birinchi render — tiklangan qiymatni qayta yozmaymiz
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        if (isEmpty && isEmpty(data)) {
          localStorage.removeItem(key);
          setSavedAt(null);
          return;
        }
        const now = Date.now();
        localStorage.setItem(key, JSON.stringify({ v: 1, savedAt: now, data } satisfies Stored<T>));
        setSavedAt(now);
      } catch {
        /* xotira to'la yoki yopiq — forma ishlashda davom etadi */
      }
    }, 600);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [data, enabled, key, isEmpty]);

  const clear = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setSavedAt(null);
  }, [key]);

  return { restored, savedAt, clear };
}
