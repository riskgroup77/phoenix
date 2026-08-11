import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Article, ArticleStatus, ARTICLE_STATUS_LABELS, Role, TranslationRequest, TranslationStatus, User } from '../types';
import Card from '../components/ui/Card';
import { Search, Rocket, Languages, ArrowRight, FileText, Printer, Loader2, ChevronDown, Check, Filter, X, Share2, BookOpen, FileDown } from 'lucide-react';
import Button from '../components/ui/Button';
import AuthorArticleReport from '../components/AuthorArticleReport';
import NashrHisobotCertificate, { NashrHisobotData, PublishedArticle } from '../components/NashrHisobotCertificate';
import { PlagiarismBadges } from '../components/PlagiarismReport';
import { downloadNashrHisobotDocx } from '../utils/exportNashrHisobotDocx';
import { getAuthorWorkflowStepsFromStatus, getAuthorWorkflowStageLabel } from '../utils/articleAuthorWorkflow';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { toast } from 'react-toastify';

// Type for the API response which has different field names
interface ArticleApiResponse {
    id: string;
    title: string;
    abstract: string;
    keywords: string[];
    status: ArticleStatus;
    author: string;
    author_name?: string;
    journal: string;
    journal_name?: string;
    submission_date: string;
    fast_track: boolean;
    file_url?: string;
    views: number;
    downloads: number;
    plagiarism_percentage?: number;
    ai_content_percentage?: number;
    plagiarism_checked_at?: string | null;
    pending_payment_transaction_id?: string | null;
}

interface TranslationRequestApiResponse {
    id: string;
    author: string;
    reviewer?: string;
    title: string;
    source_language: string;
    target_language: string;
    source_file_path: string;
    translated_file_path?: string;
    status: TranslationStatus;
    word_count: number;
    cost: number;
    submission_date: string;
    completion_date?: string;
    author_name?: string;
    reviewer_name?: string;
    /** Backend: Transaction (service_type translation) completed */
    payment_completed?: boolean;
    payment_pending?: boolean;
    payment_status_label?: string;
}

interface JournalApiResponse {
    id: string;
    name: string;
    issn: string;
    category: string;
    journal_admin?: string;
    journalAdminId?: string;
    journalAdmin?: string;
    admin_id?: string;
    admin?: { id: string };
}

/** Get article's journal ID whether API returns string or nested object */
function getArticleJournalId(a: ArticleApiResponse): string {
    const j = (a as any).journal;
    if (typeof j === 'string') return j;
    if (j && typeof j === 'object' && typeof j.id === 'string') return j.id;
    return '';
}

/** Admin / super-admin: drafts and payment stages (not yet "Yangi" in workflow) */
const journalAdminTabsBase = [
    {
        id: 'draft-payment',
        label: "Qoralama / to'lov",
        statuses: [
            ArticleStatus.Draft,
            ArticleStatus.PaymentCompleted,
            ArticleStatus.ContractProcessing,
            ArticleStatus.IsbnProcessing,
            ArticleStatus.AuthorDataVerified,
            ArticleStatus.WritingInProgress,
        ],
    },
    {
        id: 'new',
        label: 'Yangi kelganlar',
        statuses: [ArticleStatus.Yangi, ArticleStatus.Draft],
    },
    { id: 'with-editor', label: 'Redaktorda', statuses: [ArticleStatus.WithEditor] },
    { id: 'in-review', label: 'Tekshiruvda', statuses: [ArticleStatus.QabulQilingan] },
    { id: 'plagiarism-review', label: 'Antiplagiat (bosh admin)', statuses: [ArticleStatus.PlagiarismReview] },
    { id: 'ready', label: 'Nashrga Tayyorlar', statuses: [ArticleStatus.NashrgaYuborilgan] },
    { id: 'published', label: 'Nashr etilgan', statuses: [ArticleStatus.Published] },
    { id: 'all', label: 'Barcha Maqolalar', statuses: [] },
];

const authorArticleTabs: { id: string; label: string; statuses: ArticleStatus[] }[] = [
    {
        id: 'draft-payment',
        label: "To'lov va qoralama",
        statuses: [
            ArticleStatus.Draft,
            ArticleStatus.PaymentCompleted,
            ArticleStatus.ContractProcessing,
            ArticleStatus.IsbnProcessing,
            ArticleStatus.AuthorDataVerified,
            ArticleStatus.WritingInProgress,
        ],
    },
    { id: 'journal', label: 'Jurnalda', statuses: [ArticleStatus.Yangi, ArticleStatus.WithEditor] },
    { id: 'plagiarism', label: 'Antiplagiat', statuses: [ArticleStatus.PlagiarismReview] },
    { id: 'review', label: 'Taqriz', statuses: [ArticleStatus.QabulQilingan, ArticleStatus.Revision] },
    { id: 'publish', label: 'Nashrga', statuses: [ArticleStatus.Accepted, ArticleStatus.NashrgaYuborilgan] },
    { id: 'done', label: 'Nashr / yakun', statuses: [ArticleStatus.Published, ArticleStatus.Rejected] },
    { id: 'all', label: 'Barchasi', statuses: [] },
];

// Convert API response to Article type for AuthorArticleReport
const convertToArticleType = (apiArticle: ArticleApiResponse): Article => {
    return {
        id: apiArticle.id,
        title: apiArticle.title,
        abstract: apiArticle.abstract,
        keywords: apiArticle.keywords,
        status: apiArticle.status,
        authorId: apiArticle.author,
        journalId: getArticleJournalId(apiArticle),
        journalName: apiArticle.journal_name,
        submissionDate: apiArticle.submission_date,
        fastTrack: apiArticle.fast_track,
        versions: [],
        analytics: {
            views: apiArticle.views,
            downloads: apiArticle.downloads,
            citations: 0, // Default value since API doesn't provide this
        }
    };
};

