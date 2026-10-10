import React, { useState, useEffect } from 'react';
import { useAiPrefill, str, num } from '../contexts/AiPrefillContext';
import Card from '../components/ui/Card';
import EditorialPageHeader from '../components/EditorialPageHeader';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { Library, Loader2, FileCheck, FileText, Upload, Download, Printer, Eye, X, Send } from 'lucide-react';
import { toast } from 'react-toastify';
import UDKCertificate, { UDKCertificateData } from '../components/UDKCertificate';
import { useT } from '../i18n/LanguageContext';

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
}

const UdkOlish: React.FC = () => {
  const { t } = useT();
  const { user } = useAuth();
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

  const refreshData = async () => {
    try {
      const [reqRes, certRes] = await Promise.all([
        apiService.udc.requests.list(),
        apiService.udc.myCertificates(),
      ]);
      const reqData = Array.isArray(reqRes) ? reqRes : (reqRes?.results ?? reqRes?.data ?? []);
      setMyRequests(reqData);
      setCertificates((certRes?.results || []) as StandaloneCertificate[]);
    } catch (_) {}
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

      if (res?.submitted) {
        toast.success(res?.message || t("UDK so'rovi taqrizchiga yuborildi."));
        // Formani tozalash
        setStandaloneTitle('');
        setStandaloneAbstract('');
        setAuthorMiddleName('');
        setStandaloneFile(null);
        refreshData();
        return;
      }

      // To'lov sahifasiga yo'naltirish
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

  const handleViewCertificate = (cert: StandaloneCertificate) => {
    const certData: UDKCertificateData = {
      certificateNumber: `UDK-${cert.id.toString().padStart(6, '0')}`,
      issueDate: cert.created_at ? new Date(cert.created_at).toLocaleDateString('uz-UZ') : new Date().toLocaleDateString('uz-UZ'),
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_payment': return 'To\'lov kutilmoqda';
      case 'submitted': return 'Taqrizchida';
      case 'completed': return 'Yakunlangan';
      case 'rejected': return 'Rad etilgan';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_payment': return 'text-orange-800 bg-orange-500/10';
      case 'submitted': return 'text-yellow-800 bg-yellow-500/10';
      case 'completed': return 'text-emerald-800 bg-green-500/10';
      case 'rejected': return 'text-red-700 bg-red-500/10';
      default: return 'text-slate-500 bg-gray-500/10';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <EditorialPageHeader
        title={t('UDK Olish')}
        subtitle={t("UDK tasdiqlangan ma'lumotnoma: mavzu va annotatsiyani kiriting, to'lovdan keyin taqrizchi UDK kodini aniqlaydi va ma'lumotnoma tayyorlanadi.")}
      />
      <Card>
        {/* UDK so'rovi yuborish formasi */}
        <div className="p-4 rounded-xl bg-slate-100/70 border border-slate-200/90">
          <h2 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
            <Send className="h-4 w-4" />
            {t("UDK so'rovi yuborish")}
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            {t("Mavzu, annotatsiya va muallif ma'lumotlarini kiriting. To'lovdan keyin so'rov taqrizchiga yuboriladi. Taqrizchi UDK kodini aniqlab, ma'lumotnoma tayyorlaydi.")}
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

      {/* Mening so'rovlarim */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">{t("Mening UDK so'rovlarim")}</h2>
        <p className="text-sm text-slate-500 mb-4">
          {t("Yuborgan UDK so'rovlaringiz holati. Taqrizchi UDK kodini kiritgach ma'lumotnoma tayyor bo'ladi.")}
        </p>
        {loadingRequests ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : myRequests.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">{t("Hali so'rov yuborilmagan.")}</p>
        ) : (
          <ul className="space-y-3">
            {myRequests.map((req) => (
              <li
                key={req.id}
                className="p-4 rounded-xl bg-slate-100/70 border border-slate-200/90"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-900 truncate">{req.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(req.status)}`}>
                        {getStatusLabel(req.status)}
                      </span>
                    </div>
                    {req.status === 'completed' && req.udk_code && (
                      <p className="text-sm text-emerald-800 mt-1">UDK: {req.udk_code}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(req.created_at).toLocaleDateString('uz-UZ')}
                    </p>
                  </div>
                </div>
              </li>
            ))}
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
                  <p className="font-medium text-slate-900 truncate">{c.title}</p>
                  <p className="text-sm font-semibold text-[var(--editorial-primary)]">UDK: {c.udk_code}</p>
                  {c.udk_description && <p className="text-xs text-slate-500 mt-0.5">{c.udk_description}</p>}
                  {c.created_at && (
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(c.created_at).toLocaleDateString('uz-UZ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    onClick={() => handleViewCertificate(c)}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    {t("Ko'rish")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleDownloadCertificate(c.id)}
                    disabled={downloadingId === c.id}
                    className="flex items-center gap-2"
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
      {previewCertificate && (
        <div className="fixed inset-0 bg-slate-900/35 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white">
          <div className="bg-white/55 rounded-lg max-w-6xl w-full max-h-[95vh] overflow-auto print:max-w-none print:max-h-none print:overflow-visible print:bg-white print:rounded-none">
            {/* Modal header - hidden on print */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200/90 no-print">
              <h3 className="text-lg font-semibold text-slate-900">{t("UDK Ma'lumotnomasi")}</h3>
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
        </div>
      )}
    </div>
  );
};

export default UdkOlish;
