/**
 * Frontend monitoring: backend bilan bog‘lash (X-Request-ID) va ixtiyoriy Sentry.
 * Sentry: @sentry/react o‘rnatilgan bo‘lsa va VITE_SENTRY_DSN berilgan bo‘lsa ishga tushadi.
 */

let sentryInitStarted = false;

export function initClientMonitoring(): void {
  if (sentryInitStarted || typeof window === 'undefined') return;
  sentryInitStarted = true;
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
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn?.trim()) return;
  void import('@sentry/react')
    .then((Sentry) => {
      Sentry.captureException(error, { extra: context });
    })
    .catch(() => {});
}
