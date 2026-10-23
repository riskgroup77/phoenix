import React, { useState, useEffect, useRef } from 'react';
import { useAiPrefill, str, num } from '../contexts/AiPrefillContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import ModalPortal from '../components/ui/ModalPortal';
import { CheckCircle2, CreditCard, Loader2, X, XCircle } from 'lucide-react';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import type { AntiplagiatCertificateData } from '../components/AntiplagiatCertificate';
import type { PlagiarismFullReportData } from '../components/PlagiarismFullReport';
import AntiplagiatUploadPanel, {
  AntiplagiatFormValues,
  coAuthorsPayload,
  createDefaultAntiplagiatForm,
  hasIncompleteCoAuthor,
} from '../components/AntiplagiatUploadPanel';
import { ANTIPLAGIAT_MODULES, DEFAULT_ENABLED_MODULE_IDS } from '../constants/antiplagiatModules';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { formatDrfValidationErrors, getUserFriendlyError } from '../utils/errorHandler';
import { toast } from 'react-toastify';
import { useServicePrices } from '../hooks/useServicePrices';
import { MAX_UPLOAD_BYTES, formatMaxUploadLabel } from '../constants/upload';
import { useT } from '../i18n/LanguageContext';
import { antiplagiatAuthors } from '../utils/antiplagiatFromArticle';

// New types for detailed results
interface PlagiarismSource {
  source: string;
  similarity: number;
  snippet: string;
}

interface PlagiarismResult {
  plagiarism: number;
  aiContent: number;
  citations: number;
  selfCitation: number;
  sources: PlagiarismSource[];
}

interface PlagiarismCheckRequest {
  id: string;
  fileName: string;
  status: 'pending' | 'completed' | 'failed';
  plagiarismPercentage?: number;
  aiContentPercentage?: number;
  sources?: PlagiarismSource[];
  createdAt: string;
  userId: string;
}

// Antiplagiat tekshiruvi narxi (API dan olinadi)

/** Modal va toast uchun: HTML entity larni oddiy matnga aylantirish */
function formatPlagiarismPaymentMessage(raw: string): string {
  let s = raw;
  if (typeof document !== 'undefined' && s.includes('&')) {
    try {
      const ta = document.createElement('textarea');
      ta.innerHTML = s;
      s = ta.value;
    } catch {
      /* ignore */
    }
  }
  return s;
}

/**
 * To'lovdan keyin (yoki bepul tekshiruvda) forma o'rnida chiqadigan holat kartasi: foydalanuvchi qaysi bosqichda
 * ekanini aniq ko'radi. Avval progress forma ostida, sahifa pastida chiqar va "hech narsa bo'lmayapti" tuyulardi.
 */
