import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, CreditCard, Loader, XCircle } from 'lucide-react';
import ModalPortal from './ui/ModalPortal';
import { apiService } from '../services/apiService';
import { PAYMENT_MODAL_EVENT, type PaymentModalRequest } from '../services/paymentService';
import { useT } from '../i18n/LanguageContext';

type TxInfo = {
  id?: string;
  service_label?: string;
  service_type?: string;
  article_title?: string;
  context_label?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  error_note?: string;
};

type Phase = 'confirm' | 'waiting' | 'success' | 'failed';

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_MS = 20 * 60 * 1000;

const formatAmount = (amount: number | string | undefined) =>
  Math.round(Number(amount || 0)).toLocaleString('ru-RU').replace(/,/g, ' ');

/** Click belgisi (oq fonda ko'k "click" yozuvi) — tugma ichida */
const ClickMark: React.FC = () => (
  <svg viewBox="0 0 64 20" className="h-5 w-auto" aria-hidden>
    <rect width="64" height="20" rx="10" fill="#ffffff" />
    <circle cx="11" cy="10" r="5" fill="#00A0E3" />
    <text x="20" y="14.5" fontFamily="Arial, Helvetica, sans-serif" fontSize="12" fontWeight="700" fill="#0b4a8f">
      click
    </text>
  </svg>
);

/**
 * Barcha to'lovlar uchun yagona oyna. Ranglar aniq beriladi (sayt CSS o'zgaruvchilariga tayanilmaydi; avval prod'da
 * "Click orqali to'lash" tugmasi oq fonda ko'rinmasdi). Oyna HAMMA narsaning ustida (z-[120]: header z-60, mobil
 * menyu z-80, boshqa modallar z-100, "Operator chat" z-40) — to'liq ekranli qorong'i fon ortidagi sahifa bosilmaydi,
 * ko'rinishda faqat to'lov oynasi; ekran tepasiga yaqin turadi (mobil/uzun sahifada pastda yashirinib qolmaydi).
 *  1) to'lov ma'lumotlari + "Click orqali to'lash" / "Ortga";
 *  2) Click yangi tabda ochiladi, oyna o'zida "To'lov tekshirilmoqda" (boshqa sahifaga o'tmaydi);
 *  3) to'lov tasdiqlansa — Click tabi yopiladi va natija shu oynada ko'rinadi.
 */
