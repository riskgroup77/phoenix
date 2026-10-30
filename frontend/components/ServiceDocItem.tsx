/**
 * "Ishlarim" dagi xizmat hujjati (UDK ma'lumotnoma / UDK buyurtmasi / DOI) — arxiv (/auth/archive/) elementi.
 * Maqolalar va antiplagiat hujjatlari ArticleItem orqali ko'rinadi; bu yerda maqolaga bog'lanmagan hujjatlar.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Award, CheckCircle2, Clock, CreditCard, Download, Eye, Hourglass, XCircle } from 'lucide-react';
import Button from './ui/Button';
import { fetchAuthedBlob, saveBlob } from '../services/apiService';
import { useT } from '../i18n/LanguageContext';
import { openReferencePdf, referenceTarget } from '../utils/referenceDoc';

export type ServiceDoc = {
  type: string;
  id: string;
  title: string;
  label: string;
  date: string | null;
  download_url: string | null;
  view_url?: string;
  extra?: { status_label?: string; status?: string; payment_status?: string | null; udk_code?: string; doi_link?: string };
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
  const pay = doc.extra?.payment_status;
  if (st === 'rejected' || (st === 'pending_payment' && (pay === 'failed' || pay === 'cancelled'))) return 'bg-red-500/15 text-red-800';
  if (doc.download_url || st === 'completed') return 'bg-green-500/20 text-emerald-900';
  if (st === 'pending_payment') return 'bg-gray-500/20 text-slate-600';
  return 'bg-amber-500/20 text-amber-900';
};

const ServiceDocItem: React.FC<{ doc: ServiceDoc }> = ({ doc }) => {
  const { t, locale } = useT();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const status = doc.extra?.status_label || (doc.download_url ? 'Tayyor' : '');
  const reference = referenceTarget(doc);

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

  const tone = statusColor(doc);
  const StatusIcon = tone.includes('red') ? XCircle : tone.includes('green') ? CheckCircle2 : tone.includes('gray') ? CreditCard : Hourglass;
  const actionBtn = 'justify-center gap-1.5 whitespace-nowrap !px-2 !py-2 sm:!px-3 sm:!py-1.5 !text-[13px] sm:!text-sm [&_svg]:shrink-0';
  const desc = (doc.extra as { udk_description?: string } | undefined)?.udk_description;

  return (
    <div className="editorial-card cursor-pointer hover:border-[var(--editorial-primary)]/35 transition-colors" onClick={open}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h4 className="m-0 break-words text-base sm:text-lg font-semibold text-[var(--editorial-text)] leading-snug">
            {doc.title || t(TYPE_LABELS[doc.type] || doc.label)}
          </h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {status && (
              <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
                <StatusIcon className="h-3.5 w-3.5" aria-hidden /> {t(status)}
              </span>
            )}
          </div>
          <p className="m-0 mt-1.5 text-sm text-[var(--editorial-teal)] break-words">
            {t(TYPE_LABELS[doc.type] || doc.label)}
            {doc.extra?.udk_code ? (
              <> · UDK: <span className="font-mono font-semibold">{doc.extra.udk_code}</span>{desc ? <span className="text-slate-600"> — {desc}</span> : null}</>
            ) : null}
            {doc.extra?.doi_link ? <> · DOI: <span className="font-mono break-all">{doc.extra.doi_link}</span></> : null}
          </p>
          {doc.date && (
            <p className="m-0 mt-1.5 flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3 w-3" aria-hidden /> {new Date(doc.date).toLocaleDateString(locale === 'uz-UZ' ? 'ru-RU' : locale)}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 max-[359px]:grid-cols-1 gap-2 [&>*:last-child:nth-child(odd)]:col-[1/-1] [&>*]:justify-center sm:flex sm:flex-wrap sm:shrink-0 sm:justify-end" onClick={(e) => e.stopPropagation()}>
          {doc.view_url && (
            <Button type="button" variant="secondary" onClick={open} className={actionBtn}>
              <Eye className="h-4 w-4" aria-hidden /> {t("Ko'rish")}
            </Button>
          )}
          {doc.download_url && (
            <Button type="button" variant="secondary" onClick={download} disabled={busy} className={actionBtn}>
              <Download className="h-4 w-4" aria-hidden /> {t('Yuklab olish')}
            </Button>
          )}
          {reference && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void openReferencePdf(reference.kind, reference.id, t("Ma'lumotnomani yaratib bo'lmadi"))}
              className={actionBtn}
            >
              <Award className="h-4 w-4" aria-hidden /> {t("Ma'lumotnoma")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceDocItem;
