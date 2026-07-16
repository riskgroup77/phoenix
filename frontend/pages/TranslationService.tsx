import React, { useState, useRef } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Upload, Languages, FileText, Loader2, CheckCircle, AlertCircle, CreditCard } from 'lucide-react';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import { TranslationStatus } from '../types';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { toast } from 'react-toastify';

interface FileAnalysis {
  wordCount: number;
  cost: number;
  fileName: string;
  /** Backenddan: ServicePrice translation_per_word */
  pricePerWord: number;
}

const TranslationService: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [file, setFile] = useState<File | null>(null);
  const [sourceLang, setSourceLang] = useState('uz');
  const [targetLang, setTargetLang] = useState('en');
  const [analysisResult, setAnalysisResult] = useState<FileAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [translationRequestId, setTranslationRequestId] = useState<string | null>(null);
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
        analysisResult.cost,
        'UZS',
        'translation',
        undefined, // articleId
        translationRequestId
      );
      
      console.log('Payment result:', result);
      
      if (result && result.success === true && result.transaction_id) {
        setIsPaymentModalOpen(false);
        addNotification({
          message: 'To\'lov sahifasiga yo\'naltirilmoqdasiz. QR kodni skanerlang yoki tugmani bosing.',
        });
        paymentService.redirectToPaymentPage(result.transaction_id);
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
      toast.error('Iltimos, fayl tanlang');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await apiService.translations.analyzeFile(file);
      
      const ppw = Number(response.price_per_word ?? 100);
      setAnalysisResult({
        wordCount: response.word_count,
        cost: response.cost,
        fileName: file.name,
        pricePerWord: Number.isFinite(ppw) && ppw > 0 ? ppw : 100,
      });

      toast.success('Fayl tahlili tugallandi!');
    } catch (error) {
      console.error('Error analyzing file:', error);
      toast.error('Fayl tahlilida xatolik yuz berdi');
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
        word_count: analysisResult.wordCount,
        cost: analysisResult.cost,
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
      toast.error('Barcha maydonlarni to\'ldiring');
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

      // If payment is not completed, show payment modal
      if (!paymentCompleted) {
        setIsPaymentModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      toast.success('Tarjima so\'rovi muvaffaqiyatli yuborildi va to\'lov tasdiqlandi!');
      // Reset form
      setFile(null);
      setAnalysisResult(null);
      setTranslationRequestId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error('So\'rov yuborishda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card title="Ilmiy Tarjima Xizmati">
        <div className="space-y-6">
          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Hujjatni Yuklash
            </label>
            <div className="flex items-center justify-center w-full">
              <label 
                htmlFor="file-upload" 
                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer border-slate-200 hover:border-gray-500 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 text-slate-500" />
                  <p className="mb-2 text-sm text-slate-500">
                    <span className="font-semibold">Fayl tanlash</span> yoki olib keling
                  </p>
                  <p className="text-xs text-slate-500">
                    DOC, DOCX, PDF (MAX. 10MB)
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
                Manba Tili
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full px-3 py-2 bg-[#1f1630] border border-slate-300/80 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ colorScheme: 'dark' }}
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code} className="bg-[#1f1630] text-slate-900">
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Maqsad Tili
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-3 py-2 bg-[#1f1630] border border-slate-300/80 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ colorScheme: 'dark' }}
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code} className="bg-[#1f1630] text-slate-900">
                    {lang.name}
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
                      Tahlil qilinmoqda...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Hujjatni Tahlil Qilish
                    </>
                  )}
                </Button>
              </div>

              {analysisResult && (
                <div className="p-4 bg-slate-100/70 rounded-lg border border-slate-200/90">
                  <h3 className="font-medium text-slate-900 mb-3 flex items-center">
                    <Languages className="mr-2 h-5 w-5 text-blue-800" />
                    Tahlil Natijalari
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-blue-900/20 rounded border border-blue-700/30">
                      <p className="text-sm text-blue-900">Fayl nomi</p>
                      <p className="font-medium text-slate-900 truncate">{analysisResult.fileName}</p>
                    </div>
                    <div className="p-3 bg-green-900/20 rounded border border-green-700/30">
                      <p className="text-sm text-emerald-900">So'zlar soni</p>
                      <p className="font-medium text-slate-900">{analysisResult.wordCount.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-yellow-900/20 rounded border border-yellow-700/30">
                      <p className="text-sm text-yellow-900">Taxminiy narx</p>
                      <p className="font-medium text-slate-900">{analysisResult.cost.toLocaleString()} so'm</p>
                    </div>
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
                            Yuborilmoqda...
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            To'lov va Yuborish
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
                        Bekor qilish
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
                <h4 className="font-medium text-blue-900">Muhim Ma'lumot</h4>
                <p className="mt-1 text-sm text-slate-600">
                  Tarjima xizmati uchun narx so&apos;zlar soniga qarab hisoblanadi. Hozirgi narx:{' '}
                  <span className="font-semibold text-blue-200">
                    {analysisResult ? analysisResult.pricePerWord.toLocaleString('uz-UZ') : '100'} so&apos;m
                  </span>{' '}
                  har bir so&apos;z uchun. Jami: so&apos;zlar soni × bu narx. Sifatli tarjima mutaxassislarning
                  qo&apos;lidan chiqadi.
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
                <h3 className="text-xl font-semibold text-slate-900 mb-4">To'lovni tasdiqlash</h3>
                <p className="text-slate-600 mb-2">
                  Tarjima xizmati uchun to'lov:
                </p>
                <div className="p-3 bg-blue-900/20 rounded border border-blue-700/30 mb-4">
                  <p className="text-sm text-blue-900">So'zlar soni: {analysisResult?.wordCount.toLocaleString()}</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{analysisResult?.cost.toLocaleString()} so'm</p>
                </div>
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="mt-4 text-lg font-medium text-slate-700">To'lov tasdiqlanmoqda...</p>
              </div>
            )}
            {paymentStatus === 'success' && (
              <div className="text-center">
                <div className="text-green-800 text-4xl mb-4">✓</div>
                <p className="mt-4 text-lg font-medium text-slate-700">To'lov muvaffaqiyatli!</p>
                <Button onClick={() => { closePaymentModal(); handleSubmit(true); }} className="w-full mt-6">
                  So'rovni Davom Ettirish
                </Button>
              </div>
            )}
            {paymentStatus === 'failed' && (
              <div>
                <div className="text-red-500 text-4xl mb-4 text-center">✗</div>
                <p className="mt-4 text-lg font-medium text-slate-700 text-center">To'lovda xatolik!</p>
                <p className="text-sm text-slate-500 max-w-xs mx-auto text-center mb-4">{paymentError}</p>
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
    </div>
  );
};

export default TranslationService;