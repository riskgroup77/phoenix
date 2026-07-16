/**
 * Barcha frontend modullari uchun yagona API bazaviy URL.
 * Production build: avvalo VITE_API_BASE_URL / VITE_MEDIA_URL (staging va boshqa domenlar uchun).
 */
export const isProductionHost =
  import.meta.env.PROD ||
  (typeof window !== 'undefined' &&
    (window.location.hostname === 'ilmiyfaoliyat.uz' ||
      window.location.hostname === 'www.ilmiyfaoliyat.uz'));

function normalizeApiV1Base(raw: string): string {
  const t = raw.trim().replace(/\/+$/, '');
  if (!t) return '';
  return t.endsWith('/api/v1') ? t : `${t}/api/v1`;
}

function normalizeMediaBase(raw: string): string {
  const t = raw.trim().replace(/\/+$/, '');
  if (!t) return '';
  return t.endsWith('/media') ? `${t}/` : `${t}/media/`;
}

const envApi = typeof import.meta.env.VITE_API_BASE_URL === 'string' ? import.meta.env.VITE_API_BASE_URL : '';
const envMedia = typeof import.meta.env.VITE_MEDIA_URL === 'string' ? import.meta.env.VITE_MEDIA_URL : '';

export const API_V1_BASE_URL = envApi
  ? normalizeApiV1Base(envApi)
  : isProductionHost
    ? 'https://api.ilmiyfaoliyat.uz/api/v1'
    : 'http://127.0.0.1:8000/api/v1';

export const API_MEDIA_BASE_URL = envMedia
  ? normalizeMediaBase(envMedia)
  : isProductionHost
    ? 'https://api.ilmiyfaoliyat.uz/media/'
    : 'http://127.0.0.1:8000/media/';
