import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { CheckCircle, Clock, Download, Receipt, Search, Wallet, XCircle } from 'lucide-react';
import EditorialPageHeader from '../components/EditorialPageHeader';
import EmptyState from '../components/EmptyState';
import { ListSkeleton, Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/apiService';
import { useT } from '../i18n/LanguageContext';
import { formatUzDate } from '../utils/uzDate';
import { txAmount } from '../utils/amount';

type Tx = {
  id: string;
  amount: string | number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  service_type: string;
  service_label?: string;
  receipt_number?: string;
  article?: string | null;
  article_title?: string;
  journal_name?: string;
  payment_provider?: string;
  created_at: string;
  completed_at?: string | null;
  error_note?: string;
};

type Summary = {
  total_paid: number;
  completed_count: number;
  pending_count: number;
  failed_count: number;
  by_service: { service_type: string; label: string; total: number; count: number }[];
};

type Filter = 'all' | 'completed' | 'pending' | 'failed';

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  completed: { label: "To'langan", cls: 'pinm-badge pinm-badge--success', icon: CheckCircle },
  pending: { label: 'Kutilmoqda', cls: 'pinm-badge pinm-badge--info', icon: Clock },
  failed: { label: 'Muvaffaqiyatsiz', cls: 'pinm-badge pinm-badge--danger', icon: XCircle },
  cancelled: { label: 'Bekor qilingan', cls: 'pinm-badge pinm-badge--danger', icon: XCircle },
};

const money = (v: number) => Math.round(v).toLocaleString('ru-RU').replace(/,/g, ' ');

const asList = (data: any): Tx[] => (Array.isArray(data) ? data : data?.results ?? data?.data ?? []);

