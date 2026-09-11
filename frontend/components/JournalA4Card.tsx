import React from 'react';
import { BookOpen, CheckCircle2 } from 'lucide-react';
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
          ? 'ring-2 ring-[var(--editorial-primary)] shadow-lg'
          : 'hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      <div className="journal-a4-cover mx-auto w-full max-w-[280px]">
        {imgSrc && !imageError ? (
          <img
            src={imgSrc}
            alt={journal.name}
            className="journal-a4-image"
            onError={onImageError}
          />
        ) : (
          <div className="journal-a4-image-fallback">
            <BookOpen className="w-10 h-10 text-slate-400" strokeWidth={1.2} />
          </div>
        )}
      </div>

      <div className="journal-a4-meta mt-4 px-1 pb-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-serif font-semibold text-[var(--editorial-text)] text-sm leading-snug line-clamp-2 group-hover:text-[var(--editorial-primary)] transition-colors">
            {journal.name}
          </h4>
          {selected && (
            <CheckCircle2 className="w-5 h-5 text-[var(--editorial-primary)] shrink-0" aria-label="Tanlangan" />
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
            <p className="text-base font-bold text-[var(--editorial-primary)]">{price.main}</p>
            <p className="text-xs text-slate-500">{price.sub}</p>
          </div>
          <span className="text-xs font-medium text-[var(--editorial-teal)] opacity-0 group-hover:opacity-100 transition-opacity">
            Tanlash →
          </span>
        </div>
      </div>
    </button>
  );
};

export default JournalA4Card;
