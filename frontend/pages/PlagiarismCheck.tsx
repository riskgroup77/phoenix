import React, { useState, useRef } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ModalPortal from '../components/ui/ModalPortal';
import { Printer, Link as LinkIcon, CreditCard, Download, FileText, X } from 'lucide-react';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import AntiplagiatCertificate, { AntiplagiatCertificateData } from '../components/AntiplagiatCertificate';
import PlagiarismFullReport, { PlagiarismFullReportData } from '../components/PlagiarismFullReport';
import AntiplagiatUploadPanel, {
  AntiplagiatFormValues,
  createDefaultAntiplagiatForm,
} from '../components/AntiplagiatUploadPanel';
import { ANTIPLAGIAT_MODULES, DEFAULT_ENABLED_MODULE_IDS } from '../constants/antiplagiatModules';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { getUserFriendlyError } from '../utils/errorHandler';
import { toast } from 'react-toastify';
import { useServicePrices } from '../hooks/useServicePrices';
import { MAX_UPLOAD_BYTES, formatMaxUploadLabel } from '../constants/upload';

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

/** Modal va toast uchun: HTML entity va texnik UUID xabarlarini soddalashtirish */
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
  const low = s.toLowerCase();
  if (
    (low.includes('journal') || low.includes('jurnal')) &&
    (low.includes('uuid') || low.includes('not a valid') || low.includes("to'g'ri"))
  ) {
    return 'Jurnal aniqlanmadi yoki server bilan bog\'lanishda nomuvofiqlik bo\'ldi. Sahifani yangilang (F5) va qayta urinib ko\'ring.';
  }
  return s;
}

