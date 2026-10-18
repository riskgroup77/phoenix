/**
 * UDK buyurtmasi holati (UdkOlish sahifasi): "To'lov tasdiqlandi → UDK aniqlanmoqda → Tayyor".
 * To'lovdan qaytganda (yoki "Ishlarim" dan ochilganda) forma o'rniga ko'rinadi — antiplagiat sahifasidagidek
 * foydalanuvchi bo'sh formani emas, buyurtmasining jarayonini va natijasini ko'radi.
 */
import React from 'react';
import { AlertTriangle, Award, Check, CreditCard, Download, Eye, Loader2, Plus, RefreshCw, UserCheck, X } from 'lucide-react';
import Button from './ui/Button';
import { useT } from '../i18n/LanguageContext';

export type UdkTrackPhase =
  | 'checking'
  | 'payment_pending'
  | 'payment_failed'
  | 'classifying'
  | 'manual'
  | 'completed'
  | 'rejected';

export interface UdkOrderView {
  id: string;
  title: string;
  udk_code?: string;
  udk_description?: string;
  reject_reason?: string;
  certificate_id?: number | null;
  payment_status?: string | null;
}

type StepState = 'done' | 'active' | 'todo' | 'error';

interface Props {
  phase: UdkTrackPhase;
  order: UdkOrderView | null;
  busy?: { pay?: boolean; recheck?: boolean; download?: boolean };
  onPay: () => void;
  onRecheck: () => void;
  onView: () => void;
  onDownload: () => void;
  onReference: () => void;
  onNew: () => void;
  onEdit?: () => void;
}

const stepStates = (phase: UdkTrackPhase): [StepState, StepState, StepState] => {
  switch (phase) {
    case 'checking':
    case 'payment_pending':
      return ['active', 'todo', 'todo'];
    case 'payment_failed':
      return ['error', 'todo', 'todo'];
    case 'classifying':
    case 'manual':
      return ['done', 'active', 'todo'];
    case 'rejected':
      return ['done', 'error', 'todo'];
    case 'completed':
      return ['done', 'done', 'done'];
  }
};

const dotClass: Record<StepState, string> = {
  done: 'bg-emerald-600 text-white border-emerald-600',
  active: 'bg-[var(--editorial-primary)] text-white border-[var(--editorial-primary)]',
  todo: 'bg-transparent text-slate-400 border-slate-300 dark:border-slate-600',
  error: 'bg-red-600 text-white border-red-600',
};

