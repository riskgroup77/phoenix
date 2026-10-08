import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BarChart3, CalendarDays, Clock, CreditCard, TrendingUp, Wallet, XCircle } from 'lucide-react';
import { DashboardHero, SectionHead, StatRow, StatTile, TodoCard, greeting, type TodoItem } from '../../components/dashboard/DashboardParts';
import EmptyState from '../../components/EmptyState';
import { apiService } from '../../services/apiService';
import { useT } from '../../i18n/LanguageContext';
import { txAmount } from '../../utils/amount';
import { formatUzDate } from '../../utils/uzDate';

type Props = { firstName: string; transactions: any[] };

const money = (v: number) => Math.round(v || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const DAY = 24 * 60 * 60 * 1000;

/** Moliyachi: bugungi/haftalik tushum, yakunlanmagan va muvaffaqiyatsiz to'lovlar. */
const AccountantDashboard: React.FC<Props> = ({ firstName, transactions }) => {
  const { t } = useT();
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    apiService.analytics.overview(3).then((d) => alive && setOverview(d)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const paid = transactions.filter((x) => x.status === 'completed' && x.service_type !== 'top_up');
  const sum = (list: any[]) => list.reduce((s, x) => s + Math.abs(txAmount(x.amount)), 0);
  const today = paid.filter((x) => new Date(x.completed_at || x.created_at).getTime() >= startOfDay.getTime());
  const week = paid.filter((x) => now - new Date(x.completed_at || x.created_at).getTime() <= 7 * DAY);
  const stalePending = transactions.filter((x) => x.status === 'pending' && now - new Date(x.created_at).getTime() > DAY);
  const failedWeek = transactions.filter(
    (x) => (x.status === 'failed' || x.status === 'cancelled') && now - new Date(x.created_at).getTime() <= 7 * DAY,
  );

  const todos: TodoItem[] = [
    { key: 'stale', icon: Clock, title: t("24 soatdan ortiq kutilayotgan to'lovlar"), hint: t("Click/Payme holatini tekshiring"), count: stalePending.length, to: '/financials', tone: 'warning' },
    { key: 'failed', icon: XCircle, title: t("Muvaffaqiyatsiz to'lovlar (7 kun)"), hint: t('Sababini ko‘rib chiqing'), count: failedWeek.length, to: '/financials', tone: 'danger' },
  ];

  const recent = [...transactions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);
  const rev = overview?.revenue;

  return (
    <div className="flex flex-col gap-7">
      <DashboardHero
        title={`${greeting(t)}, ${firstName}!`}
        subtitle={t("Bugun {n} ta to'lov qabul qilindi.", { n: today.length })}
        actions={
          <>
            <Link to="/financials" className="milliy-btn-on-band milliy-btn-on-band--ghost">
              <CreditCard className="w-4 h-4" aria-hidden /> {t('Moliya')}
            </Link>
            <Link to="/analytics" className="milliy-btn-on-band">
              <BarChart3 className="w-4 h-4" aria-hidden /> {t('Analitika')}
            </Link>
          </>
        }
      />

      <StatRow label={t("Ko'rsatkichlar")}>
        <StatTile icon={Wallet} value={money(sum(today))} label={t("Bugungi tushum, so'm")} to="/financials" />
        <StatTile icon={CalendarDays} value={money(sum(week))} label={t("7 kunlik tushum, so'm")} to="/financials" />
        <StatTile icon={TrendingUp} value={rev ? money(rev.this_month) : '—'} label={t("Shu oy, so'm")} to="/analytics" />
        <StatTile icon={AlertTriangle} value={stalePending.length + failedWeek.length} label={t("E'tibor talab qiladi")} tone={stalePending.length + failedWeek.length > 0 ? 'alert' : 'default'} />
      </StatRow>

      <div className="flex flex-wrap gap-6 items-start">
        <section aria-labelledby="ac-recent" className="flex flex-col gap-3.5 min-w-0 flex-[2_1_520px]">
          <SectionHead id="ac-recent" title={t("So'nggi tranzaksiyalar")} to="/financials" />
          {recent.length === 0 ? (
            <EmptyState illustration="payments" title={t("Hozircha tranzaksiyalar yo'q")} />
          ) : (
            <ul className="m-0 p-0 list-none editorial-card !p-0 divide-y divide-[var(--editorial-border)]">
              {recent.map((x) => {
                const failed = x.status === 'failed' || x.status === 'cancelled';
                return (
                  <li key={x.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{x.user_name || t("Noma'lum foydalanuvchi")}</span>
                      <span className="block text-xs text-[var(--editorial-muted)] truncate">
                        {[t(x.service_label || x.service_type), formatUzDate(x.created_at, true)].join(' · ')}
                      </span>
                      {failed && x.error_note && <span className="block text-xs text-[#b91c1c] dark:text-[#f87171] truncate">{x.error_note}</span>}
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-bold tabular-nums">{money(Math.abs(txAmount(x.amount)))}</span>
                      <span className={`pinm-badge ${x.status === 'completed' ? 'pinm-badge--success' : failed ? 'pinm-badge--danger' : 'pinm-badge--info'}`}>
                        {x.status === 'completed' ? t("To'langan") : failed ? t('Muvaffaqiyatsiz') : t('Kutilmoqda')}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <TodoCard items={todos} className="min-w-0 flex-[1_1_300px]" />
      </div>
    </div>
  );
};

export default AccountantDashboard;
