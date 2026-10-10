/** Maqolalar sahifasi: tablar, holat yorliqlari, API → Article o'girish */
import { Article, ArticleStatus, ARTICLE_STATUS_LABELS, TranslationStatus } from '../../types';
import AuthorArticleReport from '../../components/AuthorArticleReport';
import { ArticleApiResponse, getArticleJournalId } from './types';

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
        statuses: [ArticleStatus.Yangi, ArticleStatus.Draft],
    },
    { id: 'with-editor', label: 'Redaktorda', statuses: [ArticleStatus.WithEditor] },
    { id: 'in-review', label: 'Tekshiruvda', statuses: [ArticleStatus.QabulQilingan] },
    { id: 'plagiarism-review', label: 'Antiplagiat (bosh admin)', statuses: [ArticleStatus.PlagiarismReview] },
    { id: 'ready', label: 'Nashrga Tayyorlar', statuses: [ArticleStatus.NashrgaYuborilgan] },
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
    { id: 'all', label: 'Barchasi', statuses: [] },
];

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
