import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, BookMarked, Clock, FileText, TrendingDown, TrendingUp, Users, Wallet, XCircle } from 'lucide-react';
import EditorialPageHeader from '../components/EditorialPageHeader';
import EmptyState from '../components/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useT } from '../i18n/LanguageContext';
import { Role } from '../types';

const LAPIS = '#1f3f8f';
const FIRUZA = '#0b6f74';
const GOLD = '#d99a00';


const money = (v: number) => Math.round(v || 0).toLocaleString('ru-RU').replace(/,/g, ' ');
const short = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));

type Overview = any;
type Workload = any;

const Kpi: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'up' | 'down' | 'neutral' }> = ({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
}) => (
  <div className="milliy-stat !items-start">
    <span className="milliy-icon-tile"><Icon className="w-5 h-5" aria-hidden /></span>
    <span className="flex flex-col min-w-0">
      <span className="text-2xl font-extrabold tabular-nums">{value}</span>
      <span className="text-sm font-semibold text-[var(--editorial-muted)]">{label}</span>
      {hint && (
        <span
          className={`text-xs font-semibold mt-0.5 ${
            tone === 'up' ? 'text-[#15803d] dark:text-[#4ade80]' : tone === 'down' ? 'text-[#b91c1c] dark:text-[#f87171]' : 'text-[var(--editorial-muted)]'
          }`}
        >
          {hint}
        </span>
      )}
    </span>
  </div>
);

