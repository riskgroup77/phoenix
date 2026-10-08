import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, PartyPopper } from 'lucide-react';
import GirihPattern from '../GirihPattern';
import { useT } from '../../i18n/LanguageContext';

/** Kun vaqtiga qarab salomlashish */
export function greeting(t: (k: string) => string): string {
  const h = new Date().getHours();
  if (h < 5) return t('Xayrli tun');
  if (h < 12) return t('Xayrli tong');
  if (h < 18) return t('Xayrli kun');
  return t('Xayrli kech');
}

/** Lojuvard salomlashish bloki (girih naqshi bilan) */
export const DashboardHero: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <section className="milliy-hero">
    <GirihPattern opacity={0.12} />
    <div className="relative flex flex-wrap items-end justify-between gap-5">
      <div className="flex flex-col gap-2.5 max-w-2xl">
        <h1 className="m-0 text-3xl sm:text-4xl leading-tight">{title}</h1>
        {subtitle && <p className="milliy-hero-sub m-0 text-base leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  </section>
);

/** Salomlashish blokiga chiqib turadigan ko'rsatkichlar qatori */
export const StatRow: React.FC<{ children: React.ReactNode; label: string }> = ({ children, label }) => (
  <section aria-label={label} className="milliy-hero-overlap grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
    {children}
  </section>
);

export const StatTile: React.FC<{
  icon: React.ElementType;
  value: React.ReactNode;
  label: string;
  to?: string;
  tone?: 'default' | 'alert';
}> = ({ icon: Icon, value, label, to, tone = 'default' }) => {
  const inner = (
    <>
      <span className={`milliy-icon-tile ${tone === 'alert' ? '!bg-[#fde8e8] !text-[#b91c1c] dark:!bg-[rgba(239,68,68,0.16)] dark:!text-[#f87171]' : ''}`}>
        <Icon className="w-5 h-5" aria-hidden />
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-2xl sm:text-[28px] font-extrabold tabular-nums truncate">{value}</span>
        <span className="text-sm font-semibold text-[var(--editorial-muted)]">{label}</span>
      </span>
    </>
  );
  return to ? (
    <Link to={to} className="milliy-stat">
      {inner}
    </Link>
  ) : (
    <div className="milliy-stat">{inner}</div>
  );
};

export type TodoItem = {
  key: string;
  icon: React.ElementType;
  title: string;
  hint?: string;
  count: number;
  to: string;
  tone?: 'info' | 'warning' | 'danger';
};

/** "Bugun nima qilish kerak" — faqat soni > 0 bo'lgan vazifalar; hammasi bajarilgan bo'lsa tabrik. */
export const TodoCard: React.FC<{ items: TodoItem[]; title?: string; className?: string }> = ({ items, title, className = '' }) => {
  const { t } = useT();
  const open = items.filter((i) => i.count > 0);
  return (
    <section aria-labelledby="todo-title" className={`editorial-card flex flex-col gap-1.5 ${className}`}>
      <h2 id="todo-title" className="m-0 mb-2 text-lg">{title || t('Bugun nima qilish kerak')}</h2>
      {open.length === 0 ? (
        <div className="flex items-center gap-3 py-3 text-sm text-[var(--editorial-muted)]">
          <span className="milliy-icon-tile milliy-icon-tile--sm"><PartyPopper className="w-4 h-4" aria-hidden /></span>
          {t("Hamma ishlar bajarilgan. Yangi vazifalar paydo bo'lsa shu yerda ko'rinadi.")}
        </div>
      ) : (
        open.map((item) => {
          const Icon = item.icon;
          const badge =
            item.tone === 'danger'
              ? 'pinm-badge pinm-badge--danger'
              : item.tone === 'warning'
                ? 'pinm-badge pinm-badge--warning'
                : 'pinm-badge pinm-badge--info';
          return (
            <Link
              key={item.key}
              to={item.to}
              className="flex items-center gap-3 min-h-[3rem] px-2 py-2 rounded-[10px] hover:bg-[var(--editorial-bg-alt)] transition-colors"
            >
              <span className="milliy-icon-tile milliy-icon-tile--sm"><Icon className="w-4 h-4" aria-hidden /></span>
              <span className="flex flex-col min-w-0 flex-1">
                <span className="font-bold text-[var(--editorial-text)] truncate">{item.title}</span>
                {item.hint && <span className="text-[13px] text-[var(--editorial-muted)] truncate">{item.hint}</span>}
              </span>
              <span className={`${badge} tabular-nums`}>{item.count}</span>
              <ChevronRight className="w-4 h-4 text-[var(--editorial-muted)] shrink-0" aria-hidden />
            </Link>
          );
        })
      )}
    </section>
  );
};

/** Bo'lim sarlavhasi + "Barchasi" havolasi */
export const SectionHead: React.FC<{ id: string; title: string; to?: string; linkLabel?: string }> = ({ id, title, to, linkLabel }) => {
  const { t } = useT();
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="m-0 text-xl">{title}</h2>
      {to && <Link to={to} className="editorial-link text-sm font-bold">{linkLabel || t('Barchasi')}</Link>}
    </div>
  );
};

/** Muddat belgisi: "2 kun qoldi" / "3 kun kechikdi" */
export const DueChip: React.FC<{ hoursLeft: number; overdue: boolean; dueSoon: boolean }> = ({ hoursLeft, overdue, dueSoon }) => {
  const { t } = useT();
  const days = Math.round(Math.abs(hoursLeft) / 24);
  if (overdue) {
    return <span className="pinm-badge pinm-badge--danger shrink-0">{days >= 1 ? t('{n} kun kechikdi', { n: days }) : t("Muddati o'tdi")}</span>;
  }
  if (dueSoon) {
    return <span className="pinm-badge pinm-badge--warning shrink-0">{t('{n} soat qoldi', { n: Math.max(1, Math.round(hoursLeft)) })}</span>;
  }
  return <span className="pinm-badge pinm-badge--neutral shrink-0">{t('{n} kun qoldi', { n: Math.max(1, days) })}</span>;
};
