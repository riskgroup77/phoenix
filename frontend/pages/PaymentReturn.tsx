/**
 * Click'dan qaytish (return_url): to'lov holatini tekshiradi va foydalanuvchini darhol xizmat sahifasiga
 * qaytaradi, natijani alert bilan ko'rsatadi. Avval oraliq "Click To'lov" kartasi ochilib, holat har 3 s da
 * tekshirilar, tasdiqlangach yana 3,5 s kutib keyin qaytilardi.
 */
import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { apiService } from '../services/apiService';
import {
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_RETURN_MAX_WAIT_MS,
  paymentDestination,
  paymentSuccessMessage,
  SELF_REPORTING_SERVICES,
  type ReturnTx,
} from '../utils/paymentReturn';

const SUBMIT_ARTICLE_PENDING_KEY = 'phonix_submit_article_pending';

async function fetchTx(id: string): Promise<ReturnTx | null> {
  try {
    // Click bilan sinxronlash (callback kechiksa ham holat aniqlanadi)
    const res = await apiService.payments.checkStatus(id);
    if (res?.transaction?.id) return res.transaction as ReturnTx;
  } catch {
    /* oddiy GET bilan davom etamiz */
  }
  try {
    return (await apiService.payments.getTransaction(id)) as ReturnTx;
  } catch {
    return null;
  }
}

const PaymentReturn: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const transactionId = params.get('transaction_id') || '';
  const done = useRef(false);

  useEffect(() => {
    if (!transactionId) {
      navigate('/payments', { replace: true });
      return;
    }
    let timer: number | undefined;
    const startedAt = Date.now();

    const finish = (to: string, notify: () => void) => {
      if (done.current) return;
      done.current = true;
      notify();
      navigate(to, { replace: true });
    };

    const check = async () => {
      if (done.current) return;
      const tx = await fetchTx(transactionId);
      if (tx?.status === 'completed') {
        sessionStorage.removeItem(SUBMIT_ARTICLE_PENDING_KEY);
        finish(paymentDestination(tx), () => {
          // Antiplagiat / UDK sahifasi to'lov natijasini o'zi ko'rsatadi — takrorlamaymiz
          if (!SELF_REPORTING_SERVICES.has(tx.service_type || '')) {
            toast.success(paymentSuccessMessage(tx.service_type), { toastId: `payment-${tx.id}` });
          }
        });
        return;
      }
      if (tx?.status === 'failed' || tx?.status === 'cancelled') {
        finish(paymentDestination(tx), () =>
          toast.error(tx.error_note || "To'lov amalga oshmadi yoki bekor qilindi. Qaytadan urinib ko'ring.", { toastId: `payment-${tx.id}` }),
        );
        return;
      }
      if (Date.now() - startedAt >= PAYMENT_RETURN_MAX_WAIT_MS) {
        finish(paymentDestination(tx), () =>
          toast.info("To'lov hali tasdiqlanmadi. Tasdiqlanganda bildirishnoma keladi — holatni «To'lovlarim» bo'limida ko'rishingiz mumkin."),
        );
        return;
      }
      timer = window.setTimeout(check, PAYMENT_POLL_INTERVAL_MS);
    };

    check();
    return () => window.clearTimeout(timer);
  }, [transactionId, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[var(--editorial-bg,#fdfbf7)] text-[var(--editorial-muted,#64748b)]" role="status" aria-live="polite">
      <Loader2 className="h-10 w-10 animate-spin text-[var(--editorial-primary,#1f3f8f)]" aria-hidden />
      <p className="text-sm">To'lov tekshirilmoqda...</p>
    </div>
  );
};

export default PaymentReturn;
