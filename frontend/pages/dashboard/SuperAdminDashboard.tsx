import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BarChart3, Bot, CheckCircle, CreditCard, Eye, FileText, Inbox, Shield, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react';
import { DashboardHero, SectionHead, StatRow, StatTile, TodoCard, greeting, type TodoItem } from '../../components/dashboard/DashboardParts';
import EmptyState from '../../components/EmptyState';
import { apiService } from '../../services/apiService';
import { useT } from '../../i18n/LanguageContext';
import { txAmount } from '../../utils/amount';
import { formatUzDate } from '../../utils/uzDate';

type Props = { firstName: string; stats: any; articles: any[]; transactions: any[]; users: any[] };

const money = (v: number) => Math.round(v || 0).toLocaleString('ru-RU').replace(/,/g, ' ');

const STATUS_GROUPS: { key: string; label: string; statuses: string[]; color: string }[] = [
  { key: 'new', label: 'Yangi', statuses: ['Yangi', 'WithEditor'], color: '#1f3f8f' },
  { key: 'review', label: 'Taqrizda', statuses: ['QabulQilingan', 'WritingInProgress'], color: '#5b7fe0' },
  { key: 'revision', label: 'Tahrirda', statuses: ['Revision'], color: '#d99a00' },
  { key: 'ready', label: 'Nashrga tayyor', statuses: ['Accepted', 'NashrgaYuborilgan', 'PlagiarismReview'], color: '#0b6f74' },
  { key: 'published', label: 'Nashr etilgan', statuses: ['Published'], color: '#15803d' },
  { key: 'rejected', label: 'Rad etilgan', statuses: ['Rejected'], color: '#b91c1c' },
];