const CheckStatusCard: React.FC<{
  stage: 'payment' | 'checking';
  paid: boolean;
  progress: number;
  label: string;
  documentName: string;
  onRecheck: () => void;
  onDismiss: () => void;
}> = ({ stage, paid, progress, label, documentName, onRecheck, onDismiss }) => {
  const { t } = useT();
  type Step = { title: string; state: 'done' | 'active' | 'todo'; hint?: string };
  const steps: Step[] = [
    ...(paid ? [{
      title: stage === 'payment' ? t("To'lov tasdiqlanishi kutilmoqda") : t("To'lov qabul qilindi"),
      state: stage === 'payment' ? 'active' as const : 'done' as const,
      hint: stage === 'payment' ? t("Click'dan tasdiq kelishi bilan tekshiruv o'zi boshlanadi (odatda 1 daqiqagacha).") : undefined,
    }] : []),
    {
      title: t('Hujjat tekshirilmoqda'),
      state: stage === 'checking' ? 'active' : 'todo',
      hint: stage === 'checking' ? t("Ichki baza va ochiq ilmiy manbalar bo'yicha moslik qidirilmoqda — odatda bir necha daqiqa.") : undefined,
    },
    { title: t('Natija va sertifikat'), state: 'todo' },
  ];
  return (
    <section
      aria-live="polite"
      className="rounded-2xl border border-[var(--editorial-border,#e2ddd4)] bg-[var(--editorial-bg-alt,#f5f0e8)] p-5 sm:p-6"
    >
      <h2 className="m-0 text-lg font-bold text-[var(--editorial-text,#1a1a1a)]">{t('Antiplagiat tekshiruvi')}</h2>
      {documentName && <p className="m-0 mt-1 truncate text-sm text-[var(--editorial-muted,#64748b)]">{documentName}</p>}
      <ol className="m-0 mt-5 flex list-none flex-col gap-4 p-0">
        {steps.map((step) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              step.state === 'done' ? 'bg-emerald-600 text-white'
                : step.state === 'active' ? 'bg-[var(--editorial-primary,#1f3f8f)] text-white'
                  : 'border border-slate-300 bg-white text-slate-400'
            }`}>
              {step.state === 'done' ? <CheckCircle2 className="h-4 w-4" aria-hidden />
                : step.state === 'active' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`m-0 text-sm font-semibold ${step.state === 'todo' ? 'text-slate-400' : 'text-[var(--editorial-text,#1a1a1a)]'}`}>
                {step.title}
              </p>
              {step.hint && <p className="m-0 mt-0.5 text-xs text-[var(--editorial-muted,#64748b)]">{step.hint}</p>}
              {step.state === 'active' && stage === 'checking' && (
                <div className="mt-3">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-2.5 rounded-full bg-[var(--editorial-primary,#1f3f8f)] transition-[width] duration-500 ease-in-out"
                      style={{ width: `${Math.max(3, Math.round(progress))}%` }}
                    />
                  </div>
                  <p className="m-0 mt-1.5 text-xs text-[var(--editorial-muted,#64748b)]">
                    {Math.round(progress)}%{label ? ` — ${t(label)}` : ''}
                  </p>
                </div>
              )}
              {step.state === 'active' && stage === 'payment' && (
                <button type="button" onClick={onRecheck} className="mt-2 text-xs font-semibold text-[var(--editorial-primary,#1f3f8f)] underline">
                  {t('Hozir tekshirish')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="m-0 mt-5 rounded-xl bg-white/60 p-3 text-xs text-slate-600">
        {t("Sahifani yopsangiz ham tekshiruv davom etadi. Tayyor bo'lganda bildirishnoma keladi, natija «Arxiv hujjatlar» bo'limida saqlanadi.")}
      </p>
      {stage === 'checking' && (
        <button type="button" onClick={onDismiss} className="mt-3 text-sm font-semibold text-[var(--editorial-primary,#1f3f8f)] underline">
          {t('Yangi hujjat tekshirish')}
        </button>
      )}
    </section>
  );
};

const PlagiarismCheck: React.FC = () => {
  const { t } = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { getPrice } = useServicePrices();
  const [form, setForm] = useState<AntiplagiatFormValues>(createDefaultAntiplagiatForm);
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [checkStatusLabel, setCheckStatusLabel] = useState('');
  const [result, setResult] = useState<PlagiarismResult | null>(null);
  const [certificateData, setCertificateData] = useState<AntiplagiatCertificateData | null>(null);
  const [fullReportData, setFullReportData] = useState<PlagiarismFullReportData | null>(null);
  const patchForm = (patch: Partial<AntiplagiatFormValues>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  // AI ish maydoni to'ldirgan qiymatlar
  const aiPrefill = useAiPrefill('plagiarism_check');
  useEffect(() => {
    if (!aiPrefill) return;
    const f = aiPrefill.fields;
    const patch: Partial<AntiplagiatFormValues> = {};
    if (str(f.documentName)) patch.documentName = str(f.documentName);
    if (str(f.documentType)) patch.documentType = str(f.documentType);
    if (str(f.documentDescription)) patch.documentDescription = str(f.documentDescription);
    if (str(f.authorFirstName)) patch.authorFirstName = str(f.authorFirstName);
    if (str(f.authorLastName)) patch.authorLastName = str(f.authorLastName);
    const picked = aiPrefill.file;
    if (picked && picked.size <= MAX_UPLOAD_BYTES) patch.file = picked;
    patchForm(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPrefill?.nonce, aiPrefill?.file]);
  
  // Narx API dan olinadi
  const PLAGIARISM_CHECK_PRICE = getPrice('plagiarism_check');
  
  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  /** True when user returned from payment page and payment is verified completed (so we can run check). */
  const [paymentVerifiedCompleted, setPaymentVerifiedCompleted] = useState(false);
  const [pendingPlagiarismPayment, setPendingPlagiarismPayment] = useState<{
    transactionId: string;
    articleId: string;
  } | null>(null);
  const paymentTimerRef = useRef<NodeJS.Timeout | null>(null);

  const STORAGE_KEY_TRANSACTION_ID = 'plagiarism_pending_transaction_id';
  const STORAGE_KEY_ARTICLE_ID = 'plagiarism_pending_article_id';

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Cleanup timer on unmount
  React.useEffect(() => {
      return () => {
          if (paymentTimerRef.current) {
              clearTimeout(paymentTimerRef.current);
          }
      };
  }, []);

  React.useEffect(() => {
      if (!user) return;
      setForm((prev) => ({
        ...prev,
        authorFirstName: prev.authorFirstName.trim() ? prev.authorFirstName : (user.firstName || ''),
        authorLastName: prev.authorLastName.trim() ? prev.authorLastName : (user.lastName || ''),
      }));
  }, [user]);

  // To'lov sahifasidan qaytish: tranzaksiya holatini aniq ID bo'yicha tekshiramiz.
  // Click yangi oynada ochiladi — u yerdan qaytilganda sessionStorage bo'sh bo'ladi, shuning uchun hujjat ID si
  // tranzaksiyaning o'zidan olinadi (avval forma bo'sh qolib, qayta to'lashda "allaqachon to'langan" xatosi chiqardi).
  // Effekt URL dagi transaction_id ga bog'langan: to'lov oynasi shu sahifaga qaytarganda ham ishlaydi.
  const urlTransactionId = searchParams.get('payment_return') === '1' ? searchParams.get('transaction_id') : null;
  React.useEffect(() => {
      if (urlTransactionId) {
          sessionStorage.setItem(STORAGE_KEY_TRANSACTION_ID, urlTransactionId);
          const next = new URLSearchParams(searchParams);
          next.delete('payment_return');
          next.delete('transaction_id');
          setSearchParams(next, { replace: true });
      }

      const pendingTxId = urlTransactionId || sessionStorage.getItem(STORAGE_KEY_TRANSACTION_ID);
      if (!pendingTxId) {
          void resumeRunningCheck();
          return;
      }

      let cancelled = false;
      (async () => {
          try {
              const res = await paymentService.checkPaymentStatus(pendingTxId);
              if (cancelled) return;
              const pendingArticleId = res.article_id || sessionStorage.getItem(STORAGE_KEY_ARTICLE_ID);
              if (!pendingArticleId) {
                  sessionStorage.removeItem(STORAGE_KEY_TRANSACTION_ID);
                  return;
              }
              if (res.payment_status === 2) {
                  sessionStorage.removeItem(STORAGE_KEY_TRANSACTION_ID);
                  sessionStorage.removeItem(STORAGE_KEY_ARTICLE_ID);
                  setArticleId(pendingArticleId);
                  setPendingPlagiarismPayment(null);
                  setPaymentVerifiedCompleted(true);
                  toast.success(t("To'lov tasdiqlandi. Antiplagiat tekshiruvi avtomatik boshlanmoqda..."));
                  void runPlagiarismAfterPayment(pendingArticleId);
                  return;
              }
              if (res.payment_status === -1) {
                  sessionStorage.removeItem(STORAGE_KEY_TRANSACTION_ID);
                  sessionStorage.removeItem(STORAGE_KEY_ARTICLE_ID);
                  setPendingPlagiarismPayment(null);
                  toast.error(t("To'lov bekor qilindi yoki muvaffaqiyatsiz."));
                  return;
              }
              // pending — bank callback kechikishi mumkin
              sessionStorage.setItem(STORAGE_KEY_ARTICLE_ID, pendingArticleId);
              setArticleId(pendingArticleId);
              setPendingPlagiarismPayment({ transactionId: pendingTxId, articleId: pendingArticleId });
              toast.info(t("To'lov tasdig'i kutilmoqda — tasdiqlanishi bilan tekshiruv o'zi boshlanadi."), { autoClose: 6000 });
          } catch {
              if (!cancelled) {
                  toast.warning(t("To'lov holatini tekshirib bo'lmadi. Internetni tekshirib, sahifani yangilang."));
              }
          }
      })();
      return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat sahifa ochilganda va to'lovdan qaytganda
  }, [urlTransactionId]);

  /**
   * Sahifa yangilansa (F5) yoki boshqa joydan qaytilsa: serverda HOZIR ketayotgan tekshiruv bo'lsa — uning progressi
   * formadan ALOHIDA bannerda ko'rsatiladi. Forma (yangi hujjat, yangi to'lov) bunga bog'lanmaydi: avval eski
   * to'langan/qotib qolgan hujjat formaga ulanib, yangi hujjat to'lovsiz "tekshirilmoqda" bo'lib qolardi.
   */
  /** Holat kartasidagi hujjat nomi (forma bo'sh bo'lganda — masalan, sahifaga qaytilganda) */
  const [activeDocTitle, setActiveDocTitle] = useState('');
  const resumeRunningCheck = async () => {
      if (!user) return;
      try {
          const raw = await apiService.articles.listAllForRole(String(user.role || 'author'));
          const list = (Array.isArray(raw) ? raw : []) as Array<{
              id: string; title?: string; antiplagiat_check_active?: boolean; antiplagiat_state?: string; submission_date?: string;
          }>;
          const newestFirst = (a: { submission_date?: string }, b: { submission_date?: string }) =>
              String(b.submission_date || '').localeCompare(String(a.submission_date || ''));
          // Hozir ketayotgan tekshiruv, yoki to'langan-u boshlanmagan yangi hujjat (to'lovdan keyin sahifa yopilgan):
          // forma o'rnida holat kartasi, tekshiruv tugagach natijaga o'tiladi. Boshlanmaganlar — faqat oxirgi 24 soat
          // (eski qotib qolganlar har safar ochilmasin); server ketayotgan tekshiruvni takrorlamaydi (force:false).
          const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
          const target = list.filter((a) => a.antiplagiat_check_active === true).sort(newestFirst)[0]
              || list
                  .filter((a) => a.antiplagiat_state === 'checking' && !a.antiplagiat_check_active
                      && Date.parse(a.submission_date || '') > dayAgo)
                  .sort(newestFirst)[0];
          if (target?.id) {
              setActiveDocTitle(target.title || '');
              void runPlagiarismAfterPayment(target.id);
          }
      } catch {
          /* ro'yxat olinmasa — oddiy bo'sh forma */
      }
  };


  // Eski havolalar: ?article_id=...&view=1 → alohida natija sahifasiga
  React.useEffect(() => {
    const legacyArticleId = searchParams.get('article_id');
    const legacyView = searchParams.get('view') === '1';
    if (legacyArticleId && legacyView) {
      navigate(`/plagiarism-check/result/${encodeURIComponent(legacyArticleId)}`, { replace: true });
    }
  }, [searchParams, navigate]);

  const goToResultView = (targetId: string) => {
    navigate(`/plagiarism-check/result/${encodeURIComponent(targetId)}`);
  };

  const applyPlagiarismResults = (
    plagiarismPercentage: number,
    aiContentPercentage: number,
    foundSources: PlagiarismSource[],
    report?: Record<string, unknown> | null,
    originalityOverride?: number,
  ) => {
    const breakdown = report?.plagiarism_breakdown as Record<string, unknown> | undefined;
    const citationPctRaw = report?.citation_percent ?? breakdown?.self_citation ?? 0;
    const citationPct = Number(citationPctRaw || 0);
    const originality =
      typeof originalityOverride === 'number'
        ? originalityOverride
        : Math.max(0, 100 - plagiarismPercentage - Number(citationPct || 0) - Number(report?.self_citation_percent ?? 0));
    const selfCitationPct = report?.self_citation_percent ?? 0;
    const charCount = report?.character_count;
    const sentCount = report?.sentence_count;
    // Faqat haqiqatda tekshirilgan bazalar (backend: executed_module_ids / search_modules)
    const executedLabels: string[] = Array.isArray(report?.search_modules) ? (report.search_modules as string[]) : [];
    const searchModules = executedLabels.length
      ? `${executedLabels.length} ta bazada tekshirilgan`
      : "Tekshirilgan bazalar ma'lum emas";
    const finalResult = {
      plagiarism: plagiarismPercentage,
      aiContent: aiContentPercentage,
      citations: Number(citationPct || 0),
      selfCitation: Number(selfCitationPct || 0),
      sources: foundSources,
    };
    setResult(finalResult);

    const certNumber = String(report?.certificate_number || '').trim() || '—';
    // Formada kiritilgan muallif va hammualliflar serverda (plagiarism_report) saqlanadi — Click'dan qaytilganda
    // forma qayta to'ldirilib, profil ismi tushardi va sertifikatda yuklagan foydalanuvchi ismi chiqardi
    const authors = antiplagiatAuthors(report, form, user);
    const newCertificateData: AntiplagiatCertificateData = {
      certificateNumber: certNumber,
      checkDate: new Date().toLocaleDateString('uz-UZ'),
      author: authors.join(', '),
      authors,
      workType: form.documentType || 'Ilmiy ish',
      fileName: form.documentName.trim() || form.file?.name || '',
      citations: `${Number(citationPct || 0).toFixed(1)}%`,
      selfCitation: `${Number(selfCitationPct || 0).toFixed(1)}%`,
      plagiarism: `${plagiarismPercentage}%`,
      originality: `${originality.toFixed(2)}%`,
      aiContent: aiContentPercentage > 0 ? `${aiContentPercentage.toFixed(1)}%` : undefined,
      searchModules,
    };
    setCertificateData(newCertificateData);

    const fullReport: PlagiarismFullReportData = {
      checkerName: newCertificateData.author,
      authors,
      checkerId: user?.id?.slice(-5) || '00000',
      checkerOrganization: user?.affiliation || '',
      documentNumber: newCertificateData.certificateNumber,
      uploadDate: new Date().toLocaleString('uz-UZ'),
      originalFileName: form.file?.name || '',
      documentName: form.documentName.trim() || form.file?.name || '',
      documentType: form.documentType || 'Ilmiy ish',
      characterCount: typeof charCount === 'number' ? charCount : (form.file ? Math.round(form.file.size * 2.5) : 0),
      sentenceCount: typeof sentCount === 'number' ? sentCount : 0,
      fileSize: form.file ? `${(form.file.size / 1024).toFixed(2)} KB` : '—',
      plagiarismPercent: plagiarismPercentage,
      selfCitationPercent: Number(selfCitationPct || 0),
      citationPercent: Number(citationPct || 0),
      originalityPercent: originality,
      searchModules: executedLabels,
      sources: foundSources.map((s, idx) => toReportSource(s as PlagiarismSource & { search_module?: string; title?: string }, idx)),
    };
    setFullReportData(fullReport);
  };

  const mapSourcesFromApi = (apiSources: unknown): (PlagiarismSource & { search_module?: string; title?: string })[] => {
    if (!apiSources || !Array.isArray(apiSources)) return [];
    return apiSources
      .map((s: { source?: string; snippet?: string; similarity?: number; search_module?: string; title?: string }) => ({
        source: (s.source || '').trim(),
        snippet: (s.snippet || '').trim(),
        title: (s.title || '').trim(),
        similarity: typeof s.similarity === 'number' ? s.similarity : 0,
        search_module: s.search_module,
      }))
      .filter((s) => s.source || s.snippet || s.title);
  };

  const toReportSource = (s: PlagiarismSource & { search_module?: string; title?: string }, idx: number) => {
    const rawUrl = s.source.startsWith('http') ? s.source : '';
    const title = s.title || s.snippet || (rawUrl ? s.source.replace(/^https?:\/\//, '').slice(0, 120) : s.source);
    const mod = s.search_module || 'Search module INTERNET PLUS';
    const modLabel = mod.includes('qidiruv moduli') ? mod : `${mod} qidiruv moduli`;
    return {
      id: idx + 1,
      percentage: `${Number(s.similarity).toFixed(2)}%`,
      sourceName: title.slice(0, 200),
      sourceUrl: rawUrl || (s.source.startsWith('http') ? s.source : undefined),
      searchModule: modLabel,
    };
  };

  const applyProgressFromReport = (report: Record<string, unknown> | undefined, attempt: number) => {
    const pct = Number(report?.progress_percent ?? 0);
    setProgress(Math.max(5, Math.min(99, pct > 0 ? pct : Math.min(95, 8 + attempt * 0.35))));
    const label = String(report?.current_module_label || '').trim();
    const done = Number(report?.modules_completed ?? 0);
    const total = Number(report?.modules_total ?? 0);
    const sources = Number(report?.sources_found ?? 0);
    if (label) {
      setCheckStatusLabel(
        total > 0
          ? `${label} — ${done}/${total} modul, ${sources} manba`
          : label,
      );
    } else if (total > 0) {
      setCheckStatusLabel(`Modullar tekshirilmoqda: ${done}/${total}`);
    }
  };

  const fetchPlagiarismResults = async (targetArticleId: string) => {
    const art = await apiService.articles.get(targetArticleId);
    const data = art?.data || art;
    const report = (data?.plagiarism_report || {}) as Record<string, unknown>;
    applyPlagiarismResults(
      Number(data?.plagiarism_percentage ?? 0),
      Number(data?.ai_content_percentage ?? 0),
      mapSourcesFromApi(report.sources ?? data?.sources),
      report,
      Number(data?.originality_percentage ?? 0),
    );
  };

  /** Tekshiruv hujjat hajmi va ochiq API javoblariga qarab bir necha daqiqa davom etadi */
  // Natija tayyorligini har 2 s da tekshirish (avval 4 s); umumiy kutish o'sha 16 daqiqa
  const pollUntilPlagiarismReady = async (targetArticleId: string, maxAttempts = 480): Promise<boolean> => {
    for (let i = 0; i < maxAttempts; i++) {
      if (!followCheckRef.current) return false;
      try {
        const art = await apiService.articles.get(targetArticleId);
        const data = art?.data || art;
        const report = (data?.plagiarism_report || {}) as Record<string, unknown>;
        applyProgressFromReport(report, i);
        // Holat kartasida hujjat nomi (forma bo'sh bo'lsa — masalan, to'lovdan qaytib sahifa qayta yuklanganda)
        if (data?.title) setActiveDocTitle((prev) => prev || String(data.title));
        if (report.check_status === 'failed') {
          throw new Error(String(report.check_error || 'Antiplagiat tekshiruvi muvaffaqiyatsiz yakunlandi.'));
        }
        if (
          data?.plagiarism_checked_at &&
          data.plagiarism_percentage != null &&
          report.check_status !== 'processing'
        ) {
          setProgress(100);
          setCheckStatusLabel('Tekshiruv yakunlandi');
          return true;
        }
      } catch (err) {
        if (err instanceof Error && (err.message.includes('muvaffaqiyatsiz') || err.message.includes('failed'))) {
          throw err;
        }
      }
      await new Promise((r) => window.setTimeout(r, 2000));
    }
    return false;
  };

  /** Holat kartasi yopilsa (yangi hujjat yuklash) — tekshiruv serverda davom etadi, sahifa natijaga sudramaydi */
  const followCheckRef = useRef(true);
  const dismissStatusCard = () => {
    followCheckRef.current = false;
    setIsChecking(false);
    setPendingPlagiarismPayment(null);
    setActiveDocTitle('');
  };

  const runPlagiarismAfterPayment = async (targetArticleId: string) => {
    followCheckRef.current = true;
    setIsChecking(true);
    setProgress(5);
    setCheckStatusLabel('To\'lovdan keyin chuqur tekshiruv boshlanmoqda...');
    setResult(null);
    setCertificateData(null);
    try {
      // Server to'lovdan keyin tekshiruvni o'zi boshlaydi. ~20 soniyada tayyor bo'lmasa — shu yerdan ishga tushiramiz
      // (force:false — ketayotgan tekshiruv takrorlanmaydi). Avval 16 daqiqa kutilar, progress qotib turardi.
      const ready = await pollUntilPlagiarismReady(targetArticleId, 10);
      if (!followCheckRef.current) return;
      if (ready) {
        await fetchPlagiarismResults(targetArticleId);
        toast.success(t("Antiplagiat tekshiruvi yakunlandi. Arxivda ko'rishingiz mumkin."));
        goToResultView(targetArticleId);
        return;
      }
      // force: false — server tekshiruv allaqachon ketayotgan bo'lsa ikkinchisini boshlamaydi
      await apiService.articles.checkPlagiarism(targetArticleId, {
        enabledModules: form.enabledModuleIds,
        force: false,
      });
      const readyAfter = await pollUntilPlagiarismReady(targetArticleId);
      if (!followCheckRef.current) return;
      if (!readyAfter) {
        throw new Error('Tekshiruv vaqti tugadi. Keyinroq «Arxiv hujjatlar» bo\'limidan natijani ko\'ring.');
      }
      await fetchPlagiarismResults(targetArticleId);
      toast.success(t('Antiplagiat tekshiruvi muvaffaqiyatli amalga oshirildi!'));
      goToResultView(targetArticleId);
    } catch (err: unknown) {
      const msg = getUserFriendlyError(err) || 'Antiplagiat tekshiruvida xatolik yuz berdi.';
      toast.error(msg);
    } finally {
      setIsChecking(false);
      setProgress(100);
      setPaymentVerifiedCompleted(false);
    }
  };

  const recheckPlagiarismPayment = async (silent = false) => {
      const txId = pendingPlagiarismPayment?.transactionId || sessionStorage.getItem(STORAGE_KEY_TRANSACTION_ID);
      const artId = pendingPlagiarismPayment?.articleId || sessionStorage.getItem(STORAGE_KEY_ARTICLE_ID);
      if (!txId || !artId) {
          toast.warning(t("Kutilayotgan to'lov topilmadi."));
          return;
      }
      try {
          const res = await paymentService.checkPaymentStatus(txId);
          if (res.payment_status === 2) {
              sessionStorage.removeItem(STORAGE_KEY_TRANSACTION_ID);
              sessionStorage.removeItem(STORAGE_KEY_ARTICLE_ID);
              setArticleId(artId);
              setPendingPlagiarismPayment(null);
              setPaymentVerifiedCompleted(true);
              toast.success(t("To'lov tasdiqlandi. Antiplagiat tekshiruvi avtomatik boshlanmoqda..."));
              window.setTimeout(() => {
                  void runPlagiarismAfterPayment(artId);
              }, 300);
              return;
          }
          if (res.payment_status === -1) {
              sessionStorage.removeItem(STORAGE_KEY_TRANSACTION_ID);
              sessionStorage.removeItem(STORAGE_KEY_ARTICLE_ID);
              setPendingPlagiarismPayment(null);
              toast.error(t("To'lov bekor qilindi yoki muvaffaqiyatsiz."));
              return;
          }
          if (!silent) toast.info(t("To'lov hali tasdiqlanmagan. Bir ozdan keyin yana urinib ko'ring."));
      } catch {
          if (!silent) toast.error(t("Holatni tekshirishda xatolik. Qayta urinib ko'ring."));
      }
  };

  // To'lov tizimga kechikib kelsa — foydalanuvchi tugma izlamasin: har 5 soniyada o'zi tekshiriladi (10 daqiqagacha)
  const pendingTx = pendingPlagiarismPayment?.transactionId;
  React.useEffect(() => {
      if (!pendingTx) return;
      const started = Date.now();
      const id = window.setInterval(() => {
          if (Date.now() - started > 10 * 60 * 1000) return;
          void recheckPlagiarismPayment(true);
      }, 5000);
      return () => window.clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTx]);

  // Tekshiruv boshlanganda holat kartasi ko'rinsin (forma o'rnida, sahifa tepasida)
  React.useEffect(() => {
      if (isChecking || pendingTx) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isChecking, pendingTx]);

  const ensureArticleForPlagiarism = async (): Promise<string> => {
      if (!form.file || !user) {
          throw new Error('Fayl yoki foydalanuvchi topilmadi.');
      }

      if (articleId) {
          const aid = String(articleId).trim();
          if (UUID_RE.test(aid)) {
              try {
                await apiService.articles.savePlagiarismConfig(aid, {
                  enabled_modules: form.enabledModuleIds,
                  document_type: form.documentType,
                  document_name: form.documentName.trim(),
                  author_first_name: form.authorFirstName.trim(),
                  author_last_name: form.authorLastName.trim(),
                  co_authors: coAuthorsPayload(form.coAuthors),
                });
              } catch {
                /* non-blocking */
              }
              return aid;
          }
      }

      // Jurnal yuborilmaydi: server antiplagiat hujjatini ichki jurnalga bog'laydi (ochiq jurnal bo'lmasa ham ishlaydi)
      const articleData = {
          title: form.documentName.trim() || `Plagiarism Check - ${form.file.name}`,
          abstract: form.documentDescription.trim() || `Hujjat turi: ${form.documentType || '—'}. Tekshiruv uchun yuborilgan.`,
          keywords: ['plagiarism', 'check', form.documentType || 'document'],
          page_count: 1,
          fast_track: false,
      };

      const articleResponse = await apiService.articles.create(articleData, { mainFile: form.file });
      const createdArticle = articleResponse?.data || articleResponse;
      const newId = String(createdArticle?.id ?? '').trim();

      if (!newId || !UUID_RE.test(newId)) {
          throw new Error('Antiplagiat uchun maqola yaratilmadi yoki server noto\'g\'ri javob qaytardi.');
      }

      setArticleId(newId);
      try {
        await apiService.articles.savePlagiarismConfig(newId, {
          enabled_modules: form.enabledModuleIds,
          document_type: form.documentType,
          document_name: form.documentName.trim(),
          author_first_name: form.authorFirstName.trim(),
          author_last_name: form.authorLastName.trim(),
          co_authors: coAuthorsPayload(form.coAuthors),
        });
      } catch {
        /* non-blocking */
      }
      return newId;
  };

  const handleFileSelect = (picked: File | null) => {
      if (!picked) {
        patchForm({ file: null });
        return;
      }
      if (picked.size > MAX_UPLOAD_BYTES) {
          toast.error(t('Fayl hajmi {value} dan oshmasligi kerak.', { value: formatMaxUploadLabel() }));
          return;
      }
      patchForm({ file: picked });
      setResult(null);
      setCertificateData(null);
      setProgress(0);
      setArticleId(null);
      setPendingPlagiarismPayment(null);
      setPaymentVerifiedCompleted(false);
      sessionStorage.removeItem(STORAGE_KEY_TRANSACTION_ID);
      sessionStorage.removeItem(STORAGE_KEY_ARTICLE_ID);
  };
  
  const closePaymentModal = () => {
      setIsPaymentModalOpen(false);
      if (paymentTimerRef.current) clearTimeout(paymentTimerRef.current);
      setPaymentStatus('idle');
      setPaymentError(null);
  };

  /** Server: "antiplagiat to'lovi allaqachon qilingan" — xato emas, to'langan hujjat tekshiruvini davom ettiramiz */
  const isAlreadyPaidMessage = (msg: string) => /allaqachon/i.test(String(msg || ''));
  const continueAlreadyPaid = (paidArticleId: string) => {
      closePaymentModal();
      setPaymentVerifiedCompleted(true);
      toast.info(t("Bu hujjat uchun to'lov qilingan — tekshiruv natijasi ochilmoqda."));
      void runPlagiarismAfterPayment(paidArticleId);
  };

  const handlePay = async () => {
      if (!form.file || !user) return;

      setPaymentError(null);
      setPaymentStatus('processing');
      if (paymentTimerRef.current) clearTimeout(paymentTimerRef.current);

      try {
          const linkedArticleId = await ensureArticleForPlagiarism();

          // Create transaction and process payment via Click
          const result = await paymentService.createTransactionAndPay(
              PLAGIARISM_CHECK_PRICE,
              'UZS',
              'language_editing', // Using language_editing as service type for plagiarism check
              linkedArticleId
          );
          
          console.log('Payment result:', result);
          
          if (result && result.success === true && result.transaction_id) {
              sessionStorage.setItem(STORAGE_KEY_TRANSACTION_ID, result.transaction_id);
              sessionStorage.setItem(STORAGE_KEY_ARTICLE_ID, linkedArticleId);
              // Sahifaning o'z "tayyorlanmoqda" oynasi yopiladi — endi umumiy to'lov oynasi ochiladi
              closePaymentModal();
              await paymentService.redirectToPaymentPage(result.transaction_id, result.payment_url);
              return;
          } else {
              // Payment preparation failed
              const errorMsg = (result as any)?.user_message || result?.error_note || result?.error || "To'lovni amalga oshirishda xatolik yuz berdi.";
              if (isAlreadyPaidMessage(errorMsg)) {
                  continueAlreadyPaid(linkedArticleId);
                  return;
              }
              setPaymentStatus('failed');
              setPaymentError(formatPlagiarismPaymentMessage(errorMsg));
              addNotification({ 
                  message: errorMsg,
              });
          }
      } catch (err: any) {
          console.error('Payment failed:', err);
          // Maydon xatosi (masalan, fayl formati) — aniq sababi ko'rsatiladi, umumiy "Xatolik yuz berdi" emas
          const errorMsg = formatDrfValidationErrors(err?.response) || err.message || err.error_note || err.user_message
              || "To'lovni amalga oshirishda xatolik yuz berdi.";
          if (articleId && isAlreadyPaidMessage(errorMsg)) {
              continueAlreadyPaid(articleId);
              return;
          }
          setPaymentStatus('failed');
          setPaymentError(formatPlagiarismPaymentMessage(errorMsg));
      }
  };

  const handleCheck = async (paymentCompleted = false, forcedArticleId?: string) => {
      if (!form.file || !user) return;
      if (!form.authorFirstName.trim() || !form.authorLastName.trim()) {
          toast.error(t('Ism va familyani kiriting.'));
          return;
      }
      if (hasIncompleteCoAuthor(form.coAuthors)) {
          toast.error(t('Hammuallifning ism va familiyasini kiriting.'));
          return;
      }
      if (!form.documentName.trim()) {
          toast.error(t('Hujjat nomini kiriting.'));
          return;
      }
      if (!form.documentType) {
          toast.error(t('Hujjat turini tanlang.'));
          return;
      }
      if (!form.enabledModuleIds.length) {
          toast.error(t('Kamida bitta tekshirish modulini yoqing.'));
          return;
      }
      // Narx 0 bo'lsa to'lovsiz tekshirish; aks holda to'lov talab qilinadi
      const requiresPayment = PLAGIARISM_CHECK_PRICE > 0;
      if (requiresPayment && !paymentCompleted && !paymentVerifiedCompleted) {
          // Tasdiqlash oynasisiz to'g'ridan-to'g'ri Click to'loviga o'tiladi
          setIsPaymentModalOpen(true);
          void handlePay();
          return;
      }
      
      followCheckRef.current = true;
      setIsChecking(true);
      setCertificateData(null);
      setResult(null);
      setProgress(0);
      setCheckStatusLabel('Chuqur antiplagiat tekshiruvi tayyorlanmoqda...');
      if (!forcedArticleId) {
          setPaymentVerifiedCompleted(false);
      }

      try {
          const targetArticleId = forcedArticleId || (await ensureArticleForPlagiarism());

          const plagiarismResult = await apiService.articles.checkPlagiarism(targetArticleId, {
            enabledModules: form.enabledModuleIds,
            force: true,
          });

          if (plagiarismResult?.status === 'completed' && plagiarismResult.cached) {
            applyPlagiarismResults(
              plagiarismResult.plagiarism || 0,
              plagiarismResult.ai_content || 0,
              mapSourcesFromApi(plagiarismResult.sources),
              plagiarismResult.report,
              plagiarismResult.originality,
            );
            toast.success(t('Antiplagiat natijasi yuklandi.'));
            goToResultView(targetArticleId);
            return;
          }

          setCheckStatusLabel("Tekshiruv boshlandi — ichki baza va ochiq ilmiy manbalar bo'yicha skanerlanmoqda...");
          const ready = await pollUntilPlagiarismReady(targetArticleId);
          if (!ready) {
            throw new Error('Tekshiruv vaqti tugadi. Keyinroq natijani «Arxiv hujjatlar»dan ko\'ring.');
          }
          await fetchPlagiarismResults(targetArticleId);
          toast.success(t('Antiplagiat tekshiruvi muvaffaqiyatli amalga oshirildi!'));
          goToResultView(targetArticleId);
      } catch (err: any) {
          const msg = getUserFriendlyError(err) || 'Antiplagiat tekshiruvida xatolik yuz berdi.';
          toast.error(msg);
          if (err?.status === 402) {
              setIsPaymentModalOpen(true);
              setPaymentError('To\'lov talab qilinadi. Iltimos, avval to\'lovni amalga oshiring.');
          }
      } finally {
          setIsChecking(false);
          setProgress(100);
      }
  };

  const onPanelSubmit = () => {
    void handleCheck(false);
  };

  return (
      <>
      <div className="no-print mx-auto max-w-4xl px-4 py-6">
          {(isChecking || pendingPlagiarismPayment) ? (
            <CheckStatusCard
              stage={pendingPlagiarismPayment && !isChecking ? 'payment' : 'checking'}
              paid={PLAGIARISM_CHECK_PRICE > 0}
              progress={progress}
              label={checkStatusLabel}
              documentName={form.documentName || form.file?.name || activeDocTitle}
              onRecheck={() => void recheckPlagiarismPayment()}
              onDismiss={dismissStatusCard}
            />
          ) : (
          <AntiplagiatUploadPanel
            values={form}
            onChange={patchForm}
            price={PLAGIARISM_CHECK_PRICE}
            isChecking={isChecking}
            onSubmit={onPanelSubmit}
            onFileSelect={handleFileSelect}
          />
          )}

          {PLAGIARISM_CHECK_PRICE === 0 && (
            <p className="mt-3 text-center text-xs text-emerald-700">{t("Test rejimi — to'lovsiz tekshirish")}</p>
          )}

          {paymentVerifiedCompleted && !isChecking && !result && (
              <div className="mx-auto mt-4 max-w-md rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <p className="mb-2 text-sm font-semibold text-emerald-900">{t("To'lov tasdiqlandi")}</p>
                  <Button onClick={() => handleCheck(true)} disabled={isChecking} className="w-full">
                      {t('Tekshirishni davom ettirish')}
                  </Button>
              </div>
          )}

      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
          <ModalPortal open={isPaymentModalOpen}>
              <div className="w-full max-w-md rounded-2xl border border-white/50 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl">
                  {paymentStatus === 'idle' && (
                      <div>
                          <h3 className="mb-4 text-xl font-bold text-slate-950">{t("To'lovni tasdiqlash")}</h3>
                          <p className="mb-4 font-medium text-slate-900">
                              {t("Antiplagiat tekshiruvi uchun to'lov:")} <span className="font-bold text-violet-950">{t("{value} so'm", { value: PLAGIARISM_CHECK_PRICE.toLocaleString() })}</span>
                          </p>
                          <div className="flex gap-3">
                              <Button onClick={handlePay} className="flex-1">
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  {t("To'lovni Amalga Oshirish")}
                              </Button>
                              <Button variant="secondary" onClick={closePaymentModal} className="flex-1">
                                  {t('Bekor qilish')}
                              </Button>
                          </div>
                      </div>
                  )}
                  {paymentStatus === 'processing' && (
                      <div className="text-center">
                          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                          <p className="mt-4 text-lg font-semibold text-slate-950">{t("To'lovga tayyorlanmoqda…")}</p>
                          <p className="mx-auto mt-2 max-w-xs text-sm font-medium text-slate-800">
                              {t('Maqola yaratilmoqda va tranzaksiya ochilmoqda. Bu 30–60 soniya davom etishi mumkin; iltimos kuting yoki oynani yopmang.')}
                          </p>
                      </div>
                  )}
                  {paymentStatus === 'success' && (
                      <div className="text-center">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                              <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
                          </div>
                          <p className="mt-4 text-lg font-semibold text-slate-950">{t("To'lov muvaffaqiyatli!")}</p>
                          <Button onClick={() => { closePaymentModal(); handleCheck(true); }} className="w-full mt-6">
                              {t('Tekshirishni Davom Ettirish')}
                          </Button>
                      </div>
                  )}
                  {paymentStatus === 'failed' && (
                      <div className="relative text-center" role="alert">
                          <button
                              type="button"
                              onClick={closePaymentModal}
                              className="absolute -right-2 -top-2 rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              aria-label={t('Yopish')}
                          >
                              <X className="h-5 w-5" aria-hidden />
                          </button>
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                              <XCircle className="h-8 w-8 text-red-600" aria-hidden />
                          </div>
                          <h3 className="mt-4 text-lg font-semibold text-slate-950">{t("To'lovni boshlab bo'lmadi")}</h3>
                          <p className="mx-auto mt-2 max-w-sm break-words text-sm text-slate-600">
                              {paymentError || t("To'lovni amalga oshirishda xatolik yuz berdi.")}
                          </p>
                          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
                              <Button variant="secondary" onClick={closePaymentModal} className="flex-1">
                                  {t('Yopish')}
                              </Button>
                              <Button onClick={handlePay} className="flex-1">
                                  {t('Qayta urinish')}
                              </Button>
                          </div>
                      </div>
                  )}
              </div>
          </ModalPortal>
      )}
      </>
  );
};

export default PlagiarismCheck;