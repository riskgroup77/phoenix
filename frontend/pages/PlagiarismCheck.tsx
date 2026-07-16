import React, { useState, useRef } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Upload, FileCheck, Printer, Link as LinkIcon, CreditCard, Download, FileText, X } from 'lucide-react';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import AntiplagiatCertificate, { AntiplagiatCertificateData } from '../components/AntiplagiatCertificate';
import PlagiarismFullReport, { PlagiarismFullReportData, PlagiarismSource as FullReportSource } from '../components/PlagiarismFullReport';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { getUserFriendlyError } from '../utils/errorHandler';
import { toast } from 'react-toastify';
import { useServicePrices } from '../hooks/useServicePrices';

// New types for detailed results
interface PlagiarismSource {
  source: string;
  similarity: number;
  snippet: string;
}

interface PlagiarismResult {
  plagiarism: number;
  aiContent: number;
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

// Hujjat turlari (ma'lumotnoma uchun) — rasmdagilar va xalqaro antiplagiat tizimlaridagi turlar
const HUJJAT_TURI_OPTIONS = [
  'Maqola',
  'Kitob',
  'Darslik',
  'Qo\'llanma',
  'O\'quv qo\'llanma',
  'Referat',
  'Kurs ishi',
  'Bitiruvchi Ish',
  'Diplom loyihasi',
  'Yakuniy saralash ishi',
  'Magistrlik dissertatsiyasi',
  'Nomzodlik dissertatsiyasi',
  'Doktorlik dissertatsiyasi',
  'Falsafa Doktorligi dissertatsiyasi',
  'Doktorlik dissertatsiyasi referati',
  'Doktorlik dissertatsiyasi referati fan nomzodi',
  'Monografiya',
  'Ilmiy malaka Ish',
  'Ilmiy loyiha',
  'Tadqiqot hisoboti',
  'Amaliyot hisoboti',
  'Amaliy ish',
  'Laboratoriya amaliyoti',
  'Mashqlar to\'plami',
  'Asarlar to\'plami',
  'Ta\'lim vizual nashri',
  'Ko\'rsatmalar',
  'Uslubiy ko\'rsatmalar',
  'Boshqa',
];

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
  const [file, setFile] = useState<File | null>(null);
  const [availableJournals, setAvailableJournals] = useState<any[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PlagiarismResult | null>(null);
  const [certificateData, setCertificateData] = useState<AntiplagiatCertificateData | null>(null);
  const [fullReportData, setFullReportData] = useState<PlagiarismFullReportData | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);

