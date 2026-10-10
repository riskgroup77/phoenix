import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'phoenix_chunk_reload_at';

/** Yangi deploydan keyin eski chunk fayllari serverda qolmaydi — «Failed to fetch dynamically imported module». */
export const isChunkLoadError = (err: unknown): boolean => {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? '');
  return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically/i.test(msg);
};

const readReloadAt = (): number => {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY) || 0);
  } catch {
    return 0;
  }
};

/**
 * React.lazy + deploydan keyingi chunk xatosida sahifani bir marta qayta yuklash
 * (60 soniya ichida takrorlansa — cheksiz qayta yuklanmasin, xato ErrorBoundary ga chiqadi).
 */
export function lazyPage<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (typeof window !== 'undefined' && isChunkLoadError(err) && Date.now() - readReloadAt() > 60_000) {
        try {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        } catch {
          /* sessionStorage yopiq */
        }
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    }
  });
}