/** Bosh admin / buxgalter / jurnal admini uchun analitika: tushum, maqolalar oqimi, jurnallar, taqrizchilar. */
const Analytics: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useT();
  const [months, setMonths] = useState(12);
  const [data, setData] = useState<Overview | null>(null);
  const [workload, setWorkload] = useState<Workload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isSuper = user?.role === Role.SuperAdmin;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      apiService.analytics.overview(months),
      isSuper ? apiService.analytics.workload().catch(() => null) : Promise.resolve(null),
    ])
      .then(([ov, wl]) => {
        if (!alive) return;
        setData(ov);
        setWorkload(wl);
      })
      .catch((e) => alive && setError(e?.message || t("Ma'lumotlarni yuklab bo'lmadi")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [months, isSuper, t]);

  const axis = theme === 'dark' ? '#93a0bb' : '#55607a';
  const grid = theme === 'dark' ? '#26324b' : '#e3e8f2';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#151f33' : '#ffffff',
    border: `1px solid ${grid}`,
    borderRadius: 10,
    color: theme === 'dark' ? '#eef2fa' : '#172033',
  };

  const labelByKey = useMemo(() => {
    const m: Record<string, string> = {};
    (data?.months || []).forEach((x: any) => (m[x.key] = x.label));
    return m;
  }, [data]);

  const revenueSeries = useMemo(
    () => (data?.revenue?.monthly || []).map((r: any) => ({ ...r, label: labelByKey[r.key] || r.key })),
    [data, labelByKey],
  );
  const flowSeries = useMemo(
    () => (data?.articles?.monthly || []).map((r: any) => ({ ...r, label: labelByKey[r.key] || r.key })),
    [data, labelByKey],
  );

  if (loading) return <PageSkeleton />;
  if (error || !data) {
    return <EmptyState illustration="chart" title={t("Analitikani yuklab bo'lmadi")} description={error || ''} />;
  }

  const rev = data.revenue;
  const art = data.articles;
  const change: number | null = rev?.change_pct ?? null;

  return (
    <div className="flex flex-col gap-7">
      <EditorialPageHeader
        title={t('Analitika')}
        subtitle={t("Platforma ko'rsatkichlari: tushum, maqolalar oqimi, jurnallar va taqrizchilar ishi.")}
        actions={
          <div className="flex gap-1 p-1 rounded-[10px] border border-[var(--editorial-border)] bg-[var(--milliy-surface)]" role="group" aria-label={t('Davr')}>
            {[6, 12, 24].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={months === m}
                onClick={() => setMonths(m)}
                className={`px-3 min-h-[2.25rem] rounded-[8px] text-sm font-semibold ${
                  months === m ? 'bg-[var(--milliy-lapis)] text-white' : 'text-[var(--editorial-body)] hover:bg-[var(--editorial-bg-alt)]'
                }`}
              >
                {t('{n} oy', { n: m })}
              </button>
            ))}
          </div>
        }
      />

      {rev && (
        <section aria-labelledby="an-revenue" className="flex flex-col gap-4">
          <h2 id="an-revenue" className="m-0 text-xl">{t('Moliya')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi icon={Wallet} label={t("Davr tushumi, so'm")} value={money(rev.total_period)} />
            <Kpi
              icon={change !== null && change < 0 ? TrendingDown : TrendingUp}
              label={t("Shu oy, so'm")}
              value={money(rev.this_month)}
              tone={change === null ? 'neutral' : change >= 0 ? 'up' : 'down'}
              hint={change === null ? t("O'tgan oy bilan solishtirib bo'lmaydi") : t("{p}% o'tgan oyga nisbatan", { p: `${change > 0 ? '+' : ''}${change}` })}
            />
            <Kpi icon={FileText} label={t("O'rtacha chek, so'm")} value={money(rev.average_check)} />
            <Kpi icon={XCircle} label={t("Kutilayotgan / muvaffaqiyatsiz")} value={`${rev.pending_count} / ${rev.failed_count}`} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="editorial-card xl:col-span-2">
              <h3 className="m-0 mb-4 text-base">{t('Oylik tushum')}</h3>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={LAPIS} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={LAPIS} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={short} tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${money(v)} ${t("so'm")}`, t('Tushum')]} />
                    <Area type="monotone" dataKey="total" stroke={theme === 'dark' ? '#8aa6f0' : LAPIS} strokeWidth={2.5} fill="url(#revFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="editorial-card">
              <h3 className="m-0 mb-4 text-base">{t('Xizmatlar kesimida')}</h3>
              {rev.by_service.length === 0 ? (
                <EmptyState compact title={t("Bu davrda to'lovlar yo'q")} />
              ) : (
                <ul className="m-0 p-0 list-none flex flex-col gap-3">
                  {rev.by_service.map((s: any) => {
                    const pct = rev.total_period > 0 ? Math.round((s.total / rev.total_period) * 100) : 0;
                    return (
                      <li key={s.service_type} className="flex flex-col gap-1.5">
                        <span className="flex justify-between gap-2 text-sm">
                          <span className="font-semibold truncate">{t(s.label)}</span>
                          <span className="tabular-nums text-[var(--editorial-muted)] shrink-0">{pct}%</span>
                        </span>
                        <span className="h-2 rounded-full bg-[var(--editorial-bg-alt)] overflow-hidden">
                          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: FIRUZA }} />
                        </span>
                        <span className="text-xs text-[var(--editorial-muted)] tabular-nums">{money(s.total)} {t("so'm")} · {s.count}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {art && (
        <section aria-labelledby="an-articles" className="flex flex-col gap-4">
          <h2 id="an-articles" className="m-0 text-xl">{t('Maqolalar oqimi')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi icon={FileText} label={t('Yuborilgan (davr)')} value={art.submitted_period} hint={t('{n} tasi hozir jarayonda', { n: art.in_progress_now })} />
            <Kpi icon={BookMarked} label={t('Nashr etilgan (davr)')} value={art.published_period} />
            <Kpi
              icon={XCircle}
              label={t('Rad etilish foizi')}
              value={art.rejection_rate === null ? '—' : `${art.rejection_rate}%`}
              hint={t('{n} ta rad etilgan', { n: art.rejected_period })}
            />
            <Kpi icon={Clock} label={t("Nashrgacha o'rtacha muddat")} value={art.avg_days_to_publish === null ? '—' : t('{n} kun', { n: art.avg_days_to_publish })} />
          </div>
          <div className="editorial-card">
            <h3 className="m-0 mb-4 text-base">{t('Oylar kesimida')}</h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={flowSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey="submitted" name={t('Yuborilgan')} fill={theme === 'dark' ? '#8aa6f0' : LAPIS} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="published" name={t('Nashr etilgan')} fill={FIRUZA} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rejected" name={t('Rad etilgan')} fill={GOLD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="editorial-card !p-0 overflow-hidden">
            <h3 className="m-0 px-5 py-4 text-base border-b border-[var(--editorial-border)]">{t('Jurnallar reytingi')}</h3>
            {art.journals.length === 0 ? (
              <div className="p-5"><EmptyState compact title={t("Jurnallar bo'yicha ma'lumot yo'q")} /></div>
            ) : (
              <div className="overflow-x-auto rtable-wrap">
                <table className="w-full text-sm rtable">
                  <thead className="text-left text-[var(--editorial-muted)]">
                    <tr className="border-b border-[var(--editorial-border)]">
                      <th className="px-5 py-3 font-semibold">{t('Jurnal')}</th>
                      <th className="px-3 py-3 font-semibold text-right">{t('Yuborilgan')}</th>
                      <th className="px-3 py-3 font-semibold text-right">{t('Jarayonda')}</th>
                      <th className="px-3 py-3 font-semibold text-right">{t('Nashr')}</th>
                      <th className="px-3 py-3 font-semibold text-right">{t('Rad')}</th>
                      <th className="px-3 py-3 font-semibold text-right">{t('Rad %')}</th>
                      {isSuper && <th className="px-5 py-3 font-semibold text-right">{t("Tushum, so'm")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {art.journals.map((j: any) => (
                      <tr key={j.id} className="border-b border-[var(--editorial-border)] last:border-0">
                        <td className="px-5 py-3 font-semibold max-w-[280px]">
                          <Link to={`/articles?journal=${encodeURIComponent(j.id)}`} className="hover:text-[var(--editorial-primary)] line-clamp-2">{j.name}</Link>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{j.submitted}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{j.in_progress}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{j.published}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{j.rejected}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{j.rejection_rate === null ? '—' : `${j.rejection_rate}%`}</td>
                        {isSuper && <td className="px-5 py-3 text-right tabular-nums">{money(j.revenue)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {data.users && (
        <section aria-labelledby="an-users" className="flex flex-col gap-4">
          <h2 id="an-users" className="m-0 text-xl">{t('Foydalanuvchilar')}</h2>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-4">
              <Kpi icon={Users} label={t('Jami foydalanuvchilar')} value={data.users.total} />
              <Kpi icon={Users} label={t('Mualliflar')} value={data.users.authors} />
              <Kpi icon={TrendingUp} label={t("Shu oy ro'yxatdan o'tganlar")} value={data.users.new_this_month} />
            </div>
            <div className="editorial-card xl:col-span-2">
              <h3 className="m-0 mb-4 text-base">{t("Yangi ro'yxatdan o'tishlar")}</h3>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={(data.users.monthly_signups || []).map((r: any) => ({ ...r, label: labelByKey[r.key] || r.key }))}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke={grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, t('Yangi')]} />
                    <Bar dataKey="count" fill={FIRUZA} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}

      {workload && (
        <section aria-labelledby="an-reviewers" className="flex flex-col gap-4">
          <h2 id="an-reviewers" className="m-0 text-xl">{t('Taqrizchilar ishi')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Kpi icon={FileText} label={t('Ochiq ishlar')} value={workload.counts.total} />
            <Kpi icon={AlertTriangle} label={t('Kechikkan')} value={workload.counts.overdue} tone={workload.counts.overdue > 0 ? 'down' : 'neutral'} hint={workload.counts.overdue > 0 ? t('Muddati o‘tgan') : undefined} />
            <Kpi icon={Clock} label={t('24 soat ichida tugaydi')} value={workload.counts.due_soon} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="editorial-card">
              <h3 className="m-0 mb-3 text-base">{t("O'rtacha bajarilish vaqti (90 kun)")}</h3>
              <ul className="m-0 p-0 list-none divide-y divide-[var(--editorial-border)]">
                {workload.processing.by_kind.map((k: any) => (
                  <li key={k.kind} className="flex justify-between gap-3 py-2.5 text-sm">
                    <span className="font-semibold">{t(k.label)}</span>
                    <span className="tabular-nums text-[var(--editorial-muted)]">
                      {k.avg_days === null ? '—' : t('{n} kun', { n: k.avg_days })} · {t('{n} ta', { n: k.completed })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="editorial-card !p-0 overflow-hidden">
              <h3 className="m-0 px-5 py-4 text-base border-b border-[var(--editorial-border)]">{t('Taqrizchilar')}</h3>
              {(workload.reviewers || []).length === 0 ? (
                <div className="p-5"><EmptyState compact title={t("Faol taqrizchilar yo'q")} /></div>
              ) : (
                <div className="overflow-x-auto rtable-wrap">
                  <table className="w-full text-sm rtable">
                    <thead className="text-left text-[var(--editorial-muted)]">
                      <tr className="border-b border-[var(--editorial-border)]">
                        <th className="px-5 py-3 font-semibold">{t('Taqrizchi')}</th>
                        <th className="px-3 py-3 font-semibold text-right">{t('Bajarilgan (90 kun)')}</th>
                        <th className="px-3 py-3 font-semibold text-right">{t("O'rtacha, kun")}</th>
                        <th className="px-5 py-3 font-semibold text-right">{t('Ochiq')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workload.reviewers.map((r: any) => (
                        <tr key={r.id} className="border-b border-[var(--editorial-border)] last:border-0">
                          <td className="px-5 py-3 font-semibold">{r.name || '—'}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{r.completed_90d}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{r.avg_days ?? '—'}</td>
                          <td className="px-5 py-3 text-right tabular-nums">{r.open_assigned}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          {workload.items.filter((i: any) => i.overdue).length > 0 && (
            <div className="editorial-card">
              <h3 className="m-0 mb-3 text-base text-[#b91c1c] dark:text-[#f87171] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" aria-hidden /> {t('Kechikkan ishlar')}
              </h3>
              <ul className="m-0 p-0 list-none divide-y divide-[var(--editorial-border)]">
                {workload.items
                  .filter((i: any) => i.overdue)
                  .slice(0, 10)
                  .map((i: any) => (
                    <li key={`${i.kind}-${i.id}`}>
                      <Link to={i.link} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-[var(--editorial-primary)]">
                        <span className="min-w-0">
                          <span className="block font-semibold truncate">{i.title}</span>
                          <span className="text-xs text-[var(--editorial-muted)]">{t(i.kind_label)}</span>
                        </span>
                        <span className="pinm-badge pinm-badge--danger shrink-0">
                          {t('{n} kun kechikdi', { n: Math.max(1, Math.round(Math.abs(i.hours_left) / 24)) })}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <p className="m-0 text-xs text-[var(--editorial-muted)]">
        {t("Antiplagiat uchun yaratilgan vaqtinchalik yozuvlar va to'lanmagan qoralamalar hisobga olinmaydi.")}
      </p>
    </div>
  );
};

export default Analytics;
