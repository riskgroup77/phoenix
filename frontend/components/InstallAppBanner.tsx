import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { canInstallApp, onInstallAvailabilityChange, promptInstallApp } from '../utils/pwa';
import { useT } from '../i18n/LanguageContext';

const DISMISS_KEY = 'phoenix_install_dismissed_at';
const DISMISS_DAYS = 30;

const dismissedRecently = (): boolean => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < DISMISS_DAYS * 24 * 3600 * 1000;
  } catch {
    return false;
  }
};

/** Telefonda «Ilovani o'rnatish» taklifi (brauzer beforeinstallprompt bergandagina ko'rinadi). */
const InstallAppBanner: React.FC = () => {
  const { t } = useT();
  const [available, setAvailable] = useState(canInstallApp());
  const [hidden, setHidden] = useState(dismissedRecently());

  useEffect(() => onInstallAvailabilityChange(() => setAvailable(canInstallApp())), []);

  if (!available || hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* localStorage yopiq */
    }
    setHidden(true);
  };

  return (
    <div className="lg:hidden mx-4 mt-3 flex items-center gap-3 rounded-xl border border-[var(--editorial-border)] bg-[var(--editorial-bg-alt)] p-3 shadow-sm" role="region" aria-label={t("Ilovani o'rnatish")}>
      <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-lg shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--editorial-text)]">{t('Phoenix ilovasi')}</p>
        <p className="text-xs text-[var(--editorial-muted)]">{t("Bosh ekranga qo'shing — tezroq ochiladi.")}</p>
      </div>
      <button
        type="button"
        onClick={() => void promptInstallApp().then((ok) => ok && setHidden(true))}
        className="inline-flex items-center gap-1 rounded-lg bg-[var(--editorial-primary)] px-3 py-2 text-xs font-semibold text-white min-h-[36px]"
      >
        <Download className="h-4 w-4" aria-hidden /> {t("O'rnatish")}
      </button>
      <button type="button" onClick={dismiss} className="p-2 text-[var(--editorial-muted)]" aria-label={t('Yopish')}>
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
};

export default InstallAppBanner;
