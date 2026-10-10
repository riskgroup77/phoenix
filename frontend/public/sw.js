/*
 * Phoenix service worker (PWA).
 *
 * Strategiya:
 *  - Sahifa (navigatsiya): avval tarmoq, tarmoq bo'lmasa — keshdagi SPA qobig'i, u ham bo'lmasa — offline.html.
 *  - /assets/* (nomida hash bor, o'zgarmaydi): avval kesh. Deploydan keyin ochiq turgan eski sahifa
 *    eski chunklarni keshdan oladi — «Failed to fetch dynamically imported module» kamayadi.
 *  - Ikonlar/rasmlar: kesh, fonda yangilanadi.
 *  - API (boshqa domen), /media, /p/ (Django), POST va h.k. — tegilmaydi (shaxsiy ma'lumot keshlanmaydi).
 *
 * Kesh nomini o'zgartirish (VERSION) eski keshlarni o'chiradi.
 */
const VERSION = 'v1';
const SHELL_CACHE = `phoenix-shell-${VERSION}`;
const ASSET_CACHE = `phoenix-assets-${VERSION}`;
const STATIC_CACHE = `phoenix-static-${VERSION}`;
const MAX_ASSETS = 120;
const OFFLINE_URL = '/offline.html';
const SHELL_URLS = ['/', OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('phoenix-') && ![SHELL_CACHE, ASSET_CACHE, STATIC_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  // Chiqishda (logout) — shaxsiy bo'lishi mumkin bo'lgan narsa qolmasin
  if (event.data === 'CLEAR_RUNTIME') {
    event.waitUntil(caches.delete(STATIC_CACHE));
  }
});

const trimCache = async (name, max) => {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
  }
};

const isBypassed = (url) =>
  url.pathname.startsWith('/media/') ||
  url.pathname.startsWith('/api/') ||
  url.pathname.startsWith('/p/') ||
  url.pathname.startsWith('/admin') ||
  url.pathname === '/sitemap.xml' ||
  url.pathname === '/robots.txt' ||
  url.pathname === '/sw.js';

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isBypassed(url)) return;

  // 1) Sahifa navigatsiyasi — network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && (url.pathname === '/' || url.pathname === '/index.html')) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put('/', copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(async () => (await caches.match('/')) || (await caches.match(OFFLINE_URL)) || Response.error())
    );
    return;
  }

  // 2) Hashli build fayllari — cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches
                .open(ASSET_CACHE)
                .then((c) => c.put(request, copy))
                .then(() => trimCache(ASSET_CACHE, MAX_ASSETS))
                .catch(() => undefined);
            }
            return res;
          })
      )
    );
    return;
  }

  // 3) Ikonlar, shriftlar, rasmlar — stale-while-revalidate
  if (/\.(png|jpe?g|svg|webp|ico|woff2?|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone()).catch(() => undefined);
            return res;
          })
          .catch(() => hit || Response.error());
        return hit || network;
      })
    );
  }
});
