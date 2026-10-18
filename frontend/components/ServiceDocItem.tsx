/**
 * "Ishlarim" dagi xizmat hujjati (UDK ma'lumotnoma / UDK buyurtmasi / DOI) — arxiv (/auth/archive/) elementi.
 * Maqolalar va antiplagiat hujjatlari ArticleItem orqali ko'rinadi; bu yerda maqolaga bog'lanmagan hujjatlar.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Download, ExternalLink, FileBadge } from 'lucide-react';
import { fetchAuthedBlob, saveBlob } from '../services/apiService';
import { useT } from '../i18n/LanguageContext';

export type ServiceDoc = {
  type: string;
  id: string;
  title: string;
  label: string;
  date: string | null;
  download_url: string | null;
  view_url?: string;
  extra?: { status_label?: string; status?: string; udk_code?: string; doi_link?: string };
};

/** "Ishlarim" ga qo'shiladigan arxiv turlari (maqola bilan bog'liqlari ArticleItem da ko'rinadi) */
export const SERVICE_DOC_TYPES = new Set(['udk_standalone', 'udk_request_order', 'doi_link']);

const TYPE_LABELS: Record<string, string> = {
  udk_standalone: "UDK ma'lumotnoma",
  udk_request_order: 'UDK buyurtmasi',
  doi_link: 'DOI raqami',
};

const statusColor = (doc: ServiceDoc) => {
  const st = doc.extra?.status;
  if (doc.download_url || st === 'completed') return 'bg-green-500/20 text-emerald-900';
  if (st === 'pending_payment') return 'bg-gray-500/20 text-slate-600';
  return 'bg-amber-500/20 text-amber-900';
};

const ServiceDocItem: React.FC<{ doc: ServiceDoc }> = ({ doc }) => {
  const { t, locale } = useT();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const status = doc.extra?.status_label || (doc.download_url ? 'Tayyor' : '');

  const open = () => {
    if (!doc.view_url) return;
    if (doc.view_url.startsWith('http')) window.open(doc.view_url, '_blank', 'noopener');
    else navigate(doc.view_url);
  };

  const download = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!doc.download_url) return open();
    setBusy(true);
    try {
      // API manzilidan nisbiy endpoint (hujjat interfeys tilida qayta yaratilishi uchun Accept-Language bilan)
      const i = doc.download_url.indexOf('/api/v1');
      const blob = i >= 0
        ? await fetchAuthedBlob(doc.download_url.slice(i + '/api/v1'.length))
        : await (await fetch(doc.download_url)).blob();
      saveBlob(blob, `${(TYPE_LABELS[doc.type] || 'hujjat').replace(/[^\w]+/g, '_')}_${doc.id}.pdf`);
    } catch {
      toast.error(t('Yuklab olishda xatolik'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="editorial-card cursor-pointer hover:border-[var(--editorial-primary)]/35 transition-colors" onClick={open}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4">
        <h4 className="text-base sm:text-lg font-semibold text-[var(--editorial-text)] leading-snug flex items-start gap-2">
          <FileBadge size={18} className="mt-1 shrink-0 text-[var(--editorial-teal)]" />
          <span>{doc.title || t(TYPE_LABELS[doc.type] || doc.label)}</span>
        </h4>
        {status && (
          <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap self-start ${statusColor(doc)}`}>
            {t(status)}
          </span>
        )}
      </div>
      {(doc.extra?.udk_code || doc.extra?.doi_link) && (
        <p className="text-sm text-slate-600 mt-2">
          {doc.extra?.udk_code ? <>UDK: <span className="font-mono font-semibold">{doc.extra.udk_code}</span></> : null}
          {doc.extra?.doi_link ? <>DOI: <span className="font-mono break-all">{doc.extra.doi_link}</span></> : null}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        {doc.download_url && (
          <button
            type="button"
            onClick={download}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--editorial-border)] text-[var(--editorial-primary)] hover:bg-slate-100/80 disabled:opacity-50"
          >
            <Download size={14} /> {t('Yuklab olish')}
          </button>
        )}
        {doc.view_url && (
          <button
            type="button"
            onClick={open}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--editorial-border)] text-[var(--editorial-primary)] hover:bg-slate-100/80"
          >
            <ExternalLink size={14} /> {t('Ochish')}
          </button>
        )}
      </div>
      <div className="flex flex-wrap justify-between items-center mt-4 text-xs text-slate-500 gap-1">
        <span className="font-medium text-[var(--editorial-teal)]">{t(TYPE_LABELS[doc.type] || doc.label)}</span>
        {doc.date && <span>{new Date(doc.date).toLocaleDateString(locale)}</span>}
      </div>
    </div>
  );
};

export default ServiceDocItem;
