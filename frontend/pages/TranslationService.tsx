import React, { useState, useEffect, useRef } from 'react';
import { useAiPrefill, str, num } from '../contexts/AiPrefillContext';
import Card from '../components/ui/Card';
import EditorialPageHeader from '../components/EditorialPageHeader';
import Button from '../components/ui/Button';
import { Upload, Languages, FileText, Loader2, CheckCircle, AlertCircle, CreditCard, Bot, Sparkles, UserCheck, XCircle } from 'lucide-react';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import { TranslationStatus } from '../types';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { toast } from 'react-toastify';
import { useT } from '../i18n/LanguageContext';
import { DEFAULT_UPLOAD_BYTES, DEFAULT_UPLOAD_MB } from '../constants/upload';

type Quality = 'basic' | 'standard' | 'expert';

interface QualityOption {
  quality: Quality;
  pricePerWord: number;
  cost: number;
}

interface FileAnalysis {
  wordCount: number;
  fileName: string;
  /** Backenddan: har bir tarjima turi narxi (ServicePrice) */
  qualities: QualityOption[];
}

/** Tarjima turlari: oddiy va o'rta — AI (to'lovdan keyin avtomatik), puxta — tarjimon */
const QUALITY_INFO: Record<Quality, { title: string; who: string; hint: string; icon: typeof Bot }> = {
  basic: {
    title: 'Oddiy tarjima',
    who: 'AI',
    hint: "Tez, mazmunni to'liq yetkazadi. Odatda bir necha daqiqada tayyor.",
    icon: Bot,
  },
  standard: {
    title: "O'rta tarjima",
    who: 'AI',
    hint: "Ilmiy uslub va atamalar izchilligi; AI ikki bosqichda tarjima qilib, o'zi tahrirlaydi.",
    icon: Sparkles,
  },
  expert: {
    title: 'Puxta tarjima',
    who: 'Tarjimon',
    hint: "Professional tarjimon qo'lda tarjima qiladi. Nashr uchun eng ishonchli variant.",
    icon: UserCheck,
  },
};
const QUALITY_ORDER: Quality[] = ['basic', 'standard', 'expert'];

