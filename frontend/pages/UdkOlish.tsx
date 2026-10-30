import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAiPrefill, str, num } from '../contexts/AiPrefillContext';
import Card from '../components/ui/Card';
import EditorialPageHeader from '../components/EditorialPageHeader';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { Loader2, FileCheck, Upload, Download, Printer, Eye, X, Send, CreditCard, Award, CheckCircle2, Clock, AlertTriangle, UserCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import UDKCertificate, { UDKCertificateData } from '../components/UDKCertificate';
import ModalPortal from '../components/ui/ModalPortal';
import { useT } from '../i18n/LanguageContext';
import { formatDocDate } from '../utils/uzDate';
import { openReferencePdf } from '../utils/referenceDoc';
import UdkOrderStatusCard, { type UdkTrackPhase } from '../components/UdkOrderStatusCard';

interface StandaloneCertificate {
  id: number;
  title: string;
  udk_code: string;
  udk_description: string;
  certificate_url: string | null;
  created_at: string | null;
}

interface UdkRequestItem {
  id: string;
  author_short: string;
  title: string;
  udk_code: string;
  udk_description: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  auto_method?: string;
  reject_reason?: string;
  transaction_id?: string | null;
  payment_status?: string | null;
  certificate_id?: number | null;
}

/** Kuzatilayotgan buyurtma: to'lovdan qaytganda (transaction_id) yoki "Ishlarim" dan (?request=) */
interface Tracker {
  requestId: string | null;
  transactionId: string | null;
  phase: UdkTrackPhase;
}

const TRACK_POLL_MS = 4000;
const PAYMENT_POLL_MAX_MS = 10 * 60 * 1000;

/** So'rov holatidan kartadagi bosqich */
function phaseOf(req: UdkRequestItem): UdkTrackPhase {
  switch (req.status) {
    case 'completed':
      return 'completed';
    case 'rejected':
      return 'rejected';
    case 'submitted':
      return req.auto_method === 'manual' ? 'manual' : 'classifying';
    default:
      if (req.payment_status === 'completed') return 'classifying';
      if (req.payment_status === 'failed' || req.payment_status === 'cancelled') return 'payment_failed';
      return 'payment_pending';
  }
}

const isFinal = (p: UdkTrackPhase) => p === 'completed' || p === 'rejected' || p === 'payment_failed';

const UdkOlish: React.FC = () => {
  const { t } = useT();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [udkPrice, setUdkPrice] = useState<number>(1000);

  // Yangi UDK so'rovi uchun formalar
  const [authorFirstName, setAuthorFirstName] = useState('');
  const [authorLastName, setAuthorLastName] = useState('');
  const [authorMiddleName, setAuthorMiddleName] = useState('');
  const [standaloneTitle, setStandaloneTitle] = useState('');
  const [standaloneAbstract, setStandaloneAbstract] = useState('');
  const [standaloneFile, setStandaloneFile] = useState<File | null>(null);
  const [requestingStandalone, setRequestingStandalone] = useState(false);

  // AI ish maydoni to'ldirgan qiymatlar (muallif tekshirib, o'zi yuboradi)
  const aiPrefill = useAiPrefill('udk');
  useEffect(() => {
    if (!aiPrefill) return;
    const f = aiPrefill.fields;
    if (str(f.firstName)) setAuthorFirstName(str(f.firstName));
    if (str(f.lastName)) setAuthorLastName(str(f.lastName));
    if (str(f.middleName)) setAuthorMiddleName(str(f.middleName));
    if (str(f.title)) setStandaloneTitle(str(f.title));
    if (str(f.abstract)) setStandaloneAbstract(str(f.abstract));
    if (aiPrefill.file) setStandaloneFile(aiPrefill.file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPrefill?.nonce, aiPrefill?.file]);

  // Mening so'rovlarim
  const [myRequests, setMyRequests] = useState<UdkRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Mening ma'lumotnomalarim (yakunlangan)
  const [certificates, setCertificates] = useState<StandaloneCertificate[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  
  // Certificate preview modal state
  const [previewCertificate, setPreviewCertificate] = useState<UDKCertificateData | null>(null);

  // User ma'lumotlarini formaga to'ldirish
  useEffect(() => {
    if (user) {
      setAuthorFirstName(user.firstName || '');
      setAuthorLastName(user.lastName || '');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchPrice = async () => {
      try {
        const res = await apiService.udc.price();
        if (res?.amount != null) setUdkPrice(Number(res.amount));
      } catch (_) {}
    };
    fetchPrice();
  }, [user]);

  // Mening so'rovlarimni yuklash
  useEffect(() => {
    if (!user) return;
    const loadRequests = async () => {
      setLoadingRequests(true);
      try {
        const res = await apiService.udc.requests.list();
        const data = Array.isArray(res) ? res : (res?.results ?? res?.data ?? []);
        setMyRequests(data.filter((r: any) => r.user === user.id || true)); // Foydalanuvchining o'z so'rovlari
      } catch (_) {
        setMyRequests([]);
      } finally {
        setLoadingRequests(false);
      }
    };
    loadRequests();
  }, [user]);

  // Mening ma'lumotnomalarimni yuklash
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoadingCertificates(true);
      try {
        const res = await apiService.udc.myCertificates();
        setCertificates((res?.results || []) as StandaloneCertificate[]);
      } catch (_) {
        setCertificates([]);
      } finally {
        setLoadingCertificates(false);
      }
    };
    load();
  }, [user]);

  const refreshData = useCallback(async () => {
    try {
      const [reqRes, certRes] = await Promise.all([
        apiService.udc.requests.list(),
        apiService.udc.myCertificates(),
      ]);
      const reqData = Array.isArray(reqRes) ? reqRes : (reqRes?.results ?? reqRes?.data ?? []);
      setMyRequests(reqData);
      setCertificates((certRes?.results || []) as StandaloneCertificate[]);
    } catch (_) {}
  }, []);

  // ===== Buyurtma kuzatuvi (antiplagiat sahifasidagidek: to'lovdan qaytganda bo'sh forma emas, jarayon) =====
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [recheckBusy, setRecheckBusy] = useState(false);
  const [trackDownloadBusy, setTrackDownloadBusy] = useState(false);
  const autoPicked = useRef(false);
  const trackerRef = useRef<HTMLDivElement>(null);
  /** Holat kartasini ko'rinadigan joyga (sahifa pastga aylantirilgan bo'lsa ham) */
  const revealTracker = () =>
    window.setTimeout(() => trackerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  const trackStartedAt = useRef(Date.now());

  const urlTransactionId = searchParams.get('transaction_id');
  const urlRequestId = searchParams.get('request');

  /** To'lov holatini Click bilan sinxronlab, kartani yangilash */
  const checkPayment = useCallback(async (txId: string, opts: { notify?: boolean } = {}) => {
    try {
      const res = await paymentService.checkPaymentStatus(txId);
      setTracker((prev) => {
        if (!prev || prev.transactionId !== txId) return prev;
        const requestId = res.udk_request_id || prev.requestId;
        if (res.payment_status === 2) {
          return { ...prev, requestId, phase: prev.phase === 'checking' || prev.phase === 'payment_pending' ? 'classifying' : prev.phase };
        }
        if (res.payment_status === -1) return { ...prev, requestId, phase: 'payment_failed' };
        return { ...prev, requestId, phase: 'payment_pending' };
      });
      if (opts.notify) {
        if (res.payment_status === 2) toast.success(t("To'lov tasdiqlandi. UDK kodi aniqlanmoqda..."), { toastId: `udk-pay-${txId}` });
        else if (res.payment_status === -1) toast.error(t("To'lov bekor qilindi yoki muvaffaqiyatsiz."), { toastId: `udk-pay-${txId}` });
        else toast.info(t("To'lov hali tasdiqlanmagan. Bir ozdan keyin yana urinib ko'ring."), { toastId: `udk-pay-${txId}` });
      }
      if (res.payment_status === 2 || res.payment_status === -1) void refreshData();
      return res.payment_status;
    } catch {
      if (opts.notify) toast.error(t("Holatni tekshirishda xatolik. Qayta urinib ko'ring."));
      return undefined;
    }
  }, [refreshData, t]);

  // To'lovdan qaytish (?payment_return=1&transaction_id=…) yoki "Ishlarim" dan (?request=…)
  useEffect(() => {
    if (!urlTransactionId && !urlRequestId) return;
    autoPicked.current = true;
    trackStartedAt.current = Date.now();
    const next = new URLSearchParams(searchParams);
    next.delete('payment_return');
    next.delete('transaction_id');
    next.delete('request');
    setSearchParams(next, { replace: true });
    revealTracker();
    if (urlTransactionId) {
      setTracker({ requestId: null, transactionId: urlTransactionId, phase: 'checking' });
      void checkPayment(urlTransactionId, { notify: true });
    } else if (urlRequestId) {
      setTracker({ requestId: urlRequestId, transactionId: null, phase: 'checking' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTransactionId, urlRequestId]);

  // Ro'yxat yangilanganda: kuzatilayotgan so'rov holatini olish; birinchi yuklashda jarayondagi buyurtmani ko'rsatish
  const trackedRequest = tracker
    ? myRequests.find((r) => (tracker.requestId && r.id === tracker.requestId) || (tracker.transactionId && r.transaction_id === tracker.transactionId)) || null
    : null;
  useEffect(() => {
    if (tracker && trackedRequest) {
      const phase = phaseOf(trackedRequest);
      // Click sinxronlash to'lovni tasdiqlagan, lekin ro'yxat hali eski bo'lsa — orqaga qaytarmaymiz
      const keep = phase === 'payment_pending'
        && (tracker.phase === 'classifying' || (tracker.phase === 'checking' && !!tracker.transactionId));
      if (!keep && (phase !== tracker.phase || tracker.requestId !== trackedRequest.id)) {
        setTracker({ requestId: trackedRequest.id, transactionId: trackedRequest.transaction_id || tracker.transactionId, phase });
      }
      return;
    }
    if (!tracker && !autoPicked.current && !loadingRequests && myRequests.length > 0) {
      autoPicked.current = true;
      const latest = myRequests[0];
      const p = phaseOf(latest);
      if (p === 'classifying' || p === 'manual') {
        setTracker({ requestId: latest.id, transactionId: latest.transaction_id || null, phase: p });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRequests, trackedRequest, loadingRequests]);

  // Kuzatuv: to'lov kutilayotganda Click bilan sinxronlash, aniqlanayotganda ro'yxatni yangilash
  const trackPhase = tracker?.phase;
  const trackTx = tracker?.transactionId || trackedRequest?.transaction_id || null;
  useEffect(() => {
    if (!trackPhase || isFinal(trackPhase)) return;
    const tick = () => {
      if (trackPhase === 'payment_pending' || trackPhase === 'checking') {
        if (Date.now() - trackStartedAt.current > PAYMENT_POLL_MAX_MS) return;
        if (trackTx) void checkPayment(trackTx);
        else void refreshData();
        return;
      }
      void refreshData();
    };
    const timer = window.setInterval(tick, trackPhase === 'manual' ? 15000 : TRACK_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [trackPhase, trackTx, checkPayment, refreshData]);

  // Ro'yxatdagi boshqa avtomatik aniqlanayotgan so'rovlar ham yangilanib tursin
  const hasProcessing = myRequests.some((r) => phaseOf(r) === 'classifying');
  useEffect(() => {
    if (!hasProcessing || (trackPhase && !isFinal(trackPhase))) return;
    const timer = window.setInterval(() => void refreshData(), 5000);
    return () => window.clearInterval(timer);
  }, [hasProcessing, trackPhase, refreshData]);

  const resetForm = () => {
    setStandaloneTitle('');
    setStandaloneAbstract('');
    setAuthorMiddleName('');
    setStandaloneFile(null);
  };

  /** To'lanmagan buyurtmani to'lash (yangi buyurtma/tranzaksiya ochilmaydi — ikki marta to'lov yo'q) */
  const payOrder = async (req: { id: string; transaction_id?: string | null }) => {
    if (!req.transaction_id) {
      toast.error(t('Tranzaksiya topilmadi.'));
      return;
    }
    setPayBusy(true);
    trackStartedAt.current = Date.now();
    setTracker({ requestId: req.id, transactionId: req.transaction_id, phase: 'payment_pending' });
    revealTracker();
    try {
      await paymentService.redirectToPaymentPage(req.transaction_id);
    } finally {
      setPayBusy(false);
    }
  };

  const recheckPayment = async () => {
    if (!trackTx) return;
    setRecheckBusy(true);
    try {
      await checkPayment(trackTx, { notify: true });
    } finally {
      setRecheckBusy(false);
    }
  };

  const dismissTracker = (clear: boolean) => {
    setTracker(null);
    if (clear) resetForm();
  };

  const handleStandaloneRequest = async () => {
    const firstName = authorFirstName.trim();
    const lastName = authorLastName.trim();
    const title = standaloneTitle.trim();
    const abstract = standaloneAbstract.trim();

    if (!firstName || !lastName) {
      toast.warning(t('Ism va familyani kiriting.'));
      return;
    }
    if (!title) {
      toast.warning(t('Mavzu (sarlavha) kiriting.'));
      return;
    }
    if (!abstract) {
      toast.warning(t('Annotatsiya (qisqa mazmun) kiriting.'));
      return;
    }

    setRequestingStandalone(true);
    try {
      const res = await apiService.udc.requests.create({
        author_first_name: firstName,
        author_last_name: lastName,
        author_middle_name: authorMiddleName.trim() || undefined,
        title,
        abstract,
        file: standaloneFile || undefined,
      });

      const txId = res?.transaction_id;
      if (!txId) {
        toast.error(t('Tranzaksiya yaratilmadi.'));
        return;
      }

      trackStartedAt.current = Date.now();
      autoPicked.current = true;
      if (res?.submitted) {
        toast.success(t("UDK so'rovi qabul qilindi — UDK avtomatik aniqlanmoqda."));
        resetForm();
        setTracker({ requestId: res.udk_request_id || null, transactionId: txId, phase: 'classifying' });
        void refreshData();
        return;
      }

      // To'lov oynasi (sahifa ustida); oyna yopilsa ham karta "To'lov kutilmoqda" — shu buyurtmani to'lash mumkin.
      // Server shu ish uchun to'lanmagan buyurtmani qayta beradi (res.reused) — ikkinchi to'lov ochilmaydi.
      setTracker({ requestId: res.udk_request_id || null, transactionId: txId, phase: 'payment_pending' });
      void refreshData();
      paymentService.redirectToPaymentPage(txId);
    } catch (e: any) {
      toast.error(e?.message || t("So'rov yuborishda xatolik"));
    } finally {
      setRequestingStandalone(false);
    }
  };

  const handleDownloadCertificate = async (id: number) => {
    setDownloadingId(id);
    try {
      await apiService.udc.downloadCertificate(id);
      toast.success(t("Ma'lumotnoma yuklandi"));
    } catch (e: any) {
      toast.error(e?.message || t('Yuklab olishda xatolik'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewOrder = (req: UdkRequestItem) => {
    if (!req.certificate_id) return;
    setPreviewCertificate({
      certificateNumber: `UDK-${req.certificate_id.toString().padStart(6, '0')}`,
      issueDate: formatDocDate(req.completed_at || req.created_at || new Date()),
      author: req.author_short || `${user?.lastName || ''} ${user?.firstName || ''}`.trim(),
      workTitle: req.title,
      udkCode: req.udk_code,
      udkDescription: req.udk_description || undefined,
    });
  };

  const handleTrackDownload = async () => {
    const id = trackedRequest?.certificate_id;
    if (!id) return;
    setTrackDownloadBusy(true);
    try {
      await handleDownloadCertificate(id);
    } finally {
      setTrackDownloadBusy(false);
    }
  };

  const openOrderReference = (id: string) =>
    void openReferencePdf('udk_request', id, t("Ma'lumotnomani yaratib bo'lmadi"));

  const handleViewCertificate = (cert: StandaloneCertificate) => {
    const certData: UDKCertificateData = {
      certificateNumber: `UDK-${cert.id.toString().padStart(6, '0')}`,
      issueDate: formatDocDate(cert.created_at || new Date()),
      author: (cert as any).author_name || user?.lastName + ' ' + user?.firstName || 'Noma\'lum',
      workTitle: cert.title,
      udkCode: cert.udk_code,
      udkDescription: cert.udk_description || undefined,
    };
    setPreviewCertificate(certData);
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  const closePreview = () => {
    setPreviewCertificate(null);
  };

  /** Ro'yxatdagi holat belgisi (rang + ikonka + matn) */
  const statusBadge = (req: UdkRequestItem) => {
    const phase = phaseOf(req);
    const map: Record<UdkTrackPhase, { label: string; cls: string; icon: React.ReactNode }> = {
      checking: { label: t("To'lov tekshirilmoqda..."), cls: 'bg-slate-500/10 text-slate-700', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> },
      payment_pending: { label: t("To'lov kutilmoqda"), cls: 'bg-orange-500/10 text-orange-800', icon: <CreditCard className="h-3.5 w-3.5" aria-hidden /> },
      payment_failed: { label: t("To'lov amalga oshmadi"), cls: 'bg-red-500/10 text-red-700', icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> },
      classifying: { label: t('UDK aniqlanmoqda'), cls: 'bg-blue-500/10 text-blue-800', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> },
      manual: { label: t("Mutaxassis ko'rib chiqmoqda"), cls: 'bg-amber-500/15 text-amber-900', icon: <UserCheck className="h-3.5 w-3.5" aria-hidden /> },
      completed: { label: t('Tayyor'), cls: 'bg-emerald-500/15 text-emerald-800', icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> },
      rejected: { label: t('Rad etilgan'), cls: 'bg-red-500/10 text-red-700', icon: <X className="h-3.5 w-3.5" aria-hidden /> },
    };
    const b = map[phase];
    return (
      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${b.cls}`}>
        {b.icon} {b.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <EditorialPageHeader
        title={t('UDK Olish')}
        subtitle={t("UDK tasdiqlangan ma'lumotnoma: mavzu va annotatsiyani kiriting — to'lovdan keyin UDK kodi avtomatik aniqlanadi va ma'lumotnoma darhol tayyorlanadi.")}
      />
      <div ref={trackerRef} className="scroll-mt-4" />
      {tracker && (
        <UdkOrderStatusCard
          phase={tracker.phase}
          order={trackedRequest}
          busy={{ pay: payBusy, recheck: recheckBusy, download: trackDownloadBusy }}
          onPay={() => trackedRequest && void payOrder(trackedRequest)}
          onRecheck={() => void recheckPayment()}
          onView={() => trackedRequest && handleViewOrder(trackedRequest)}
          onDownload={() => void handleTrackDownload()}
          onReference={() => trackedRequest && openOrderReference(trackedRequest.id)}
          onNew={() => dismissTracker(true)}
          onEdit={() => dismissTracker(false)}
        />
      )}

      {!tracker && (
      <Card>
        {/* UDK so'rovi yuborish formasi */}
        <div className="p-4 rounded-xl bg-slate-100/70 border border-slate-200/90">
          <h2 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
            <Send className="h-4 w-4" />
            {t("UDK so'rovi yuborish")}
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            {t("Mavzu, annotatsiya va muallif ma'lumotlarini kiriting. To'lovdan keyin UDK kodi UDK klassifikatori (O'zbekiston Milliy kutubxonasi nashri) asosida avtomatik aniqlanadi va ma'lumotnoma bir necha soniyada tayyor bo'ladi.")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">{t('Familya *')}</label>
              <input
                type="text"
                value={authorLastName}
                onChange={(e) => setAuthorLastName(e.target.value)}
                placeholder={t('Masalan: Toshmatov')}
                className="w-full rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 px-4 py-2 focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">{t('Ism *')}</label>
              <input
                type="text"
                value={authorFirstName}
                onChange={(e) => setAuthorFirstName(e.target.value)}
                placeholder={t('Masalan: Alisher')}
                className="w-full rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 px-4 py-2 focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">{t('Otasining ismi')}</label>
              <input
                type="text"
                value={authorMiddleName}
                onChange={(e) => setAuthorMiddleName(e.target.value)}
                placeholder={t('Masalan: Karimovich')}
                className="w-full rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 px-4 py-2 focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">{t('Mavzu (sarlavha) *')}</label>
              <input
                type="text"
                value={standaloneTitle}
                onChange={(e) => setStandaloneTitle(e.target.value)}
                placeholder={t('Masalan: Iqtisodiyotda raqamli transformatsiya')}
                className="w-full rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 px-4 py-2 focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">{t('Annotatsiya *')}</label>
              <textarea
                value={standaloneAbstract}
                onChange={(e) => setStandaloneAbstract(e.target.value)}
                placeholder={t('Ilmiy ish mazmunini qisqacha yozing (UDK aniqlash uchun muhim)')}
                rows={4}
                className="w-full rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 px-4 py-2 focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">{t('PDF yoki Word fayl (ixtiyoriy)')}</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 cursor-pointer hover:bg-white/10 text-slate-600 text-sm">
                  <Upload className="h-4 w-4" />
                  {t('Fayl tanlash')}
                  <input
                    type="file"
                    accept=".pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => setStandaloneFile(e.target.files?.[0] || null)}
                  />
                </label>
                {standaloneFile && (
                  <span className="text-sm text-slate-500 truncate max-w-[200px]">{standaloneFile.name}</span>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="accent"
              onClick={handleStandaloneRequest}
              disabled={requestingStandalone || !standaloneTitle.trim() || !standaloneAbstract.trim() || !authorFirstName.trim() || !authorLastName.trim()}
              className="mt-3 w-full sm:w-auto min-h-[48px] px-8 text-base gap-2 ring-2 ring-amber-400/30"
            >
              {requestingStandalone ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
              {t("UDK so'rovi yuborish (")}{udkPrice?.toLocaleString()} {t("so'm)")}
            </Button>
          </div>
        </div>
      </Card>
      )}

      {/* Mening so'rovlarim */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t("Mening UDK so'rovlarim")}</h2>
        <p className="text-sm text-slate-500 mb-4">
          {t("Buyurtmalaringiz holati: to'lov → UDK aniqlanmoqda → tayyor. To'lanmagan buyurtmani shu yerdan to'lashingiz mumkin.")}
        </p>
        {loadingRequests ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : myRequests.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">{t("Hali so'rov yuborilmagan.")}</p>
        ) : (
          <ul className="space-y-3">
            {myRequests.map((req) => {
              const phase = phaseOf(req);
              const active = tracker?.requestId === req.id;
              return (
                <li
                  key={req.id}
                  className={`p-4 rounded-xl border ${active ? 'border-[var(--editorial-primary)]/50 bg-[var(--editorial-primary)]/5' : 'border-slate-200/90 bg-slate-100/70'}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="m-0 min-w-0 break-words font-medium text-slate-900">{req.title}</p>
                        {statusBadge(req)}
                      </div>
                      {phase === 'completed' && req.udk_code && (
                        <p className="m-0 mt-1 text-sm text-emerald-800">
                          UDK: <span className="font-mono font-semibold">{req.udk_code}</span>
                          {req.udk_description ? <span className="text-slate-600"> — {req.udk_description}</span> : null}
                        </p>
                      )}
                      {phase === 'rejected' && req.reject_reason && (
                        <p className="m-0 mt-1 text-sm text-red-700">{req.reject_reason}</p>
                      )}
                      <p className="m-0 mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" aria-hidden />
                        {formatDocDate(req.created_at)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 max-[359px]:grid-cols-1 gap-2 [&>*:last-child:nth-child(odd)]:col-[1/-1] [&>*]:justify-center sm:flex sm:flex-wrap sm:shrink-0 sm:justify-end">
                      {(phase === 'payment_pending' || (phase === 'payment_failed' && req.payment_status === 'failed')) && (
                        <Button type="button" variant="accent" onClick={() => void payOrder(req)} disabled={payBusy} className="justify-center gap-1.5 whitespace-nowrap !px-2 !py-2 sm:!px-3 sm:!py-1.5 !text-[13px] sm:!text-sm [&_svg]:shrink-0">
                          <CreditCard className="h-4 w-4" aria-hidden /> {t("To'lash")}
                        </Button>
                      )}
                      {phase === 'completed' && req.certificate_id && (
                        <>
                          <Button type="button" variant="secondary" onClick={() => handleViewOrder(req)} className="justify-center gap-1.5 whitespace-nowrap !px-2 !py-2 sm:!px-3 sm:!py-1.5 !text-[13px] sm:!text-sm [&_svg]:shrink-0">
                            <Eye className="h-4 w-4" aria-hidden /> {t("Ko'rish")}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void handleDownloadCertificate(req.certificate_id as number)}
                            disabled={downloadingId === req.certificate_id}
                            className="justify-center gap-1.5 whitespace-nowrap !px-2 !py-2 sm:!px-3 sm:!py-1.5 !text-[13px] sm:!text-sm [&_svg]:shrink-0"
                          >
                            {downloadingId === req.certificate_id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
                            {t('Yuklab olish')}
                          </Button>
                        </>
                      )}
                      <Button type="button" variant="secondary" onClick={() => openOrderReference(req.id)} className="justify-center gap-1.5 whitespace-nowrap !px-2 !py-2 sm:!px-3 sm:!py-1.5 !text-[13px] sm:!text-sm [&_svg]:shrink-0">
                        <Award className="h-4 w-4" aria-hidden /> {t("Ma'lumotnoma")}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Mening UDK ma'lumotnomalarim (standalone) */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t("Mening UDK ma'lumotnomalarim")}</h2>
        <p className="text-sm text-slate-500 mb-4">
          {t("Tayyor bo'lgan UDK ma'lumotnomalaringiz.")}
        </p>
        {loadingCertificates ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : certificates.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">{t("Hali ma'lumotnoma yo'q.")}</p>
        ) : (
          <ul className="space-y-3">
            {certificates.map((c) => (
              <li
                key={c.id}
                className="p-4 rounded-xl bg-slate-100/70 border border-slate-200/90 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 break-words sm:truncate">{c.title}</p>
                  <p className="text-sm font-semibold text-[var(--editorial-primary)]">UDK: {c.udk_code}</p>
                  {c.udk_description && <p className="text-xs text-slate-500 mt-0.5">{c.udk_description}</p>}
                  {c.created_at && (
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(c.created_at).toLocaleDateString('uz-UZ')}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 max-[359px]:grid-cols-1 gap-2 w-full sm:flex sm:w-auto sm:shrink-0">
                  <Button
                    variant="secondary"
                    onClick={() => handleViewCertificate(c)}
                    className="flex items-center justify-center gap-2 !px-3 sm:!px-6"
                  >
                    <Eye className="h-4 w-4" />
                    {t("Ko'rish")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDownloadCertificate(c.id)}
                    disabled={downloadingId === c.id}
                    className="flex items-center justify-center gap-2 !px-3 sm:!px-6"
                  >
                    {downloadingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {t('Yuklab olish')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Certificate Preview Modal */}
      {/* ModalPortal: header (z-60) va pastki menyu ustida, sahifa transformidan mustaqil */}
      {previewCertificate && (
        <ModalPortal open backdropClassName="bg-slate-900/60 print:p-0 print:bg-white">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-6xl w-full max-h-[95vh] overflow-auto print:max-w-none print:max-h-none print:overflow-visible print:bg-white print:rounded-none">
            {/* Modal header - hidden on print */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200/90 no-print">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t("UDK Ma'lumotnomasi")}</h3>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={handlePrintCertificate} className="flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  {t('Chop etish / PDF')}
                </Button>
                <button 
                  onClick={closePreview}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {/* Certificate content */}
            <div className="p-4 print:p-0" id="udk-certificate-print-area">
              <UDKCertificate data={previewCertificate} />
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default UdkOlish;
