import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { draftStorageKey, readDraft } from './useFormDraft';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? (this.store.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
}

describe('readDraft', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('kalit foydalanuvchiga bog‘langan', () => {
    expect(draftStorageKey('submit', 'u1')).not.toBe(draftStorageKey('submit', 'u2'));
  });

  it('yangi qoralamani qaytaradi', () => {
    const key = draftStorageKey('submit', 'u1');
    localStorage.setItem(key, JSON.stringify({ v: 1, savedAt: Date.now(), data: { title: 'Sarlavha' } }));
    expect(readDraft<{ title: string }>(key)?.data.title).toBe('Sarlavha');
  });

  it("14 kundan eski qoralamani o'chiradi", () => {
    const key = draftStorageKey('submit', 'u1');
    localStorage.setItem(key, JSON.stringify({ v: 1, savedAt: Date.now() - 15 * 24 * 3600 * 1000, data: {} }));
    expect(readDraft(key)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("buzilgan JSON — null", () => {
    const key = draftStorageKey('submit', 'u1');
    localStorage.setItem(key, '{oops');
    expect(readDraft(key)).toBeNull();
  });
});
