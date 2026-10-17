import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, Loader } from 'lucide-react';
import ModalPortal from './ui/ModalPortal';
import Button from './ui/Button';
import { apiService } from '../services/apiService';
import { PAYMENT_MODAL_EVENT, type PaymentModalRequest } from '../services/paymentService';
import { useT } from '../i18n/LanguageContext';

type TxInfo = {
  service_label?: string;
  service_type?: string;
  article_title?: string;
  context_label?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
};

const formatAmount = (amount: number | string | undefined) =>
  Math.round(Number(amount || 0)).toLocaleString('ru-RU').replace(/,/g, ' ');

/**
 * Barcha to'lovlar uchun yagona oyna: to'lov ma'lumotlari + "Click orqali to'lash" / "Ortga".
 * Click sahifasi faqat tugma bosilganda yangi tabda ochiladi (avtomatik emas) — joriy tab to'lov holatini kutadi.
 */
const PaymentConfirmModal: React.FC = () => {
  const { t } = useT();
  const [request, setRequest] = useState<PaymentModalRequest | null>(null);
  const [tx, setTx] = useState<TxInfo | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<PaymentModalRequest>).detail;
      if (!detail?.transactionId) return;
      setRequest(detail);
      setTx(null);
      setPaymentUrl(detail.paymentUrl || '');
      setError(null);
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
        if (typeof url === 'string' && /^https:\/\//.test(url)) setPaymentUrl(url);
        else setError(t("Click to'lov havolasini olib bo'lmadi. Keyinroq qayta urinib ko'ring."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [request, t]);

  const close = useCallback(() => {
    setRequest(null);
  }, []);

  const pay = () => {
    if (!request || !paymentUrl) return;
    const win = window.open(paymentUrl, '_blank');
    if (win) {
      try { win.opener = null; } catch { /* ignore */ }
      // Joriy tab to'lov holatini kutadi va to'lov tugagach natijani ko'rsatadi
      window.location.hash = `#/payment/click?transaction_id=${encodeURIComponent(request.transactionId)}`;
    } else {
      window.location.assign(paymentUrl);
    }
    setRequest(null);
  };

  if (!request) return null;

  const purpose = tx?.article_title || tx?.context_label || '';

  return (
    <ModalPortal open>
      <div className="w-full sm:w-[28rem] rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-300">
            <CreditCard className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">{t("To'lov")}</h3>
            <p className="m-0 text-sm text-slate-500 dark:text-slate-400">{t("To'lov ma'lumotlarini tekshiring")}</p>
          </div>
        </div>

        {loading && !tx ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 dark:text-slate-400">
            <Loader className="h-4 w-4 animate-spin" aria-hidden /> {t('Yuklanmoqda...')}
          </div>
        ) : (
          <dl className="m-0 flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{t('Xizmat')}</dt>
              <dd className="m-0 text-right font-medium text-slate-900 dark:text-slate-100">{t(tx?.service_label || tx?.service_type || '—')}</dd>
            </div>
            {purpose && (
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-slate-500 dark:text-slate-400">{t('Nima uchun')}</dt>
                <dd className="m-0 min-w-0 break-words text-right text-slate-900 dark:text-slate-100">{purpose}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-slate-200 dark:border-slate-700 pt-2">
              <dt className="text-slate-500 dark:text-slate-400">{t('Summa')}</dt>
              <dd className="m-0 text-right text-base font-bold text-slate-900 dark:text-slate-100">
                {tx ? `${formatAmount(tx.amount)} ${t("so'm")}` : '—'}
              </dd>
            </div>
          </dl>
        )}

        {error && <p className="mb-0 mt-3 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={close} className="flex flex-1 items-center justify-center gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden /> {t('Ortga')}
          </Button>
          <Button
            type="button"
            onClick={pay}
            disabled={!paymentUrl || loading}
            className="flex flex-1 items-center justify-center gap-2"
          >
            <CreditCard className="h-4 w-4" aria-hidden /> {t("Click orqali to'lash")}
          </Button>
        </div>
        <p className="mb-0 mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          {t("Click sahifasi yangi oynada ochiladi. To'lovdan keyin natija shu yerda ko'rinadi.")}
        </p>
      </div>
    </ModalPortal>
  );
};

export default PaymentConfirmModal;
