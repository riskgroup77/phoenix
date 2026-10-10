import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldAlert, Send, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { useT } from '../i18n/LanguageContext';

type Props = {
  /** Bosh sahifadagi ixcham eslatma (tasdiqlangan bo'lsa — ko'rinmaydi) */
  compact?: boolean;
};

/**
 * Telefon raqamini Telegram orqali tasdiqlash (bepul, SMS'siz): bot ochiladi, «Raqamni ulashish» bosiladi.
 * Tasdiqlangach sahifa o'zi yangilanadi (holat har 3 soniyada tekshiriladi).
 */
const PhoneVerifyCard: React.FC<Props> = ({ compact = false }) => {
  const { t } = useT();
  const { user, markPhoneVerified } = useAuth();
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [link, setLink] = useState('');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearInterval(timer.current), []);

  if (!user) return null;
  if (user.phoneVerified) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-900">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
        {t('Telefon raqamingiz Telegram orqali tasdiqlangan.')}
      </div>
    );
  }

  const startPolling = (seconds: number) => {
    window.clearInterval(timer.current);
    const until = Date.now() + seconds * 1000;
    setWaiting(true);
    timer.current = window.setInterval(async () => {
      if (Date.now() > until) {
        window.clearInterval(timer.current);
        setWaiting(false);
        return;
      }
      try {
        const res = await apiService.auth.phoneVerifyStatus();
        if (res?.phone_verified) {
          window.clearInterval(timer.current);
          setWaiting(false);
          markPhoneVerified();
          toast.success(t('Telefon raqamingiz tasdiqlandi!'));
        }
      } catch {
        /* keyingi urinishda */
      }
    }, 3000);
  };

  const start = async () => {
    setBusy(true);
    try {
      const res = await apiService.auth.phoneVerifyStart();
      if (res?.already_verified) {
        markPhoneVerified();
        return;
      }
      if (res?.deep_link) {
        setLink(res.deep_link);
        window.open(res.deep_link, '_blank', 'noopener');
        startPolling(res.expires_in || 1800);
      }
    } catch (e: any) {
      toast.error(e?.message || t("Tasdiqlashni boshlab bo'lmadi"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-amber-300/70 bg-amber-50 text-amber-950 ${compact ? 'p-3' : 'p-4'}`}
      role="status"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-amber-700" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-sm">{t('Telefon raqamingiz tasdiqlanmagan')}</p>
            {!compact && (
              <p className="text-sm mt-1 text-amber-900/90">
                {t("Telegram botni oching va «📱 Raqamni ulashish» tugmasini bosing — raqam bir zumda tasdiqlanadi. Bu hisobingizni himoya qiladi va parolni unutganda o'zingiz tiklash imkonini beradi.")}
              </p>
            )}
            {waiting && (
              <p className="text-xs mt-1 flex items-center gap-1 text-amber-900">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> {t("Telegram'dagi tasdiqlash kutilmoqda...")}
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="underline ml-1">
                    {t('botni qayta ochish')}
                  </a>
                )}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="milliy-btn-primary inline-flex items-center justify-center gap-2 w-full sm:w-auto shrink-0"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          {t('Telegram orqali tasdiqlash')}
        </button>
      </div>
    </div>
  );
};

export default PhoneVerifyCard;
