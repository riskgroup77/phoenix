/**
 * Login tokenlarini saqlash.
 *
 * Cookie rejimi (production — backend JWT_USE_HTTPONLY_COOKIES): refresh token faqat HttpOnly cookie'da
 * (JavaScript o'qiy olmaydi), access token faqat xotirada. localStorage'da hech qanday token yo'q —
 * XSS bo'lsa ham token o'g'irlanmaydi. Sahifa yangilanganda sessiya cookie orqali jimgina tiklanadi.
 *
 * Eski rejim (lokal ishlab chiqish, cookie o'chiq): avvalgidek localStorage.
 */
const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const MODE_KEY = 'auth_mode'; // 'cookie' — sir emas, faqat qaysi rejim ekanini bildiradi

let accessInMemory: string | null = null;

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function isCookieMode(): boolean {
  return storage()?.getItem(MODE_KEY) === 'cookie';
}

export function getAccessToken(): string | null {
  if (accessInMemory) return accessInMemory;
  return isCookieMode() ? null : storage()?.getItem(ACCESS_KEY) ?? null;
}

export function setAccessToken(token: string | null): void {
  accessInMemory = token;
  if (!isCookieMode() && token) storage()?.setItem(ACCESS_KEY, token);
}

/** Eski rejimdagi refresh token (cookie rejimida — null: u HttpOnly cookie'da) */
export function getRefreshToken(): string | null {
  return isCookieMode() ? null : storage()?.getItem(REFRESH_KEY) ?? null;
}

/** Login/ro'yxatdan o'tish javobidan tokenlarni saqlash */
export function storeLoginTokens(data: { access?: string; refresh?: string; cookie_auth?: boolean }): void {
  const s = storage();
  if (data.cookie_auth) {
    s?.setItem(MODE_KEY, 'cookie');
    s?.removeItem(ACCESS_KEY);
    s?.removeItem(REFRESH_KEY);
    accessInMemory = data.access ?? null;
    return;
  }
  s?.removeItem(MODE_KEY);
  accessInMemory = data.access ?? null;
  if (data.access) s?.setItem(ACCESS_KEY, data.access);
  if (data.refresh) s?.setItem(REFRESH_KEY, data.refresh);
}

/** Sessiya bormi (cookie rejimida — tekshirish uchun refresh so'rovi kerak bo'lishi mumkin) */
export function hasStoredSession(): boolean {
  return Boolean(getAccessToken() || getRefreshToken() || isCookieMode());
}

export function clearTokens(): void {
  accessInMemory = null;
  const s = storage();
  s?.removeItem(ACCESS_KEY);
  s?.removeItem(REFRESH_KEY);
  s?.removeItem(MODE_KEY);
}
