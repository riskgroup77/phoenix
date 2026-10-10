/**
 * PWA: service worker ro'yxatdan o'tkazish va «Ilovani o'rnatish» taklifi.
 * Faqat production buildda (dev'da Vite HMR bilan to'qnashmasin).
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const canInstallApp = (): boolean => deferredPrompt !== null && !isStandalone();

export const onInstallAvailabilityChange = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export async function promptInstallApp(): Promise<boolean> {
  const ev = deferredPrompt;
  if (!ev) return false;
  deferredPrompt = null;
  notify();
  try {
    await ev.prompt();
    const choice = await ev.userChoice;
    return choice.outcome === 'accepted';
  } catch {
    return false;
  }
}

/** Chiqishda (logout) SW keshidagi runtime fayllarni tozalash. */
export function clearServiceWorkerRuntimeCache(): void {
  try {
    navigator.serviceWorker?.controller?.postMessage('CLEAR_RUNTIME');
  } catch {
    /* SW yo'q */
  }
}

export function initPwa(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (import.meta.env.VITE_DISABLE_SW === 'true') {
    // Favqulodda o'chirish: eski SW ni olib tashlash
    void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()));
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Uzoq ochiq turgan tablarda ham yangilanishni tekshirish (soatiga bir marta)
        window.setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
      })
      .catch(() => undefined);
  });
}