/** Mening to'lovlarim: barcha to'lovlar bir joyda, har biri uchun PDF chek. */
const Payments: React.FC = () => {
  const { t } = useT();
  const [items, setItems] = useState<Tx[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([apiService.payments.listTransactions(), apiService.payments.summary()])
      .then(([list, sum]) => {
        if (!alive) return;
        setItems(asList(list));
        setSummary(sum);
      })
      .catch((e) => toast.error(e?.message || t("To'lovlarni yuklab bo'lmadi")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((tx) => {
      if (filter === 'completed' && tx.status !== 'completed') return false;
      if (filter === 'pending' && tx.status !== 'pending') return false;
      if (filter === 'failed' && !(tx.status === 'failed' || tx.status === 'cancelled')) return false;
      if (!q) return true;
      return [tx.service_label, tx.article_title, tx.journal_name, tx.receipt_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, filter, query]);

  const download = async (tx: Tx) => {
    setDownloading(tx.id);
    try {
      await apiService.payments.downloadReceipt(tx.id, tx.receipt_number);
    } catch (e: any) {
      toast.error(e?.message || t("Chekni yuklab bo'lmadi"));
    } finally {
      setDownloading(null);
    }
  };

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: 'Barchasi', count: items.length },
    { key: 'completed', label: "To'langan", count: summary?.completed_count },
    { key: 'pending', label: 'Kutilmoqda', count: summary?.pending_count },
    { key: 'failed', label: 'Muvaffaqiyatsiz', count: summary?.failed_count },
  ];

  return (
    <div className="flex flex-col gap-6">
      <EditorialPageHeader
        title={t("To'lovlarim")}
        subtitle={t("Barcha to'lovlaringiz bir joyda. Yakunlangan har bir to'lov uchun PDF chekni yuklab olishingiz mumkin.")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="milliy-stat">
          <span className="milliy-icon-tile"><Wallet className="w-5 h-5" aria-hidden /></span>
          <span className="flex flex-col min-w-0">
            {loading ? <Skeleton className="h-7 w-28" rounded="sm" /> : (
              <span className="text-2xl font-extrabold tabular-nums">{money(summary?.total_paid || 0)}</span>
            )}
            <span className="text-sm font-semibold text-[var(--editorial-muted)]">{t("Jami to'langan, so'm")}</span>
          </span>
        </div>
        <div className="milliy-stat">
          <span className="milliy-icon-tile"><Receipt className="w-5 h-5" aria-hidden /></span>
          <span className="flex flex-col min-w-0">
            {loading ? <Skeleton className="h-7 w-12" rounded="sm" /> : (
              <span className="text-2xl font-extrabold tabular-nums">{summary?.completed_count ?? 0}</span>
            )}
            <span className="text-sm font-semibold text-[var(--editorial-muted)]">{t('Cheklar')}</span>
          </span>
        </div>
        <div className="milliy-stat">
          <span className="milliy-icon-tile"><Clock className="w-5 h-5" aria-hidden /></span>
          <span className="flex flex-col min-w-0">
            {loading ? <Skeleton className="h-7 w-12" rounded="sm" /> : (
              <span className="text-2xl font-extrabold tabular-nums">{summary?.pending_count ?? 0}</span>
            )}
            <span className="text-sm font-semibold text-[var(--editorial-muted)]">{t("Kutilayotgan to'lovlar")}</span>
          </span>
        </div>
      </div>

      {summary && summary.by_service.length > 1 && (
        <section className="editorial-card" aria-labelledby="pay-by-service">
          <h2 id="pay-by-service" className="m-0 mb-4 text-lg">{t('Xizmatlar kesimida')}</h2>
          <ul className="m-0 p-0 list-none flex flex-col gap-3">
            {summary.by_service.map((row) => {
              const pct = summary.total_paid > 0 ? Math.round((row.total / summary.total_paid) * 100) : 0;
              return (
                <li key={row.service_type} className="flex flex-col gap-1.5">
                  <span className="flex justify-between gap-3 text-sm">
                    <span className="font-semibold">{t(row.label)}</span>
                    <span className="tabular-nums text-[var(--editorial-muted)]">
                      {money(row.total)} {t("so'm")} · {row.count}
                    </span>
                  </span>
                  <span className="h-2 rounded-full bg-[var(--editorial-bg-alt)] overflow-hidden">
                    <span className="block h-full rounded-full bg-[var(--milliy-firuza)]" style={{ width: `${pct}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('Holat bo‘yicha saralash')}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3.5 min-h-[2.375rem] rounded-full text-sm font-semibold border transition-colors ${
                filter === f.key
                  ? 'bg-[var(--milliy-lapis)] text-white border-[var(--milliy-lapis)]'
                  : 'bg-[var(--milliy-surface)] text-[var(--editorial-body)] border-[var(--editorial-border)] hover:border-[var(--editorial-primary)]'
              }`}
            >
              {t(f.label)}
              {typeof f.count === 'number' && <span className="ml-1.5 opacity-75 tabular-nums">{f.count}</span>}
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">{t("To'lov qidirish")}</span>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--editorial-muted)]" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Xizmat, maqola yoki chek raqami')} className="editorial-select w-full !pl-9" />
        </label>
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState
          illustration="payments"
          title={t("Hozircha to'lovlar yo'q")}
          description={t("Maqola yuborganingizda yoki xizmatga buyurtma berganingizda to'lovlar shu yerda ko'rinadi.")}
          action={{ label: t("Xizmatlarni ko'rish"), to: '/services' }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState compact illustration="search" title={t('Mos to‘lov topilmadi')} description={t("Filtr yoki qidiruv so'zini o'zgartiring.")} />
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-3">
          {filtered.map((tx) => {
            const badge = STATUS_BADGE[tx.status] || STATUS_BADGE.pending;
            const BadgeIcon = badge.icon;
            const amount = Math.abs(txAmount(tx.amount));
            return (
              <li key={tx.id} className="editorial-card flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 !py-4">
                <span className="milliy-icon-tile shrink-0 hidden sm:flex"><Receipt className="w-5 h-5" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-bold text-[var(--editorial-text)]">{t(tx.service_label || tx.service_type)}</p>
                  {tx.article_title && (
                    tx.article ? (
                      <Link to={`/articles/${tx.article}`} className="block text-sm editorial-link truncate">{tx.article_title}</Link>
                    ) : (
                      <p className="m-0 text-sm text-[var(--editorial-body)] truncate">{tx.article_title}</p>
                    )
                  )}
                  <p className="m-0 mt-0.5 text-xs text-[var(--editorial-muted)]">
                    {[formatUzDate(tx.completed_at || tx.created_at, true), tx.payment_provider ? tx.payment_provider.toUpperCase() : '', tx.receipt_number]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {(tx.status === 'failed' || tx.status === 'cancelled') && tx.error_note && (
                    <p className="m-0 mt-1 text-xs text-red-700 dark:text-red-300">{t('Sabab')}: {tx.error_note}</p>
                  )}
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <span className="text-right">
                    <span className="block text-lg font-extrabold tabular-nums">{money(amount)} {t("so'm")}</span>
                    <span className={`${badge.cls} inline-flex items-center gap-1`}>
                      <BadgeIcon className="w-3.5 h-3.5" aria-hidden /> {t(badge.label)}
                    </span>
                  </span>
                  {tx.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => download(tx)}
                      disabled={downloading === tx.id}
                      className="milliy-btn-secondary !min-h-[2.5rem] !px-3 text-sm"
                      aria-label={t('Chekni yuklab olish')}
                    >
                      <Download className="w-4 h-4" aria-hidden />
                      <span className="hidden md:inline">{downloading === tx.id ? t('Yuklanmoqda...') : t('Chek (PDF)')}</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default Payments;