const getStatusDisplayData = (status: ArticleStatus | TranslationStatus): { text: string; color: string } => {
    const map: Record<ArticleStatus | TranslationStatus, { text: string; color: string }> = {
        [ArticleStatus.Draft]: { text: 'Qoralama', color: 'bg-gray-500/20 text-slate-600' },
        [ArticleStatus.Yangi]: { text: 'Yangi', color: 'bg-blue-500/20 text-blue-900' },
        [ArticleStatus.WithEditor]: { text: 'Redaktorda', color: 'bg-indigo-500/20 text-indigo-300' },
        [ArticleStatus.QabulQilingan]: { text: 'Qabul Qilingan', color: 'bg-yellow-500/20 text-yellow-900' },
        [ArticleStatus.Revision]: { text: 'Tahrirga qaytarilgan', color: 'bg-orange-500/20 text-orange-900' },
        [ArticleStatus.Accepted]: { text: 'Ma\'qullangan', color: 'bg-teal-500/20 text-teal-900' },
        [ArticleStatus.Published]: { text: 'Nashr etilgan', color: 'bg-green-500/20 text-emerald-900' },
        [ArticleStatus.Rejected]: { text: 'Rad etilgan', color: 'bg-red-500/20 text-red-800' },
        [ArticleStatus.PlagiarismReview]: { text: 'Antiplagiat ko\'rib chiqish', color: 'bg-amber-500/20 text-amber-900' },
        [ArticleStatus.NashrgaYuborilgan]: { text: 'Nashrga Yuborilgan', color: 'bg-purple-500/20 text-purple-900' },
        [ArticleStatus.WritingInProgress]: { text: 'Yozilmoqda', color: 'bg-cyan-500/20 text-cyan-900' },
        [ArticleStatus.ContractProcessing]: { text: 'Shartnoma rasmiylashtirilmoqda', color: 'bg-amber-500/20 text-amber-900' },
        [ArticleStatus.IsbnProcessing]: { text: 'ISBN olinmoqda', color: 'bg-amber-500/20 text-amber-900' },
        [ArticleStatus.AuthorDataVerified]: { text: 'Muallif ma\'lumotlari tasdiqlandi', color: 'bg-teal-500/20 text-teal-900' },
        [ArticleStatus.PaymentCompleted]: { text: 'To\'lov yakunlandi', color: 'bg-green-500/20 text-emerald-900' },
        [TranslationStatus.Jarayonda]: { text: 'Jarayonda', color: 'bg-yellow-500/20 text-yellow-900' },
        [TranslationStatus.Bajarildi]: { text: 'Bajarildi', color: 'bg-green-500/20 text-emerald-900' },
        [TranslationStatus.BekorQilindi]: { text: 'Bekor Qilindi', color: 'bg-red-500/20 text-red-800' },
    };
    const entry = map[status as ArticleStatus | TranslationStatus];
    if (entry) return entry;
    const label = ARTICLE_STATUS_LABELS[status as string] || (status as string);
    return { text: label, color: 'bg-gray-500/20 text-slate-600' };
};

