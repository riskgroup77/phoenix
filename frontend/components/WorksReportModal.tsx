import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FileDown, FileText, RefreshCw, X, ExternalLink } from 'lucide-react';
import Button from './ui/Button';
import { apiService, saveBlob } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../i18n/LanguageContext';

const POSITION_KEY = 'phx.worksReport.position';
const WORKPLACE_KEY = 'phx.worksReport.workplace';

const readLocal = (key: string): string => {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};
const writeLocal = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private rejim */
  }
};

interface Props {
  /** Berilsa — faqat shu ilmiy ish bo'yicha ma'lumotnoma; aks holda barcha ishlar */
  articleId?: string;
  articleTitle?: string;
  onClose: () => void;
}

/** "Barcha ilmiy ishlar bo'yicha ma'lumotnoma" (Phoenix shabloni) — backendda PDF/DOCX yaratiladi */
const WorksReportModal: React.FC<Props> = ({ articleId, articleTitle, onClose }) => {
  const { t } = useT();
  const { user } = useAuth();
  const [workplace, setWorkplace] = useState(() => readLocal(WORKPLACE_KEY) || user?.affiliation || '');
  const [position, setPosition] = useState(() => readLocal(POSITION_KEY));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | null>(null);
  const urlRef = useRef<string | null>(null);

  const params = useCallback(
    (format: 'pdf' | 'docx') => ({ format, articleId, workplace: workplace.trim(), position: position.trim() }),
    [articleId, workplace, position],
  );
  const baseName = articleId ? 'Ilmiy_ish_malumotnoma' : 'Ilmiy_ishlar_malumotnoma';

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const blob = await apiService.articles.worksReport(params('pdf'));
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      if (urlRef.current) window.URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setPreviewUrl(url);
    } catch (e) {
      toast.error((e as Error)?.message || t("Ma'lumotnomani yaratib bo'lmadi"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    void loadPreview();
    return () => {
      if (urlRef.current) window.URL.revokeObjectURL(urlRef.current);
    };
    // Faqat ochilganda; maydonlar o'zgarsa — "Yangilash" tugmasi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = async (format: 'pdf' | 'docx') => {
    writeLocal(POSITION_KEY, position.trim());
    writeLocal(WORKPLACE_KEY, workplace.trim());
    setDownloading(format);
    try {
      const blob = await apiService.articles.worksReport(params(format));
      saveBlob(blob, `${baseName}.${format}`);
    } catch (e) {
      toast.error((e as Error)?.message || t("Yuklab olishda xatolik"));
    } finally {
      setDownloading(null);
    }
  };

  const inputCls =
    'w-full bg-white border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex justify-center items-center p-2 sm:p-4 no-print">
      <div className="w-full max-w-5xl h-[95vh] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200/90 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 shrink-0" />
              {articleId ? t("Ilmiy ish bo'yicha ma'lumotnoma") : t("Barcha ilmiy ishlar bo'yicha ma'lumotnoma")}
            </h3>
            {articleTitle && <p className="text-sm text-slate-500 truncate mt-0.5">{articleTitle}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label={t('Yopish')}>
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200/90 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">{t("Ish yoki o'qish joyi")}</label>
            <input className={inputCls} value={workplace} onChange={(e) => setWorkplace(e.target.value)} maxLength={255} />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">{t('Lavozimi')}</label>
            <input
              className={inputCls}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder={t("Masalan: Katta o'qituvchi")}
              maxLength={150}
            />
          </div>
          <Button variant="secondary" onClick={() => void loadPreview()} disabled={loading} className="!px-4">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {t('Yangilash')}
          </Button>
        </div>

        <div className="flex-1 min-h-0 bg-slate-100">
          {loading && !previewUrl ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">{t('Tayyorlanmoqda...')}</div>
          ) : previewUrl ? (
            <iframe title="malumotnoma" src={previewUrl} className="w-full h-full border-0" />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">{t("Ko'rib chiqish mavjud emas")}</div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200/90 flex flex-wrap justify-end gap-2">
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noreferrer" className="editorial-btn editorial-btn-secondary px-4 py-2.5 font-semibold inline-flex items-center">
              <ExternalLink className="mr-2 h-4 w-4" /> {t('Ochish')}
            </a>
          )}
          <Button variant="secondary" onClick={() => void download('docx')} isLoading={downloading === 'docx'} disabled={!!downloading}>
            <FileDown className="mr-2 h-4 w-4" /> {t('Word (.docx)')}
          </Button>
          <Button variant="primary" onClick={() => void download('pdf')} isLoading={downloading === 'pdf'} disabled={!!downloading}>
            <FileDown className="mr-2 h-4 w-4" /> {t('PDF yuklab olish')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorksReportModal;