const PaymentConfirmModal: React.FC = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const [request, setRequest] = useState<PaymentModalRequest | null>(null);
  const [tx, setTx] = useState<TxInfo | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('confirm');
  const clickWindowRef = useRef<Window | null>(null);
  const pollStartedAt = useRef<number>(0);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<PaymentModalRequest>).detail;
      if (!detail?.transactionId) return;
      setRequest(detail);
      setTx(null);
      setPaymentUrl(detail.paymentUrl || '');
      setError(null);
      setPhase('confirm');
    };
    window.addEventListener(PAYMENT_MODAL_EVENT, onOpen);
    return () => window.removeEventListener(PAYMENT_MODAL_EVENT, onOpen);
  }, []);

  // Ma'lumot va Click havolasi oldindan olinadi — tugma bosilganda tab darhol ochiladi (popup bloklanmaydi)
  useEffect(() => {
    if (!request) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const [info, url] = await Promise.all([
          apiService.payments.getTransaction(request.transactionId).catch(() => null),
          request.paymentUrl
            ? Promise.resolve(request.paymentUrl)
            : apiService.payments
                .processPayment(request.transactionId, 'click')
                .then((r: any) => r?.payment_url || '')
                .catch(() => ''),
        ]);
        if (!alive) return;
        setTx(info);
        if (info?.status === 'completed') setPhase('success');
        if (typeof url === 'string' && /^https:\/\//.test(url)) setPaymentUrl(url);
        else if (info?.status !== 'completed') setError(t("Click to'lov havolasini olib bo'lmadi. Keyinroq qayta urinib ko'ring."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [request, t]);

  const closeClickWindow = () => {
    try {
      clickWindowRef.current?.close();
    } catch {
      /* boshqa domen — yopib bo'lmasa, foydalanuvchi o'zi yopadi */
    }
    clickWindowRef.current = null;
  };

  const checkStatus = useCallback(async () => {
    if (!request) return;
    try {
      let next: TxInfo | null = null;
      try {
        const sync: any = await apiService.payments.checkStatus(request.transactionId);
        next = sync?.transaction || null;
      } catch {
        /* Click sinxronlash ishlamasa — oddiy GET */
      }
      if (!next) next = await apiService.payments.getTransaction(request.transactionId);
      if (!next) return;
      setTx((prev) => ({ ...(prev || {}), ...next }));
      if (next.status === 'completed') {
        setPhase('success');
        closeClickWindow();
      } else if (next.status === 'failed' || next.status === 'cancelled') {
        setPhase('failed');
        closeClickWindow();
      }
    } catch {
      /* keyingi urinishda */
    }
  }, [request]);

  // Kutish: oyna ichida to'lov holati tekshiriladi (tab qaytganda ham darhol)
  useEffect(() => {
    if (phase !== 'waiting') return;
    pollStartedAt.current = Date.now();
    const tick = () => {
      if (Date.now() - pollStartedAt.current > POLL_MAX_MS) return;
      void checkStatus();
    };
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, checkStatus]);

  const close = useCallback(() => {
    setRequest(null);
    setPhase('confirm');
  }, []);

  const pay = () => {
    if (!request || !paymentUrl) return;
    const win = window.open(paymentUrl, '_blank');
    if (!win) {
      // Popup bloklangan — shu tabda Click; qaytishda #/payment/click natijani ko'rsatadi
      window.location.assign(paymentUrl);
      return;
    }
    clickWindowRef.current = win;
    setError(null);
    setPhase('waiting');
  };

  /** To'lovdan keyin: xizmatga qarab keyingi qadam */
  const finish = () => {
    const id = request?.transactionId || '';
    const st = tx?.service_type;
    setRequest(null);
    setPhase('confirm');
    if (st === 'language_editing') {
      navigate(`/plagiarism-check?payment_return=1&transaction_id=${encodeURIComponent(id)}`);
      return;
    }
    if (st === 'udk_request') {
      // UDK sahifasi so'rovni topib, "UDK aniqlanmoqda → Tayyor" holatini o'zi kuzatadi
      navigate(`/udk-olish?payment_return=1&transaction_id=${encodeURIComponent(id)}`);
      return;
    }
    if (st === 'publication_fee') {
      sessionStorage.removeItem('phonix_submit_article_pending');
      navigate('/articles?tab=journal');
      return;
    }
    // Boshqa xizmatlar: sahifa holati yangilansin (to'lov belgisi, buyurtma holati)
    window.location.reload();
  };

  if (!request) return null;

  const purpose = tx?.article_title || tx?.context_label || '';
  const muted = 'text-slate-500 dark:text-slate-400';
  const border = 'border-slate-200 dark:border-slate-700';

  return (
    <ModalPortal
      open
      align="top"
      zIndexClass="z-[120]"
      backdropClassName="bg-slate-950/80 backdrop-blur-sm"
      labelledBy="payment-modal-title"
    >
      <div className={`relative w-full max-w-full sm:w-[28rem] rounded-2xl border ${border} bg-white p-5 sm:p-6 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100`}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-300">
            <CreditCard className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 id="payment-modal-title" className="m-0 text-lg font-bold">{t("To'lov")}</h3>
            <p className={`m-0 text-sm ${muted}`}>
              {phase === 'confirm' && t("To'lov ma'lumotlarini tekshiring")}
              {phase === 'waiting' && t("Click sahifasida to'lovni yakunlang")}
              {phase === 'success' && t("To'lov muvaffaqiyatli tasdiqlandi!")}
              {phase === 'failed' && t("To'lov yakunlanmadi yoki bekor qilindi.")}
            </p>
          </div>
        </div>

        {loading && !tx ? (
          <div className={`flex items-center justify-center gap-2 py-8 text-sm ${muted}`}>
            <Loader className="h-4 w-4 animate-spin" aria-hidden /> {t('Yuklanmoqda...')}
          </div>
        ) : (
          <dl className={`m-0 flex flex-col gap-2 rounded-xl border ${border} p-4 text-sm`}>
            <div className="flex justify-between gap-4">
              <dt className={muted}>{t('Xizmat')}</dt>
              <dd className="m-0 text-right font-medium">{t(tx?.service_label || tx?.service_type || '—')}</dd>
            </div>
            {purpose && (
              <div className="flex justify-between gap-4">
                <dt className={`shrink-0 ${muted}`}>{t('Nima uchun')}</dt>
                <dd className="m-0 min-w-0 break-words text-right">{purpose}</dd>
              </div>
            )}
            <div className={`flex justify-between gap-4 border-t ${border} pt-2`}>
              <dt className={muted}>{t('Summa')}</dt>
              <dd className="m-0 text-right text-base font-bold">{tx ? `${formatAmount(tx.amount)} ${t("so'm")}` : '—'}</dd>
            </div>
          </dl>
        )}

        {phase === 'waiting' && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm text-slate-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-slate-100">
            <Loader className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-700 dark:text-blue-300" aria-hidden />
            <span>{t("To'lov tekshirilmoqda — Click'da to'lovni yakunlang, tasdiq shu oynada avtomatik chiqadi.")}</span>
          </div>
        )}
        {phase === 'success' && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{t("To'lov qabul qilindi. Click oynasi yopildi — ochiq qolgan bo'lsa, uni yopishingiz mumkin.")}</span>
          </div>
        )}
        {phase === 'failed' && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{tx?.error_note || t("To'lov yakunlanmadi yoki bekor qilindi.")}</span>
          </div>
        )}

        {error && phase === 'confirm' && <p className="mb-0 mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}

        <div className="mt-5 flex flex-col-reverse gap-2">
          {phase !== 'success' && (
            <button
              type="button"
              onClick={() => {
                closeClickWindow();
                close();
              }}
              className={`flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl border ${border} bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> {t('Ortga')}
            </button>
          )}
          {(phase === 'confirm' || phase === 'failed') && (
            <button
              type="button"
              onClick={pay}
              disabled={!paymentUrl || loading}
              className="flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl bg-[#00A0E3] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#008cc7] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ClickMark /> {phase === 'failed' ? t('Qayta urinish') : t("Click orqali to'lash")}
            </button>
          )}
          {phase === 'waiting' && (
            <button
              type="button"
              onClick={() => void checkStatus()}
              className="flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl bg-[#00A0E3] px-4 text-sm font-semibold text-white hover:bg-[#008cc7]"
            >
              {t('Hozir tekshirish')}
            </button>
          )}
          {phase === 'success' && (
            <button
              type="button"
              onClick={finish}
              className="flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <CheckCircle className="h-4 w-4" aria-hidden /> {t('Davom etish')}
            </button>
          )}
        </div>
        {phase === 'confirm' && (
          <p className={`mb-0 mt-3 text-center text-xs ${muted}`}>
            {t("Click sahifasi yangi oynada ochiladi. To'lovdan keyin natija shu yerda ko'rinadi.")}
          </p>
        )}
      </div>
    </ModalPortal>
  );
};

export default PaymentConfirmModal;