const StepDot: React.FC<{ state: StepState; index: number }> = ({ state, index }) => (
  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${dotClass[state]}`}>
    {state === 'done' ? (
      <Check className="h-4 w-4" aria-hidden />
    ) : state === 'error' ? (
      <X className="h-4 w-4" aria-hidden />
    ) : state === 'active' ? (
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
    ) : (
      index + 1
    )}
  </span>
);

const UdkOrderStatusCard: React.FC<Props> = ({
  phase, order, busy = {}, onPay, onRecheck, onView, onDownload, onReference, onNew, onEdit,
}) => {
  const { t } = useT();
  const states = stepStates(phase);
  const paymentLabel =
    phase === 'payment_failed'
      ? t("To'lov amalga oshmadi")
      : states[0] === 'done'
        ? t("To'lov tasdiqlandi")
        : phase === 'checking'
          ? t("To'lov tekshirilmoqda...")
          : t("To'lov kutilmoqda");
  const steps = [
    paymentLabel,
    phase === 'manual'
      ? t("Mutaxassis ko'rib chiqmoqda")
      : phase === 'rejected'
        ? t('Rad etilgan')
        : states[1] === 'done'
          ? t('UDK aniqlandi')
          : t('UDK aniqlanmoqda'),
    t('Tayyor'),
  ];

  const headline: Record<UdkTrackPhase, string> = {
    checking: t("To'lov holati tekshirilmoqda..."),
    payment_pending: t("To'lov hali tasdiqlanmagan"),
    payment_failed: t("To'lov yakunlanmadi yoki bekor qilindi."),
    classifying: t('UDK kodi aniqlanmoqda'),
    manual: t("Mutaxassis ko'rib chiqmoqda"),
    completed: t("UDK ma'lumotnomangiz tayyor"),
    rejected: t("UDK so'rovi rad etildi"),
  };
  const hint: Partial<Record<UdkTrackPhase, string>> = {
    checking: t("Click'dan to'lov natijasi olinmoqda, iltimos kuting."),
    payment_pending: t("Agar Click'da to'lagan bo'lsangiz, tasdiq 1–2 daqiqada keladi — sahifa holatni o'zi tekshiradi. To'lamagan bo'lsangiz, shu buyurtmani to'lang (qayta buyurtma berish shart emas)."),
    payment_failed: t("Pul yechilmagan bo'lsa, shu buyurtmani qayta to'lashingiz yoki yangi so'rov yuborishingiz mumkin."),
    classifying: t("To'lov tasdiqlandi. UDK kodi klassifikator asosida avtomatik aniqlanmoqda — odatda bir necha soniya."),
    manual: t("Avtomatik aniqlab bo'lmadi — UDK kodini mutaxassis qo'lda belgilaydi. Tayyor bo'lganda bildirishnoma keladi."),
  };

  const tone =
    phase === 'completed'
      ? 'border-emerald-300 dark:border-emerald-800'
      : phase === 'payment_failed' || phase === 'rejected'
        ? 'border-red-300 dark:border-red-800'
        : 'border-[var(--editorial-primary)]/30';

  return (
    <section
      className={`editorial-card pinm-card border-2 ${tone}`}
      aria-live="polite"
      aria-busy={phase === 'checking' || phase === 'classifying'}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--editorial-primary)]/10 text-[var(--editorial-primary)]">
          {phase === 'completed' ? <Award className="h-6 w-6" aria-hidden />
            : phase === 'manual' ? <UserCheck className="h-6 w-6" aria-hidden />
              : phase === 'payment_failed' || phase === 'rejected' ? <AlertTriangle className="h-6 w-6" aria-hidden />
                : <Loader2 className="h-6 w-6 animate-spin" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-lg font-semibold text-[var(--editorial-text)]">{headline[phase]}</h2>
          {order?.title && <p className="mt-0.5 text-sm text-slate-500 break-words">{order.title}</p>}
        </div>
      </div>

      {/* Bosqichlar */}
      <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label={t('Buyurtma bosqichlari')}>
        {steps.map((label, i) => (
          <li key={i} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
            <div className="flex items-center gap-2 sm:w-full">
              <StepDot state={states[i]} index={i} />
              {i < 2 && (
                <span
                  className={`hidden h-0.5 flex-1 rounded sm:block ${states[i] === 'done' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  aria-hidden
                />
              )}
            </div>
            <span className={`text-sm ${states[i] === 'todo' ? 'text-slate-400' : 'font-medium text-[var(--editorial-text)]'}`}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      {hint[phase] && <p className="mt-4 text-sm text-slate-600">{hint[phase]}</p>}

      {phase === 'rejected' && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {order?.reject_reason || t("Sabab ko'rsatilmagan. Savollar bo'lsa, operatorga murojaat qiling.")}
        </p>
      )}

      {phase === 'completed' && order && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="m-0 text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">{t('UDK kodi')}</p>
          <p className="m-0 mt-1 break-all font-mono text-2xl font-bold text-emerald-900 dark:text-emerald-200">{order.udk_code}</p>
          {order.udk_description && (
            <p className="m-0 mt-2 text-sm text-slate-700 dark:text-slate-300">{order.udk_description}</p>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {(phase === 'payment_pending' || (phase === 'payment_failed' && order?.payment_status !== 'cancelled')) && (
          <Button type="button" variant="accent" onClick={onPay} disabled={busy.pay} className="gap-2">
            {busy.pay ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CreditCard className="h-4 w-4" aria-hidden />}
            {phase === 'payment_failed' ? t("Qayta to'lash") : t("Shu buyurtmani to'lash")}
          </Button>
        )}
        {phase === 'payment_pending' && (
          <Button type="button" variant="secondary" onClick={onRecheck} disabled={busy.recheck} className="gap-2">
            {busy.recheck ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            {t("To'lov holatini tekshirish")}
          </Button>
        )}
        {phase === 'completed' && (
          <>
            <Button type="button" variant="primary" onClick={onDownload} disabled={busy.download || !order?.certificate_id} className="gap-2">
              {busy.download ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
              {t('Yuklab olish')}
            </Button>
            <Button type="button" variant="secondary" onClick={onView} disabled={!order?.certificate_id} className="gap-2">
              <Eye className="h-4 w-4" aria-hidden /> {t("Ko'rish")}
            </Button>
          </>
        )}
        {order && phase !== 'checking' && (
          <Button type="button" variant="secondary" onClick={onReference} className="gap-2">
            <Award className="h-4 w-4" aria-hidden /> {t("Ma'lumotnoma")}
          </Button>
        )}
        {phase === 'payment_pending' && onEdit && (
          <Button type="button" variant="secondary" onClick={onEdit}>
            {t("Ma'lumotlarni tahrirlash")}
          </Button>
        )}
        {(phase === 'completed' || phase === 'payment_failed' || phase === 'rejected' || phase === 'manual') && (
          <Button type="button" variant="secondary" onClick={onNew} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden /> {t("Yangi UDK so'rovi")}
          </Button>
        )}
      </div>
    </section>
  );
};

export default UdkOrderStatusCard;
