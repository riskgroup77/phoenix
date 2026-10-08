import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Copy, Download, ExternalLink, Globe, Send } from 'lucide-react';
import { apiService } from '../services/apiService';
import { API_V1_BASE_URL, isProductionHost } from '../config/apiBase';
import { useT } from '../i18n/LanguageContext';

/** Ochiq (indekslanadigan) maqola sahifasi manzili: prod'da asosiy domen, aks holda backend. */
export function scholarPageUrl(articleId: string): string {
  const origin = isProductionHost ? 'https://ilmiyfaoliyat.uz' : API_V1_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${origin}/p/article/${articleId}/`;
}

type Props = { articleId: string; doi?: string; canManage: boolean };

/**
 * Nashr etilgan maqola: Google Scholar uchun ochiq sahifa va (admin uchun) Crossref DOI depoziti.
 */
const PublicationIndexingPanel: React.FC<Props> = ({ articleId, doi, canManage }) => {
  const { t } = useT();
  const [info, setInfo] = useState<{ configured: boolean; doi: string; suggested_doi: string } | null>(null);
  const [busy, setBusy] = useState<'xml' | 'deposit' | null>(null);
  const url = scholarPageUrl(articleId);

  useEffect(() => {
    if (!canManage) return;
    let alive = true;
    apiService.articles
      .crossrefInfo(articleId)
      .then((d) => alive && setInfo(d))
      .catch(() => alive && setInfo(null));
    return () => {
      alive = false;
    };
  }, [articleId, canManage]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('Havola nusxalandi'));
    } catch {
      toast.info(url);
    }
  };

  const downloadXml = async () => {
    setBusy('xml');
    try {
      await apiService.articles.crossrefXml(articleId);
    } catch (e: any) {
      toast.error(e?.message || t("XML yaratib bo'lmadi"));
    } finally {
      setBusy(null);
    }
  };

  const deposit = async () => {
    setBusy('deposit');
    try {
      const res = await apiService.articles.crossrefDeposit(articleId);
      toast.success(res?.message || t("Crossref'ga yuborildi"));
      setInfo((p) => (p ? { ...p, doi: res?.doi || p.doi } : p));
    } catch (e: any) {
      toast.error(e?.message || t("Crossref'ga yuborib bo'lmadi"));
    } finally {
      setBusy(null);
    }
  };

  const shownDoi = info?.doi || doi || '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-sm text-[var(--editorial-muted)]">
          {t("Maqolaning ochiq sahifasi Google Scholar va qidiruv tizimlari uchun meta-teglar bilan tayyorlangan. Uni ulashishingiz mumkin.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="milliy-btn-secondary !min-h-[2.5rem] text-sm">
            <Globe className="w-4 h-4" aria-hidden /> {t('Ochiq sahifa')} <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          </a>
          <button type="button" onClick={copy} className="milliy-btn-secondary !min-h-[2.5rem] text-sm">
            <Copy className="w-4 h-4" aria-hidden /> {t('Havolani nusxalash')}
          </button>
        </div>
      </div>

      {shownDoi && (
        <p className="m-0 text-sm">
          <span className="text-[var(--editorial-muted)]">DOI: </span>
          <a
            href={shownDoi.startsWith('http') ? shownDoi : `https://doi.org/${shownDoi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="editorial-link font-semibold break-all"
          >
            {shownDoi}
          </a>
        </p>
      )}

      {canManage && (
        <div className="flex flex-col gap-2 pt-3 border-t border-[var(--editorial-border)]">
          <p className="m-0 text-sm font-bold">Crossref</p>
          <p className="m-0 text-xs text-[var(--editorial-muted)]">
            {info?.configured
              ? t("DOI ma'lumotlari Crossref'ga to'g'ridan-to'g'ri yuboriladi.")
              : t("Crossref login sozlanmagan — XML faylni yuklab olib, Crossref panelida qo'lda yuklashingiz mumkin.")}
            {!shownDoi && info?.suggested_doi ? ` ${t('Beriladigan DOI: {d}', { d: info.suggested_doi })}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadXml} disabled={busy !== null} className="milliy-btn-secondary !min-h-[2.5rem] text-sm">
              <Download className="w-4 h-4" aria-hidden /> {busy === 'xml' ? t('Tayyorlanmoqda...') : t('Depozit XML')}
            </button>
            {info?.configured && (
              <button type="button" onClick={deposit} disabled={busy !== null} className="milliy-btn-primary !min-h-[2.5rem] text-sm">
                <Send className="w-4 h-4" aria-hidden /> {busy === 'deposit' ? t('Yuborilmoqda...') : t("Crossref'ga yuborish")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicationIndexingPanel;
