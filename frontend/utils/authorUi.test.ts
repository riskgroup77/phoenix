import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.resetModules();
});

afterEach(() => vi.unstubAllGlobals());

describe('authorUi', () => {
  it('muallif standart holatda AI ish maydoniga tushadi', async () => {
    const { homePathFor } = await import('./authorUi');
    expect(homePathFor('author')).toBe('/ai');
    expect(homePathFor('reviewer')).toBe('/dashboard');
    expect(homePathFor('operator')).toBe('/operator-dashboard');
  });

  it("klassik ko'rinish tanlansa — oddiy panel", async () => {
    const { homePathFor, setAuthorUi, getAuthorUi } = await import('./authorUi');
    setAuthorUi('classic');
    expect(getAuthorUi()).toBe('classic');
    expect(homePathFor('author')).toBe('/dashboard');
    setAuthorUi('ai');
    expect(homePathFor('author')).toBe('/ai');
  });
});