/** Bosh administrator: tushum, qarorlar, kechikishlar va platforma holati. */
const SuperAdminDashboard: React.FC<Props> = ({ firstName, stats, articles, transactions, users }) => {
  const { t } = useT();
  const [overview, setOverview] = useState<any>(null);
  const [workload, setWorkload] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    apiService.analytics.overview(3).then((d) => alive && setOverview(d)).catch(() => undefined);
    apiService.analytics.workload().then((d) => alive && setWorkload(d)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const journalArticles = articles.filter((a) => !String(a.title || '').toLowerCase().startsWith('plagiarism check'));
  const count = (...s: string[]) => journalArticles.filter((a) => s.includes(a.status)).length;
  const rev = overview?.revenue;
  const change: number | null = rev?.change_pct ?? null;
  const items = workload?.items || [];
  const pendingTx = transactions.filter((x) => x.status === 'pending').length;

  const todos: TodoItem[] = [
    { key: 'plag', icon: Shield, title: t('Antiplagiat bo‘yicha qaror kerak'), hint: t('Qabul qiling yoki rad eting'), count: count('PlagiarismReview'), to: '/articles', tone: 'danger' },
    { key: 'overdue', icon: AlertTriangle, title: t('Taqrizchilarda kechikkan ishlar'), count: workload?.counts?.overdue || 0, to: '/analytics', tone: 'danger' },
    { key: 'new', icon: Inbox, title: t('Yangi kelgan maqolalar'), count: count('Yangi', 'WithEditor'), to: '/articles', tone: 'warning' },
    { key: 'doi', icon: Bot, title: t("DOI va UDK so'rovlari"), count: items.filter((i: any) => i.kind === 'doi' || i.kind === 'udk').length, to: '/doi-requests' },
    { key: 'pay', icon: CreditCard, title: t("Yakunlanmagan to'lovlar"), hint: t('Click/Payme javobi kutilmoqda'), count: pendingTx, to: '/financials' },
  ];

  const totalUsers = stats?.users?.total || users.length;
  const publishedCount = stats?.articles?.published ?? count('Published');
  const groupCounts = STATUS_GROUPS.map((g) => ({ ...g, value: count(...g.statuses) }));
  const groupTotal = groupCounts.reduce((s, g) => s + g.value, 0);

  const recentTx = [...transactions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
  const topArticles = [...journalArticles].sort((a, b) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 5);

  return (
    <div className="flex flex-col gap-7">
      <DashboardHero
        title={`${greeting(t)}, ${firstName}!`}
        subtitle={t("Platforma bo'yicha bugungi holat: qarorlar, tushum va maqolalar oqimi.")}
        actions={
          <>
            <Link to="/users" className="milliy-btn-on-band milliy-btn-on-band--ghost">
              <Users className="w-4 h-4" aria-hidden /> {t('Foydalanuvchilar')}
            </Link>
            <Link to="/analytics" className="milliy-btn-on-band">
              <BarChart3 className="w-4 h-4" aria-hidden /> {t('Analitika')}
            </Link>
          </>
        }
      />

      <StatRow label={t("Ko'rsatkichlar")}>
        <StatTile icon={change !== null && change < 0 ? TrendingDown : Wallet} value={rev ? money(rev.this_month) : '—'} label={t("Shu oy tushumi, so'm")} to="/analytics" />
        <StatTile icon={Users} value={totalUsers} label={t('Foydalanuvchilar')} to="/users" />
        <StatTile icon={FileText} value={stats?.articles?.total || journalArticles.length} label={t('Jami maqolalar')} to="/articles" />
        <StatTile icon={CheckCircle} value={publishedCount} label={t('Nashr etilgan')} to="/articles" />
      </StatRow>

      {change !== null && (
        <p className="m-0 -mt-3 text-sm text-[var(--editorial-muted)] flex items-center gap-1.5">
          {change >= 0 ? <TrendingUp className="w-4 h-4 text-[#15803d]" aria-hidden /> : <TrendingDown className="w-4 h-4 text-[#b91c1c]" aria-hidden />}
          {t("Tushum o'tgan oyga nisbatan {p}%", { p: `${change > 0 ? '+' : ''}${change}` })}
        </p>
      )}

      <div className="flex flex-wrap gap-6 items-start">
        <TodoCard items={todos} className="min-w-0 flex-[1_1_320px]" />
        <section aria-labelledby="sa-status" className="editorial-card min-w-0 flex-[1_1_360px]">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 id="sa-status" className="m-0 text-lg">{t('Maqolalar holati')}</h2>
            <span className="text-sm text-[var(--editorial-muted)] tabular-nums">{t('{n} ta', { n: groupTotal })}</span>
          </div>
          {groupTotal === 0 ? (
            <EmptyState compact title={t("Hozircha maqolalar yo'q")} />
          ) : (
            <>
              <div className="flex h-3 rounded-full overflow-hidden bg-[var(--editorial-bg-alt)]" aria-hidden>
                {groupCounts.filter((g) => g.value > 0).map((g) => (
                  <span key={g.key} style={{ width: `${(g.value / groupTotal) * 100}%`, background: g.color }} />
                ))}
              </div>
              <ul className="m-0 mt-4 p-0 list-none grid grid-cols-2 gap-x-4 gap-y-2.5">
                {groupCounts.map((g) => (
                  <li key={g.key} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.color }} aria-hidden />
                    <span className="text-[var(--editorial-muted)] truncate">{t(g.label)}</span>
                    <span className="ml-auto font-bold tabular-nums">{g.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section aria-labelledby="sa-tx" className="flex flex-col gap-3.5">
          <SectionHead id="sa-tx" title={t("So'nggi to'lovlar")} to="/financials" />
          {recentTx.length === 0 ? (
            <EmptyState compact illustration="payments" title={t("To'lovlar yo'q")} />
          ) : (
            <ul className="m-0 p-0 list-none editorial-card !p-0 divide-y divide-[var(--editorial-border)]">
              {recentTx.map((x) => {
                const failed = x.status === 'failed' || x.status === 'cancelled';
                return (
                  <li key={x.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="milliy-icon-tile milliy-icon-tile--sm shrink-0"><CreditCard className="w-4 h-4" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{t(x.service_label || x.service_type)}</span>
                      <span className="block text-xs text-[var(--editorial-muted)] truncate">{[x.user_name, formatUzDate(x.created_at, true)].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={`text-sm font-bold tabular-nums ${failed ? 'text-[#b91c1c] dark:text-[#f87171]' : x.status === 'pending' ? 'text-[#a16207] dark:text-[#facc15]' : 'text-[var(--milliy-firuza)]'}`}>
                      {money(Math.abs(txAmount(x.amount)))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section aria-labelledby="sa-top" className="flex flex-col gap-3.5">
          <SectionHead id="sa-top" title={t("Eng ko'p ko'rilgan maqolalar")} to="/articles" />
          {topArticles.length === 0 ? (
            <EmptyState compact title={t("Hozircha maqolalar yo'q")} />
          ) : (
            <ol className="m-0 p-0 list-none editorial-card !p-0 divide-y divide-[var(--editorial-border)]">
              {topArticles.map((a, i) => (
                <li key={a.id}>
                  <Link to={`/articles/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--editorial-bg-alt)]">
                    <span className="milliy-step-num shrink-0">{i + 1}</span>
                    <span className="flex-1 min-w-0 text-sm font-semibold truncate">{a.title}</span>
                    <span className="flex items-center gap-1 text-sm text-[var(--editorial-muted)] tabular-nums shrink-0">
                      <Eye className="w-4 h-4" aria-hidden /> {a.views_count || 0}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