const PlagiarismCheck: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { getPrice } = useServicePrices();
  const [form, setForm] = useState<AntiplagiatFormValues>(createDefaultAntiplagiatForm);
  const [availableJournals, setAvailableJournals] = useState<any[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PlagiarismResult | null>(null);
  const [certificateData, setCertificateData] = useState<AntiplagiatCertificateData | null>(null);
  const [fullReportData, setFullReportData] = useState<PlagiarismFullReportData | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);

  const patchForm = (patch: Partial<AntiplagiatFormValues>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };
  
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

  const JOURNAL_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const extractList = <T,>(raw: any): T[] => {
    if (Array.isArray(raw)) return raw as T[];
    if (!raw || typeof raw !== 'object') return [];
    if (Array.isArray(raw.results)) return raw.results as T[];
    if (Array.isArray(raw.items)) return raw.items as T[];
    if (Array.isArray(raw.data)) return raw.data as T[];
    if (raw.data && typeof raw.data === 'object') {
      if (Array.isArray(raw.data.results)) return raw.data.results as T[];
      if (Array.isArray(raw.data.items)) return raw.data.items as T[];
    }
    return [];
  };

  const journalIdValid = (j: any): string | null => {
    const id = String(j?.id ?? j?.uuid ?? j?.pk ?? '').trim();
    return JOURNAL_UUID_RE.test(id) ? id : null;
  };

  /** Jurnal tanlash: oldindan nashr to'lovi talab qilinmasa — antiplagiat uchun maqola yaratish osonlashadi */
  const pickJournalForPlagiarism = (journals: any[]): any | null => {
    if (!journals?.length) return null;
    const valid = journals.filter((j) => journalIdValid(j));
    if (!valid.length) return null;
    const withoutPrepayFee = valid.find((j) => {
      const fee = Number(j.publication_fee ?? 0) || 0;
      const perPage = Number(j.price_per_page ?? 0) || 0;
      const isPre = j.payment_model === 'pre-payment';
      return !isPre || (fee <= 0 && perPage <= 0);
    });
    return withoutPrepayFee || valid[0];
  };

  // Cleanup timer on unmount
  React.useEffect(() => {
      return () => {
          if (paymentTimerRef.current) {
              clearTimeout(paymentTimerRef.current);
          }
      };
  }, []);

  React.useEffect(() => {
      const fetchJournals = async () => {
          if (!user) return;
          try {
              // Turli API formatlarini qo'llab-quvvatlash (results/data/items)
              const [paged, plain] = await Promise.all([
                  apiService.journals.list({ pageSize: 500 }),
                  apiService.journals.list(),
              ]);
              const merged = [...extractList<any>(paged), ...extractList<any>(plain)];
              const dedup = Array.from(new Map(merged.map((j: any) => [String(j?.id ?? j?.uuid ?? j?.pk ?? ''), j])).values())
                  .filter((j: any) => journalIdValid(j));
              setAvailableJournals(dedup);
          } catch (err) {
              console.error('Failed to fetch journals for plagiarism check:', err);
              setAvailableJournals([]);
          }
      };

      fetchJournals();
  }, [user]);

  React.useEffect(() => {
      if (!user) return;
      setForm((prev) => ({
        ...prev,
        authorFirstName: prev.authorFirstName.trim() ? prev.authorFirstName : (user.firstName || ''),
        authorLastName: prev.authorLastName.trim() ? prev.authorLastName : (user.lastName || ''),
      }));
  }, [user]);

  // To'lov sahifasidan qaytish: tranzaksiya holatini aniq ID bo'yicha tekshiramiz (ro'yxat paginatsiyasi xatosiz).
  // pending bo'lsa sessionStorage ni SAQLAB qolamiz — avvalgi kodda har safar o'chirilardi va UI "o'ylanib" qolardi.
  React.useEffect(() => {
      const pendingTxId = sessionStorage.getItem(STORAGE_KEY_TRANSACTION_ID);
      const pendingArticleId = sessionStorage.getItem(STORAGE_KEY_ARTICLE_ID);
      if (!pendingTxId || !pendingArticleId) return;

      let cancelled = false;
      (async () => {
          try {
              const res = await paymentService.checkPaymentStatus(pendingTxId);
              if (cancelled) return;
              if (res.payment_status === 2) {
                  sessionStorage.removeItem(STORAGE_KEY_TRANSACTION_ID);
                  sessionStorage.removeItem(STORAGE_KEY_ARTICLE_ID);
                  setArticleId(pendingArticleId);
                  setPendingPlagiarismPayment(null);
                  setPaymentVerifiedCompleted(true);
                  toast.success('To\'lov tasdiqlandi. Antiplagiat tekshiruvi avtomatik boshlanmoqda...');
                  window.setTimeout(() => {
                      void runPlagiarismAfterPayment(pendingArticleId);
                  }, 300);
                  return;
              }
              if (res.payment_status === -1) {
                  sessionStorage.removeItem(STORAGE_KEY_TRANSACTION_ID);
                  sessionStorage.removeItem(STORAGE_KEY_ARTICLE_ID);
                  setPendingPlagiarismPayment(null);
                  toast.error('To\'lov bekor qilindi yoki muvaffaqiyatsiz.');
                  return;
              }
              // pending — bank callback kechikishi mumkin
              setArticleId(pendingArticleId);
              setPendingPlagiarismPayment({ transactionId: pendingTxId, articleId: pendingArticleId });
              toast.info(
                  'To\'lov hali tizimda tasdiqlanmagan. Agar Clickda to\'lov qilgan bo\'lsangiz, 1–2 daqiqa kutib "To\'lov holatini tekshirish" tugmasini bosing.',
                  { autoClose: 9000 }
              );
          } catch {
              if (!cancelled) {
                  toast.warning('To\'lov holatini tekshirib bo\'lmadi. Internetni tekshirib, sahifani yangilang.');
              }
          }
      })();
      return () => { cancelled = true; };
  }, []);

  const applyPlagiarismResults = (
    plagiarismPercentage: number,
    aiContentPercentage: number,
    foundSources: PlagiarismSource[],
    report?: Record<string, unknown> | null,
  ) => {
    const originality = 100 - plagiarismPercentage;
    const citationPct = report?.citation_percent ?? report?.plagiarism_breakdown?.self_citation ?? 0;
    const selfCitationPct = report?.self_citation_percent ?? 0;
    const charCount = report?.character_count;
    const sentCount = report?.sentence_count;
    const enabledIds = Array.isArray(report?.enabled_module_ids)
      ? (report.enabled_module_ids as string[])
      : form.enabledModuleIds;
    const enabledCount = enabledIds.length || form.enabledModuleIds.length || DEFAULT_ENABLED_MODULE_IDS.length;
    const searchModules = `${enabledCount} ta moduldan / ${enabledCount} tasida tekshirilgan`;
    const finalResult = {
      plagiarism: plagiarismPercentage,
      aiContent: aiContentPercentage,
      citations: Number(citationPct || 0),
      selfCitation: Number(selfCitationPct || 0),
      sources: foundSources,
    };
    setResult(finalResult);

    const certNumber = Date.now().toString().slice(-6);
    const newCertificateData: AntiplagiatCertificateData = {
      certificateNumber: certNumber,
      checkDate: new Date().toLocaleDateString('uz-UZ'),
      author: `${(form.authorLastName || user?.lastName || '').trim()} ${(form.authorFirstName || user?.firstName || '').trim()}`.trim(),
      workType: form.documentType || 'Ilmiy ish',
      fileName: form.documentName.trim() || form.file?.name || '',
      citations: `${Number(citationPct || 0).toFixed(1)}%`,
      selfCitation: `${Number(selfCitationPct || 0).toFixed(1)}%`,
      plagiarism: `${plagiarismPercentage}%`,
      originality: `${originality.toFixed(2)}%`,
      searchModules,
    };
    setCertificateData(newCertificateData);

    const fullReport: PlagiarismFullReportData = {
      checkerName: newCertificateData.author,
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
      searchModules: Array.isArray(report?.search_modules)
        ? (report.search_modules as string[])
        : form.enabledModuleIds
            .map((id) => ANTIPLAGIAT_MODULES.find((m) => m.id === id)?.label)
            .filter(Boolean) as string[],
      sources: foundSources.map((s, idx) => {
        const isUrl = s.source.startsWith('http') || s.source.includes('ilmiyfaoliyat.uz');
        const sourceUrl = s.source.startsWith('http') ? s.source : (isUrl ? `https://${s.source.replace(/^\/\//, '')}` : undefined);
        const sourceName = isUrl
          ? (s.snippet || s.source.replace(/^https?:\/\//, '').slice(0, 120))
          : (s.snippet || s.source).slice(0, 160);
        return {
          id: idx + 1,
          percentage: `${Number(s.similarity).toFixed(2)}%`,
          sourceName,
          sourceUrl,
          searchModule: (s as { search_module?: string }).search_module
            ? `${(s as { search_module?: string }).search_module} qidiruv moduli`
            : 'Search module INTERNET PLUS qidiruv moduli',
        };
      }),
    };
    setFullReportData(fullReport);
  };

  const mapSourcesFromApi = (apiSources: unknown): (PlagiarismSource & { search_module?: string })[] => {
    if (!apiSources || !Array.isArray(apiSources)) return [];
    return apiSources
      .map((s: { source?: string; snippet?: string; similarity?: number; search_module?: string }) => ({
        source: (s.source || '').trim(),
        snippet: (s.snippet || '').trim(),
        similarity: typeof s.similarity === 'number' ? s.similarity : 0,
        search_module: s.search_module,
      }))
      .filter((s) => s.source || s.snippet);
  };

  /** To'lovdan keyin server avtomatik tekshiruvni ishga tushiradi — natija tayyor bo'lguncha kutamiz */
  const pollUntilPlagiarismReady = async (targetArticleId: string, maxAttempts = 40): Promise<boolean> => {
    for (let i = 0; i < maxAttempts; i++) {
      setProgress(Math.min(95, 10 + i * 2));
      try {
        const art = await apiService.articles.get(targetArticleId);
        const data = art?.data || art;
        if (data?.plagiarism_checked_at && data.plagiarism_percentage != null) {
          const sources = mapSourcesFromApi(data.plagiarism_report?.sources);
          applyPlagiarismResults(
            Number(data.plagiarism_percentage) || 0,
            Number(data.ai_content_percentage) || 0,
            sources,
            data.plagiarism_report,
          );
          return true;
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => window.setTimeout(r, 3000));
    }
    return false;
  };

  const runPlagiarismAfterPayment = async (targetArticleId: string) => {
    setIsChecking(true);
    setProgress(5);
    setResult(null);
    setCertificateData(null);
    try {
      const ready = await pollUntilPlagiarismReady(targetArticleId);
      if (ready) {
        toast.success('Antiplagiat tekshiruvi muvaffaqiyatli yakunlandi!');
        return;
      }
      toast.info('Avtomatik tekshiruv davom etmoqda. API orqali yakunlanmoqda...');
      const plagiarismResult = await apiService.articles.checkPlagiarism(targetArticleId, {
        enabledModules: form.enabledModuleIds,
      });
      const plagiarismPercentage = plagiarismResult.plagiarism || 0;
      const aiContentPercentage = plagiarismResult.ai_content || 0;
      applyPlagiarismResults(
        plagiarismPercentage,
        aiContentPercentage,
        mapSourcesFromApi(plagiarismResult.sources),
        plagiarismResult.report,
      );
      toast.success('Antiplagiat tekshiruvi muvaffaqiyatli amalga oshirildi!');
    } catch (err: unknown) {
      const msg = getUserFriendlyError(err) || 'Antiplagiat tekshiruvida xatolik yuz berdi.';
      toast.error(msg);
    } finally {
      setIsChecking(false);
      setProgress(100);
      setPaymentVerifiedCompleted(false);
    }
  };

  const recheckPlagiarismPayment = async () => {
      const txId = pendingPlagiarismPayment?.transactionId || sessionStorage.getItem(STORAGE_KEY_TRANSACTION_ID);
      const artId = pendingPlagiarismPayment?.articleId || sessionStorage.getItem(STORAGE_KEY_ARTICLE_ID);
      if (!txId || !artId) {
          toast.warning('Kutilayotgan to\'lov topilmadi.');
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
              toast.success('To\'lov tasdiqlandi. Antiplagiat tekshiruvi avtomatik boshlanmoqda...');
              window.setTimeout(() => {
                  void runPlagiarismAfterPayment(artId);
              }, 300);
              return;
          }
          if (res.payment_status === -1) {
              sessionStorage.removeItem(STORAGE_KEY_TRANSACTION_ID);
              sessionStorage.removeItem(STORAGE_KEY_ARTICLE_ID);
              setPendingPlagiarismPayment(null);
              toast.error('To\'lov bekor qilindi yoki muvaffaqiyatsiz.');
              return;
          }
          toast.info('To\'lov hali tasdiqlanmagan. Bir ozdan keyin yana urinib ko\'ring.');
      } catch {
          toast.error('Holatni tekshirishda xatolik. Qayta urinib ko\'ring.');
      }
  };

  const ensureArticleForPlagiarism = async (): Promise<string> => {
      if (!form.file || !user) {
          throw new Error('Fayl yoki foydalanuvchi topilmadi.');
      }

      if (articleId) {
          const aid = String(articleId).trim();
          if (JOURNAL_UUID_RE.test(aid)) {
              try {
                await apiService.articles.savePlagiarismConfig(aid, {
                  enabled_modules: form.enabledModuleIds,
                  document_type: form.documentType,
                });
              } catch {
                /* non-blocking */
              }
              return aid;
          }
      }

      console.log('[DEBUG] availableJournals:', availableJournals);
      const selectedJournal = pickJournalForPlagiarism(availableJournals);
      console.log('[DEBUG] selectedJournal:', selectedJournal);
      console.log('[DEBUG] selectedJournal?.id:', selectedJournal?.id);
      
      const journalPk = journalIdValid(selectedJournal);
      if (!journalPk) {
          throw new Error('Jurnal topilmadi yoki jurnal ID noto\'g\'ri. Administratorga murojaat qiling.');
      }

      const articleData = {
          title: form.documentName.trim() || `Plagiarism Check - ${form.file.name}`,
          abstract: form.documentDescription.trim() || `Hujjat turi: ${form.documentType || '—'}. Tekshiruv uchun yuborilgan.`,
          keywords: ['plagiarism', 'check', form.documentType || 'document'],
          journal: journalPk,
          page_count: 1,
          fast_track: false,
      };
      console.log('[DEBUG] articleData:', articleData);

      const articleResponse = await apiService.articles.create(articleData, { mainFile: form.file });
      const createdArticle = articleResponse?.data || articleResponse;
      const newId = String(createdArticle?.id ?? '').trim();

      if (!newId || !JOURNAL_UUID_RE.test(newId)) {
          throw new Error('Antiplagiat uchun maqola yaratilmadi yoki server noto\'g\'ri javob qaytardi.');
      }

      setArticleId(newId);
      try {
        await apiService.articles.savePlagiarismConfig(newId, {
          enabled_modules: form.enabledModuleIds,
          document_type: form.documentType,
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
          toast.error(`Fayl hajmi ${formatMaxUploadLabel()} dan oshmasligi kerak.`);
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
  
  const handlePrint = () => {
      window.print();
  };

  const closePaymentModal = () => {
      setIsPaymentModalOpen(false);
      if (paymentTimerRef.current) clearTimeout(paymentTimerRef.current);
      setPaymentStatus('idle');
      setPaymentError(null);
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
              addNotification({
                  message: 'To\'lov sahifasida QR kodni skanerlang yoki tugmani bosing. To\'lovdan so\'ng sahifaga qayting va "Tekshirishni davom ettirish" tugmasini bosing.',
              });
              paymentService.redirectToPaymentPage(result.transaction_id);
              return;
          } else if (result && result.success === true && result.payment_url && result.transaction_id) {
              paymentService.redirectToPaymentPage(result.transaction_id);
              return;
          } else {
              // Payment preparation failed
              const errorMsg = (result as any)?.user_message || result?.error_note || result?.error || "To'lovni amalga oshirishda xatolik yuz berdi.";
              setPaymentStatus('failed');
              setPaymentError(formatPlagiarismPaymentMessage(errorMsg));
              addNotification({ 
                  message: errorMsg,
              });
          }
      } catch (err: any) {
          console.error('Payment failed:', err);
          const errorMsg = err.message || err.error_note || err.user_message || "To'lovni amalga oshirishda xatolik yuz berdi.";
          setPaymentStatus('failed');
          setPaymentError(formatPlagiarismPaymentMessage(errorMsg));
      }
  };

  const handleCheck = async (paymentCompleted = false, forcedArticleId?: string) => {
      if (!form.file || !user) return;
      if (!form.authorFirstName.trim() || !form.authorLastName.trim()) {
          toast.error('Ism va familyani kiriting.');
          return;
      }
      if (!form.documentName.trim()) {
          toast.error('Hujjat nomini kiriting.');
          return;
      }
      if (!form.documentType) {
          toast.error('Hujjat turini tanlang.');
          return;
      }
      if (!form.enabledModuleIds.length) {
          toast.error('Kamida bitta tekshirish modulini yoqing.');
          return;
      }
      // Narx 0 bo'lsa to'lovsiz tekshirish; aks holda to'lov talab qilinadi
      const requiresPayment = PLAGIARISM_CHECK_PRICE > 0;
      if (requiresPayment && !paymentCompleted && !paymentVerifiedCompleted) {
          setIsPaymentModalOpen(true);
          return;
      }
      
      setIsChecking(true);
      setCertificateData(null);
      setResult(null);
      setProgress(0);
      if (!forcedArticleId) {
          setPaymentVerifiedCompleted(false);
      }

      try {
          const targetArticleId = forcedArticleId || (await ensureArticleForPlagiarism());

          // Backend will verify payment; if not paid, returns 402
          const plagiarismResult = await apiService.articles.checkPlagiarism(targetArticleId, {
        enabledModules: form.enabledModuleIds,
      });
          
          // Update UI with the results
          const plagiarismPercentage = plagiarismResult.plagiarism || 0;
          const aiContentPercentage = plagiarismResult.ai_content || 0;
          applyPlagiarismResults(
            plagiarismPercentage,
            aiContentPercentage,
            mapSourcesFromApi(plagiarismResult.sources),
            plagiarismResult.report,
          );
          toast.success('Antiplagiat tekshiruvi muvaffaqiyatli yakunlandi!');
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
      <div className="no-print mx-auto max-w-4xl px-4 py-8">
          <p className="mb-6 text-center text-sm text-slate-600">
            Hujjat yuklang, turini tanlang, tekshirish modullarini sozlang va natijani oling.
          </p>

          <AntiplagiatUploadPanel
            values={form}
            onChange={patchForm}
            price={PLAGIARISM_CHECK_PRICE}
            isChecking={isChecking}
            onSubmit={onPanelSubmit}
            onFileSelect={handleFileSelect}
          />

          {PLAGIARISM_CHECK_PRICE === 0 && (
            <p className="mt-3 text-center text-xs text-emerald-700">Test rejimi — to&apos;lovsiz tekshirish</p>
          )}

          {isChecking && (
              <div className="mx-auto mt-8 max-w-lg">
                  <p className="mb-2 text-center font-medium text-slate-700">Antiplagiat tahlili — hujjat to&apos;liq tekshirilmoqda...</p>
                  <div className="h-2.5 w-full rounded-full bg-slate-200">
                      <div className="h-2.5 rounded-full bg-blue-600 transition-[width] duration-300 ease-in-out" style={{ width: `${progress}%` }} />
                  </div>
              </div>
          )}

          {paymentVerifiedCompleted && !isChecking && !result && (
              <div className="mx-auto mt-4 max-w-md rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <p className="mb-2 text-sm font-semibold text-emerald-900">To&apos;lov tasdiqlandi</p>
                  <Button onClick={() => handleCheck(true)} disabled={isChecking} className="w-full">
                      Tekshirishni davom ettirish
                  </Button>
              </div>
          )}

          {pendingPlagiarismPayment && !paymentVerifiedCompleted && (
              <div className="mx-auto mt-4 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
                  <p className="mb-3 text-sm text-amber-900">
                      To&apos;lov Clickda qilingan bo&apos;lsa, tizimga kelishi biroz vaqt olishi mumkin.
                  </p>
                  <Button type="button" variant="secondary" onClick={recheckPlagiarismPayment} className="w-full sm:w-auto">
                      To&apos;lov holatini tekshirish
                  </Button>
              </div>
          )}

          {result && (
              <div className="mt-10">
                  <h3 className="text-xl font-bold text-center mb-4 text-slate-900">Tekshiruv natijalari</h3>
                  <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
                          <p className="text-sm font-semibold text-slate-600">Originallik</p>
                          <p className="text-4xl font-bold text-emerald-700 mt-1">{100 - result.plagiarism}%</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
                          <p className="text-sm font-semibold text-slate-600">O&apos;xshashlik (Plagiat)</p>
                          <p className="text-4xl font-bold text-amber-700 mt-1">{result.plagiarism}%</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
                          <p className="text-sm font-semibold text-slate-600">Iqtiboslar</p>
                          <p className="text-4xl font-bold text-cyan-700 mt-1">{result.citations.toFixed(1)}%</p>
                      </div>
                  </div>

                   <Card title="Topilgan manbalar" className="mx-auto mt-6 max-w-3xl">
                      <p className="-mt-4 mb-4 text-sm text-slate-600">Tanlangan modullar bo&apos;yicha o&apos;xshashlik topilgan manbalar.</p>
                      <div className="max-h-80 space-y-4 overflow-y-auto pr-2">
                          {result.sources.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-6">
                              Aniq manba topilmadi. Plagiat foizi ko&apos;rsatilgan.
                            </p>
                          ) : (
                          result.sources.map((source, index) => (
                          <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                              <div className="flex justify-between items-start text-sm">
                                  <a href={source.source.startsWith('http') ? source.source : `https://${source.source}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-700 hover:underline break-all">
                                      <LinkIcon size={14}/> {source.source.length > 60 ? source.source.slice(0, 57) + '...' : source.source}
                                  </a>
                                  <span className="font-bold text-amber-800 whitespace-nowrap ml-4">{source.similarity}%</span>
                              </div>
                              <blockquote className="mt-2 pl-3 border-l-2 border-amber-400 text-xs text-slate-500 italic">
                                  {source.snippet}
                              </blockquote>
                          </div>
                          ))
                          )}
                      </div>
                  </Card>
              </div>
          )}
      
      {certificateData && (
          <div className="mt-8">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4 no-print">
                  <h2 className="text-2xl font-bold text-slate-900">Tekshiruv Sertifikati</h2>
                  <div className="flex gap-2 flex-wrap">
                      {fullReportData && (
                          <Button onClick={() => setShowFullReport(true)} variant="primary">
                              <FileText className="mr-2 h-4 w-4"/> To'liq Hisobot
                          </Button>
                      )}
                      <Button onClick={handlePrint} variant="secondary" title="Chop qilish oynasida 'PDF ga saqlash' ni tanlashingiz mumkin">
                          <Download className="mr-2 h-4 w-4"/> PDF yuklab olish
                      </Button>
                      <Button onClick={handlePrint} variant="secondary">
                          <Printer className="mr-2 h-4 w-4"/> Chop etish
                      </Button>
                  </div>
              </div>
              <div id="certificate-print-area">
                  <AntiplagiatCertificate data={certificateData} />
              </div>
          </div>
      )}
      </div>

      {/* Full Report Modal */}
      {showFullReport && fullReportData && (
          <div className="fixed inset-0 bg-black/90 z-50 flex flex-col print:bg-white">
              <div className="flex justify-between items-center p-4 bg-white/55 border-b border-slate-200/90 no-print">
                  <h3 className="text-xl font-bold text-slate-900">To'liq Antiplagiat Hisoboti</h3>
                  <div className="flex gap-3">
                      <Button onClick={() => window.print()} variant="primary">
                          <Printer className="mr-2 h-4 w-4"/> Chop etish / PDF
                      </Button>
                      <Button onClick={() => setShowFullReport(false)} variant="secondary">
                          <X className="mr-2 h-4 w-4"/> Yopish
                      </Button>
                  </div>
              </div>
              <div className="flex-1 overflow-auto p-6 print:p-0 print:overflow-visible">
                  <PlagiarismFullReport data={fullReportData} />
              </div>
          </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
          <ModalPortal open={isPaymentModalOpen}>
              <div className="w-full max-w-md rounded-2xl border border-white/50 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl">
                  {paymentStatus === 'idle' && (
                      <div>
                          <h3 className="mb-4 text-xl font-bold text-slate-950">To'lovni tasdiqlash</h3>
                          <p className="mb-4 font-medium text-slate-900">
                              Antiplagiat tekshiruvi uchun to'lov: <span className="font-bold text-violet-950">{PLAGIARISM_CHECK_PRICE.toLocaleString()} so'm</span>
                          </p>
                          <div className="flex gap-3">
                              <Button onClick={handlePay} className="flex-1">
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  To'lovni Amalga Oshirish
                              </Button>
                              <Button variant="secondary" onClick={closePaymentModal} className="flex-1">
                                  Bekor qilish
                              </Button>
                          </div>
                      </div>
                  )}
                  {paymentStatus === 'processing' && (
                      <div className="text-center">
                          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                          <p className="mt-4 text-lg font-semibold text-slate-950">To&apos;lovga tayyorlanmoqda…</p>
                          <p className="mx-auto mt-2 max-w-xs text-sm font-medium text-slate-800">
                              Maqola yaratilmoqda va tranzaksiya ochilmoqda. Bu 30–60 soniya davom etishi mumkin; iltimos kuting yoki oynani yopmang.
                          </p>
                      </div>
                  )}
                  {paymentStatus === 'success' && (
                      <div className="text-center">
                          <div className="mb-4 text-4xl text-emerald-800">✓</div>
                          <p className="mt-4 text-lg font-semibold text-slate-950">To'lov muvaffaqiyatli!</p>
                          <Button onClick={() => { closePaymentModal(); handleCheck(true); }} className="w-full mt-6">
                              Tekshirishni Davom Ettirish
                          </Button>
                      </div>
                  )}
                  {paymentStatus === 'failed' && (
                      <div>
                          <div className="mb-4 text-center text-4xl text-red-600">✗</div>
                          <p className="mt-4 text-center text-lg font-bold text-slate-950">To'lovda xatolik!</p>
                          <p className="mx-auto mb-4 max-w-xs break-words rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-center text-sm font-medium text-slate-900">{paymentError}</p>
                          <div className="flex gap-3">
                              <Button onClick={handlePay} className="flex-1">
                                  Qayta Urinish
                              </Button>
                              <Button variant="secondary" onClick={closePaymentModal} className="flex-1">
                                  Yopish
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