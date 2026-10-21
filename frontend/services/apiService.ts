/**
 * API Service for Phoenix Scientific Platform
 * Handles all HTTP requests to the backend
 */

import { formatDrfValidationErrors, getUserFriendlyError, isAuthError } from '../utils/errorHandler';
import { API_V1_BASE_URL, API_MEDIA_BASE_URL, isProductionHost } from '../config/apiBase';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isCookieMode,
  setAccessToken,
  storeLoginTokens,
} from '../utils/authTokens';

/** @deprecated Use API_V1_BASE_URL — nom mosligi uchun */
const API_BASE_URL = API_V1_BASE_URL;
const MEDIA_URL = API_MEDIA_BASE_URL;

if (typeof window !== 'undefined' && !isProductionHost) {
  console.log(`[API] API_BASE_URL: ${API_BASE_URL}`);
}

// Tokenlar: productionda access — xotirada, refresh — HttpOnly cookie'da (utils/authTokens.ts)
const getToken = () => getAccessToken();
const setToken = (token: string) => setAccessToken(token);
const removeToken = () => clearTokens();

/** Login/register: eski Bearer yuborilmasin (noto‘g‘ri JWT 401 berishi mumkin). */
function isPublicAuthEndpoint(endpoint: string): boolean {
  return (
    endpoint.startsWith('/auth/login/') ||
    endpoint.startsWith('/auth/register/')
  );
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * SimpleJWT refresh — parallel so‘rovlarda bitta marta bajariladi.
 */
export async function refreshAccessTokenFromApi(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = getRefreshToken();
  // Cookie rejimida refresh token HttpOnly cookie'da — so'rov tanasiz yuboriladi
  if (!refresh && !isCookieMode()) {
    return false;
  }
  refreshInFlight = (async (): Promise<boolean> => {
    try {
      const r = await fetch(`${API_BASE_URL}/token/refresh/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(refresh ? { refresh } : {}),
      });
      const text = await r.text();
      const data = (text ? JSON.parse(text) : {}) as { access?: string; refresh?: string };
      if (!r.ok || !data.access) {
        return false;
      }
      setToken(data.access);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// Base fetch with authentication
export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {},
  _isRetryAfterRefresh = false
): Promise<any> => {
  const token = getToken();
  const publicAuth = isPublicAuthEndpoint(endpoint);

  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = new Headers(options.headers || {});

  // Let browser set multipart boundary for FormData requests
  if (!isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization') && !publicAuth) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // Interfeys tili: backend hujjatlarni (ma'lumotnoma, sertifikat, chek) shu tilda shakllantiradi
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', uiLang());
  }
  // CSRF himoyasi: cookie bilan autentifikatsiyada backend o'zgartiruvchi so'rovlarda shu sarlavhani talab qiladi
  // (boshqa saytdagi forma yoki skript uni qo'ya olmaydi — CORS preflight bloklaydi)
  if (!publicAuth && !headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }

  // Login/register: maxsus sarlavha qo‘ymaslik — CORS preflight sodda bo‘ladi (x-request-id ba’zi serverlarda bloklangan).
  if (
    !publicAuth &&
    !headers.has('X-Request-ID') &&
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    headers.set('X-Request-ID', crypto.randomUUID());
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: options.credentials ?? 'include',
  };

  try {
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    if (!isProductionHost) {
      console.log(`[API] Request: ${options.method || 'GET'} ${fullUrl}`);
    }
    const response = await fetch(fullUrl, config);

    if (response.status === 401) {
      if (publicAuth) {
        const errorText = await response.text();
        let error: Record<string, unknown> = {};
        try {
          error = errorText ? JSON.parse(errorText) : {};
        } catch {
          error = { detail: errorText || 'Kirish rad etildi' };
        }
        const errorMessage = getUserFriendlyError({ response: error, status: 401 });
        const apiError: Error & { status?: number; response?: unknown } = new Error(errorMessage);
        apiError.status = 401;
        apiError.response = error;
        throw apiError;
      }
      if (!_isRetryAfterRefresh) {
        const refreshed = await refreshAccessTokenFromApi();
        if (refreshed) {
          const newHeaders = new Headers(options.headers || {});
          if (!isFormDataBody && !newHeaders.has('Content-Type')) {
            newHeaders.set('Content-Type', 'application/json');
          }
          const newToken = getToken();
          if (newToken) {
            newHeaders.set('Authorization', `Bearer ${newToken}`);
          }
          return apiFetch(endpoint, { ...options, headers: newHeaders }, true);
        }
      }
      removeToken();
      const err: Error & { status?: number } = new Error(
        'Sizning sessiyangiz muddati tugagan. Iltimos, qayta kiring.'
      );
      err.status = 401;
      window.location.href = '/#/login';
      throw err;
    }

    if (!response.ok) {
      const errorText = await response.text();
      let error: any;
      
      // Try to parse as JSON
      try {
        error = JSON.parse(errorText);
      } catch (e) {
        // If not JSON, check if it's HTML (Django error page)
        if (errorText.includes('<!DOCTYPE html>') || errorText.includes('<html')) {
          // Extract error message from HTML if possible
          const errorMatch = errorText.match(/<pre class="exception_value">(.*?)<\/pre>/s);
          if (errorMatch) {
            error = { detail: errorMatch[1].trim(), html: true };
          } else {
            error = { detail: `Server xatosi (Status: ${response.status})`, html: true };
          }
        } else {
          error = { detail: errorText || 'Noma\'lum xatolik' };
        }
      }
      
      // Use centralized error handler for user-friendly messages
      const errorMessage = getUserFriendlyError({ response: error, status: response.status });
      
      const apiError: any = new Error(errorMessage);
      apiError.status = response.status;
      apiError.response = error;
      throw apiError;
    }

    const text = await response.text();
    
    if (!text) {
      return {};
    }

    try {
      const data = JSON.parse(text);
      return data;
    } catch (e) {
      throw new Error('Invalid response format');
    }
  } catch (error: any) {
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    const isSessionExpired = error?.status === 401 || error?.message?.includes('sessiya');
    const isForbiddenExpected = error?.status === 403 && (error?.message?.includes('huquq') || error?.message?.includes('egasiz'));
    if (!isProductionHost && !isSessionExpired && !isForbiddenExpected) {
      console.error(`[API] Request failed:`, fullUrl, error?.message || error);
    }
    
    // Network error handling - agar fetch xatolik bersa
    if (error?.name === 'TypeError' && (error?.message?.includes('fetch') || error?.message?.includes('Failed'))) {
      const networkError: any = new Error('Serverga ulanib bo\'lmadi.');
      networkError.name = 'NetworkError';
      networkError.code = 'NETWORK_ERROR';
      networkError.originalError = error;
      networkError.url = fullUrl;
      throw networkError;
    }
    
    // CORS error handling
    if (error?.message?.includes('CORS') || error?.message?.includes('cors')) {
      const corsError: any = new Error('Server CORS sozlamalari noto\'g\'ri. Iltimos, administratorga murojaat qiling.');
      corsError.name = 'CORS_ERROR';
      corsError.code = 'CORS_ERROR';
      throw corsError;
    }
    
    // Agar error allaqachon formatlangan bo'lsa, uni qaytarish
    throw error;
  }
};

/**
 * Autentifikatsiyali fayl yuklab olish (PDF chek, Crossref XML va h.k.).
 * 401 bo'lsa tokenni bir marta yangilab qayta urinadi.
 */
/** Joriy interfeys tili (LanguageContext bilan bir xil kalit) — hujjatlar shu tilda yaratiladi */
export const uiLang = (): string => {
  try {
    const v = localStorage.getItem('phoenix-lang');
    if (v === 'uz' || v === 'uz-Cyrl' || v === 'ru' || v === 'en') return v;
  } catch {
    /* localStorage yopiq */
  }
  return 'uz';
};

export const fetchAuthedBlob = async (endpoint: string): Promise<Blob> => {
  const run = () => {
    const token = getToken();
    return fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { 'Accept-Language': uiLang(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
    });
  };
  let res = await run();
  if (res.status === 401 && (await refreshAccessTokenFromApi())) {
    res = await run();
  }
  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.detail || data?.error || '';
    } catch {
      /* fayl emas */
    }
    throw new Error(detail || "Faylni yuklab bo'lmadi");
  }
  return res.blob();
};

export const saveBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

export const downloadAuthed = async (endpoint: string, filename: string): Promise<void> => {
  saveBlob(await fetchAuthedBlob(endpoint), filename);
};

/** Sahifalash havolasi (`next` — to'liq URL) → apiFetch endpointi */
function nextEndpoint(next: string): string {
  const i = next.indexOf('/api/v1');
  return i >= 0 ? next.slice(i + '/api/v1'.length) : next;
}

/**
 * DRF sahifalangan ro'yxatni TO'LIQ yig'adi (`next` bo'yicha, har sahifada 200 tadan).
 * Avval ro'yxatlar faqat birinchi 20 ta yozuvni olardi: "Moliya" jami tushumi, foydalanuvchilar, jurnallar
 * (21-jurnal tanlansa maqola to'lovsiz qoralamada qotib qolardi), son tarkibi va boshqalar noto'g'ri edi.
 * Sahifalanmagan (massiv) javob ham qabul qilinadi.
 */
// Qaytish turi `any`: chaqiruvchilar eski `{ results }` va massiv javoblarni ham qo'llaydi
export async function fetchAllPages<T = any>(endpoint: string, maxPages = 100): Promise<any> {
  const sep = endpoint.includes('?') ? '&' : '?';
  let url: string | null = /[?&]page_size=/.test(endpoint) ? endpoint : `${endpoint}${sep}page_size=200`;
  const out: T[] = [];
  for (let i = 0; url && i < maxPages; i += 1) {
    const data = await apiFetch(url);
    if (Array.isArray(data)) return data as T[];
    out.push(...((data?.results ?? []) as T[]));
    url = data?.next ? nextEndpoint(String(data.next)) : null;
  }
  return out;
}

/**
 * Fayl (multipart) yuboradigan so'rovlar uchun: apiFetch bilan bir xil autentifikatsiya — cookie, CSRF sarlavhasi
 * va 401 da tokenni yangilash. Avval xom fetch ishlatilardi: productionda (cookie rejimi) sahifa yangilangandan
 * keyin access token xotirada bo'lmagani va cookie yuborilmagani uchun maqola/kitob/DOI yuborish 401 berardi.
 */
export const apiUpload = (endpoint: string, formData: FormData, method: 'POST' | 'PATCH' | 'PUT' = 'POST') =>
  apiFetch(endpoint, { method, body: formData });

// API Service
export const apiService = {
  // Authentication
  auth: {
    login: async (phone: string, password: string) => {
      const data = await apiFetch('/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
      });
      if (data.access || data.cookie_auth) storeLoginTokens(data);
      return data;
    },

    register: async (userData: any) => {
      const data = await apiFetch('/auth/register/', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      if (data.access || data.cookie_auth) storeLoginTokens(data);
      return data;
    },

    /** Ro'yxatdan o'tish (Telegram orqali): ma'lumotlar tekshiriladi, bot havolasi qaytadi */
    registerStart: (userData: Record<string, unknown>): Promise<{ deep_link: string; token: string; expires_in: number }> =>
      apiFetch('/auth/register/start/', { method: 'POST', body: JSON.stringify(userData) }),

    /** Botdan olingan 4 xonali kod bilan hisobni yaratish (javobda login tokenlari) */
    registerConfirm: async (token: string, code: string) => {
      const data = await apiFetch('/auth/register/confirm/', {
        method: 'POST',
        body: JSON.stringify({ token, code }),
      });
      if (data.access || data.cookie_auth) storeLoginTokens(data);
      return data;
    },

    logout: async () => {
      const refresh = getRefreshToken();
      try {
        await fetch(`${API_BASE_URL}/auth/logout/`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          },
          body: JSON.stringify(refresh ? { refresh } : {}),
        });
      } catch {
        /* ignore network errors on logout */
      }
      removeToken();
    },

    getProfile: () => apiFetch('/auth/profile/'),
    /** Profil rasmi (JPG/PNG/WEBP, 5 MB gacha) — server Pillow bilan tekshiradi */
    uploadAvatar: (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      return apiFetch('/auth/avatar/', { method: 'POST', body: formData });
    },
    deleteAvatar: () => apiFetch('/auth/avatar/', { method: 'DELETE' }),

    /** Telefonni Telegram orqali tasdiqlash: bot havolasini oladi */
    phoneVerifyStart: (): Promise<{ deep_link?: string; expires_in?: number; already_verified?: boolean }> =>
      apiFetch('/auth/phone-verify/start/', { method: 'POST', body: '{}' }),
    phoneVerifyStatus: (): Promise<{ phone_verified: boolean }> => apiFetch('/auth/phone-verify/status/'),

    /** Parolni tiklash (Telegram orqali): avval bot havolasi, keyin bir martalik havola bilan yangi parol */
    passwordResetStart: (phone: string): Promise<{ deep_link: string; expires_in: number }> =>
      apiFetch('/auth/password-reset/start/', { method: 'POST', body: JSON.stringify({ phone }) }),
    passwordResetConfirm: (token: string, password: string, passwordConfirm: string) =>
      apiFetch('/auth/password-reset/confirm/', {
        method: 'POST',
        body: JSON.stringify({ token, password, password_confirm: passwordConfirm }),
      }),

    /** Maxfiylik: o'z ma'lumotlarining nusxasi (JSON) */
    myDataExport: () => apiFetch('/auth/my-data/'),

    /** Maxfiylik: hisobni o'chirish so'rovi (super adminlarga yuboriladi) */
    accountDeletionRequest: (reason: string) =>
      apiFetch('/auth/delete-request/', { method: 'POST', body: JSON.stringify({ reason }) }),

    /** Muallifning arxiv hujjatlari: maqolalar, UDK, sertifikatlar, taqriz natijalari. */
    getArchive: () => apiFetch('/auth/archive/'),

    updateProfile: (userData: any) =>
      apiFetch('/auth/update_profile/', {
        method: 'PUT',
        body: JSON.stringify(userData),
      }),

    stats: () => apiFetch('/auth/stats/'),

    /**
     * JWT access yangilash (SimpleJWT). Refresh token alohida yuboriladi.
     */
    refreshAccessToken: async () => {
      const refresh = getRefreshToken();
      if (!refresh && !isCookieMode()) {
        throw new Error('Refresh token yo\'q');
      }
      const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(refresh ? { refresh } : {}),
      });
      const text = await response.text();
      let data: { access?: string; detail?: string };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error('Token yangilash javobi noto\'g\'ri');
      }
      if (!response.ok) {
        const err: Error & { status?: number } = new Error(data.detail || 'Sessiya yangilanmadi');
        err.status = response.status;
        throw err;
      }
      if (data.access) {
        setToken(data.access);
      }
      return data;
    },
  },

  // Users
  users: {
    /** Barcha foydalanuvchilar (barcha sahifalar). */
    listAll: (): Promise<any[]> => fetchAllPages('/auth/'),
    /** @param params masalan { role: 'journal_admin' } — DRF sahifalashda barcha jurnal adminlarni olish uchun */
    list: (params?: Record<string, string>) =>
      fetchAllPages(params && Object.keys(params).length ? `/auth/?${new URLSearchParams(params)}` : '/auth/'),

    get: (id: string) => apiFetch(`/auth/${id}/`),

    create: (userData: any) =>
      apiFetch('/auth/', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),

    update: (id: string, userData: any) =>
      apiFetch(`/auth/${id}/`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      }),

    /** Faolsizlantirilgan hisobni qayta faollashtirish (faqat bosh admin) */
    setActive: (id: string, isActive: boolean) =>
      apiFetch(`/auth/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      }),

    /** Hisobni faolsizlantirish (arxivlash) — tasdiq: bosh adminning o'z paroli */
    delete: (id: string, password: string) =>
      apiFetch(`/auth/${id}/`, {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      }),

    /** User activity, stats and history (super_admin only). */
    activity: (id: string) => apiFetch(`/auth/${id}/activity/`),
      
    stats: () => apiFetch('/auth/stats/'),
  },

  // Muallif AI yordamchisi (backend apps/assistant)
  assistant: {
    listConversations: () => apiFetch('/assistant/conversations/'),
    createConversation: (title = '') =>
      apiFetch('/assistant/conversations/', { method: 'POST', body: JSON.stringify({ title }) }),
    getConversation: (id: string) => apiFetch(`/assistant/conversations/${id}/`),
    renameConversation: (id: string, title: string) =>
      apiFetch(`/assistant/conversations/${id}/`, { method: 'PATCH', body: JSON.stringify({ title }) }),
    deleteConversation: (id: string) => apiFetch(`/assistant/conversations/${id}/`, { method: 'DELETE' }),
    sendMessage: (id: string, payload: { text: string; lang: string; file?: File | null }) => {
      const body = new FormData();
      body.append('text', payload.text);
      body.append('lang', payload.lang);
      if (payload.file) body.append('file', payload.file);
      return apiFetch(`/assistant/conversations/${id}/messages/`, { method: 'POST', body });
    },
  },

  // Articles
  articles: {
    /** Crossref: sozlama holati va DOI (faqat nashr etilgan maqola, admin) */
    crossrefInfo: (id: string) => apiFetch(`/articles/${id}/crossref/?info=1`),
    crossrefXml: (id: string) => downloadAuthed(`/articles/${id}/crossref/`, `crossref-${id.slice(0, 8)}.xml`),
    crossrefDeposit: (id: string) => apiFetch(`/articles/${id}/crossref/`, { method: 'POST' }),
    /** Maqola namuna: 1 bet narxlari (quyi/orta/yuqori). */
    getArticleSamplePrice: () => apiFetch('/articles/article-sample/price/'),
    /** Maqola namuna so'rovi yaratadi, tranzaksiya qaytaradi (to'lov sahifasiga yo'naltirish uchun). */
    createArticleSampleRequest: (data: {
      requirements: string;
      pages: number;
      topic: string;
      quality_level: 'quyi' | 'orta' | 'yuqori';
      first_name: string;
      last_name: string;
    }) =>
      apiFetch('/articles/article-sample/request/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    list: (params?: Record<string, string>) =>
      fetchAllPages(params && Object.keys(params).length ? `/articles/?${new URLSearchParams(params)}` : '/articles/'),

    /** Muallifning barcha maqolalari (Draft/Yangi) — paginatsiya muammosiz */
    mine: () => apiFetch('/articles/mine/'),

    /** Bosh admin / jurnal admin / operator — barcha maqolalar (paginatsiyasiz) */
    staff: () => apiFetch('/articles/staff/'),

    /**
     * Rol bo'yicha to'liq maqolalar ro'yxati (staff/mine yoki paginatsiyali list).
     */
    listAllForRole: async (role: string): Promise<unknown[]> => {
      const parseBatch = (raw: unknown): unknown[] => {
        if (Array.isArray(raw)) return raw;
        if (!raw || typeof raw !== 'object') return [];
        const o = raw as {
          results?: unknown[];
          data?: unknown[] | { results?: unknown[]; items?: unknown[] };
          items?: unknown[];
        };
        if (Array.isArray(o.results)) return o.results;
        if (Array.isArray(o.items)) return o.items;
        const nested = o.data;
        if (Array.isArray(nested)) return nested;
        if (nested && typeof nested === 'object') {
          const n = nested as { results?: unknown[]; items?: unknown[] };
          if (Array.isArray(n.results)) return n.results;
          if (Array.isArray(n.items)) return n.items;
        }
        return [];
      };

      const r = String(role || '').toLowerCase();
      if (r === 'author') {
        return parseBatch(await apiService.articles.mine());
      }
      const staffRoles = ['super_admin', 'superadmin', 'journal_admin', 'journaladmin', 'operator', 'accountant'];
      if (staffRoles.includes(r)) {
        try {
          return parseBatch(await apiService.articles.staff());
        } catch {
          /* eski backend */
        }
      }

      const pageSize = 200;
      const merged: unknown[] = [];
      let page = 1;
      while (page <= 40) {
        const raw = await apiService.articles.list({
          page_size: String(pageSize),
          page: String(page),
        });
        const batch = parseBatch(raw);
        merged.push(...batch);
        if (Array.isArray(raw)) break;
        const nextUrl = (raw as { next?: string | null })?.next;
        if (!nextUrl || batch.length === 0 || batch.length < pageSize) break;
        page += 1;
      }
      if (merged.length === 0) {
        return parseBatch(await apiService.articles.list());
      }
      return merged;
    },

    get: (id: string) => apiFetch(`/articles/${id}/`),

    getPublic: (id: string) => apiFetch(`/articles/public/${id}/`),
    /** Joriy sozlamalarda haqiqatan tekshiriladigan antiplagiat modullari */
    antiplagiatModules: () => apiFetch('/articles/antiplagiat-modules/'),

    /** Fayldagi sahifalar soni — server narxni aynan shu bo'yicha oladi */
    pageCount: (file: File): Promise<{ pages: number | null; detected: boolean }> => {
      const form = new FormData();
      form.append('file', file);
      return apiUpload('/articles/page-count/', form);
    },

    /** Hujjat holati haqida ma'lumotnoma (PDF, interfeys tilida) — maqola, antiplagiat, UDK, DOI */
    referencePdf: (kind: 'article' | 'udk_request' | 'udk_certificate' | 'doi', id: string | number) =>
      fetchAuthedBlob(`/articles/reports/reference/?${new URLSearchParams({ kind, id: String(id), lang: uiLang() })}`),

    /** Barcha ilmiy ishlar (articleId bo'lsa — bitta ish) bo'yicha ma'lumotnoma: PDF yoki DOCX */
    worksReport: (params: { format: 'pdf' | 'docx'; articleId?: string; workplace?: string; position?: string }) => {
      const q = new URLSearchParams({ fmt: params.format, lang: uiLang() });
      if (params.articleId) q.set('article', params.articleId);
      if (params.workplace) q.set('workplace', params.workplace);
      if (params.position) q.set('position', params.position);
      return fetchAuthedBlob(`/articles/reports/works/?${q.toString()}`);
    },

    /** Muallif maqolalar ro'yxati PDF — QR uchun imzoli to'g'ridan-to'g'ri PDF havolasi */
    getAuthorMalumotnomaSignedUrl: () =>
      apiFetch('/articles/reports/author-malumotnoma-signed-url/'),

    create: async (articleData: any, files?: { mainFile?: File, additionalFile?: File }) => {
      if (files && (files.mainFile || files.additionalFile)) {
        // Use FormData for file uploads
        const formData = new FormData();
        
        // Add all article data fields
        Object.keys(articleData).forEach(key => {
          const value = articleData[key];
          if (value !== null && value !== undefined) {
            if (key === 'journal') {
              let jid = '';
              if (typeof value === 'object' && value !== null) {
                const o = value as Record<string, unknown>;
                jid = String(o.id ?? o.uuid ?? o.pk ?? '').trim();
              } else {
                jid = String(value).trim();
              }
              if (jid) formData.append(key, jid);
              return;
            }
            if (Array.isArray(value)) {
              // Handle arrays by stringifying them
              formData.append(key, JSON.stringify(value));
            } else if (typeof value === 'object') {
              formData.append(key, JSON.stringify(value));
            } else {
              formData.append(key, value);
            }
          }
        });
        
        // Add files if provided
        if (files.mainFile) {
          formData.append('final_pdf_path', files.mainFile);
        }
        if (files.additionalFile) {
          formData.append('additional_document_path', files.additionalFile);
        }
        
        try {
          return await apiUpload('/articles/', formData);
        } catch (err: any) {
          // Maydon xatolarini o'qiladigan ko'rinishda ("Fayl: ...") ko'rsatish
          const drfMsg = err?.response ? formatDrfValidationErrors(err.response) : '';
          if (drfMsg) err.message = drfMsg;
          throw err;
        }
      } else {
        // Regular JSON request
        return apiFetch('/articles/', {
          method: 'POST',
          body: JSON.stringify(articleData),
        });
      }
    },

    update: async (id: string, articleData: any, files?: { mainFile?: File, additionalFile?: File }) => {
      if (files && (files.mainFile || files.additionalFile)) {
        // Use FormData for file uploads
        const formData = new FormData();
        
        // Add all article data fields
        Object.keys(articleData).forEach(key => {
          const value = articleData[key];
          if (value !== null && value !== undefined) {
            if (key === 'journal') {
              let jid = '';
              if (typeof value === 'object' && value !== null) {
                const o = value as Record<string, unknown>;
                jid = String(o.id ?? o.uuid ?? o.pk ?? '').trim();
              } else {
                jid = String(value).trim();
              }
              if (jid) formData.append(key, jid);
              return;
            }
            if (Array.isArray(value)) {
              // Convert arrays to JSON strings
              formData.append(key, JSON.stringify(value));
            } else if (typeof value === 'object') {
              formData.append(key, JSON.stringify(value));
            } else {
              formData.append(key, value);
            }
          }
        });
        
        // Add files if present
        if (files.mainFile) {
          formData.append('final_pdf_path', files.mainFile);
        }
        if (files.additionalFile) {
          formData.append('additional_document_path', files.additionalFile);
        }
        
        return apiUpload(`/articles/${id}/`, formData, 'PUT');
      } else {
        // Regular JSON request
        return apiFetch(`/articles/${id}/`, {
          method: 'PUT',
          body: JSON.stringify(articleData),
        });
      }
    },

    patch: (id: string, data: Partial<Record<string, unknown>>) =>
      apiFetch(`/articles/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiFetch(`/articles/${id}/`, {
        method: 'DELETE',
      }),

    /** Qoralamani qisman tahrirlash; yangi fayl berilsa alohida multipart so'rov bilan yuklanadi. */
    patchDraft: async (id: string, data: { title?: string; abstract?: string; keywords?: string[] }, mainFile?: File | null) => {
      let result: any = await apiFetch(`/articles/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
      if (!mainFile) return result;
      const formData = new FormData();
      formData.append('final_pdf_path', mainFile);
      const token = getToken();
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${API_BASE_URL}/articles/${id}/`, {
        method: 'PATCH',
        headers,
        body: formData,
        credentials: 'include',
      });
      const text = await response.text();
      try { result = text ? JSON.parse(text) : result; } catch { result = { detail: text }; }
      if (!response.ok) {
        throw new Error(result?.detail || result?.message || `API request failed with status ${response.status}`);
      }
      return result;
    },

    incrementViews: (id: string) =>
      apiFetch(`/articles/${id}/increment_views/`, {
        method: 'POST',
      }),

    incrementDownloads: (id: string) =>
      apiFetch(`/articles/${id}/increment_downloads/`, {
        method: 'POST',
      }),

    /** Muallif tuzatilgan faylni yuklaydi (PATCH — PUT barcha maydonlarni talab qiladi). */
    replaceFile: (id: string, file: File) => {
      const formData = new FormData();
      formData.append('final_pdf_path', file);
      return apiFetch(`/articles/${id}/`, { method: 'PATCH', body: formData });
    },
    updateStatus: (id: string, status: string, reason?: string) =>
      apiFetch(`/articles/${id}/update_status/`, {
        method: 'POST',
        body: JSON.stringify({ status, reason }),
      }),

    checkPlagiarism: (
      id: string,
      options?: { enabledModules?: string[]; force?: boolean },
    ) => {
      const clean = String(id ?? '')
        .trim()
        .replace(/^["']|["']$/g, '');
      if (!clean || clean === 'undefined' || clean === 'null') {
        return Promise.reject(new Error('Maqola identifikatori yo\'q. Sahifani yangilab, qayta urinib ko\'ring.'));
      }
      const body: Record<string, unknown> = {};
      if (options?.enabledModules?.length) {
        body.enabled_modules = options.enabledModules;
      }
      if (options?.force) {
        body.force = true;
      }
      return apiFetch(`/articles/${clean}/check_plagiarism/`, {
        method: 'POST',
        body: Object.keys(body).length ? JSON.stringify(body) : undefined,
      });
    },

    savePlagiarismConfig: (
      id: string,
      config: {
        enabled_modules?: string[];
        document_type?: string;
        document_name?: string;
        author_first_name?: string;
        author_last_name?: string;
      },
    ) =>
      apiFetch(`/articles/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          plagiarism_report: {
            pending_enabled_modules: config.enabled_modules || [],
            document_type: config.document_type || '',
            document_name: config.document_name || '',
            author_first_name: config.author_first_name || '',
            author_last_name: config.author_last_name || '',
          },
        }),
      }),

    /** Nashr qilish: sertifikat yuklash, status Published, muallifga bildirishnoma */
    completePublication: (id: string, formData: FormData) =>
      apiUpload(`/articles/${id}/complete_publication/`, formData),

    /** Nashr etilgan maqola: havola va/yoki sertifikat, muallifga bildirishnoma */
    sendPublicationDelivery: (id: string, formData: FormData) =>
      apiUpload(`/articles/${id}/send_publication_delivery/`, formData),

    /** DOI so'rovlari ro'yxati (operator uchun) */
    getDoiRequests: () => fetchAllPages('/articles/doi/requests/'),

    /** Maqola namuna so'rovlari ro'yxati (operator uchun) */
    getArticleSampleRequests: () => fetchAllPages('/articles/article-sample/requests/'),

    /** Muallif ↔ operator chat: oxirgi faol yozishmalar (faqat operator) */
    getOperatorChatInbox: () => apiFetch('/articles/operator-chat-inbox/'),

    getOperatorChatMessages: (articleId: string) =>
      apiFetch(`/articles/${articleId}/operator-chat/`),

    sendOperatorChatMessage: (articleId: string, body: string) =>
      apiFetch(`/articles/${articleId}/operator-chat/`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
  },

  // DOI raqami olish
  doi: {
    price: () => apiFetch('/articles/doi/price/'),
    request: (formData: FormData) => apiUpload('/articles/doi/request/', formData),
    list: () => fetchAllPages('/articles/doi/requests/'),
    updateLink: (id: string, doi_link: string) =>
      apiFetch(`/articles/doi/requests/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ doi_link }),
      }),
  },

  /** Maqola namuna so'rovlari (taqrizchi: barcha, muallif: o'zini) */
  articleSample: {
    list: () => fetchAllPages('/articles/article-sample/requests/'),
    /** Taqrizchi so'rovni ishga oladi */
    take: (id: string) => apiFetch(`/articles/article-sample/requests/${id}/take/`, { method: 'POST' }),
    /** Tayyor namuna faylini yuklash — muallifga bildirishnoma boradi */
    complete: (id: string, file: File, note: string) => {
      const fd = new FormData();
      fd.append('result_file', file);
      fd.append('reviewer_note', note);
      return apiUpload(`/articles/article-sample/requests/${id}/complete/`, fd);
    },
  },

  // Journals
  journals: {
    listCategories: () => apiFetch('/journals/categories/'),
    
    list: (opts?: { pageSize?: number; page?: number }) => {
      const params = new URLSearchParams();
      if (opts?.pageSize != null) params.set('page_size', String(opts.pageSize));
      if (opts?.page != null) params.set('page', String(opts.page));
      const qs = params.toString();
      // Sahifa so'ralmasa — barcha jurnallar (avval faqat 20 tasi kelardi)
      return qs ? apiFetch(`/journals/journals/?${qs}`) : fetchAllPages('/journals/journals/');
    },
    
    get: (id: string) => apiFetch(`/journals/journals/${id}/`),
    
    create: async (journalData: any, imageFile?: File) => {
      
      if (imageFile) {
        // Use FormData for file uploads
        const formData = new FormData();
        
        // Add all journal data fields
        Object.keys(journalData).forEach(key => {
          const value = journalData[key];
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              // Convert arrays to JSON strings
              formData.append(key, JSON.stringify(value));
            } else if (typeof value === 'object') {
              formData.append(key, JSON.stringify(value));
            } else {
              formData.append(key, value);
            }
          }
        });
        
        // Add the image file
        formData.append('image_url', imageFile);
        
        return apiUpload(`/journals/journals/`, formData);
      } else {
        // Regular JSON request
        return apiFetch('/journals/journals/', {
          method: 'POST',
          body: JSON.stringify(journalData),
        });
      }
    },
    
    /** Qisman yangilash (PUT barcha majburiy maydonlarni talab qiladi). Kalitlar snake_case. */
    patch: async (id: string, data: Record<string, unknown>) =>
      apiFetch(`/journals/journals/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),

    update: async (id: string, journalData: any, imageFile?: File) => {
      
      if (imageFile) {
        // Use FormData for file uploads
        const formData = new FormData();
        
        // Add all journal data fields
        Object.keys(journalData).forEach(key => {
          const value = journalData[key];
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              // Convert arrays to JSON strings
              formData.append(key, JSON.stringify(value));
            } else if (typeof value === 'object') {
              formData.append(key, JSON.stringify(value));
            } else {
              formData.append(key, value);
            }
          }
        });
        
        // Add the image file
        formData.append('image_url', imageFile);
        
        return apiUpload(`/journals/journals/${id}/`, formData, 'PUT');
      } else {
        // Regular JSON request
        return apiFetch(`/journals/journals/${id}/`, {
          method: 'PUT',
          body: JSON.stringify(journalData),
        });
      }
    },
    
    /** Maqolasi bor jurnal o'chirilmaydi — arxivlanadi: javob { archived: true, message } */
    delete: (id: string) =>
      apiFetch(`/journals/journals/${id}/`, {
        method: 'DELETE',
      }),

    /** Arxivlangan jurnalni qayta faollashtirish (bosh admin) */
    restore: (id: string) => apiFetch(`/journals/journals/${id}/restore/`, { method: 'POST' }),
    
    createCategory: (categoryData: any) =>
      apiFetch('/journals/categories/', {
        method: 'POST',
        body: JSON.stringify(categoryData),
      }),
    
    deleteCategory: (id: string) =>
      apiFetch(`/journals/categories/${id}/`, {
        method: 'DELETE',
      }),
    
    listIssues: () => fetchAllPages('/journals/issues/'),
    /** Public issue data for share link (no auth required). */
    getPublicIssue: (id: string) => apiFetch(`/journals/issues/${id}/public/`),
    
    createIssue: async (issueData: any, collectionFile?: File) => {
      if (collectionFile) {
        // Use FormData for file uploads
        const formData = new FormData();
        
        // Add all issue data fields
        Object.keys(issueData).forEach(key => {
          const value = issueData[key];
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              // Convert arrays to JSON strings
              formData.append(key, JSON.stringify(value));
            } else if (typeof value === 'object') {
              formData.append(key, JSON.stringify(value));
            } else {
              formData.append(key, value);
            }
          }
        });
        
        // Add the collection file
        formData.append('collection_file', collectionFile);
        
        return apiUpload(`/journals/issues/`, formData);
      } else {
        // Regular JSON request
        return apiFetch('/journals/issues/', {
          method: 'POST',
          body: JSON.stringify(issueData),
        });
      }
    },
    
    updateIssue: async (id: string, issueData: any, collectionFile?: File) => {
      if (collectionFile) {
        // Use FormData for file uploads
        const formData = new FormData();
        
        // Add all issue data fields
        Object.keys(issueData).forEach(key => {
          const value = issueData[key];
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              // Convert arrays to JSON strings
              formData.append(key, JSON.stringify(value));
            } else if (typeof value === 'object') {
              formData.append(key, JSON.stringify(value));
            } else {
              formData.append(key, value);
            }
          }
        });
        
        // Add the collection file
        formData.append('collection_file', collectionFile);
        
        return apiUpload(`/journals/issues/${id}/`, formData, 'PUT');
      } else {
        // Regular JSON request
        return apiFetch(`/journals/issues/${id}/`, {
          method: 'PUT',
          body: JSON.stringify(issueData),
        });
      }
    },
    
    deleteIssue: (id: string) =>
      apiFetch(`/journals/issues/${id}/`, {
        method: 'DELETE',
      }),
  },

  // Payments
  payments: {
    listTransactions: () => fetchAllPages('/payments/transactions/'),
    /** Faqat joriy foydalanuvchining to'lovlari (To'lovlarim) — xodim rolida ham */
    listMyTransactions: () => fetchAllPages('/payments/transactions/?mine=1'),

    getTransactions: () => fetchAllPages('/payments/transactions/'),

    getTransaction: (id: string) => apiFetch(`/payments/transactions/${id}/`),
    /** Muallif: rad etilgan maqolaning nashr to'lovini qaytarishni so'rash */
    requestRefund: (id: string, reason: string) =>
      apiFetch(`/payments/transactions/${id}/request_refund/`, { method: 'POST', body: JSON.stringify({ reason }) }),
    /** Moliyachi / bosh admin: pul qaytarilganini belgilash */
    markRefunded: (id: string, note: string, viaClick = false) =>
      apiFetch(`/payments/transactions/${id}/mark_refunded/`, {
        method: 'POST',
        body: JSON.stringify({ note, via_click: viaClick }),
      }),

    createTransaction: (transactionData: any) =>
      apiFetch('/payments/transactions/', {
        method: 'POST',
        body: JSON.stringify(transactionData),
      }),

    processPayment: (id: string, provider: 'click' | 'payme' = 'click') =>
      apiFetch(`/payments/transactions/${id}/process_payment/?provider=${provider}`, {
        method: 'POST',
      }),

    preparePayment: (id: string) =>
      apiFetch(`/payments/transactions/${id}/prepare_payment/`, {
        method: 'POST',
      }),

    checkStatus: (id: string) =>
      apiFetch(`/payments/transactions/${id}/check_status/`, {
        method: 'POST',
      }),

    /** Foydalanuvchining to'lovlari bo'yicha jami (xizmatlar kesimida) */
    summary: () => apiFetch('/payments/transactions/summary/'),

    /** To'lov cheki (PDF) — faqat yakunlangan to'lov */
    downloadReceipt: (id: string, receiptNumber?: string) =>
      downloadAuthed(`/payments/transactions/${id}/receipt/`, `${receiptNumber || 'chek'}.pdf`),
  },

  // Analitika, taqrizchi navbati va ochiq bosh sahifa
  analytics: {
    overview: (months = 12) => apiFetch(`/analytics/overview/?months=${months}`),
    workload: () => apiFetch('/analytics/workload/'),
    /** Kirishsiz bosh sahifa: token yuborilmaydi (eskirgan token 401 bermasin) */
    publicOverview: async () => {
      const res = await fetch(`${API_BASE_URL}/analytics/public/`, { credentials: 'omit' });
      if (!res.ok) throw new Error("Ma'lumotlarni yuklab bo'lmadi");
      return res.json();
    },
  },

  /** Ctrl+K global qidiruv */
  search: (q: string) => apiFetch(`/search/?q=${encodeURIComponent(q)}`),

  // UDC (UDK) — Universal Decimal Classification, teacode.com + O'zbekiston
  udc: {
    /** UDK so'rovlari ro'yxati — `udc.requests.list()` bilan bir xil */
    list: () => apiFetch('/udc/requests/'),
    price: () => apiFetch('/udc/price/'),
    root: () => apiFetch('/udc/root/'),
    children: (path: string) => apiFetch(`/udc/children/?path=${encodeURIComponent(path)}`),
    search: (q: string, limit?: number) =>
      apiFetch(`/udc/search/?q=${encodeURIComponent(q)}${limit != null ? `&limit=${limit}` : ''}`),
    /** Maqola uchun (article_id) yoki mustaqil mavzu/fayl (title, abstract, author_name majburiy; file ixtiyoriy). */
    requestDocument: (data: {
      article_id?: string;
      udk_code?: string;
      udk_description?: string;
      title?: string;
      abstract?: string;
      author_name?: string;
      file?: File;
    }) => {
      if (data.article_id) {
        return apiFetch('/udc/request-document/', {
          method: 'POST',
          body: JSON.stringify({ article_id: data.article_id, udk_code: data.udk_code, udk_description: data.udk_description }),
        });
      }
      const title = (data.title || '').trim();
      const author_name = (data.author_name || '').trim();
      if (!title) throw new Error('Mavzu (title) majburiy.');
      if (!author_name) throw new Error('Ism, familya, otchestva majburiy.');
      if (data.file) {
        const form = new FormData();
        form.append('title', title);
        form.append('abstract', data.abstract || '');
        form.append('author_name', author_name);
        form.append('file', data.file);
        return apiFetch('/udc/request-document/', { method: 'POST', body: form });
      }
      return apiFetch('/udc/request-document/', {
        method: 'POST',
        body: JSON.stringify({ title, abstract: data.abstract || '', author_name }),
      });
    },
    myCertificates: () => apiFetch('/udc/my-certificates/'),
    /** Standalone UDK ma'lumotnomani yuklab olish (auth bilan). */
    downloadCertificate: (id: number): Promise<void> =>
      downloadAuthed(`/udc/certificates/${id}/download/`, `udk_malumotnoma_${id}.pdf`),
    // UDK Request endpoints (DOI kabi workflow)
    /** UDK so'rovlari ro'yxati - taqrizchi barcha, muallif faqat o'zini */
    requests: {
      list: () => apiFetch('/udc/requests/'),
      /** Yangi UDK so'rovi yaratish */
      create: (data: {
        author_first_name: string;
        author_last_name: string;
        author_middle_name?: string;
        title: string;
        abstract: string;
        file?: File;
      }) => {
        if (data.file) {
          const form = new FormData();
          form.append('author_first_name', data.author_first_name);
          form.append('author_last_name', data.author_last_name);
          if (data.author_middle_name) form.append('author_middle_name', data.author_middle_name);
          form.append('title', data.title);
          form.append('abstract', data.abstract);
          form.append('file', data.file);
          return apiFetch('/udc/request/', { method: 'POST', body: form });
        }
        return apiFetch('/udc/request/', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },
      /** UDK so'rovni yakunlash (taqrizchi) */
      complete: (id: string, udk_code: string, udk_description?: string) =>
        apiFetch(`/udc/requests/${id}/complete/`, {
          method: 'PATCH',
          body: JSON.stringify({ udk_code, udk_description }),
        }),
      /** UDK so'rovni rad etish (taqrizchi) */
      reject: (id: string, reject_reason?: string) =>
        apiFetch(`/udc/requests/${id}/reject/`, {
          method: 'PATCH',
          body: JSON.stringify({ reject_reason }),
        }),
    },
    /** Service prices management (bosh admin uchun) */
    servicePrices: {
      list: () => apiFetch('/udc/service-prices/'),
      get: (id: number) => apiFetch(`/udc/service-prices/${id}/`),
      create: (data: { service_key: string; label: string; amount: number }) =>
        apiFetch('/udc/service-prices/', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: number, data: { amount?: number; label?: string }) =>
        apiFetch(`/udc/service-prices/${id}/`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      delete: (id: number) =>
        apiFetch(`/udc/service-prices/${id}/`, {
          method: 'DELETE',
        }),
    },
  },

  // Translations
  translations: {
    list: () => fetchAllPages('/translations/'),

    get: (id: string) => apiFetch(`/translations/${id}/`),

    analyzeFile: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch('/translations/analyze_file/', {
        method: 'POST',
        body: formData,
        headers: {}, // Let fetch set Content-Type for FormData
      });
    },

    create: (translationData: any) => {
      // Handle file uploads for translations
      if (translationData.file) {
        const formData = new FormData();
        formData.append('source_file_path', translationData.file);
        Object.keys(translationData).forEach(key => {
          if (key !== 'file') {
            formData.append(key, translationData[key]);
          }
        });
        return apiFetch('/translations/', {
          method: 'POST',
          body: formData,
          headers: {}, // Let fetch set Content-Type for FormData
        });
      }
      
      return apiFetch('/translations/', {
        method: 'POST',
        body: JSON.stringify(translationData),
      });
    },

    update: (id: string, translationData: any) => {
      const file = translationData.file as File | undefined;
      if (file) {
        const formData = new FormData();
        formData.append('translated_file_path', file);
        const appendIf = (k: string, v: unknown) => {
          if (v !== undefined && v !== null && v !== '') formData.append(k, String(v));
        };
        appendIf('status', translationData.status);
        appendIf('reviewer', translationData.reviewer);
        appendIf('completion_date', translationData.completion_date);
        return apiFetch(`/translations/${id}/`, {
          method: 'PATCH',
          body: formData,
          headers: {},
        });
      }
      const { file: _f, ...rest } = translationData;
      return apiFetch(`/translations/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(rest),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    
    delete: (id: string) =>
      apiFetch(`/translations/${id}/`, {
        method: 'DELETE',
      }),
  },

  // Reviews
  reviews: {
    list: () => fetchAllPages('/reviews/'),

    /** Bitta maqola taqrizlari (rolga qarab: muharrir — hammasi, taqrizchi — o'ziniki, muallif — o'z maqolasi) */
    listForArticle: (articleId: string) =>
      fetchAllPages<any>(`/reviews/?article=${encodeURIComponent(articleId)}`),

    /** Taqrizchi tanlash: faol taqrizchilar, moslik va bandlik bo'yicha saralangan */
    findSpecialists: (params: { article?: string; q?: string; specializations?: string }) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
      return apiFetch(`/reviews/find-specialists/?${qs}`);
    },

    get: (id: string) => apiFetch(`/reviews/${id}/`),

    create: (reviewData: any) =>
      apiFetch('/reviews/', {
        method: 'POST',
        body: JSON.stringify(reviewData),
      }),

    update: (id: string, reviewData: any) =>
      apiFetch(`/reviews/${id}/`, {
        method: 'PUT',
        body: JSON.stringify(reviewData),
      }),
      
    delete: (id: string) =>
      apiFetch(`/reviews/${id}/`, {
        method: 'DELETE',
      }),

    acceptReview: (id: string) =>
      apiFetch(`/reviews/${id}/accept_review/`, { method: 'POST' }),

    declineReview: (id: string, reason?: string) =>
      apiFetch(`/reviews/${id}/decline_review/`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || '' }),
      }),

    submitReview: (id: string, reviewData: any) =>
      apiFetch(`/reviews/${id}/submit_review/`, {
        method: 'POST',
        body: JSON.stringify(reviewData),
      }),

    /** Taqriz natijasini matn sifatida yuklab olish (backend: GET review-document) */
    downloadReviewDocument: (id: string): Promise<void> =>
      downloadAuthed(`/reviews/${id}/review-document/`, `taqriz_${id}.txt`),
  },

  // Notifications
  // Yordam sahifasidagi murojaat formasi (mehmon ham yuborishi mumkin)
  support: {
    contact: (data: { name: string; phone: string; email: string; topic: string; message: string }) =>
      apiFetch('/notifications/contact/', { method: 'POST', body: JSON.stringify(data) }),
  },

  notifications: {
    list: () => apiFetch('/notifications/'),

    markRead: (id: string) =>
      apiFetch(`/notifications/${id}/mark_read/`, {
        method: 'POST',
      }),

    markAllRead: () =>
      apiFetch('/notifications/mark_all_read/', {
        method: 'POST',
      }),

    unreadCount: () => apiFetch('/notifications/unread_count/'),
  },

  // File upload helper
  uploadFile: async (endpoint: string, file: File, additionalData?: any) => {
    const formData = new FormData();
    formData.append('file', file);
    if (additionalData) {
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });
    }
    return apiUpload(endpoint, formData);
  },

  // Get media URL
  getMediaUrl: (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const normalized = path.startsWith('/media/')
      ? path.slice('/media/'.length)
      : path.startsWith('media/')
        ? path.slice('media/'.length)
        : path.replace(/^\//, '');
    return `${MEDIA_URL}${normalized}`;
  },

  // Scientific Fields
  scientificFields: {
    list: (params?: Record<string, string>) => {
      if (!params || Object.keys(params).length === 0) {
        return apiFetch('/journals/scientific-fields/');
      }
      return apiFetch(`/journals/scientific-fields/?${new URLSearchParams(params)}`);
    },
    get: (id: string) => apiFetch(`/journals/scientific-fields/${id}/`),
    create: (fieldData: any) =>
      apiFetch('/journals/scientific-fields/', {
        method: 'POST',
        body: JSON.stringify(fieldData),
      }),
    update: (id: string, fieldData: any) =>
      apiFetch(`/journals/scientific-fields/${id}/`, {
        method: 'PUT',
        body: JSON.stringify(fieldData),
      }),
    delete: (id: string) =>
      apiFetch(`/journals/scientific-fields/${id}/`, {
        method: 'DELETE',
      }),
  },

  // Conferences
  conferences: {
    list: (params?: Record<string, string>) => {
      if (!params || Object.keys(params).length === 0) {
        return apiFetch('/journals/conferences/');
      }
      return apiFetch(`/journals/conferences/?${new URLSearchParams(params)}`);
    },
    get: (id: string) => apiFetch(`/journals/conferences/${id}/`),
    create: (conferenceData: any) =>
      apiFetch('/journals/conferences/', {
        method: 'POST',
        body: JSON.stringify(conferenceData),
      }),
    update: (id: string, conferenceData: any) =>
      apiFetch(`/journals/conferences/${id}/`, {
        method: 'PUT',
        body: JSON.stringify(conferenceData),
      }),
    delete: (id: string) =>
      apiFetch(`/journals/conferences/${id}/`, {
        method: 'DELETE',
      }),
  },

  // Author Publications
  authorPublications: {
    list: (params?: Record<string, string>) => {
      if (!params || Object.keys(params).length === 0) {
        return apiFetch('/journals/author-publications/');
      }
      return apiFetch(`/journals/author-publications/?${new URLSearchParams(params)}`);
    },
    get: (id: string) => apiFetch(`/journals/author-publications/${id}/`),
    create: (publicationData: any) =>
      apiFetch('/journals/author-publications/', {
        method: 'POST',
        body: JSON.stringify(publicationData),
      }),
    update: (id: string, publicationData: any) =>
      apiFetch(`/journals/author-publications/${id}/`, {
        method: 'PUT',
        body: JSON.stringify(publicationData),
      }),
    delete: (id: string) =>
      apiFetch(`/journals/author-publications/${id}/`, {
        method: 'DELETE',
      }),
    myPublications: () => apiFetch('/journals/author-publications/my_publications/'),
    publicationTypes: () => apiFetch('/journals/author-publications/publication_types/'),
    statistics: () => apiFetch('/journals/author-publications/statistics/'),
  },
};

export default apiService;

export { API_V1_BASE_URL, API_MEDIA_BASE_URL, isProductionHost } from '../config/apiBase';