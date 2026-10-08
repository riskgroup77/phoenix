import React from 'react';
import { AlertTriangle, CheckCircle, CircleDot, CreditCard, FileSearch, Send, XCircle } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';
import { formatUzDate } from '../utils/uzDate';

export type TimelineEntry = {
  kind?: 'status' | 'payment' | 'plagiarism';
  status: string;
  to_status?: string;
  from_status?: string;
  date: string;
  comment?: string;
  responsible?: string;
  hint?: string;
  tone?: 'success' | 'warning' | 'danger' | 'info';
};

const timeOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function durationLabel(fromIso: string, toIso: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const hours = ms / 3_600_000;
  if (hours < 1) return t('1 soatdan kam');
  if (hours < 24) return t('{n} soat', { n: Math.round(hours) });
  return t('{n} kun', { n: Math.round(hours / 24) });
}

const iconFor = (e: TimelineEntry) => {
  if (e.kind === 'payment') return CreditCard;
  if (e.kind === 'plagiarism') return FileSearch;
  if (e.tone === 'success') return CheckCircle;
  if (e.tone === 'danger') return XCircle;
  if (e.tone === 'warning') return AlertTriangle;
  if (!e.from_status) return Send;
  return CircleDot;
};

/**
 * Maqola tarixi: "Yuborildi → Muharrirda → Taqrizda → Tahrirga qaytdi ..." — sana, mas'ul va izoh bilan.
 * Oxirgi holat ajratib ko'rsatiladi va unda qancha vaqt turgani yoziladi.
 */
const ArticleTimeline: React.FC<{ entries: TimelineEntry[] }> = ({ entries }) => {
  const { t } = useT();
  const statusEntries = entries.filter((e) => (e.kind ?? 'status') === 'status');
  const current = statusEntries[statusEntries.length - 1];

  if (entries.length === 0) {
    return <p className="m-0 text-sm text-[var(--editorial-muted)]">{t("Tarix hali mavjud emas.")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {current && (
        <div className="rounded-[12px] border border-[var(--editorial-border)] bg-[var(--editorial-bg-alt)] p-4 flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--editorial-muted)]">{t('Hozirgi holat')}</span>
          <span className="text-lg font-extrabold text-[var(--editorial-text)]">{t(current.status)}</span>
          {current.hint && <span className="text-sm text-[var(--editorial-body)]">{t(current.hint)}</span>}
          <span className="text-xs text-[var(--editorial-muted)]">
            {t('{d} dan beri', { d: formatUzDate(current.date, true) })}
            {' · '}
            {durationLabel(current.date, new Date().toISOString(), t)}
          </span>
        </div>
      )}

      <ol className="milliy-timeline" aria-label={t('Maqola tarixi')}>
        {entries.map((e, idx) => {
          const Icon = iconFor(e);
          const isCurrent = e === current;
          const next = entries.slice(idx + 1).find((x) => (x.kind ?? 'status') === 'status');
          const stayed = (e.kind ?? 'status') === 'status' && next ? durationLabel(e.date, next.date, t) : '';
          const dotTone = isCurrent ? 'current' : e.tone && e.tone !== 'info' ? e.tone : '';
          return (
            <li key={`${e.date}-${idx}`} className="milliy-timeline-item">
              <span className={`milliy-timeline-dot ${dotTone ? `milliy-timeline-dot--${dotTone}` : ''}`} aria-hidden>
                <Icon className="w-4 h-4" />
              </span>
              <div className="min-w-0 pt-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="font-bold text-[var(--editorial-text)]">{t(e.status)}</span>
                  <time dateTime={e.date} className="text-xs text-[var(--editorial-muted)] tabular-nums">
                    {formatUzDate(e.date, true)} {timeOf(e.date)}
                  </time>
                </div>
                <div className="text-xs text-[var(--editorial-muted)] mt-0.5">
                  {[e.responsible ? t(e.responsible) : '', e.kind === 'payment' ? e.comment : '', stayed ? t('bu bosqichda {d}', { d: stayed }) : '']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {e.kind !== 'payment' && e.comment && (
                  <div className={`milliy-timeline-note ${e.tone === 'danger' ? 'milliy-timeline-note--danger' : e.tone === 'warning' ? 'milliy-timeline-note--warning' : ''}`}>
                    {e.comment}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default ArticleTimeline;
