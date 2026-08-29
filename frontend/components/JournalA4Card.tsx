import React from 'react';
import { BookOpen, Bookmark, CheckCircle2 } from 'lucide-react';
import { apiService } from '../services/apiService';

export type JournalCardData = {
  id: string;
  name: string;
  description?: string;
  issn?: string;
  publication_fee?: number;
  price_per_page?: number;
  pricing_type?: string;
  payment_model?: string;
  image_url?: string | null;
  category_name?: string;
  admin_name?: string;
  issues?: { issue_number?: string; publication_date?: string }[];
};

type Props = {
  journal: JournalCardData;
  imageError?: boolean;
  onImageError?: () => void;
  onSelect: () => void;
  selected?: boolean;
};

function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : apiService.getMediaUrl(url);
}

function latestIssueLabel(issues?: JournalCardData['issues']): string {
  if (!issues?.length) return '';
  const sorted = [...issues].sort((a, b) => {
    const da = a.publication_date ? Date.parse(a.publication_date) : 0;
    const db = b.publication_date ? Date.parse(b.publication_date) : 0;
    return db - da;
  });
  const latest = sorted[0];
  const year = latest.publication_date
    ? new Date(latest.publication_date).getFullYear()
    : new Date().getFullYear();
  const num = latest.issue_number || '1';
  return `${year} — № ${num}`;
}

function priceLabel(journal: JournalCardData): { main: string; sub: string } {
  const isFixed =
    journal.pricing_type === 'fixed' ||
    (journal.publication_fee != null &&
      journal.publication_fee > 0 &&
      !journal.price_per_page);
  if (isFixed) {
    return {
      main: `${(journal.publication_fee ?? 0).toLocaleString('uz-UZ')} so'm`,
      sub: "To'liq to'lov",
    };
  }
  if (journal.price_per_page != null && journal.price_per_page > 0) {
    return {
      main: `${journal.price_per_page.toLocaleString('uz-UZ')} so'm / sahifa`,
      sub: 'Sahifabop narx',
    };
  }
  return { main: 'Bepul', sub: "To'lov talab qilinmaydi" };
}

const JournalA4Card: React.FC<Props> = ({
  journal,
  imageError,
  onImageError,
  onSelect,
  selected,
}) => {
  const imgSrc = resolveImageUrl(journal.image_url);
  const issueLabel = latestIssueLabel(journal.issues);
  const price = priceLabel(journal);
  const paymentModel =
    (journal.payment_model || 'pre-payment') === 'pre-payment'
      ? "Oldindan to'lov"
      : "Keyin to'lov";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full text-left rounded-2xl transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
        selected
          ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20'
          : 'hover:shadow-xl hover:-translate-y-0.5'
      }`}
    >
      {/* A4 muqova */}
      <div className="journal-a4-cover mx-auto w-full max-w-[280px]">
        <div className="journal-a4-spine" aria-hidden />
        <div className="journal-a4-inner">
          <div className="journal-a4-header">
            <span className="journal-a4-header-left">
              {(journal.category_name || journal.name).slice(0, 42).toUpperCase()}
            </span>
            <span className="journal-a4-header-right">
              {issueLabel || (journal.issn ? `ISSN ${journal.issn}` : '')}
            </span>
          </div>
          <div className="journal-a4-rule" />

          <h3 className="journal-a4-title">{journal.name}</h3>
          {journal.admin_name && (
            <p className="journal-a4-author">{journal.admin_name}</p>
          )}

          <div className="journal-a4-image-wrap">
            {imgSrc && !imageError ? (
              <img
                src={imgSrc}
                alt={journal.name}
                className="journal-a4-image"
                onError={onImageError}
              />
            ) : (
              <div className="journal-a4-image-fallback">
                <BookOpen className="w-10 h-10 text-[#8B1538]/40" strokeWidth={1.2} />
              </div>
            )}
          </div>

          <div className="journal-a4-rule journal-a4-rule-bottom" />
          <div className="journal-a4-footer">
            <span className="journal-a4-doi">
              {journal.issn ? `ISSN: ${journal.issn}` : 'Ilmiy jurnal'}
            </span>
            <Bookmark className="journal-a4-bookmark" strokeWidth={1.5} aria-hidden />
          </div>
        </div>
      </div>

      {/* Qo'shimcha ma'lumot — A4 tagida */}
      <div className="journal-a4-meta mt-4 px-1 pb-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors">
            {journal.name}
          </h4>
          {selected && (
            <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" aria-label="Tanlangan" />
          )}
        </div>
        {journal.description && (
          <p className="text-xs text-slate-500 mt-1.5 line-clamp-3 leading-relaxed">
            {journal.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {journal.category_name && (
            <span className="journal-a4-badge">{journal.category_name}</span>
          )}
          {journal.issn && (
            <span className="journal-a4-badge journal-a4-badge-muted">{journal.issn}</span>
          )}
          <span className="journal-a4-badge journal-a4-badge-muted">{paymentModel}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-end justify-between gap-2">
          <div>
            <p className="text-base font-bold text-indigo-700">{price.main}</p>
            <p className="text-xs text-slate-500">{price.sub}</p>
          </div>
          <span className="text-xs font-medium text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
            Tanlash →
          </span>
        </div>
      </div>
    </button>
  );
};

export default JournalA4Card;
