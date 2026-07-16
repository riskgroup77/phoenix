import type { Location } from 'react-router-dom';

/**
 * HashRouter (#/articles/...) va oddiy pathname ikkalasida ham ishlaydigan yo‘l.
 */
export function getAppPathname(loc: Pick<Location, 'pathname' | 'hash'>): string {
  const { pathname, hash } = loc;
  if (hash && hash.length > 1) {
    const q = hash.indexOf('?');
    const raw = (q >= 0 ? hash.slice(0, q) : hash).replace(/^#/, '').trim();
    if (raw) {
      const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
      return withSlash.length > 1 && withSlash.endsWith('/')
        ? withSlash.slice(0, -1)
        : withSlash;
    }
  }
  let p = pathname && pathname !== '' ? pathname : '/';
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}
