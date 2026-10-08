import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import EditorialPageHeader from '../components/EditorialPageHeader';
import Button from '../components/ui/Button';
import { UploadCloud, CheckCircle, Loader2, XCircle, FileText, Users, Eye, BookOpen, Filter, Layers, X, History, Check, CreditCard, Search as SearchIcon, ShieldCheck, BadgeCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PUBLICATION_TYPES, SUBJECT_AREAS } from '../constants/authorCategories';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import {
  buildArticlePayload,
  computePublicationPaymentAmount,
  estimatePageCountFromFile,
  parsePageCount,
} from '../utils/submitArticleUtils';
import JournalA4Card, { type JournalCardData } from '../components/JournalA4Card';
import { toast } from 'react-toastify';
import { useFormDraft } from '../hooks/useFormDraft';
import { useT } from '../i18n/LanguageContext';
import { formatUzDate } from '../utils/uzDate';

const MAX_FILE_MB = 20;

type SubmitDraft = {
  title: string;
  authorName: string;
  journalId: string;
  abstract: string;
  keywords: string;
  references: string;
  pageCount: number;
  coAuthors: { name: string; identifier: string }[];
  step: number;
};

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const SubmitArticle: React.FC = () => {
  const { user } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const [draftNotice, setDraftNotice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [journals, setJournals] = useState<JournalCardData[]>([]);
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
    pageCount: 1,
    coAuthors: [] as { name: string; identifier: string }[],
  });

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Pre-payment: to'lov qilinganidan keyin maqola yuboriladi
  const [paymentPendingTransactionId, setPaymentPendingTransactionId] = useState<string | null>(null);
  const [paymentChecking, setPaymentChecking] = useState(false);

  const SUBMIT_ARTICLE_PENDING_KEY = 'phonix_submit_article_pending';

  // Avtomatik qoralama (fayldan tashqari barcha maydonlar) — sahifa yopilsa ham yo'qolmaydi
  const draftData = useMemo<SubmitDraft>(
    () => ({
      title: formData.title,
      authorName: formData.authorName,
      journalId: formData.journalId,
      abstract: formData.abstract,
      keywords: formData.keywords,
      references: formData.references,
      pageCount: formData.pageCount,
      coAuthors: formData.coAuthors,
      step: currentStep,
    }),
    [formData.title, formData.authorName, formData.journalId, formData.abstract, formData.keywords, formData.references, formData.pageCount, formData.coAuthors, currentStep],
  );
  const draft = useFormDraft<SubmitDraft>('submit-article', user?.id, draftData, {
    enabled: !!user,
    isEmpty: (d) => !d.journalId && !d.title.trim() && !d.abstract.trim() && !d.keywords.trim() && d.coAuthors.length === 0,
  });

  useEffect(() => {
    const r = draft.restored;
    if (!r) return;
    const d = r.data;
    setFormData((prev) => ({
      ...prev,
      title: d.title || '',
      authorName: d.authorName || prev.authorName,
      journalId: d.journalId || '',
      abstract: d.abstract || '',
      keywords: d.keywords || '',
      references: d.references || '',
      pageCount: d.pageCount || 1,
      coAuthors: Array.isArray(d.coAuthors) ? d.coAuthors : [],
    }));
    // Fayl brauzerda saqlanmaydi — jurnal tanlangan bo'lsa fayl qadamidan davom etiladi
    setCurrentStep(d.journalId ? 2 : 1);
    setDraftNotice(r.savedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetDraft = () => {
    draft.clear();
    setDraftNotice(null);
    setFormData({
      title: '',
      authorName: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
      journalId: '',
      file: null,
      abstract: '',
      keywords: '',
      references: '',
      pageCount: 1,
      coAuthors: [],
    });
    setErrors({});
    setCurrentStep(1);
  };

  // Fayl tanlangan, lekin yuborilmagan bo'lsa — sahifadan chiqishda ogohlantirish
  useEffect(() => {
    if (!formData.file) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [formData.file]);

  const steps = [
    { id: 1, title: t('Jurnal tanlash'), icon: BookOpen },
    { id: 2, title: t('Fayl yuklash'), icon: UploadCloud },
    { id: 3, title: t('Maqola tavsifi'), icon: FileText },
    { id: 4, title: t('Hammualliflar'), icon: Users },
    { id: 5, title: t('Tasdiqlash'), icon: Eye },
  ];

  useEffect(() => {
    if (user && !formData.authorName.trim()) {
      const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
      if (full) {
        setFormData((prev) => ({ ...prev, authorName: full }));
      }
    }
  }, [user]);

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
          admin_name: j.admin_name || '',
          issues: Array.isArray(j.issues) ? j.issues : [],
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

  const acceptFile = (file: File | undefined | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.docx') && !name.endsWith('.doc')) {
      toast.error(t('Faqat DOC yoki DOCX (Word) fayllarini yuklash mumkin'));
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(t('Fayl hajmi {n} MB dan oshmasligi kerak', { n: MAX_FILE_MB }));
      return;
    }
    setFormData((prev) => ({ ...prev, file, pageCount: estimatePageCountFromFile(file) }));
    setErrors((e) => ({ ...e, file: '' }));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const buildPayload = (options?: {
    awaitingPublicationPayment?: boolean;
    paymentTransactionId?: string | null;
  }) =>
    buildArticlePayload(
      {
        title: formData.title,
        authorName: formData.authorName,
        journalId: formData.journalId,
        abstract: formData.abstract,
        keywords: formData.keywords,
        references: formData.references,
        pageCount: formData.pageCount,
        coAuthors: formData.coAuthors,
      },
      options
    );

  /** Create article (called when no payment required or after payment completed). */
  const doSubmitArticle = async () => {
    await apiService.articles.create(buildPayload(), { mainFile: formData.file! });
    draft.clear();
    toast.success(t('Maqola muvaffaqiyatli yuborildi'));
    setFormData({
      title: '',
      authorName: '',
      journalId: '',
      file: null,
      abstract: '',
      keywords: '',
      references: '',
      pageCount: 1,
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
    const isPrePayment = (selectedJournal?.payment_model || 'pre-payment') === 'pre-payment';
    const pubFee = selectedJournal?.publication_fee != null ? Number(selectedJournal.publication_fee) : 0;
    const perPage = selectedJournal?.price_per_page != null ? Number(selectedJournal.price_per_page) : 0;
    const hasFee = pubFee > 0 || perPage > 0;
    const amountForPayment = computePublicationPaymentAmount(selectedJournal, formData.pageCount);

    if (isPrePayment && hasFee && amountForPayment > 0) {
      setLoading(true);
      try {
        const draftArticle = await apiService.articles.create(
          buildPayload({ awaitingPublicationPayment: true }),
          { mainFile: formData.file! }
        );
        const articleId = draftArticle?.id;
        if (!articleId) {
          toast.error('Maqola yaratilmadi. Qayta urinib ko\'ring.');
          return;
        }
        // Maqola serverda saqlandi — brauzerdagi qoralama endi kerak emas
        draft.clear();

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
    <div className={`mx-auto p-6 ${currentStep === 1 ? 'max-w-6xl' : 'max-w-4xl'}`}>
      <EditorialPageHeader
        title={t('Maqola yuborish')}
        subtitle={t('Maqolangizni nashr qilish uchun yuboring')}
        actions={
          draft.savedAt ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--editorial-muted)]" aria-live="polite">
              <Check className="w-4 h-4 text-[var(--milliy-firuza)]" aria-hidden /> {t('Qoralama saqlandi · {time}', { time: hhmm(draft.savedAt) })}
            </span>
          ) : undefined
        }
      />

      {draftNotice && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[12px] border border-[var(--editorial-border)] bg-[var(--milliy-firuza-soft)] px-4 py-3 text-sm">
          <History className="w-5 h-5 text-[var(--milliy-firuza)] shrink-0" aria-hidden />
          <span className="flex-1 min-w-[220px] text-[var(--editorial-text)]">
            {t('Oldingi qoralamangiz tiklandi ({date}, {time}).', { date: formatUzDate(draftNotice), time: hhmm(draftNotice) })}{' '}
            {formData.journalId && !formData.file && t('Maqola faylini qayta biriktiring.')}
          </span>
          <button type="button" onClick={resetDraft} className="milliy-btn-secondary !min-h-[2.25rem] !px-3 text-sm">
            {t('Yangidan boshlash')}
          </button>
          <button type="button" onClick={() => setDraftNotice(null)} className="editorial-icon-btn" aria-label={t('Yopish')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <ol className="milliy-stepper mb-8" aria-label={t('Bosqichlar')}>
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <li key={step.id} className="flex-1 min-w-[7.5rem]">
              <button
                type="button"
                onClick={() => isCompleted && setCurrentStep(step.id)}
                disabled={!isCompleted}
                aria-current={isActive ? 'step' : undefined}
                className={`milliy-step w-full ${isActive ? 'milliy-step--active' : ''} ${isCompleted ? 'milliy-step--done cursor-pointer' : 'cursor-default'}`}
              >
                <span className="milliy-step-num">{isCompleted ? <Check className="w-4 h-4" aria-hidden /> : step.id}</span>
                <span className="truncate">{step.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8 justify-items-center">
              {filteredJournals.map((j) => (
                <JournalA4Card
                  key={j.id}
                  journal={j}
                  selected={formData.journalId === j.id}
                  imageError={!!journalImageErrors[j.id]}
                  onImageError={() => setJournalImageErrors((prev) => ({ ...prev, [j.id]: true }))}
                  onSelect={() => selectJournalAndNext(j.id)}
                />
              ))}
            </div>
            {filteredJournals.length === 0 && (
              <p className="text-center text-slate-500 py-8">Qidiruv bo&apos;yicha jurnal topilmadi.</p>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">{t('Fayl yuklash')}</h2>
              <div
                role="button"
                tabIndex={0}
                aria-label={t('Maqola faylini tanlash')}
                className={`border-2 border-dashed rounded-[14px] p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-[var(--editorial-primary)] bg-[var(--milliy-firuza-soft)]'
                    : 'border-[var(--editorial-border)] hover:border-[var(--editorial-primary)]'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  acceptFile(e.dataTransfer.files?.[0]);
                }}
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
                    <p className="text-slate-900 font-medium">{t('Faylni shu yerga tashlang yoki tanlash uchun bosing')}</p>
                    <p className="text-slate-500 text-sm">{t('DOC yoki DOCX (Word), {n} MB gacha', { n: MAX_FILE_MB })}</p>
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
                  Sahifalar soni *
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={formData.pageCount}
                  onChange={(e) =>
                    setFormData({ ...formData, pageCount: parsePageCount(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Fayl yuklanganda taxminiy hisoblanadi; sahifabop narx uchun to&apos;g&apos;rilang.
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

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Adabiyotlar ro&apos;yxati (ixtiyoriy)
              </label>
              <textarea
                value={formData.references}
                onChange={(e) => setFormData({ ...formData, references: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-slate-100/70 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                placeholder="Adabiyotlar ro&apos;yxatini kiriting"
              />
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
                  <p><strong>Sahifalar soni:</strong> {formData.pageCount}</p>
                  <p><strong>Jurnal:</strong> {journals.find(j => j.id === formData.journalId)?.name || '—'}</p>
                  <p><strong>Kalit so'zlar:</strong> {formData.keywords}</p>
                  <p><strong>Abstrakt:</strong> {formData.abstract.substring(0, 100)}...</p>
                </div>
              </div>

              {(() => {
                const j = journals.find((x) => x.id === formData.journalId);
                const amount = computePublicationPaymentAmount(j, formData.pageCount);
                const pre = (j?.payment_model || 'pre-payment') === 'pre-payment';
                return (
                  <div className="rounded-[12px] border border-[var(--editorial-border)] p-4 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-bold text-[var(--editorial-text)]">
                        <CreditCard className="w-5 h-5 text-[var(--milliy-firuza)]" aria-hidden /> {t("Nashr to'lovi")}
                      </span>
                      <span className="text-xl font-extrabold tabular-nums">
                        {amount > 0 ? `${Math.round(amount).toLocaleString('ru-RU').replace(/,/g, ' ')} ${t("so'm")}` : t('Bepul / kelishiladi')}
                      </span>
                    </div>
                    {amount > 0 && (
                      <p className="m-0 text-sm text-[var(--editorial-muted)]">
                        {pre
                          ? t("To'lov yuborishdan oldin olinadi (Click). To'lovdan so'ng maqola tahririyatga tushadi.")
                          : t("To'lov maqola qabul qilingandan keyin olinadi.")}
                      </p>
                    )}
                    <ol className="m-0 pl-0 list-none grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                      {[
                        { icon: CreditCard, label: t("To'lov") },
                        { icon: SearchIcon, label: t('Muharrir tekshiruvi') },
                        { icon: ShieldCheck, label: t('Taqriz va antiplagiat') },
                        { icon: BadgeCheck, label: t('Nashr va sertifikat') },
                      ].map((s, i) => (
                        <li key={s.label} className="flex items-center gap-2 rounded-[10px] bg-[var(--editorial-bg-alt)] px-3 py-2 font-semibold text-[var(--editorial-body)]">
                          <span className="milliy-step-num !w-6 !h-6 !text-[11px]">{i + 1}</span>
                          <s.icon className="w-4 h-4 text-[var(--milliy-firuza)] shrink-0" aria-hidden />
                          {s.label}
                        </li>
                      ))}
                    </ol>
                    <p className="m-0 text-xs text-[var(--editorial-muted)]">
                      {t("Har bir bosqich «Maqolalarim» sahifasidagi tarixda ko'rinadi va Telegram'ga xabar keladi.")}
                    </p>
                  </div>
                );
              })()}

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
            {t('Orqaga')}
          </Button>

          {currentStep < steps.length ? (
            <Button onClick={nextStep}>
              {t('Keyingi')}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading || !!paymentPendingTransactionId}
              className="flex items-center gap-2"
            >
              {loading && !paymentPendingTransactionId && <Loader2 className="w-4 h-4 animate-spin" />}
              {paymentPendingTransactionId ? t("To'lov kutilmoqda") : t('Yuborish')}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SubmitArticle;
