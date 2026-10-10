import React from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, FileText } from 'lucide-react';
import { useT } from '../../i18n/LanguageContext';
import {
  AiAction,
  AiCard,
  FIELD_LABELS,
  VALUE_LABELS,
  formatSom,
} from './types';

type Handlers = {
  onOpen: (path: string, label: string) => void;
  onSend: (text: string) => void;
  onOpenAction: (action: AiAction) => void;
};

const card = 'rounded-xl border border-[var(--editorial-border)] bg-[var(--editorial-bg)] overflow-hidden';
const linkBtn =
  'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--editorial-primary)] hover:bg-[var(--editorial-bg-alt)] min-h-[32px]';

const PAYMENT_LABELS: Record<string, string> = {
  publication_fee: "Nashr to'lovi",
  language_editing: 'Antiplagiat',
  plagiarism_check: 'Antiplagiat',
  udk_request: 'UDK',
  doi_request: 'DOI',
  translation: 'Tarjima',
  book_publication: 'Kitob nashri',
  article_sample: 'Maqola namunasi',
  'fast-track': 'Tezkor nashr',
  top_up: "Hisobni to'ldirish",
};

export const StageBar: React.FC<{ stage: number; stages: string[] }> = ({ stage, stages }) => {
  const { t } = useT();
  const rejected = stage < 0;
  return (
    <div className="flex gap-1" role="img" aria-label={rejected ? t('Rad etilgan') : `${Math.min(stage, stages.length)}/${stages.length}`}>
      {stages.map((s, i) => (
        <span
          key={s}
          title={t(s)}
          className={`h-1.5 flex-1 rounded-full ${
            rejected ? 'bg-red-300' : i < stage ? 'bg-[var(--editorial-teal,#0b6f74)]' : i === stage ? 'bg-[var(--editorial-primary)]' : 'bg-[var(--editorial-border)]'
          }`}
        />
      ))}
    </div>
  );
};

export const fieldValue = (key: string, value: unknown, t: (k: string) => string, journalName?: string): string => {
  if (key === 'journalId') return journalName || String(value ?? '');
  if (typeof value === 'boolean') return value ? t('Ha') : t("Yo'q");
  if (typeof value === 'number') return value.toLocaleString('ru-RU');
  const s = String(value ?? '');
  return VALUE_LABELS[s] ? t(VALUE_LABELS[s]) : s;
};

export const ActionSummary: React.FC<{ action: AiAction } & Pick<Handlers, 'onOpenAction'>> = ({ action, onOpenAction }) => {
  const { t } = useT();
  const rows = action.filled.filter((k) => !['abstract', 'synopsis', 'documentDescription'].includes(k)).slice(0, 7);
  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-2 bg-[var(--editorial-bg-alt)] px-3 py-2">
        <span className="text-xs font-bold text-[var(--editorial-text)]">{t(action.label)}</span>
        {action.quote?.amount ? (
          <span className="text-xs font-bold text-[var(--editorial-text)]">{formatSom(action.quote.amount)} {t("so'm")}</span>
        ) : null}
      </div>
      <div className="px-3 py-2.5 space-y-1.5 text-[13px]">
        {rows.map((k) => (
          <div key={k} className="grid grid-cols-[minmax(0,40%)_minmax(0,1fr)] gap-2">
            <span className="text-[var(--editorial-muted)] truncate">{t(FIELD_LABELS[k] || k)}</span>
            <span className="text-[var(--editorial-text)] break-words [overflow-wrap:anywhere] line-clamp-2">
              {fieldValue(k, action.fields[k], t, action.journal?.name)}
            </span>
          </div>
        ))}
        {action.missing.length > 0 && (
          <div className="flex items-start gap-1.5 pt-1 text-amber-800 dark:text-amber-300">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {t('Kerak:')} {action.missing.map((m) => t(FIELD_LABELS[m] || m)).join(', ')}
            </span>
          </div>
        )}
      </div>
      <div className="border-t border-[var(--editorial-border)] px-2 py-1.5">
        <button type="button" className={linkBtn} onClick={() => onOpenAction(action)}>
          {t("Formani ko'rish")} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
};