const ArticleItem: React.FC<{ article: ArticleApiResponse, isAdmin?: boolean, isJournalAdmin?: boolean, userId?: string, journalIds?: string[], onStatusUpdate?: () => void }> = ({ 
    article, 
    isAdmin = false, 
    isJournalAdmin = false, 
    userId, 
    journalIds,
    onStatusUpdate
}) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(article.status);
    const [isUpdating, setIsUpdating] = useState(false);
    const statusData = getStatusDisplayData(currentStatus);

    // Determine if user can update status
    const canUpdateStatus = isAdmin || (isJournalAdmin && journalIds && journalIds.includes(article.journal));
    const isAuthor = (userId || user?.id) === article.author;
    const isAuthorRole =
        user?.role === Role.Author || String(user?.role ?? '').toLowerCase() === 'author';
    const authorWorkflowSteps = isAuthor && isAuthorRole ? getAuthorWorkflowStepsFromStatus(currentStatus) : [];
    const authorStageHint = isAuthor && isAuthorRole ? getAuthorWorkflowStageLabel(currentStatus) : '';
    const viewerRoleNorm =
        typeof user?.role === 'string' ? user.role.toLowerCase() : String(user?.role ?? '');
    const showPlagiarismBadges =
        viewerRoleNorm === 'journal_admin' || viewerRoleNorm === 'super_admin';

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        const base = window.location.origin + (window.location.pathname || '/');
        const shareUrl = (base.endsWith('/') ? base : base + '/') + '#/public/article/' + article.id;
        navigator.clipboard.writeText(shareUrl).then(() => {
            toast.success('Share havolasi nusxalandi. Havolani istalgan kishiga yuboring — unda jurnal linki va sertifikat ko‘rinadi.');
        }).catch(() => {
            toast.error('Havolani nusxalashda xatolik.');
        });
    };

    const handleStatusUpdate = async (newStatus: ArticleStatus) => {
        if (!canUpdateStatus) return;
        
        try {
            setIsUpdating(true);
            console.log('Updating status to:', newStatus); // Debug log
            console.log('Sending status update request with status:', newStatus, 'type:', typeof newStatus);
            
            // Validate that newStatus is not null/undefined
            if (!newStatus) {
                console.error('Status is null or undefined, cannot update');
                return;
            }
            
            // Ensure the status is properly formatted as a string
            const statusString = String(newStatus);
            console.log('Formatted status string:', statusString);
            
            await apiService.articles.updateStatus(article.id, statusString);
            console.log('Status update request completed');
            setCurrentStatus(newStatus);
            setIsStatusDropdownOpen(false);
            if (onStatusUpdate) {
                onStatusUpdate();
            }
        } catch (error) {
            console.error('Failed to update article status:', error);
            // Show error message to user
        } finally {
            setIsUpdating(false);
        }
    };

    // Define available status options based on current status
    const getAvailableStatusOptions = () => {
        // Common statuses that can be changed to
        const allStatuses = [
            ArticleStatus.Draft,
            ArticleStatus.Yangi,
            ArticleStatus.WithEditor,
            ArticleStatus.QabulQilingan,
            ArticleStatus.Revision,
            ArticleStatus.Accepted,
            ArticleStatus.Published,
            ArticleStatus.Rejected,
            ArticleStatus.NashrgaYuborilgan,
            ArticleStatus.WritingInProgress
        ];
        

        
        // Filter based on user role or other logic if needed
        return allStatuses;
    };

    const pendingTxId = article.pending_payment_transaction_id;

    return (
        <div 
            className="p-4 sm:p-5 bg-slate-100/70 rounded-xl hover:bg-white/10 transition-all duration-200 cursor-pointer border border-transparent hover:border-slate-200/90"
            onClick={() => navigate(`/articles/${article.id}`)}
        >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4">
                <h4 className="text-base sm:text-lg font-semibold text-blue-800 leading-snug">{article.title}</h4>
                <div className="flex items-center gap-2 shrink-0">
                    {article.fast_track && (
                        <span className="text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap bg-yellow-500/20 text-yellow-900 flex items-center gap-1.5">
                            <Rocket size={14} /> TOP
                        </span>
                    )}
                    <div className="relative">
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${statusData.color}`}>
                                {statusData.text}
                            </span>
                            {isAuthor && currentStatus === ArticleStatus.Published && (
                                <button
                                    onClick={handleShare}
                                    className="p-1.5 rounded-lg bg-green-600/20 text-emerald-800 hover:bg-green-500/30 transition-colors"
                                    title="Share — jurnal linki va sertifikat havolasini ulashish"
                                >
                                    <Share2 size={16} />
                                </button>
                            )}
                            {canUpdateStatus && (
                                <div className="relative">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsStatusDropdownOpen(!isStatusDropdownOpen);
                                        }}
                                        className="text-xs bg-slate-100/90 hover:bg-gray-600 rounded-full p-1.5 transition-colors"
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                    
                                    {isStatusDropdownOpen && (
                                        <div className="absolute right-0 mt-1 w-48 bg-white/50 border border-slate-200 rounded-lg shadow-lg z-10">
                                            <div className="py-1 max-h-60 overflow-y-auto">
                                                {getAvailableStatusOptions().map((status) => (
                                                    <button
                                                        key={status}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            console.log('Status button clicked with status:', status);
                                                            handleStatusUpdate(status);
                                                        }}
                                                        disabled={isUpdating}
                                                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                                            currentStatus === status 
                                                                ? 'bg-blue-600/30 text-blue-900' 
                                                                : 'text-slate-600 hover:bg-slate-100/80'
                                                        }`}
                                                    >
                                                        <Check size={14} className={currentStatus === status ? 'opacity-100' : 'opacity-0'} />
                                                        {getStatusDisplayData(status).text}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <p className="text-sm text-slate-500 mt-2 line-clamp-2">{article.abstract}</p>
            {isAuthor && currentStatus === ArticleStatus.Draft && pendingTxId && (
                <div
                    className="mt-3 p-3 rounded-lg bg-amber-500/15 border border-amber-500/30"
                    onClick={(e) => e.stopPropagation()}
                >
                    <p className="text-sm text-amber-950 mb-2">
                        To&apos;lov kutilmoqda — jurnalga yuborish uchun to&apos;lovni tugating.
                    </p>
                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={(e) => {
                            e.stopPropagation();
                            paymentService.redirectToPaymentPage(pendingTxId);
                        }}
                    >
                        To&apos;lovni tugatish
                    </Button>
                </div>
            )}
            {authorWorkflowSteps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200/90" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs text-slate-500 mb-2">Jarayon: <span className="text-blue-900">{authorStageHint}</span></p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
                        {authorWorkflowSteps.map((step, i) => (
                            <div key={step.name} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                <span
                                    title={step.name}
                                    className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md truncate max-w-[72px] sm:max-w-none ${
                                        step.done
                                            ? 'bg-emerald-500/20 text-emerald-900'
                                            : step.current
                                              ? 'bg-blue-500/25 text-blue-200 ring-1 ring-blue-400/50'
                                              : 'bg-slate-100/70 text-slate-500'
                                    }`}
                                >
                                    {step.name}
                                </span>
                                {i < authorWorkflowSteps.length - 1 && (
                                    <span className="text-gray-600 hidden sm:inline" aria-hidden>
                                        →
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">Batafsil bosqichlar uchun maqolani oching.</p>
                </div>
            )}
            {/* Antiplagiat foizlari faqat jurnal admin va super admin uchun (muallifda ko'rinmasin) */}
            {showPlagiarismBadges && (
                <div className="mt-3">
                    <PlagiarismBadges
                        plagiarism={Number(article.plagiarism_percentage ?? 0)}
                        ai={Number(article.ai_content_percentage ?? 0)}
                        checkedAt={article.plagiarism_checked_at || null}
                    />
                </div>
            )}
            <div className="flex flex-wrap justify-between items-center mt-4 text-xs text-slate-500 gap-1">
                <span className="truncate max-w-[60%]">{article.author_name || 'Noma\'lum muallif'}</span>
                <span>{new Date(article.submission_date).toLocaleDateString()}</span>
            </div>
        </div>
    );
}

const TranslationItem: React.FC<{ request: TranslationRequestApiResponse }> = ({ request }) => {
    const navigate = useNavigate();
    const statusData = getStatusDisplayData(request.status);
    const costNum = Number(request.cost ?? 0);
    const paid = costNum <= 0 || request.payment_completed === true;
    const unpaidKnown = costNum > 0 && request.payment_completed === false;
    const paymentHint =
        request.payment_status_label ||
        (paid
            ? costNum <= 0
                ? 'To\'lov talab qilinmaydi (0 so\'m)'
                : 'To\'lov tasdiqlangan'
            : unpaidKnown
              ? 'To\'lov qilinmagan yoki kutilmoqda'
              : 'To\'lov holati — batafsil uchun oching');

    return (
        <div 
            className="p-4 sm:p-5 bg-slate-100/70 rounded-xl hover:bg-white/10 transition-all duration-200 cursor-pointer border border-transparent hover:border-slate-200/90"
            onClick={() => navigate(`/translations/${request.id}`)}
        >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4">
                <h4 className="text-base sm:text-lg font-semibold text-indigo-400 flex items-center gap-2 min-w-0"><Languages size={18} className="shrink-0"/> <span className="truncate">{request.title}</span></h4>
                <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${statusData.color}`}>
                    {statusData.text}
                </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        paid
                            ? 'bg-emerald-500/15 text-emerald-900'
                            : unpaidKnown
                              ? 'bg-amber-500/25 text-amber-950'
                              : 'bg-slate-200/90 text-slate-800'
                    }`}
                    title={paymentHint}
                >
                    {paid ? 'To\'lov: OK' : unpaidKnown ? 'To\'lov: yo\'q' : 'To\'lov: ?'}
                </span>
                <span className="text-xs text-slate-600 truncate max-w-full">{paymentHint}</span>
            </div>
            <div className="flex justify-between items-end mt-4">
                <div>
                     <p className="text-sm text-slate-500 mt-2">
                        {request.source_language?.toUpperCase() || 'Noma\'lum'} <ArrowRight size={14} className="inline-block mx-1"/> {request.target_language?.toUpperCase() || 'Noma\'lum'}
                    </p>
                    <div className="text-xs text-slate-500 mt-2">
                        <span>Muallif: {request.author_name || 'Noma\'lum'}</span>
                        <span className="mx-2">|</span>
                        <span>Sana: {new Date(request.submission_date).toLocaleDateString()}</span>
                    </div>
                </div>
                 <span className="text-sm font-semibold text-emerald-800">{request.cost?.toLocaleString() || 0} so'm</span>
            </div>
        </div>
    );
};

const Articles: React.FC = () => {
    const { user } = useAuth();
    // Handle both string and enum role values
    const userRole = typeof user?.role === 'string' ? user.role.toLowerCase() : user?.role;
    const isJournalAdmin = userRole === Role.JournalAdmin || userRole === 'journal_admin' || userRole === 'journaladmin';
    /** API / JWT ba'zan role qiymatini boshqacha yuborishi mumkin */
    const isSuperAdminUser =
        userRole === Role.SuperAdmin ||
        userRole === 'super_admin' ||
        userRole === 'superadmin';
    /** API ba'zan role ni boshqa registrda yuborishi mumkin; switch(user.role) bo'sh ro'yxat qaytardi */
    const isReviewer = userRole === 'reviewer' || user?.role === Role.Reviewer;
    const isOperator = userRole === 'operator' || user?.role === Role.Operator;

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState(() => {
        if (isReviewer) return 'reviews';
        if (isJournalAdmin || isSuperAdminUser || isOperator) return 'new';
        return 'all';
    });
    const [showReportModal, setShowReportModal] = useState(false);
    const [showNashrHisobotModal, setShowNashrHisobotModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [filterJournal, setFilterJournal] = useState('');
    const [filterPlagiarism, setFilterPlagiarism] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [searchParams] = useSearchParams();
    const [articles, setArticles] = useState<ArticleApiResponse[]>([]);
    const [translations, setTranslations] = useState<TranslationRequestApiResponse[]>([]);
    const [journals, setJournals] = useState<JournalApiResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hasActiveFilters = !!(filterJournal || filterPlagiarism || filterDateFrom || filterDateTo);
    const clearFilters = () => { setFilterJournal(''); setFilterPlagiarism(''); setFilterDateFrom(''); setFilterDateTo(''); };

    // Different tabs for different roles
    // FIX: Explicitly type the array to allow a union of statuses and avoid type errors.
    const reviewerTabs: { id: string; label: string; statuses: (ArticleStatus | TranslationStatus)[] }[] = [
        { id: 'reviews', label: 'Maqola Taqrizlari', statuses: [ArticleStatus.QabulQilingan] },
        { id: 'translations', label: 'Tarjimalar', statuses: [TranslationStatus.Yangi, TranslationStatus.Jarayonda] },
        { id: 'book-orders', label: 'Kitob nashr', statuses: [ArticleStatus.QabulQilingan, ArticleStatus.Yangi, ArticleStatus.ContractProcessing] },
    ];
    const journalAdminTabs = journalAdminTabsBase;

    let title = "Maqolalar";
    switch (userRole) {
        case Role.Author: 
        case 'author': 
            title = "Mening Maqolalarim"; 
            break;
        case Role.Reviewer: 
        case 'reviewer': 
            title = "Ish Stoli"; 
            break;
        case Role.JournalAdmin: 
        case 'journal_admin': 
        case 'journaladmin': 
            title = "Jurnal Maqolalari"; 
            break;
        case Role.SuperAdmin: 
        case 'super_admin': 
        case 'superadmin': 
            title = "Tizimdagi Barcha Maqolalar"; 
            break;
        case Role.Operator:
        case 'operator':
            title = 'Maqolalar (muallif chatlari uchun)';
            break;
    }
    
    const articlesToShow: ArticleApiResponse[] = useMemo(() => {
        if (isJournalAdmin) {
            /** GET /articles/ allaqachon journal_admin uchun journal__journal_admin bilan cheklangan.
             * Jurnal ro'yxati esa paginatsiyali (/journals/journals/ default ~20 ta) — journal ID bilan qayta
             * filtrlash maqolani yo'qotishi mumkin; shuning uchun faqat tab bo'yicha status filtri. */
            const selectedTab = journalAdminTabs.find(t => t.id === activeTab);
            if (!selectedTab) return [];
            return articles.filter(a => {
                const statusMatch =
                    selectedTab.id === 'all' ||
                    !!(selectedTab.statuses && selectedTab.statuses.includes(a.status as ArticleStatus));
                return statusMatch;
            }).sort((a, b) => (b.fast_track ? 1 : 0) - (a.fast_track ? 1 : 0));
        }
        if (isSuperAdminUser) {
            const selectedTab = journalAdminTabs.find(t => t.id === activeTab);
            if (!selectedTab) return articles;
            return articles.filter(a => selectedTab.id === 'all' || (selectedTab.statuses && selectedTab.statuses.includes(a.status as ArticleStatus)))
                .sort((a, b) => (b.fast_track ? 1 : 0) - (a.fast_track ? 1 : 0));
        }
        if (isOperator) {
            const selectedTab = journalAdminTabs.find(t => t.id === activeTab);
            if (!selectedTab) return articles;
            return articles
                .filter(a => selectedTab.id === 'all' || (selectedTab.statuses && selectedTab.statuses.includes(a.status as ArticleStatus)))
                .sort((a, b) => (b.fast_track ? 1 : 0) - (a.fast_track ? 1 : 0));
        }
        if (userRole === Role.Author || userRole === 'author') {
            const selectedTab = authorArticleTabs.find(t => t.id === activeTab);
            if (!selectedTab) return articles;
            const list =
                selectedTab.id === 'all'
                    ? articles
                    : articles.filter(a => selectedTab.statuses.includes(a.status as ArticleStatus));
            return list.sort((a, b) => (b.fast_track ? 1 : 0) - (a.fast_track ? 1 : 0));
        }
        if (isReviewer) {
            if (activeTab === 'translations') {
                return [];
            }
            if (activeTab === 'book-orders') {
                return articles
                    .filter((a) => (a.title || '').trim().toUpperCase().startsWith('[KITOB]'))
                    .sort((a, b) => (b.fast_track ? 1 : 0) - (a.fast_track ? 1 : 0));
            }
            if (activeTab === 'reviews') {
                return articles
                    .filter(
                        (a) =>
                            a.status === ArticleStatus.QabulQilingan &&
                            !(a.title || '').trim().toUpperCase().startsWith('[KITOB]')
                    )
                    .sort((a, b) => (b.fast_track ? 1 : 0) - (a.fast_track ? 1 : 0));
            }
            return [];
        }
        return [];
    }, [user, userRole, activeTab, articles, isJournalAdmin, isReviewer, isOperator, isSuperAdminUser]);

    const translationsToShow: TranslationRequestApiResponse[] = useMemo(() => {
        if (!isReviewer || activeTab !== 'translations') return [];
        return translations.filter((tr) => {
            if (tr.status === TranslationStatus.Yangi) return true;
            if (tr.status === TranslationStatus.Jarayonda) {
                if (!tr.reviewer) return true;
                return String(tr.reviewer) === String(user?.id);
            }
            return false;
        });
    }, [user, activeTab, translations, isReviewer]);

    const filteredTranslations = useMemo(() => {
        if (!searchQuery) return translationsToShow;
        const lowercasedQuery = searchQuery.toLowerCase();
        return translationsToShow.filter(req =>
            req.title.toLowerCase().includes(lowercasedQuery)
        );
    }, [searchQuery, translationsToShow]);

    const filteredArticles = useMemo(() => {
        let result = articlesToShow;

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(a =>
                a.title.toLowerCase().includes(q) ||
                (a.keywords && a.keywords.join(' ').toLowerCase().includes(q)) ||
                (a.author_name && a.author_name.toLowerCase().includes(q))
            );
        }

        if (filterJournal) {
            result = result.filter(a => getArticleJournalId(a) === filterJournal);
        }

        if (filterPlagiarism) {
            result = result.filter(a => {
                const p = Number(a.plagiarism_percentage ?? 0);
                if (filterPlagiarism === 'low') return p < 20;
                if (filterPlagiarism === 'medium') return p >= 20 && p < 50;
                if (filterPlagiarism === 'high') return p >= 50;
                return true;
            });
        }

        if (filterDateFrom) {
            const from = new Date(filterDateFrom);
            result = result.filter(a => new Date(a.submission_date) >= from);
        }
        if (filterDateTo) {
            const to = new Date(filterDateTo);
            to.setHours(23, 59, 59);
            result = result.filter(a => new Date(a.submission_date) <= to);
        }

        return result;
    }, [searchQuery, articlesToShow, filterJournal, filterPlagiarism, filterDateFrom, filterDateTo]);

    // Calculate tab counts using useMemo to ensure hooks are always called
    const reviewerTabCounts = useMemo(() => {
        return reviewerTabs.map(tab => {
            let count = 0;
            if (tab.id === 'translations') {
                count = translations.filter((tr) => {
                    if (tr.status === TranslationStatus.Yangi) return true;
                    if (tr.status === TranslationStatus.Jarayonda) {
                        if (!tr.reviewer) return true;
                        return String(tr.reviewer) === String(user.id);
                    }
                    return false;
                }).length;
            } else if (tab.id === 'book-orders') {
                count = articles.filter((a) =>
                    (a.title || '').trim().toUpperCase().startsWith('[KITOB]')
                ).length;
            } else if (tab.id === 'reviews') {
                count = articles.filter(
                    (a) =>
                        a.status === ArticleStatus.QabulQilingan &&
                        !(a.title || '').trim().toUpperCase().startsWith('[KITOB]')
                ).length;
            } else if (tab.statuses) {
                count = articles.filter((a) =>
                    (tab.statuses as ArticleStatus[]).includes(a.status as ArticleStatus)
                ).length;
            }
            return { id: tab.id, count };
        });
    }, [articles, translations, reviewerTabs, user?.id]);

    const articlesForJournalFilter = useMemo(() => {
        if (!filterJournal) return articles;
        return articles.filter((a) => getArticleJournalId(a) === filterJournal);
    }, [articles, filterJournal]);

    const journalAdminTabCounts = useMemo(() => {
        const source = isJournalAdmin ? articlesForJournalFilter : articles;
        return journalAdminTabs.map(tab => {
            let count = 0;
            if (tab.statuses !== undefined) {
                count = source.filter(a => {
                    const statusMatch = tab.id === 'all' || (tab.statuses as ArticleStatus[]).includes(a.status);
                    return statusMatch;
                }).length;
            }
            return { id: tab.id, count };
        });
    }, [articles, articlesForJournalFilter, journalAdminTabs, isJournalAdmin]);

    const superAdminTabCounts = useMemo(() => {
        return journalAdminTabs.map(tab => {
            const count = tab.id === 'all'
                ? articles.length
                : articles.filter(a => tab.statuses && (tab.statuses as ArticleStatus[]).includes(a.status)).length;
            return { id: tab.id, count };
        });
    }, [articles, journalAdminTabs]);

    const authorTabCounts = useMemo(() => {
        return authorArticleTabs.map(tab => {
            const count =
                tab.id === 'all'
                    ? articles.length
                    : articles.filter(a => tab.statuses.includes(a.status as ArticleStatus)).length;
            return { id: tab.id, count };
        });
    }, [articles]);

    const isAuthorUser = userRole === Role.Author || userRole === 'author';
    /** Rol bo'yicha to'liq ro'yxat (staff / mine / paginatsiyali list) */
    const fetchAllArticlesPages = useCallback(async (): Promise<ArticleApiResponse[]> => {
        const raw = await apiService.articles.listAllForRole(String(userRole || user?.role || ''));
        return (Array.isArray(raw) ? raw : []) as ArticleApiResponse[];
    }, [userRole, user?.role]);

    /** Jurnal dropdown / guruhlash uchun: default API ~20 ta qaytaradi — barcha sahifalar yig'iladi */
    const fetchAllJournalsPages = useCallback(async (): Promise<JournalApiResponse[]> => {
        const pageSize = 200;
        const merged: JournalApiResponse[] = [];
        let page = 1;
        while (page <= 40) {
            const raw = await apiService.journals.list({ pageSize, page });
            const batch = Array.isArray(raw)
                ? raw
                : Array.isArray((raw as { results?: JournalApiResponse[] })?.results)
                  ? (raw as { results: JournalApiResponse[] }).results
                  : [];
            merged.push(...batch);
            const nextUrl = !Array.isArray(raw) ? (raw as { next?: string | null })?.next : null;
            if (!nextUrl || batch.length === 0 || batch.length < pageSize) {
                break;
            }
            page += 1;
        }
        return merged;
    }, []);

    const fetchData = useCallback(async () => {
        if (!user) return;
        
        try {
            setLoading(true);
            setError(null);
            
            const [articlesArrayFlat, translationsData, journalsMerged] = await Promise.all([
                fetchAllArticlesPages(),
                apiService.translations.list(),
                fetchAllJournalsPages(),
            ]);
            
            let articlesArray = articlesArrayFlat;
            
            const translationsArray = Array.isArray(translationsData) 
                ? translationsData 
                : (translationsData?.data && Array.isArray(translationsData.data) 
                    ? translationsData.data 
                    : (translationsData?.results && Array.isArray(translationsData.results) 
                        ? translationsData.results 
                        : []));
            
            setArticles(articlesArray);
            setTranslations(translationsArray);
            setJournals(journalsMerged);
        } catch (error: any) {
            setError(error?.message || 'Maqolalar ma\'lumotlarini yuklashda xatolik. Iltimos, keyinroq urinib ko\'ring.');
        } finally {
            setLoading(false);
        }
    }, [user, fetchAllArticlesPages, fetchAllJournalsPages]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const jid = searchParams.get('journal');
        if (jid) setFilterJournal(jid);
        const tab = searchParams.get('tab');
        if (tab) {
            if (authorArticleTabs.some((t) => t.id === tab)) {
                setActiveTab(tab);
            } else if (reviewerTabs.some((t) => t.id === tab)) {
                setActiveTab(tab);
            }
        }
    }, [searchParams]);

    useEffect(() => {
        if (!user) return;
        const onFocus = () => {
            void fetchData();
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [user, fetchData]);

    // Handle early returns after all hooks are declared
    if (!user) return null;
    
    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }
    
    if (error) {
        return (
            <Card title="Xatolik">
                <p className="text-red-700">{error}</p>
                <Button onClick={() => { setError(null); fetchData(); }} className="mt-4">Qayta urinish</Button>
            </Card>
        );
    }

    const renderTabs = (tabs: {id: string, label: string, statuses?: (ArticleStatus | TranslationStatus)[]}[], tabCounts: {id: string, count: number}[]) => {
        return (
             <div className="mb-6 border-b border-slate-200/90 flex">
                {tabs.map(tab => {
                    const tabCount = tabCounts.find(tc => tc.id === tab.id)?.count || 0;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 font-medium text-sm transition-colors ${
                                activeTab === tab.id
                                    ? 'border-b-2 border-blue-400 text-blue-800'
                                    : 'text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            {tab.label} <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-blue-500/20 text-blue-900' : 'bg-white/10 text-slate-600'}`}>{tabCount}</span>
                        </button>
                    )
                })}
            </div>
        )
    }
    
    const handlePrintReport = () => {
        window.print();
    };

    const renderContent = () => {
        if (isReviewer && activeTab === 'translations') {
            return (
                <div className="space-y-4">
                    {filteredTranslations.length > 0 ? (
                        filteredTranslations.map(req => <TranslationItem key={req.id} request={req} />)
                    ) : (
                        <p className="text-center text-slate-500 py-8">
                            {searchQuery 
                                ? `"${searchQuery}" bo'yicha hech narsa topilmadi.` 
                                : 'Yangi tarjima so\'rovlari mavjud emas.'}
                        </p>
                    )}
                </div>
            );
        }

        // Determine if user is super admin or journal admin
        const isAdmin = isSuperAdminUser;
        const isJournalAdmin = userRole === Role.JournalAdmin || userRole === 'journal_admin' || userRole === 'journaladmin';
        
        // Get the journal IDs for journal admins
        let journalAdminIds = [];
        if (isJournalAdmin) {
            const userId = user.id || (user as any).userId || (user as any).user_id;
            const managedJournals = journals.filter(j => {
                const journalAdminId = j.journal_admin || j.journalAdminId || j.journalAdmin || j.admin_id || (j.admin && j.admin.id);
                return journalAdminId === userId;
            });
            journalAdminIds = managedJournals.map(j => j.id);
        }

        const renderArticleList = (list: ArticleApiResponse[]) => (
            list.map(article => (
                <ArticleItem
                    key={article.id}
                    article={article}
                    isAdmin={isAdmin}
                    isJournalAdmin={isJournalAdmin}
                    userId={user.id}
                    journalIds={journalAdminIds}
                    onStatusUpdate={fetchData}
                />
            ))
        );

        if (filteredArticles.length === 0) {
            return (
                <div className="space-y-4">
                    <p className="text-center text-slate-500 py-8">
                        {searchQuery
                            ? `"${searchQuery}" bo'yicha hech narsa topilmadi.`
                            : "Ushbu bo'limda hozircha maqolalar mavjud emas."}
                    </p>
                </div>
            );
        }

        if (isJournalAdmin && journals.length > 1 && !filterJournal) {
            const byJournal: Record<string, ArticleApiResponse[]> = {};
            filteredArticles.forEach(a => {
                const jId = getArticleJournalId(a);
                if (!byJournal[jId]) byJournal[jId] = [];
                byJournal[jId].push(a);
            });
            const journalOrder = journals.slice();
            return (
                <div className="space-y-6">
                    {journalOrder.filter(j => byJournal[j.id]?.length).map(journal => (
                        <div key={journal.id}>
                            <h3 className="text-lg font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-200/90">
                                {journal.name}
                            </h3>
                            <div className="space-y-4">
                                {renderArticleList(byJournal[journal.id])}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {renderArticleList(filteredArticles)}
            </div>
        );
    }

    return (
        <>
            <Card title={title}>
                {user.role === Role.Author && (
                    <div className="mb-6 flex flex-wrap gap-2 justify-end">
                        <Button onClick={() => setShowReportModal(true)} variant="secondary">
                            <FileText className="mr-2 h-4 w-4" /> Barcha maqolalar bo'yicha ma'lumotnoma
                        </Button>
                        <Button onClick={() => setShowNashrHisobotModal(true)} variant="primary">
                            <BookOpen className="mr-2 h-4 w-4" /> Nashri haqida hisobot
                        </Button>
                    </div>
                )}
                {isReviewer && renderTabs(reviewerTabs, reviewerTabCounts)}
                {(userRole === Role.Author || userRole === 'author') && renderTabs(authorArticleTabs, authorTabCounts)}
                {isJournalAdmin && renderTabs(journalAdminTabs, journalAdminTabCounts)}
                {isSuperAdminUser && renderTabs(journalAdminTabs, superAdminTabCounts)}
                {isOperator && renderTabs(journalAdminTabs, superAdminTabCounts)}

                {/* Jurnal admin bir nechta jurnalda: jurnal bo'yicha filtrlash (alohida-alohida) */}
                {isJournalAdmin && journals.length > 1 && (
                    <div className="mb-4">
                        <label className="text-xs text-slate-500 mb-2 block">Jurnal bo'yicha</label>
                        <select
                            value={filterJournal}
                            onChange={(e) => setFilterJournal(e.target.value)}
                            className="w-full sm:w-auto min-w-[200px] bg-white/50 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Barcha jurnallar</option>
                            {journals.map((j) => (
                                <option key={j.id} value={j.id}>{j.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 flex items-center bg-slate-100/70 border border-slate-200/90 rounded-xl focus-within:border-accent-color focus-within:ring-2 focus-within:ring-accent-color-glow transition-all">
                        <Search className="text-slate-500 mx-4 shrink-0" size={20} />
                        <input
                            type="text"
                            placeholder="Sarlavha, muallif yoki kalit so'z bo'yicha qidirish..."
                            className="w-full !bg-transparent !border-none !py-3 !pr-4 !pl-0 !shadow-none !ring-0"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-3 rounded-xl border transition-all ${hasActiveFilters ? 'bg-blue-500/20 border-blue-500/40 text-blue-900' : 'bg-slate-100/70 border-slate-200/90 text-slate-500 hover:text-white'}`}
                    >
                        <Filter size={20} />
                    </button>
                    {hasActiveFilters && (
                        <button onClick={clearFilters} className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 hover:text-red-800 transition-all">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {showFilters && (
                    <div className="mb-6 p-4 bg-slate-100/70 border border-slate-200/90 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Jurnal</label>
                            <select value={filterJournal} onChange={(e) => setFilterJournal(e.target.value)} className="w-full bg-white/50 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900">
                                <option value="">Barchasi</option>
                                {journals.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Plagiat darajasi</label>
                            <select value={filterPlagiarism} onChange={(e) => setFilterPlagiarism(e.target.value)} className="w-full bg-white/50 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900">
                                <option value="">Barchasi</option>
                                <option value="low">Past (&lt;20%)</option>
                                <option value="medium">O'rtacha (20-50%)</option>
                                <option value="high">Yuqori (&gt;50%)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Sanadan</label>
                            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full bg-white/50 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Sanagacha</label>
                            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full bg-white/50 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900" />
                        </div>
                    </div>
                )}

                {hasActiveFilters && (
                    <p className="text-xs text-slate-500 mb-4">Natijalar: {filteredArticles.length} ta maqola topildi</p>
                )}

                {renderContent()}
            </Card>

            {showReportModal && user && (
                <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex justify-center items-center p-4 no-print">
                    <div className="w-full max-w-4xl h-[90vh] bg-white/50 rounded-lg shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-200/90 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-slate-900">Maqolalar bo'yicha ma'lumotnoma</h3>
                            <div className="flex gap-2">
                                <Button onClick={handlePrintReport} variant="primary">
                                    <Printer className="mr-2 h-4 w-4"/> Chop Etish
                                </Button>
                                <Button onClick={() => setShowReportModal(false)} variant="secondary">
                                    Yopish
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div id="author-report-print-area">
                                <AuthorArticleReport articles={articles.map(convertToArticleType)} author={user as User} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showNashrHisobotModal && user && (() => {
                // Faqat nashr etilgan maqolalarni olamiz (muallifda tab filtri emas — barcha nashrlar)
                const publishedArticles = articles.filter(a => a.status === ArticleStatus.Published);
                
                const nashrHisobotData: NashrHisobotData = {
                    documentNumber: `HSB-${Date.now().toString(36).toUpperCase()}`,
                    documentDate: new Date().toLocaleDateString('uz-UZ'),
                    authorFullName: `${user.lastName || ''} ${user.firstName || ''}`.trim() || user.email,
                    authorWorkplace: user.affiliation || "Ko'rsatilmagan",
                    authorPosition: (user as any).degree || (user as any).position || "Muallif",
                    articles: publishedArticles.map((article, index) => ({
                        id: index + 1,
                        title: article.title,
                        publishName: article.journal_name || 'Noma\'lum jurnal',
                        publishDate: article.submission_date ? new Date(article.submission_date).toLocaleDateString('uz-UZ') : undefined,
                        internetLink: `https://ilmiyfaoliyat.uz/public/article/${article.id}`,
                        coAuthors: [] // API dan kelgan bo'lsa qo'shish mumkin
                    }))
                };

                return (
                    <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex justify-center items-center p-4 print:p-0 print:bg-white no-print">
                        <div className="w-full max-w-6xl h-[95vh] bg-white/55 rounded-lg shadow-2xl flex flex-col print:max-w-none print:h-auto print:bg-white print:rounded-none print:shadow-none">
                            <div className="p-4 border-b border-slate-200/90 flex justify-between items-center no-print">
                                <h3 className="text-lg font-semibold text-slate-900">Maqolalar nashri haqida hisobot</h3>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={async () => {
                                            try {
                                                await downloadNashrHisobotDocx(nashrHisobotData);
                                                toast.success('Hisobot .docx fayl sifatida yuklandi');
                                            } catch (e) {
                                                toast.error('Yuklab olishda xatolik');
                                            }
                                        }}
                                        variant="primary"
                                        className="flex items-center gap-2"
                                    >
                                        <FileDown className="h-4 w-4" /> Yuklab olish (.docx)
                                    </Button>
                                    <Button onClick={() => window.print()} variant="primary">
                                        <Printer className="mr-2 h-4 w-4"/> Chop Etish / PDF
                                    </Button>
                                    <Button onClick={() => setShowNashrHisobotModal(false)} variant="secondary">
                                        Yopish
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
                                {publishedArticles.length > 0 ? (
                                    <NashrHisobotCertificate data={nashrHisobotData} />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <BookOpen size={64} className="text-gray-600 mb-4" />
                                        <h4 className="text-xl font-semibold text-slate-900 mb-2">Nashr etilgan maqolalar yo'q</h4>
                                        <p className="text-slate-500 max-w-md">
                                            Sizda hali nashr etilgan maqolalar mavjud emas. 
                                            Maqolangiz nashr etilgandan so'ng bu yerda hisobot yaratishingiz mumkin bo'ladi.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
};

export default Articles;