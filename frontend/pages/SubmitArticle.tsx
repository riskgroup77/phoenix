import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { UploadCloud, CheckCircle, Loader2, XCircle, FileText, Users, Eye, BookOpen, Filter, Layers, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PUBLICATION_TYPES, SUBJECT_AREAS } from '../constants/authorCategories';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { toast } from 'react-toastify';

const SubmitArticle: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [journals, setJournals] = useState<{ id: string; name: string; description?: string; issn?: string; publication_fee?: number; price_per_page?: number; pricing_type?: string; payment_model?: string; image_url?: string | null; category_name?: string }[]>([]);
  const [journalSearch, setJournalSearch] = useState('');
  const [journalFilterType, setJournalFilterType] = useState('');
  const [journalFilterSubject, setJournalFilterSubject] = useState('');
  const [journalImageErrors, setJournalImageErrors] = useState<Record<string, boolean>>({});

  // Form data — maqola mavzusi va ism-familiya majburiy
  const [formData, setFormData] = useState({
    title: '',
    authorName: '',
    journalId: '',
    file: null as File | null,
    abstract: '',
    keywords: '',
    references: '',
    coAuthors: [] as { name: string; identifier: string }[],
  });

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Pre-payment: to'lov qilinganidan keyin maqola yuboriladi
  const [paymentPendingTransactionId, setPaymentPendingTransactionId] = useState<string | null>(null);
  const [paymentChecking, setPaymentChecking] = useState(false);

  const SUBMIT_ARTICLE_PENDING_KEY = 'phonix_submit_article_pending';

  const steps = [
    { id: 1, title: 'Jurnal tanlash', icon: BookOpen },
    { id: 2, title: 'Fayl yuklash', icon: UploadCloud },
    { id: 3, title: 'Maqola tavsifi', icon: FileText },
    { id: 4, title: 'Hammualliflar', icon: Users },
    { id: 5, title: 'Tasdiqlash', icon: Eye },
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiService.journals.list();
        const list = Array.isArray(data) ? data : (data?.results || data?.data || []);
        setJournals(list.map((j: any) => ({
          id: j.id,
          name: j.name || j.title,
          description: j.description,
          issn: j.issn,
          publication_fee: j.publication_fee != null ? Number(j.publication_fee) : undefined,
          price_per_page: j.price_per_page != null ? Number(j.price_per_page) : undefined,
          pricing_type: j.pricing_type,
          payment_model: j.payment_model || undefined,
          image_url: j.image_url || null,
          category_name: j.category_name || '',
        })));
      } catch (e) {
        console.error('Failed to load journals', e);
      }
    };
    load();
  }, []);

  /** To'lovdan qaytganida: maqola allaqachon yaratilgan bo'lsa arxivga yo'naltirish */
  useEffect(() => {
    const raw = sessionStorage.getItem(SUBMIT_ARTICLE_PENDING_KEY);
    if (!raw) return;
    let pending: { articleId?: string; transactionId?: string };
    try {
      pending = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(SUBMIT_ARTICLE_PENDING_KEY);
      return;
    }
    const txId = pending.transactionId;
    if (!txId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await paymentService.checkPaymentStatus(txId);
        if (cancelled) return;
        if (res.payment_status === 2) {
          sessionStorage.removeItem(SUBMIT_ARTICLE_PENDING_KEY);
          toast.success("To'lov tasdiqlandi. Maqola arxiv va «Maqolalarim» bo'limlarida ko'rinadi.");
          navigate('/arxiv');
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const validateStep = (step: number): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (step === 1) {
      if (!formData.journalId) {
        newErrors.journalId = 'Jurnalni tanlang';
      }
    } else if (step === 2) {
      if (!formData.file) {
        newErrors.file = 'Faylni tanlang';
      }
    } else if (step === 3) {
      if (!formData.title.trim()) {
        newErrors.title = 'Maqola mavzusini kiriting (majburiy)';
      } else if (formData.title.trim().length < 5) {
        newErrors.title = 'Maqola mavzusi kamida 5 ta belgidan iborat bo\'lishi kerak';
      }
      if (!formData.authorName.trim()) {
        newErrors.authorName = 'Muallif ism-familiyasini kiriting (majburiy)';
      } else if (formData.authorName.trim().length < 3) {
        newErrors.authorName = 'Ism-familiyani to\'liq kiriting';
      }
      if (!formData.abstract.trim()) {
        newErrors.abstract = 'Abstraktni kiriting';
      }
      if (!formData.keywords.trim()) {
        newErrors.keywords = 'Kalit so\'zlarni kiriting';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** Select journal and go to next step (card click = select + next) */
  const selectJournalAndNext = (journalId: string) => {
    setFormData((prev) => ({ ...prev, journalId }));
    setErrors((e) => ({ ...e, journalId: '' }));
    setCurrentStep(2);
  };

  const filteredJournals = journals.filter((j) => {
    if (journalFilterType && (j.category_name || '') !== journalFilterType) return false;
    if (journalFilterSubject) {
      const sub = journalFilterSubject.toLowerCase();
      const name = (j.name || '').toLowerCase();
      const desc = (j.description || '').toLowerCase();
      if (!name.includes(sub) && !desc.includes(sub)) return false;
    }
    return (
      !journalSearch.trim() ||
      (j.name || '').toLowerCase().includes(journalSearch.trim().toLowerCase()) ||
      (j.description || '').toLowerCase().includes(journalSearch.trim().toLowerCase())
    );
  });

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const name = file.name.toLowerCase();
      if (!name.endsWith('.docx') && !name.endsWith('.doc')) {
        toast.error('Faqat DOC yoki DOCX (Word) fayllarini yuklash mumkin');
        return;
      }
      setFormData({ ...formData, file });
    }
  };

  const buildArticlePayload = (options?: {
    awaitingPublicationPayment?: boolean;
    paymentTransactionId?: string | null;
  }): Record<string, unknown> => {
    const keywordsStr = formData.keywords.trim();
    const keywordsList = keywordsStr
      ? keywordsStr.split(/\s*,\s*/).map((k: string) => k.trim()).filter(Boolean)
      : [];
    const articlePayload: Record<string, unknown> = {
      title: formData.title.trim(),
      journal: formData.journalId,
      abstract: formData.abstract.trim() || '',
      keywords: keywordsList,
      page_count: 1,
      fast_track: false,
    };
    const coAuthorContacts = formData.coAuthors
      .map((coAuthor) => ({
        name: coAuthor.name.trim(),
        identifier: coAuthor.identifier.trim(),
      }))
      .filter((coAuthor) => coAuthor.identifier);
    if (coAuthorContacts.length > 0) {
      articlePayload.co_author_contacts = coAuthorContacts;
    }
    if (options?.awaitingPublicationPayment) {
      articlePayload.awaiting_publication_payment = true;
    }
    const txId = options?.paymentTransactionId ?? paymentPendingTransactionId;
    if (txId) {
      articlePayload.payment_transaction_id = txId;
    }
    return articlePayload;
  };

  /** Create article (called when no payment required or after payment completed). */
  const doSubmitArticle = async () => {
    await apiService.articles.create(buildArticlePayload(), { mainFile: formData.file! });
    toast.success('Maqola muvaffaqiyatli yuborildi');
    setFormData({
      title: '',
      authorName: '',
      journalId: '',
      file: null,
      abstract: '',
      keywords: '',
      references: '',
      coAuthors: [],
    });
    setCurrentStep(1);
    setJournalSearch('');
    setPaymentPendingTransactionId(null);
    sessionStorage.removeItem(SUBMIT_ARTICLE_PENDING_KEY);
    navigate('/articles?tab=journal');
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Maqola mavzusini kiriting.');
      setErrors(e => ({ ...e, title: 'Maqola mavzusini kiriting (majburiy)' }));
      return;
    }
    if (!formData.authorName.trim()) {
      toast.error('Muallif ism-familiyasini kiriting.');
      setErrors(e => ({ ...e, authorName: 'Muallif ism-familiyasini kiriting (majburiy)' }));
      return;
    }
    if (!formData.journalId) {
      toast.error('Jurnalni tanlang.');
      setErrors((e) => ({ ...e, journalId: 'Jurnalni tanlang' }));
      return;
    }
    if (!formData.file) {
      toast.error('Maqola faylini yuklang.');
      return;
    }
    if (!validateStep(3)) {
      setCurrentStep(3);
      return;
    }

    const selectedJournal = journals.find((j) => j.id === formData.journalId);
    // API ba'zan payment_model qaytarmasa ham jurnal default pre-payment
    const isPrePayment = (selectedJournal?.payment_model || 'pre-payment') === 'pre-payment';
    const pubFee = selectedJournal?.publication_fee != null ? Number(selectedJournal.publication_fee) : 0;
    const perPage = selectedJournal?.price_per_page != null ? Number(selectedJournal.price_per_page) : 0;
    // Backend bilan mos: publication_fee yoki price_per_page > 0 bo'lsa oldindan to'lov talab qilinishi mumkin
    const hasFee = pubFee > 0 || perPage > 0;
    const isPerPage = selectedJournal?.pricing_type === 'per_page';
    const pages = Math.max(1, 1);
    const amountForPayment =
      isPerPage && perPage > 0
        ? perPage * pages
        : pubFee > 0
          ? pubFee
          : perPage > 0
            ? perPage * pages
            : 0;

    if (isPrePayment && hasFee && amountForPayment > 0) {
      setLoading(true);
      try {
        const draftArticle = await apiService.articles.create(
          buildArticlePayload({ awaitingPublicationPayment: true }),
          { mainFile: formData.file! }
        );
        const articleId = draftArticle?.id;
        if (!articleId) {
          toast.error('Maqola yaratilmadi. Qayta urinib ko\'ring.');
          return;
        }

        const result = await paymentService.createTransactionAndPay(
          amountForPayment,
          'UZS',
          'publication_fee',
          articleId,
          undefined,
          'click'
        );
        if (result?.transaction_id) {
          setPaymentPendingTransactionId(result.transaction_id);
          sessionStorage.setItem(
            SUBMIT_ARTICLE_PENDING_KEY,
            JSON.stringify({ articleId, transactionId: result.transaction_id })
          );
          toast.info(
            'Maqola saqlandi. To\'lovni amalga oshiring — «Maqolalarim» → To\'lov va qoralama bo\'limida ham ko\'rinadi.'
          );
          paymentService.redirectToPaymentPage(result.transaction_id);
        } else {
          toast.error(result?.error || result?.error_note || 'To\'lovni boshlashda xatolik');
        }
      } catch (err: any) {
        toast.error(err?.message || 'To\'lovni boshlashda xatolik');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      await doSubmitArticle();
    } catch (error: any) {
      const msg = error?.response?.detail || error?.message || 'Maqola yuborishda xatolik yuz berdi';
      const details = error?.response && typeof error.response === 'object' && !error.response.detail;
      const detailStr = details ? Object.entries(error.response).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') : null;
      toast.error(detailStr || msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckPaymentAndSubmit = async () => {
    if (!paymentPendingTransactionId) return;
    setPaymentChecking(true);
    try {
      const res = await paymentService.checkPaymentStatus(paymentPendingTransactionId);
      if (res.payment_status === 2) {
        const pendingRaw = sessionStorage.getItem(SUBMIT_ARTICLE_PENDING_KEY);
        if (pendingRaw) {
          sessionStorage.removeItem(SUBMIT_ARTICLE_PENDING_KEY);
          toast.success("To'lov tasdiqlandi. Maqola arxiv va «Maqolalarim» bo'limlarida ko'rinadi.");
          navigate('/arxiv');
          return;
        }
        setLoading(true);
        try {
          await doSubmitArticle();
        } catch (err: any) {
          toast.error(err?.message || 'Maqola yuborishda xatolik');
        } finally {
          setLoading(false);
        }
      } else if (res.payment_status === -1) {
        toast.error('To\'lov amalga oshirilmadi yoki bekor qilindi.');
      } else {
        toast.info('To\'lov hali tasdiqlanmadi. To\'lovni amalga oshiring yoki biroz kutib qayta tekshiring.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'To\'lov holatini tekshirishda xatolik');
    } finally {
      setPaymentChecking(false);
    }
  };

  const addCoAuthor = () => {
    setFormData({
      ...formData,
      coAuthors: [...formData.coAuthors, { name: '', identifier: '' }]
    });
  };

  const removeCoAuthor = (index: number) => {
    setFormData({
      ...formData,
      coAuthors: formData.coAuthors.filter((_, i) => i !== index)
    });
  };

  const updateCoAuthor = (index: number, field: 'name' | 'identifier', value: string) => {
    const updated = [...formData.coAuthors];
    updated[index][field] = value;
    setFormData({ ...formData, coAuthors: updated });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Maqola yuborish</h1>
        <p className="text-slate-500">Maqolangizni nashr qilish uchun yuboring</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex justify-between">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div key={step.id} className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                  isCompleted ? 'bg-green-600' :
                  isActive ? 'bg-blue-600' : 'bg-gray-600'
                }`}>
                  {isCompleted ? <CheckCircle className="w-6 h-6 text-slate-900" /> : <Icon className="w-6 h-6 text-slate-900" />}
                </div>
                <span className={`text-sm font-medium ${
                  isActive ? 'text-blue-800' : isCompleted ? 'text-emerald-800' : 'text-slate-500'
                }`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 bg-slate-100/90 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <Card className="p-6">
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Jurnal tanlang</h2>
            <p className="text-slate-500 text-sm mb-4">Jurnal kartasiga bosing — tanlash va keyingi qadamga o&apos;ting (Keyingi tugmasini bosish shart emas).</p>

            {/* Filtr — faqat jurnal tanlash qadamida, kartalar ustida; mobilda carddan chiqmaslik */}
            <div className="w-full min-w-0 overflow-hidden flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 p-3 rounded-lg bg-white/60 border border-slate-200/90 mb-4">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-500 shrink-0">
                <Filter size={18} className="text-blue-800" />
                Filtr
              </span>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 min-w-0 w-full sm:flex-1">
                <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
                  <BookOpen size={16} className="text-slate-500 shrink-0" />
                  <select
                    value={journalFilterType}
                    onChange={(e) => setJournalFilterType(e.target.value)}
                    className="flex-1 min-w-0 w-full max-w-full bg-slate-100/70 border border-slate-200/90 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                    style={{ minWidth: 0 }}
                    aria-label="Nashr turi"
                  >
                    <option value="">Barcha jurnallar</option>
                    {PUBLICATION_TYPES.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
                  <Layers size={16} className="text-slate-500 shrink-0" />
                  <select
                    value={journalFilterSubject}
                    onChange={(e) => setJournalFilterSubject(e.target.value)}
                    className="flex-1 min-w-0 w-full max-w-full bg-slate-100/70 border border-slate-200/90 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer"
                    style={{ minWidth: 0 }}
                    aria-label="Soha"
                  >
                    <option value="">Barcha sohalar</option>
                    {SUBJECT_AREAS.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                {(journalFilterType || journalFilterSubject) && (
                  <button
                    type="button"
                    onClick={() => { setJournalFilterType(''); setJournalFilterSubject(''); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-white/10 transition-colors shrink-0 self-start sm:self-center"
                    aria-label="Filterni tozalash"
                  >
                    <X size={16} />
                    Tozalash
                  </button>
                )}
              </div>
            </div>

            <input
              type="text"
              value={journalSearch}
              onChange={(e) => setJournalSearch(e.target.value)}
              placeholder="Jurnal nomi yoki tavsifi bo'yicha qidirish..."
              className="w-full px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 mb-4"
            />
            <p className="text-sm text-slate-500 mb-4">Jurnallar: {journals.length} | Ko&apos;rsatilmoqda: {filteredJournals.length}</p>
            {errors.journalId && <p className="text-red-500 text-sm mb-2">{errors.journalId}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredJournals.map((j) => {
                const isFixed = j.pricing_type === 'fixed' || (j.publication_fee != null && j.publication_fee > 0 && !j.price_per_page);
                const priceText = isFixed
                  ? `${(j.publication_fee ?? 0).toLocaleString()} so'm`
                  : j.price_per_page != null
                    ? `${(j.price_per_page).toLocaleString()} so'm / sahifa`
                    : '';
                return (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => selectJournalAndNext(j.id)}
                    className="text-left rounded-xl border-2 border-slate-200/90 bg-slate-100/70 hover:border-blue-500/50 hover:bg-white/10 transition-all duration-200 group overflow-hidden"
                  >
                    <div className="flex flex-col">
                      <div className="w-full h-36 sm:h-40 rounded-t-xl bg-white flex items-center justify-center overflow-hidden border-b border-slate-200/90 p-2">
                        {j.image_url && !journalImageErrors[j.id] ? (
                          <img
                            src={j.image_url.startsWith('http') ? j.image_url : apiService.getMediaUrl(j.image_url)}
                            alt={j.name}
                            className="max-w-full max-h-full w-auto h-auto object-contain object-center"
                            onError={() => setJournalImageErrors((prev) => ({ ...prev, [j.id]: true }))}
                          />
                        ) : (
                          <BookOpen className="w-16 h-16 text-blue-800 shrink-0" />
                        )}
                      </div>
                      <div className="p-4 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{j.name}</h3>
                        {j.description && (
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{j.description}</p>
                        )}
                        {j.issn && <p className="text-xs text-slate-500 mt-1 font-mono">{j.issn}</p>}
                        {priceText && (
                          <p className="text-sm font-medium text-blue-900 mt-2">{priceText}</p>
                        )}
                        {priceText && <p className="text-xs text-slate-500">To&apos;liq to&apos;lov</p>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {filteredJournals.length === 0 && (
              <p className="text-center text-slate-500 py-8">Qidiruv bo&apos;yicha jurnal topilmadi.</p>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Fayl yuklash</h2>
              <div
                className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center cursor-pointer hover:border-gray-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {formData.file ? (
                  <div className="space-y-2">
                    <CheckCircle className="w-12 h-12 text-green-800 mx-auto" />
                    <p className="text-slate-900 font-medium">{formData.file.name}</p>
                    <p className="text-slate-500 text-sm">
                      {(formData.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud className="w-12 h-12 text-slate-500 mx-auto" />
                    <p className="text-slate-900 font-medium">Faylni tanlang</p>
                    <p className="text-slate-500 text-sm">DOC yoki DOCX (Word)</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              {errors.file && <p className="text-red-500 text-sm mt-2">{errors.file}</p>}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Maqola tavsifi</h2>
            <p className="text-slate-500 text-sm mb-4">Maqola mavzusi va muallif ism-familiyasi majburiy (ma&apos;lumotnomada ko&apos;rsatiladi).</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Maqola mavzusi (sarlavha) *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="Masalan: O'zbekiston iqtisodiyotida raqamlashtirish tendensiyalari"
                />
                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Muallif ism-familiyasi *
                </label>
                <input
                  type="text"
                  value={formData.authorName}
                  onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="Masalan: Ali Valiyev"
                />
                {errors.authorName && <p className="text-red-500 text-sm mt-1">{errors.authorName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Jurnal
                </label>
                <p className="px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-lg text-slate-900">
                  {journals.find((j) => j.id === formData.journalId)?.name || '—'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Abstrakt *
              </label>
              <textarea
                value={formData.abstract}
                onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                placeholder="Maqola abstraktini kiriting"
              />
              {errors.abstract && <p className="text-red-500 text-sm mt-1">{errors.abstract}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Kalit so'zlar *
              </label>
              <input
                type="text"
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                className="w-full px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                placeholder="Kalit so'zlarni vergul bilan ajratib kiriting"
              />
              {errors.keywords && <p className="text-red-500 text-sm mt-1">{errors.keywords}</p>}
            </div>

          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Hammualliflar</h2>

            {formData.coAuthors.map((coAuthor, index) => (
              <div key={index} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Hammuallif ismi
                  </label>
                  <input
                    type="text"
                    value={coAuthor.name}
                    onChange={(e) => updateCoAuthor(index, 'name', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="Ism familiyani kiriting"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    ID / email / telefon *
                  </label>
                  <input
                    type="text"
                    value={coAuthor.identifier}
                    onChange={(e) => updateCoAuthor(index, 'identifier', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="User ID yoki email yoki telefon"
                  />
                </div>
                <Button
                  onClick={() => removeCoAuthor(index)}
                  variant="secondary"
                  className="mb-0"
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            ))}

            <Button onClick={addCoAuthor} variant="secondary" className="w-full">
              + Hammuallif qo'shish
            </Button>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Tasdiqlash</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Fayl</h3>
                <p className="text-slate-600">{formData.file?.name}</p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Maqola ma'lumotlari</h3>
                <div className="bg-slate-100/70 rounded-lg p-4 space-y-2">
                  <p><strong>Mavzu (sarlavha):</strong> {formData.title || '—'}</p>
                  <p><strong>Muallif (ism-familiya):</strong> {formData.authorName || '—'}</p>
                  <p><strong>Jurnal:</strong> {journals.find(j => j.id === formData.journalId)?.name || '—'}</p>
                  <p><strong>Kalit so'zlar:</strong> {formData.keywords}</p>
                  <p><strong>Abstrakt:</strong> {formData.abstract.substring(0, 100)}...</p>
                </div>
              </div>

              {formData.coAuthors.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Hammualliflar</h3>
                  <div className="space-y-2">
                    {formData.coAuthors.map((coAuthor, index) => (
                      <div key={index} className="bg-slate-100/70 rounded-lg p-3">
                        <p>{coAuthor.name || 'Nomsiz hammuallif'} - {coAuthor.identifier}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pre-payment: to'lov kutilmoqda — to'lovni tekshirish */}
        {currentStep === steps.length && paymentPendingTransactionId && (
          <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <p className="text-amber-950 text-sm mb-3">
              Oldindan to&apos;lov talab qilinadi. To&apos;lovni amalga oshiring (yangi tabda ochilgan sahifada), keyin quyidagi tugmani bosing.
            </p>
            <Button
              type="button"
              onClick={handleCheckPaymentAndSubmit}
              disabled={paymentChecking || loading}
              className="flex items-center gap-2"
            >
              {paymentChecking || loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              To&apos;lovni tekshirish va maqolani yuborish
            </Button>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
          <Button
            onClick={prevStep}
            disabled={currentStep === 1}
            variant="secondary"
          >
            Orqaga
          </Button>

          {currentStep < steps.length ? (
            <Button onClick={nextStep}>
              Keyingi
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading || !!paymentPendingTransactionId}
              className="flex items-center gap-2"
            >
              {loading && !paymentPendingTransactionId && <Loader2 className="w-4 h-4 animate-spin" />}
              {paymentPendingTransactionId ? 'To\'lov kutilmoqda' : 'Yuborish'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SubmitArticle;