const AiCards: React.FC<{ cards: AiCard[] } & Handlers> = ({ cards, onOpen, onSend }) => {
  const { t } = useT();
  return (
    <div className="space-y-2.5">
      {cards.map((c, idx) => {
        if (c.type === 'file') {
          const f = c.file;
          return (
            <div key={idx} className={`${card} p-3 flex gap-3`}>
              <FileText className="h-5 w-5 shrink-0 text-[var(--editorial-primary)]" aria-hidden />
              <div className="min-w-0 text-[13px] space-y-1">
                <div className="font-semibold text-[var(--editorial-text)] break-words">{f.title || f.filename}</div>
                <div className="text-[var(--editorial-muted)]">
                  {t("{words} so'z · ~{pages} bet", { words: f.word_count.toLocaleString('ru-RU'), pages: f.page_estimate || 1 })}
                </div>
                {f.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {f.keywords.slice(0, 6).map((k) => (
                      <span key={k} className="rounded-full bg-[var(--editorial-bg-alt)] px-2 py-0.5 text-[11px] text-[var(--editorial-body)]">{k}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }
        if (c.type === 'articles') {
          return (
            <div key={idx} className={`${card} divide-y divide-[var(--editorial-border)]`}>
              {c.items.map((a) => (
                <div key={a.id} className="p-3 space-y-2 text-[13px]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--editorial-text)] break-words line-clamp-2">{a.title}</div>
                      <div className="text-[var(--editorial-muted)] truncate">{a.journal}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--editorial-bg-alt)] px-2 py-0.5 text-[11px] font-semibold text-[var(--editorial-text)]">
                      {t(a.status_label)}
                    </span>
                  </div>
                  <StageBar stage={a.stage} stages={a.stages} />
                  {a.hint && <div className="text-[var(--editorial-body)]">{t(a.hint)}</div>}
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className={linkBtn} onClick={() => onOpen(`/articles/${a.id}`, a.title)}>
                      {t('Ochish')} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    {a.needs_payment && (
                      <button type="button" className={linkBtn} onClick={() => onOpen(`/articles/${a.id}`, a.title)}>
                        {t("To'lovni tugatish")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        if (c.type === 'payments') {
          const rows = [...c.pending, ...c.recent].slice(0, 6);
          return (
            <div key={idx} className={card}>
              {rows.length === 0 ? (
                <div className="p-3 text-[13px] text-[var(--editorial-muted)]">{t("To'lovlar hali yo'q.")}</div>
              ) : (
                <div className="divide-y divide-[var(--editorial-border)]">
                  {rows.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                      <span className="min-w-0 truncate text-[var(--editorial-text)]">{t(PAYMENT_LABELS[p.service_type] || p.service_type)}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold">{formatSom(p.amount)}</span>
                        {p.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-label={t('Tasdiqlangan')} />
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">{t('Kutilmoqda')}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-[var(--editorial-border)] px-2 py-1.5">
                <button type="button" className={linkBtn} onClick={() => onOpen('/payments', t("To'lovlarim"))}>
                  {t("To'lovlarim")} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          );
        }
        if (c.type === 'prices') {
          return (
            <div key={idx} className={`${card} divide-y divide-[var(--editorial-border)]`}>
              {c.items.map((p) => (
                <div key={p.label} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                  <span className="text-[var(--editorial-text)]">{p.label}</span>
                  <span className="font-semibold whitespace-nowrap">
                    {formatSom(p.amount)} {t("so'm")}
                    {p.unit}
                  </span>
                </div>
              ))}
            </div>
          );
        }
        if (c.type === 'journals') {
          return (
            <div key={idx} className={`${card} divide-y divide-[var(--editorial-border)]`}>
              {c.items.map((j) => (
                <div key={j.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]">
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--editorial-text)] break-words">{j.name}</div>
                    <div className="text-[var(--editorial-muted)]">
                      {j.category}
                      {j.publication_fee > 0 && ` · ${formatSom(j.publication_fee)} ${t("so'm")}`}
                      {j.pricing_type === 'per_page' && j.price_per_page > 0 && ` · ${formatSom(j.price_per_page)} ${t("so'm / bet")}`}
                      {j.plagiarism_max_percent ? ` · ${t('plagiat ≤ {n}%', { n: j.plagiarism_max_percent })}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg bg-[var(--editorial-primary)] px-3 py-1.5 text-xs font-semibold text-white min-h-[34px]"
                    onClick={() => onSend(t('«{name}» jurnaliga yuboraman', { name: j.name }))}
                  >
                    {t('Tanlash')}
                  </button>
                </div>
              ))}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};

export default AiCards;
