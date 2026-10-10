import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from './lazyPage';
import { isIgnorableError } from './monitoring';

describe('isChunkLoadError', () => {
  it('deploydan keyingi chunk xatolarini taniydi', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/A-1.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true); // Safari
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true); // Firefox
    expect(isChunkLoadError({ name: 'ChunkLoadError' })).toBe(false); // Error emas — string ga aylanadi
    expect(isChunkLoadError(Object.assign(new Error('x'), { name: 'ChunkLoadError' }))).toBe(true);
  });

  it('oddiy xatolarni chunk xatosi deb hisoblamaydi', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('isIgnorableError (monitoring)', () => {
  it('kengaytma va tarmoq xatolarini yubormaydi', () => {
    expect(isIgnorableError('Script error.')).toBe(true);
    expect(isIgnorableError('ResizeObserver loop limit exceeded')).toBe(true);
    expect(isIgnorableError('TypeError: Failed to fetch')).toBe(true);
    expect(isIgnorableError('x', 'chrome-extension://abc/content.js')).toBe(true);
    expect(isIgnorableError('')).toBe(true);
  });

  it('haqiqiy kod xatolarini yuboradi', () => {
    expect(isIgnorableError("TypeError: Cannot read properties of null (reading 'id')", 'https://ilmiyfaoliyat.uz/assets/index.js')).toBe(false);
  });
});
