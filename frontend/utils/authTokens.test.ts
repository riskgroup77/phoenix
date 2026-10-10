import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? (this.m.get(k) as string) : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  dump() { return Object.fromEntries(this.m); }
}

let store: MemoryStorage;

beforeEach(() => {
  store = new MemoryStorage();
  vi.stubGlobal('window', { localStorage: store });
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const load = () => import('./authTokens');

describe('authTokens — cookie rejimi', () => {
  it('localStorage ga hech qanday token yozmaydi', async () => {
    const t = await load();
    t.storeLoginTokens({ access: 'ACC', refresh: 'REF', cookie_auth: true });
    expect(store.dump()).toEqual({ auth_mode: 'cookie' });
    expect(t.getAccessToken()).toBe('ACC'); // faqat xotirada
    expect(t.getRefreshToken()).toBeNull(); // HttpOnly cookie da
    expect(t.isCookieMode()).toBe(true);
    expect(t.hasStoredSession()).toBe(true);
  });

  it('yangi access token ham localStorage ga tushmaydi', async () => {
    const t = await load();
    t.storeLoginTokens({ access: 'A1', cookie_auth: true });
    t.setAccessToken('A2');
    expect(t.getAccessToken()).toBe('A2');
    expect(JSON.stringify(store.dump())).not.toContain('A2');
  });

  it('sahifa qayta yuklanganda (xotira bo\'sh) sessiya cookie orqali tiklanishi kerakligini bildiradi', async () => {
    store.setItem('auth_mode', 'cookie');
    const t = await load();
    expect(t.getAccessToken()).toBeNull();
    expect(t.hasStoredSession()).toBe(true);
  });

  it('eski localStorage tokenlarini cookie rejimiga o\'tganda o\'chiradi', async () => {
    store.setItem('access_token', 'OLD');
    store.setItem('refresh_token', 'OLDR');
    const t = await load();
    t.storeLoginTokens({ access: 'NEW', cookie_auth: true });
    expect(store.getItem('access_token')).toBeNull();
    expect(store.getItem('refresh_token')).toBeNull();
  });
});

describe('authTokens — eski (lokal) rejim', () => {
  it('tokenlarni localStorage da saqlaydi', async () => {
    const t = await load();
    t.storeLoginTokens({ access: 'ACC', refresh: 'REF' });
    expect(store.getItem('access_token')).toBe('ACC');
    expect(t.getRefreshToken()).toBe('REF');
    expect(t.isCookieMode()).toBe(false);
  });

  it('clearTokens hammasini tozalaydi', async () => {
    const t = await load();
    t.storeLoginTokens({ access: 'ACC', refresh: 'REF', cookie_auth: true });
    t.clearTokens();
    expect(store.dump()).toEqual({});
    expect(t.getAccessToken()).toBeNull();
    expect(t.hasStoredSession()).toBe(false);
  });
});