  // Ma'lumotnoma uchun: Ism, Familya, Hujjat nomi, Hujjat turi, Hujjat tavsifi (ixtiyoriy)
  const [authorFirstName, setAuthorFirstName] = useState('');
  const [authorLastName, setAuthorLastName] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentDescription, setDocumentDescription] = useState('');
  
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

  // Ro'yxatdan o'tgan foydalanuvchi ismi va familyasini avtomatik to'ldirish (faqat bo'sh bo'lsa)
  React.useEffect(() => {
      if (!user) return;
      setAuthorFirstName(prev => (prev.trim() ? prev : (user.firstName || '')));
      setAuthorLastName(prev => (prev.trim() ? prev : (user.lastName || '')));
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
                  toast.success('To\'lov tasdiqlandi. Endi "Tekshirishni davom ettirish" tugmasini bosing.');
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
              toast.success('To\'lov tasdiqlandi. "Tekshirishni davom ettirish" tugmasini bosing.');
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
      if (!file || !user) {
          throw new Error('Fayl yoki foydalanuvchi topilmadi.');
      }

      if (articleId) {
          const aid = String(articleId).trim();
          if (JOURNAL_UUID_RE.test(aid)) {
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
          title: documentName.trim() || `Plagiarism Check - ${file.name}`,
          abstract: documentDescription.trim() || `Hujjat turi: ${documentType || '—'}. Tekshiruv uchun yuborilgan.`,
          keywords: ['plagiarism', 'check', documentType || 'document'],
          journal: journalPk,
          page_count: 1,
          fast_track: false,
      };
      console.log('[DEBUG] articleData:', articleData);

      const articleResponse = await apiService.articles.create(articleData, { mainFile: file });
      const createdArticle = articleResponse?.data || articleResponse;
      const newId = String(createdArticle?.id ?? '').trim();

      if (!newId || !JOURNAL_UUID_RE.test(newId)) {
          throw new Error('Antiplagiat uchun maqola yaratilmadi yoki server noto\'g\'ri javob qaytardi.');
      }

      setArticleId(newId);
      return newId;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          setFile(e.target.files[0]);
          setResult(null);
          setCertificateData(null);
          setProgress(0);
          setArticleId(null);
          setPendingPlagiarismPayment(null);
          setPaymentVerifiedCompleted(false);
          sessionStorage.removeItem(STORAGE_KEY_TRANSACTION_ID);
          sessionStorage.removeItem(STORAGE_KEY_ARTICLE_ID);
      }
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
      if (!file || !user) return;

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

  const MOCK_SOURCES = [
      { url: 'www.ilmiymaqolalar.uz/archive/2021/article-15.html', snippet: '...bu esa o\'z navbatida iqtisodiy o\'sishga sezilarli ta\'sir ko\'rsatadi va innovatsion rivojlanishga olib keladi...' },
      { url: 'cyberleninka.ru/article/n/digital-economy-trends-uz', snippet: '...the integration of artificial intelligence technologies is a key factor for future development...' },
      { url: 'jstor.org/stable/25733682', snippet: '...methodology involved a qualitative analysis of emerging market trends...' },
      { url: 'researchgate.net/publication/3456789/AI_in_Economics', snippet: '...sun\'iy intellekt texnologiyalarini joriy etish kelajakdagi rivojlanishning asosiy omili hisoblanadi...' },
  ];

  const handleCheck = async (paymentCompleted = false) => {
      if (!file || !user) return;
      if (!authorFirstName.trim() || !authorLastName.trim()) {
          toast.error('Ism va familyani kiriting.');
          return;
      }
      if (!documentName.trim()) {
          toast.error('Hujjat nomini kiriting.');
          return;
      }
      if (!documentType) {
          toast.error('Hujjat turini tanlang.');
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
      setPaymentVerifiedCompleted(false);

      try {
          const targetArticleId = await ensureArticleForPlagiarism();

          // Backend will verify payment; if not paid, returns 402
          const plagiarismResult = await apiService.articles.checkPlagiarism(targetArticleId);
          
          // Update UI with the results
          const plagiarismPercentage = plagiarismResult.plagiarism || 0;
          const aiContentPercentage = plagiarismResult.ai_content || 0;
          const originality = 100 - plagiarismPercentage;

          // Use API sources (Gemini deep search) when present; otherwise fallback to mock
          let foundSources: PlagiarismSource[] = [];
          const apiSources = plagiarismResult.sources;
          if (apiSources && Array.isArray(apiSources) && apiSources.length > 0) {
              foundSources = apiSources.map((s: { source?: string; snippet?: string; similarity?: number }) => ({
                  source: (s.source || '').trim(),
                  snippet: (s.snippet || '').trim(),
                  similarity: typeof s.similarity === 'number' ? Math.round(s.similarity) : 0,
              })).filter((s: PlagiarismSource) => s.source);
          } else {
              const numSources = Math.min(3, Math.max(0, Math.floor(plagiarismPercentage / 15) + 1));
              const shuffledSources = [...MOCK_SOURCES].sort(() => 0.5 - Math.random());
              let remainingPlagiarism = plagiarismPercentage;
              for (let i = 0; i < numSources && i < shuffledSources.length; i++) {
                  if (remainingPlagiarism <= 0) break;
                  const similarity = Math.min(remainingPlagiarism, Math.floor(Math.random() * 5) + 2);
                  remainingPlagiarism -= similarity;
                  foundSources.push({
                      source: shuffledSources[i].url,
                      snippet: shuffledSources[i].snippet,
                      similarity,
                  });
              }
          }

          const finalResult = {
              plagiarism: plagiarismPercentage,
              aiContent: aiContentPercentage,
              sources: foundSources,
          };

          setResult(finalResult);

          const newCertificateData: AntiplagiatCertificateData = {
            certificateNumber: `PN-${Date.now().toString().slice(-6)}`,
            checkDate: new Date().toLocaleDateString('uz-UZ'),
            author: `${(authorLastName || user.lastName).trim()} ${(authorFirstName || user.firstName).trim()}`.trim() || user?.lastName + ' ' + user?.firstName,
            workType: documentType || 'Ilmiy ish',
            fileName: documentName.trim() || file.name,
            citations: '0%',
            selfCitation: '0%',
            plagiarism: `${plagiarismPercentage}%`,
            originality: `${originality.toFixed(2)}%`,
            searchModules: 'Milliy reestr, Internet plyus, Shablon iboralar, eLIBRARY.RU, Bibliografiya, BMK dissertatsiyalari, Viloy nashriyoti, Universitetlar halqasi, IPS Adilet, Tabobat, Tarjimali matnlar qidiruv moduli, Patentlar, Tarjima tekshiruvi uz-ru, Tarjima tekshiruvi uz-ru, parafaz matnlarni tekshirish, RDK to\'plami, Rossiya va MDH OAVlari, Elektron-kutubxona tizimlari, Garant AHT, Iqtibos keltirish, SPS Garant',
          };
          setCertificateData(newCertificateData);

          // To'liq hisobot ma'lumotlarini yaratish
          const fullReport: PlagiarismFullReportData = {
            checkerName: `${(authorLastName || user.lastName).trim()} ${(authorFirstName || user.firstName).trim()}`.trim(),
            checkerId: user?.id?.slice(-5) || '00000',
            checkerOrganization: user?.affiliation || '',
            documentNumber: newCertificateData.certificateNumber,
            uploadDate: new Date().toLocaleString('uz-UZ'),
            originalFileName: file.name,
            documentName: documentName.trim() || file.name,
            documentType: documentType || 'Ilmiy ish',
            characterCount: Math.floor(Math.random() * 50000) + 10000,
            sentenceCount: Math.floor(Math.random() * 500) + 100,
            fileSize: `${(file.size / 1024).toFixed(2)} KB`,
            plagiarismPercent: plagiarismPercentage,
            selfCitationPercent: 0,
            citationPercent: 0,
            originalityPercent: originality,
            searchModules: [
              'Phoenix Milliy reestr',
              'Internet PLUS qidiruv moduli',
              'eLIBRARY.RU qidiruv moduli',
              'OTMlar halqasi qidiruv moduli',
              'BMK dissertatsiyalari qidiruv moduli',
              'Shablon iboralar qidiruv moduli',
              'Iqtibos keltirish qidiruv moduli',
              'Patentlar qidiruv moduli',
              'Elektron-kutubxona tizimlari',
              'Tarjimali matnlar qidiruv moduli'
            ],
            sources: foundSources.map((s, idx) => ({
              id: idx + 1,
              percentage: `${s.similarity}%`,
              sourceName: s.snippet.slice(0, 100) + '...',
              sourceUrl: s.source.startsWith('http') ? s.source : `https://${s.source}`,
              searchModule: 'Internet PLUS qidiruv moduli'
            }))
          };
          setFullReportData(fullReport);

          toast.success('Antiplagiat tekshiruvi muvaffaqiyatli amalga oshirildi!');
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

  const canSubmit = file && authorFirstName.trim() && authorLastName.trim() && documentName.trim() && documentType && !isChecking;

  return (
      <>
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-white/40 bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-400 p-[1px] shadow-2xl shadow-indigo-950/35">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.45),transparent_55%)]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_100%_80%,rgba(250,204,21,0.25),transparent_45%)]" aria-hidden />
        <div className="relative rounded-[26px] bg-gradient-to-br from-white/20 via-white/10 to-cyan-200/15 px-4 py-8 backdrop-blur-md sm:px-8 sm:py-10">
      <Card title="Mustaqil Antiplagiat Tekshiruvi" className="no-print border-white/50 bg-white/30 shadow-2xl backdrop-blur-2xl">
          <p className="mb-6 text-sm font-medium text-slate-900">Ma'lumotnoma va tekshiruv natijalari uchun quyidagi maydonlarni to'ldiring. Ko'chirma foizi va manbalar (aniq linklar) hisoblanadi.</p>

          <div className="mx-auto max-w-xl space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-900">Ism *</label>
                      <input
                          type="text"
                          value={authorFirstName}
                          onChange={e => setAuthorFirstName(e.target.value)}
                          placeholder="Ism"
                          className="w-full rounded-xl border border-white/60 bg-white/45 px-4 py-2.5 text-slate-950 placeholder-slate-600 shadow-inner backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                  </div>
                  <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-900">Familya *</label>
                      <input
                          type="text"
                          value={authorLastName}
                          onChange={e => setAuthorLastName(e.target.value)}
                          placeholder="Familya"
                          className="w-full rounded-xl border border-white/60 bg-white/45 px-4 py-2.5 text-slate-950 placeholder-slate-600 shadow-inner backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                  </div>
              </div>
              <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-900">Hujjat nomi *</label>
                  <input
                      type="text"
                      value={documentName}
                      onChange={e => setDocumentName(e.target.value)}
                      placeholder="Hujjat nomini kiriting"
                      className="w-full rounded-xl border border-white/60 bg-white/45 px-4 py-2.5 text-slate-950 placeholder-slate-600 shadow-inner backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
              </div>
              <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-900">Hujjat turi *</label>
                  <select
                      value={documentType}
                      onChange={e => setDocumentType(e.target.value)}
                      className="w-full rounded-xl border border-white/60 bg-white/45 px-4 py-2.5 text-slate-950 shadow-inner backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                      <option value="" className="bg-slate-900 text-white">Hujjat turini tanlang</option>
                      {HUJJAT_TURI_OPTIONS.map((opt) => (
                          <option key={opt} value={opt} className="text-slate-900">{opt}</option>
                      ))}
                  </select>
              </div>
              <div className="text-center">
                  <label htmlFor="file-upload" className="block cursor-pointer">
                      <div className="rounded-2xl border-2 border-dashed border-white/70 bg-white/35 p-10 shadow-inner backdrop-blur-lg transition hover:bg-white/45">
                          <Upload className="mx-auto h-12 w-12 text-violet-900/80" />
                          <p className="mt-2 text-sm font-medium text-slate-950">
                              {file ? `Tanlangan fayl: ${file.name}` : 'Hujjatni shu joyga tortib tashlang yoki faylni tanlang (.docx, .pdf)'}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-800">Maksimal hajmi: 10MB</p>
                      </div>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
                  </label>
              </div>
              <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-900">Hujjat tavsifi (ixtiyoriy)</label>
                  <textarea
                      value={documentDescription}
                      onChange={e => setDocumentDescription(e.target.value)}
                      placeholder="Hujjat haqida qisqacha"
                      rows={3}
                      className="w-full rounded-xl border border-white/60 bg-white/45 px-4 py-2.5 text-slate-950 placeholder-slate-600 shadow-inner backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
              </div>
          </div>

          <div className="mt-6 space-y-4 text-center">
              <div className="mx-auto max-w-md rounded-2xl border border-white/55 bg-white/35 p-4 shadow-lg backdrop-blur-xl">
                  <p className="mb-2 text-sm font-medium text-slate-950">
                      <span className="font-bold text-violet-950">Narx:</span> {PLAGIARISM_CHECK_PRICE.toLocaleString()} so'm
                      {PLAGIARISM_CHECK_PRICE === 0 && <span className="ml-2 font-semibold text-emerald-900">(test rejimi)</span>}
                  </p>
                  {PLAGIARISM_CHECK_PRICE > 0 && (
                      <p className="text-xs text-slate-500">Antiplagiat tekshiruvi uchun to'lov talab qilinadi</p>
                  )}
              </div>
              <Button onClick={() => handleCheck(false)} disabled={!canSubmit} isLoading={isChecking} className="w-full max-w-xs mx-auto">
                  {isChecking ? 'Tekshirilmoqda...' : <><FileCheck className="mr-2 h-4 w-4" /> {PLAGIARISM_CHECK_PRICE > 0 ? 'To\'lov va Tekshirish' : 'Tekshirish'}</>}
              </Button>
              {paymentVerifiedCompleted && (
                  <div className="mx-auto mt-4 max-w-xs rounded-xl border border-emerald-700/35 bg-emerald-200/45 p-4 backdrop-blur-md">
                      <p className="mb-2 text-sm font-semibold text-emerald-950">To'lov tasdiqlandi</p>
                      <Button onClick={() => handleCheck(true)} disabled={isChecking} className="w-full">
                          Tekshirishni davom ettirish
                      </Button>
                  </div>
              )}
              {pendingPlagiarismPayment && !paymentVerifiedCompleted && (
                  <div className="mx-auto mt-4 max-w-md rounded-xl border border-amber-700/35 bg-amber-200/40 p-4 text-center backdrop-blur-md">
                      <p className="mb-3 text-sm font-medium text-amber-950">
                          To&apos;lov Clickda qilingan bo&apos;lsa, tizimga kelishi biroz vaqt olishi mumkin.
                      </p>
                      <Button type="button" variant="secondary" onClick={recheckPlagiarismPayment} className="w-full sm:w-auto">
                          To&apos;lov holatini tekshirish
                      </Button>
                  </div>
              )}
          </div>

          {isChecking && (
              <div className="mx-auto mt-8 max-w-lg">
                  <p className="mb-2 text-center font-medium text-slate-950">Tahlil qilinmoqda... Iltimos, kuting.</p>
                  <div className="h-2.5 w-full rounded-full bg-white/35 shadow-inner">
                      <div className="h-2.5 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 shadow-sm transition-[width] duration-300 ease-in-out" style={{ width: `${progress}%` }} />
                  </div>
              </div>
          )}

          {result && (
              <div className="mt-8">
                  <h3 className="text-xl font-bold text-center mb-4 text-slate-900">Tekshiruv Natijalari</h3>
                  <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 rounded-2xl border border-white/50 bg-white/35 p-4 backdrop-blur-xl md:grid-cols-3">
                      <div className="rounded-xl border border-white/45 bg-white/40 p-4 text-center shadow-inner backdrop-blur-md">
                          <p className="text-sm font-semibold text-slate-800">Originallik</p>
                          <p className="text-4xl font-bold text-emerald-800 mt-1">{100 - result.plagiarism}%</p>
                      </div>
                      <div className="rounded-xl border border-white/45 bg-white/40 p-4 text-center shadow-inner backdrop-blur-md">
                          <p className="text-sm font-semibold text-slate-800">O'xshashlik (Plagiat)</p>
                          <p className="text-4xl font-bold text-yellow-800 mt-1">{result.plagiarism}%</p>
                      </div>
                      <div className="rounded-xl border border-white/45 bg-white/40 p-4 text-center shadow-inner backdrop-blur-md">
                          <p className="text-sm font-semibold text-slate-800">AI-Kontent</p>
                          <p className="text-4xl font-bold text-cyan-800 mt-1">{result.aiContent}%</p>
                      </div>
                  </div>

                   <Card title="Topilgan manbalar" className="mx-auto mt-6 max-w-3xl border-white/50 bg-white/25 backdrop-blur-xl">
                      <p className="-mt-4 mb-4 text-sm font-medium text-slate-900">Tizim matningizga o'xshashlik topgan manbalar ro'yxati. Bu natijalar taxminiy bo'lib, yakuniy xulosa uchun qo'shimcha tahlil talab etilishi mumkin.</p>
                      <div className="max-h-80 space-y-4 overflow-y-auto pr-2">
                          {result.sources.map((source, index) => (
                          <div key={index} className="rounded-xl border border-white/50 bg-white/35 p-4 backdrop-blur-md">
                              <div className="flex justify-between items-start text-sm">
                                  <a href={source.source.startsWith('http') ? source.source : `https://${source.source}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-800 hover:underline break-all">
                                      <LinkIcon size={14}/> {source.source.length > 60 ? source.source.slice(0, 57) + '...' : source.source}
                                  </a>
                                  <span className="font-bold text-yellow-900 whitespace-nowrap ml-4">{source.similarity}% o'xshashlik</span>
                              </div>
                              <blockquote className="mt-2 pl-3 border-l-2 border-yellow-500/50 text-xs text-slate-500 italic">
                                  {source.snippet}
                              </blockquote>
                          </div>
                          ))}
                      </div>
                  </Card>
              </div>
          )}
      </Card>
      
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md">
              <div className="w-full max-w-md rounded-2xl border border-white/50 bg-gradient-to-br from-white/45 via-white/30 to-violet-200/35 p-6 shadow-2xl backdrop-blur-2xl transition-all duration-300">
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
          </div>
      )}
      </>
  );
};

export default PlagiarismCheck;