const TranslationService: React.FC = () => {
  const { t } = useT();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState('uz');
  const [targetLang, setTargetLang] = useState('en');
  const [quality, setQuality] = useState<Quality>('standard');
  const [analysisResult, setAnalysisResult] = useState<FileAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const selectedOption = (a: FileAnalysis | null) => a?.qualities.find((q) => q.quality === quality) ?? null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [translationRequestId, setTranslationRequestId] = useState<string | null>(null);

  // AI ish maydoni: tillar va fayl; fayl kelsa so'zlar soni avtomatik hisoblanadi
  const aiPrefill = useAiPrefill('translation');
  const aiAutoAnalyze = useRef(false);
  useEffect(() => {
    if (!aiPrefill) return;
    const f = aiPrefill.fields;
    if (str(f.sourceLang)) setSourceLang(str(f.sourceLang));
    if (str(f.targetLang)) setTargetLang(str(f.targetLang));
    if (aiPrefill.file && aiPrefill.file !== file) {
      aiAutoAnalyze.current = true;
      setAnalysisResult(null);
      setFile(aiPrefill.file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPrefill?.nonce, aiPrefill?.file]);
  useEffect(() => {
    if (!aiAutoAnalyze.current || !file) return;
    aiAutoAnalyze.current = false;
    void analyzeFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);
  const paymentTimerRef = useRef<NodeJS.Timeout | null>(null);

  const languages = [
    { code: 'uz', name: 'O\'zbekcha' },
    { code: 'en', name: 'Inglizcha' },
    { code: 'ru', name: 'Ruscha' },
    { code: 'fr', name: 'Fransuzcha' },
    { code: 'de', name: 'Nemischa' },
    { code: 'es', name: 'Ispancha' },
    { code: 'ar', name: 'Arabcha' },
  ];

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (paymentTimerRef.current) {
        clearTimeout(paymentTimerRef.current);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Server chegarasi bilan bir xil (avval sahifada "MAX. 10MB" deyilar, tekshiruv esa yo'q edi)
      if (selectedFile.size > DEFAULT_UPLOAD_BYTES) {
        toast.error(t('Fayl hajmi {mb} MB dan oshmasligi kerak.', { mb: DEFAULT_UPLOAD_MB }));
        e.target.value = '';
        return;
      }
      setFile(selectedFile);
      setAnalysisResult(null);
      setTranslationRequestId(null);
    }
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    if (paymentTimerRef.current) clearTimeout(paymentTimerRef.current);
    setPaymentStatus('idle');
    setPaymentError(null);
  };

  const handlePay = async () => {
    if (!file || !analysisResult || !user || !translationRequestId) return;

    setPaymentError(null);
    setPaymentStatus('processing');
    if (paymentTimerRef.current) clearTimeout(paymentTimerRef.current);

    try {
      // Create transaction and process payment via Click
      const result = await paymentService.createTransactionAndPay(
        selectedOption(analysisResult)?.cost ?? 0,
        'UZS',
        'translation',
        undefined, // articleId
        translationRequestId
      );
      
      console.log('Payment result:', result);
      
      if (result && result.success === true && result.transaction_id) {
        setIsPaymentModalOpen(false);
        paymentService.redirectToPaymentPage(result.transaction_id, result.payment_url);
      } else if (result && result.success === true && result.payment_url) {
        setIsPaymentModalOpen(false);
        addNotification({
          message: 'To\'lov sahifasiga yo\'naltirilmoqdasiz. To\'lovni tugallang.',
        });
        if (result.transaction_id) {
          paymentService.redirectToPaymentPage(result.transaction_id);
        } else {
          setTimeout(() => paymentService.redirectToPayment(result.payment_url!), 500);
        }
      } else {
        // Payment preparation failed
        const errorMsg = (result as any)?.user_message || result?.error_note || result?.error || "To'lovni amalga oshirishda xatolik yuz berdi.";
        setPaymentStatus('failed');
        setPaymentError(errorMsg);
        addNotification({ 
          message: errorMsg,
        });
      }
    } catch (err: any) {
      console.error('Payment failed:', err);
      const errorMsg = err.message || err.error_note || err.user_message || "To'lovni amalga oshirishda xatolik yuz berdi.";
      setPaymentStatus('failed');
      setPaymentError(errorMsg);
    }
  };

  const analyzeFile = async () => {
    if (!file) {
      toast.error(t('Iltimos, fayl tanlang'));
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await apiService.translations.analyzeFile(file);
      
      const rows: any[] = Array.isArray(response.qualities) ? response.qualities : [];
      setAnalysisResult({
        wordCount: response.word_count,
        fileName: file.name,
        qualities: QUALITY_ORDER.map((q) => {
          const row = rows.find((r) => r.quality === q);
          return { quality: q, pricePerWord: Number(row?.price_per_word ?? 0), cost: Number(row?.cost ?? 0) };
        }),
      });

      toast.success(t('Fayl tahlili tugallandi!'));
    } catch (error) {
      console.error('Error analyzing file:', error);
      toast.error(t('Fayl tahlilida xatolik yuz berdi'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const createTranslationRequest = async (fileToUpload: File) => {
    if (!user || !fileToUpload || !analysisResult) return;
    
    try {
      // Create translation request with file upload
      const translationData = {
        title: fileToUpload.name,
        source_language: sourceLang,
        target_language: targetLang,
        status: TranslationStatus.Yangi,
        quality,
        word_count: analysisResult.wordCount,
        cost: selectedOption(analysisResult)?.cost ?? 0,
        submission_date: new Date().toISOString().split('T')[0],
      };
      
      const result = await apiService.translations.create({
        ...translationData,
        file: fileToUpload
      });
      
      addNotification({ 
        message: `"${translationData.title}" uchun tarjima so'rovi qabul qilindi.`,
        link: `/my-translations`
      });
      
      return result;
    } catch (error) {
      console.error('Failed to create translation request:', error);
      addNotification({ 
        message: 'Tarjima so\'rovi yuborishda xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.',
      });
      throw error;
    }
  };

  const handleSubmit = async (paymentCompleted = false) => {
    if (!file || !analysisResult || !user) {
      toast.error(t("Barcha maydonlarni to'ldiring"));
      return;
    }

    setIsSubmitting(true);
    try {
      // Create translation request first
      const translationResult = await createTranslationRequest(file);
      
      // Save translation request ID for payment
      if (translationResult && translationResult.id) {
        setTranslationRequestId(translationResult.id);
      }

      // Bepul (narxi 0) buyurtma darhol ishga tushadi — to'lov oynasi kerak emas
      if (!paymentCompleted && Number(translationResult?.cost ?? 0) <= 0) {
        toast.success(t("Tarjima buyurtmasi qabul qilindi. Holatini «Tarjimalarim» bo'limida kuzating."));
        setFile(null);
        setAnalysisResult(null);
        setTranslationRequestId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsSubmitting(false);
        return;
      }

      // If payment is not completed, show payment modal
      if (!paymentCompleted) {
        setIsPaymentModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      toast.success(t("Tarjima so'rovi muvaffaqiyatli yuborildi va to'lov tasdiqlandi!"));
      // Reset form
      setFile(null);
      setAnalysisResult(null);
      setTranslationRequestId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error(t("So'rov yuborishda xatolik yuz berdi"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <EditorialPageHeader
        title={t('Ilmiy Tarjima Xizmati')}
        subtitle={t('Hujjatni yuklang, til juftligini tanlang va tarjima buyurtmasini yuboring.')}
      />
      <Card>
        <div className="space-y-6">
          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              {t('Hujjatni Yuklash')}
            </label>
            <div className="flex items-center justify-center w-full">
              <label 
                htmlFor="file-upload" 
                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer border-slate-200 hover:border-gray-500 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 text-slate-500" />
                  <p className="mb-2 text-sm text-slate-500">
                    <span className="font-semibold">{t('Fayl tanlash')}</span> {t('yoki olib keling')}
                  </p>
                  <p className="text-xs text-slate-500">
                    DOC, DOCX, PDF (MAX. {DEFAULT_UPLOAD_MB}MB)
                  </p>
                  {file && (
                    <p className="mt-2 text-sm text-emerald-800 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {file.name}
                    </p>
                  )}
                </div>
                <input 
                  id="file-upload" 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.txt"
                  ref={fileInputRef}
                />
              </label>
            </div>
          </div>

          {/* Language Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                {t('Manba Tili')}
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full px-3 py-2 bg-[#1f1630] border border-slate-300/80 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ colorScheme: 'dark' }}
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code} className="bg-[#1f1630] text-slate-900">
                    {t(lang.name)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                {t('Maqsad Tili')}
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-3 py-2 bg-[#1f1630] border border-slate-300/80 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ colorScheme: 'dark' }}
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code} className="bg-[#1f1630] text-slate-900">
                    {t(lang.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Analysis and Submit Section */}
          {file && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Button
                  onClick={analyzeFile}
                  disabled={isAnalyzing}
                  variant="secondary"
                  className="w-full max-w-xs"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('Tahlil qilinmoqda...')}
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      {t('Hujjatni Tahlil Qilish')}
                    </>
                  )}
                </Button>
              </div>

              {analysisResult && (
                <div className="p-4 bg-slate-100/70 rounded-lg border border-slate-200/90">
                  <h3 className="font-medium text-slate-900 mb-3 flex items-center">
                    <Languages className="mr-2 h-5 w-5 text-blue-800" />
                    {t('Tahlil Natijalari')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-900/20 rounded border border-blue-700/30">
                      <p className="text-sm text-blue-900">{t('Fayl nomi')}</p>
                      <p className="font-medium text-slate-900 truncate">{analysisResult.fileName}</p>
                    </div>
                    <div className="p-3 bg-green-900/20 rounded border border-green-700/30">
                      <p className="text-sm text-emerald-900">{t("So'zlar soni")}</p>
                      <p className="font-medium text-slate-900">{analysisResult.wordCount.toLocaleString()}</p>
                    </div>
                  </div>

                  <p className="mt-5 mb-2 text-sm font-medium text-slate-700">{t('Tarjima turini tanlang')}</p>
                  <div role="radiogroup" aria-label={t('Tarjima turi')} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {analysisResult.qualities.map((option) => {
                      const info = QUALITY_INFO[option.quality];
                      const Icon = info.icon;
                      const active = option.quality === quality;
                      return (
                        <button
                          key={option.quality}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setQuality(option.quality)}
                          className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${
                            active
                              ? 'border-[var(--editorial-primary)] bg-[rgba(31,63,143,0.08)] ring-2 ring-[rgba(31,63,143,0.25)]'
                              : 'border-slate-200/90 bg-white/40 hover:border-[var(--editorial-primary)]/50'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 font-semibold text-slate-900">
                              <Icon className="h-4 w-4 text-[var(--editorial-primary)]" aria-hidden /> {t(info.title)}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              option.quality === 'expert' ? 'bg-emerald-500/15 text-emerald-900' : 'bg-sky-500/15 text-sky-900'
                            }`}>{t(info.who)}</span>
                          </span>
                          <span className="text-xs text-slate-600">{t(info.hint)}</span>
                          <span className="mt-auto pt-1 text-lg font-bold text-slate-900">
                            {t("{value} so'm", { value: option.cost.toLocaleString() })}
                          </span>
                          <span className="text-xs text-slate-500">
                            {t("{value} so'm / so'z", { value: option.pricePerWord.toLocaleString() })}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-200/90">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={() => handleSubmit(false)}
                        disabled={isSubmitting}
                        className="flex-1"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('Yuborilmoqda...')}
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            {t("To'lov va Yuborish")}
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          setAnalysisResult(null);
                          setTranslationRequestId(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                          setFile(null);
                        }}
                        variant="secondary"
                      >
                        {t('Bekor qilish')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Information Section */}
          <div className="p-4 bg-blue-900/10 border border-blue-700/30 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-800 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900">{t("Muhim Ma'lumot")}</h4>
                <p className="mt-1 text-sm text-slate-600">
                  {t("Narx so'zlar soni va tarjima turiga qarab hisoblanadi. Oddiy va o'rta tarjimani AI to'lovdan keyin avtomatik bajaradi; puxta tarjimani professional tarjimon qiladi. AI tarjima qila olmasa, buyurtmani qo'shimcha to'lovsiz tarjimon bajaradi.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white/55 rounded-lg p-6 max-w-md w-full border border-slate-200/90">
            {paymentStatus === 'idle' && (
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-4">{t("To'lovni tasdiqlash")}</h3>
                <p className="text-slate-600 mb-2">
                  {t("Tarjima xizmati uchun to'lov:")}
                </p>
                <div className="p-3 bg-blue-900/20 rounded border border-blue-700/30 mb-4">
                  <p className="text-sm text-blue-900">{t("So'zlar soni: {value}", { value: analysisResult?.wordCount.toLocaleString() })}</p>
                  <p className="text-sm text-blue-900">{t(QUALITY_INFO[quality].title)}</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{t("{value} so'm", { value: (selectedOption(analysisResult)?.cost ?? 0).toLocaleString() })}</p>
                </div>
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="mt-4 text-lg font-medium text-slate-700">{t("To'lov tasdiqlanmoqda...")}</p>
              </div>
            )}
            {paymentStatus === 'success' && (
              <div className="text-center">
                <div className="text-green-800 text-4xl mb-4">✓</div>
                <p className="mt-4 text-lg font-medium text-slate-700">{t("To'lov muvaffaqiyatli!")}</p>
                <Button onClick={() => { closePaymentModal(); handleSubmit(true); }} className="w-full mt-6">
                  {t("So'rovni Davom Ettirish")}
                </Button>
              </div>
            )}
            {paymentStatus === 'failed' && (
              <div className="text-center" role="alert">
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
        </div>
      )}
    </div>
  );
};

export default TranslationService;