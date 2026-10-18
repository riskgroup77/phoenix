/** Maqolalar sahifasi: tablar, holat yorliqlari, API → Article o'girish */
import { Article, ArticleStatus, ARTICLE_STATUS_LABELS, TranslationStatus } from '../../types';
import AuthorArticleReport from '../../components/AuthorArticleReport';
import { ArticleApiResponse, getArticleJournalId } from './types';
import { isStandalonePlagiarismArticle } from '../../utils/antiplagiatFromArticle';

/** "Antiplagiat" bandi: jurnaldagi antiplagiat ko'rib chiqish + muallifning mustaqil antiplagiat tekshiruvlari */
export const ANTIPLAGIAT_DOCS_TAB = 'plagiarism';
/** UDK / DOI kabi maqolaga bog'lanmagan xizmat hujjatlari (arxivdan) — "Ishlarim" da ham ko'rinadi */
export const SERVICE_DOCS_TAB = 'service-docs';

export const journalAdminTabsBase = [
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
        statuses: [ArticleStatus.Yangi],
    },
    { id: 'with-editor', label: 'Redaktorda', statuses: [ArticleStatus.WithEditor] },
    { id: 'in-review', label: 'Tekshiruvda', statuses: [ArticleStatus.QabulQilingan] },
    { id: 'plagiarism-review', label: 'Antiplagiat (bosh admin)', statuses: [ArticleStatus.PlagiarismReview] },
    // Qabul qilingan maqola ham nashrga tayyor (sertifikat bilan yakunlanadi) — avval u hech bir tabda yo'q edi
    { id: 'ready', label: 'Nashrga Tayyorlar', statuses: [ArticleStatus.Accepted, ArticleStatus.NashrgaYuborilgan] },
    { id: 'published', label: 'Nashr etilgan', statuses: [ArticleStatus.Published] },
    { id: 'all', label: 'Barcha Maqolalar', statuses: [] },
];

export const authorArticleTabs: { id: string; label: string; statuses: ArticleStatus[] }[] = [
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
    { id: SERVICE_DOCS_TAB, label: 'UDK va DOI hujjatlari', statuses: [] },
    { id: 'all', label: 'Barchasi', statuses: [] },
];

/** Mustaqil antiplagiat hujjati (jurnalga yuborilmagan, faqat tekshiruv uchun) */
export const isAntiplagiatDoc = (a: { antiplagiat_state?: string | null; work_type?: string; title?: string; keywords?: string[] | string; abstract?: string }): boolean =>
    !!a.antiplagiat_state || a.work_type === 'Antiplagiat' || isStandalonePlagiarismArticle(a);

/** "Ishlarim" filtri: holat bo'yicha bandlarda antiplagiat hujjatlari aralashmaydi, ular alohida bandda */
export const matchesAuthorTab = (tab: { id: string; statuses: ArticleStatus[] }, a: ArticleApiResponse): boolean => {
    if (tab.id === 'all') return true;
    const doc = isAntiplagiatDoc(a);
    if (tab.id === ANTIPLAGIAT_DOCS_TAB) return doc || tab.statuses.includes(a.status as ArticleStatus);
    if (tab.id === SERVICE_DOCS_TAB) return false; // bu bandda faqat xizmat hujjatlari (ServiceDocItem)
    return !doc && tab.statuses.includes(a.status as ArticleStatus);
};

/** Antiplagiat hujjati holati yorlig'i */
export const ANTIPLAGIAT_STATE_LABELS: Record<string, { text: string; color: string }> = {
    awaiting_payment: { text: "To'lov kutilmoqda", color: 'bg-gray-500/20 text-slate-600' },
    checking: { text: 'Tekshirilmoqda', color: 'bg-amber-500/20 text-amber-900' },
    failed: { text: 'Tekshiruvda xatolik', color: 'bg-red-500/20 text-red-800' },
    done: { text: 'Tekshirildi', color: 'bg-green-500/20 text-emerald-900' },
};

// Convert API response to Article type for AuthorArticleReport
export const convertToArticleType = (apiArticle: ArticleApiResponse): Article => {
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

export const getStatusDisplayData = (status: ArticleStatus | TranslationStatus): { text: string; color: string } => {
    const map: Record<ArticleStatus | TranslationStatus, { text: string; color: string }> = {
        [ArticleStatus.Draft]: { text: 'Qoralama', color: 'bg-gray-500/20 text-slate-600' },
        [ArticleStatus.Yangi]: { text: 'Yangi', color: 'bg-blue-500/20 text-blue-900' },
        [ArticleStatus.WithEditor]: { text: 'Redaktorda', color: 'bg-[#e5ecff] text-[#233f8c] dark:bg-[rgba(138,166,240,0.16)] dark:text-[#b9cbf7]' },
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

/** Bosh admin / operator: kitob nashri buyurtmalari (filtri sarlavha bo'yicha — Articles.tsx matchesStaffTab) */
export const BOOK_ORDERS_TAB = { id: 'book-orders', label: 'Kitob buyurtmalari', statuses: [] as ArticleStatus[] };
