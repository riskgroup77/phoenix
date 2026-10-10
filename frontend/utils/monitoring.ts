/**
 * Frontend monitoring: backend bilan bog‘lash (X-Request-ID) va ixtiyoriy Sentry.
 * Sentry: @sentry/react o‘rnatilgan bo‘lsa va VITE_SENTRY_DSN berilgan bo‘lsa ishga tushadi.
 *
 * Bepul variant (Sentry'siz ham): brauzerdagi ushlanmagan xatolar /api/v1/client-errors/ ga yuboriladi —
 * backend logga yozadi va Telegram'ga ogohlantiradi (config/alerts.py). Sahifa yuklanishida ko'pi bilan 5 ta,
 * bir xil xato bir marta.
 */
import { API_V1_BASE_URL } from '../config/apiBase';

let sentryInitStarted = false;
const reported = new Set<string>();
const MAX_REPORTS = 5;

/** Brauzer kengaytmalari va tarmoq uzilishlari — bizning xatomiz emas, yuborilmaydi */
export function isIgnorableError(message: string, source = ''): boolean {
  return (
    !message ||
    /^Script error\.?$/i.test(message) ||
    /ResizeObserver loop/i.test(message) ||
    /Failed to fetch|NetworkError|Load failed|ChunkLoadError|Loading chunk/i.test(message) ||
    /^(chrome|moz|safari)-extension:/i.test(source)
  );
}

export function reportClientError(message: string, extra: { stack?: string; source?: string } = {}): boolean {
  if (typeof window === 'undefined') return false;
  const msg = String(message || '').slice(0, 500);
  if (isIgnorableError(msg, extra.source)) return false;
  const key = msg + '|' + (extra.source || '');
  if (reported.has(key) || reported.size >= MAX_REPORTS) return false;
  reported.add(key);
  const body = JSON.stringify({
    message: msg,
    stack: (extra.stack || '').slice(0, 2000),
    source: (extra.source || '').slice(0, 300),
    url: window.location.href.slice(0, 300),
    release: String(import.meta.env.VITE_APP_VERSION || ''),
  });
  try {
    const url = `${API_V1_BASE_URL.replace(/\/$/, '')}/client-errors/`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
    }
  } catch {
    /* monitoring ilovani buzmasin */
  }
  return true;
}

export function initClientMonitoring(): void {
  if (sentryInitStarted || typeof window === 'undefined') return;
  sentryInitStarted = true;
  if (!import.meta.env.DEV) {
    window.addEventListener('error', (e) => {
      reportClientError(e.message, { stack: e.error?.stack, source: `${e.filename || ''}:${e.lineno || ''}` });
    });
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason as { message?: string; stack?: string } | string | undefined;
      const message = typeof reason === 'string' ? reason : reason?.message || 'Unhandled promise rejection';
      reportClientError(message, { stack: typeof reason === 'object' ? reason?.stack : undefined });
    });
  }
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn?.trim()) return;

  void import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: dsn.trim(),
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1) || 0.1,
      });
    })
    .catch(() => {
      /* @sentry/react o‘rnatilmagan */
    });
}

export function captureClientException(error: Error, context?: Record<string, unknown>): void {
  // ErrorBoundary ushlagan xatolar window.onerror ga yetmaydi — bepul kanal orqali ham yuboriladi
  if (!import.meta.env.DEV) {
    const componentStack = typeof context?.componentStack === 'string' ? context.componentStack : '';
    reportClientError(error?.message || String(error), { stack: `${error?.stack || ''}\n${componentStack}`.trim() });
  }
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn?.trim()) return;
  void import('@sentry/react')
    .then((Sentry) => {
      Sentry.captureException(error, { extra: context });
    })
    .catch(() => {});
}
