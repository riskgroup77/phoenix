/** Maqolalar ro'yxatidagi bitta maqola kartasi (holat, to'lov, ulashish, admin amallari) */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArticleStatus, Role } from '../../types';
import { Rocket, ChevronDown, Check, Filter, Share2, FileText, Award, Eye, Clock, CheckCircle2, XCircle, CreditCard, Hourglass } from 'lucide-react';
import Button from '../../components/ui/Button';
import { PlagiarismBadges } from '../../components/PlagiarismReport';
import { getAuthorWorkflowStepsFromStatus, getAuthorWorkflowStageLabel, isBookTitle } from '../../utils/articleAuthorWorkflow';
import { apiService } from '../../services/apiService';
import { paymentService } from '../../services/paymentService';
import { toast } from 'react-toastify';
import { ArticleApiResponse } from './types';
import { getStatusDisplayData, isAntiplagiatDoc, ANTIPLAGIAT_STATE_LABELS } from './helpers';
import { useT } from '../../i18n/LanguageContext';
import { askStatusReason } from '../../utils/statusReason';
import WorksReportModal from '../../components/WorksReportModal';
import { openReferencePdf } from '../../utils/referenceDoc';

/** Bu holatlarda ma'lumotnoma berilmaydi (backend: works_report.ACCEPTANCE_EXCLUDED_STATUSES) */
const NO_DOCUMENT_STATUSES = new Set<string>([ArticleStatus.Draft, ArticleStatus.Rejected]);

const ArticleItem: React.FC<{ article: ArticleApiResponse, isAdmin?: boolean, isJournalAdmin?: boolean, userId?: string, journalIds?: string[], onStatusUpdate?: () => void }> = ({ 
    article, 
    isAdmin = false, 
    isJournalAdmin = false, 
    userId, 
    journalIds,
    onStatusUpdate
}) => {
    const { t, locale } = useT();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(article.status);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showReport, setShowReport] = useState(false);
    /** Mustaqil antiplagiat hujjati: o'z holati, bosilganda — natija / tekshiruv sahifasi */
    const isPlagDoc = isAntiplagiatDoc(article);
    const plagState = article.antiplagiat_state || (currentStatus === ArticleStatus.Draft ? 'awaiting_payment' : 'checking');
    const statusData = isPlagDoc
        ? ANTIPLAGIAT_STATE_LABELS[plagState] || ANTIPLAGIAT_STATE_LABELS.checking
        : getStatusDisplayData(currentStatus);
    const openTarget = isPlagDoc
        ? plagState === 'done'
            ? `/plagiarism-check/result/${article.id}`
            : '/plagiarism-check'
        : `/articles/${article.id}`;

    // Determine if user can update status
    const canUpdateStatus = isAdmin || (isJournalAdmin && journalIds && journalIds.includes(article.journal));
    const isAuthor = (userId || user?.id) === article.author;
    const isAuthorRole =
        user?.role === Role.Author || String(user?.role ?? '').toLowerCase() === 'author';
    const authorWorkflowSteps = isAuthor && isAuthorRole && !isAntiplagiatDoc(article) ? getAuthorWorkflowStepsFromStatus(currentStatus, isBookTitle(article.title)) : [];
    const authorStageHint = isAuthor && isAuthorRole ? getAuthorWorkflowStageLabel(currentStatus, isBookTitle(article.title)) : '';
    const viewerRoleNorm =
        typeof user?.role === 'string' ? user.role.toLowerCase() : String(user?.role ?? '');
    // Kitob buyurtmasi antiplagiatdan o'tmaydi — "Tekshirilmagan" belgisi chalg'itardi
    const canGetDocuments = isAuthor && isAuthorRole && !isPlagDoc && !NO_DOCUMENT_STATUSES.has(String(currentStatus));
    const showPlagiarismBadges =
        (viewerRoleNorm === 'journal_admin' || viewerRoleNorm === 'super_admin') && !isBookTitle(article.title);

    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        const base = window.location.origin + (window.location.pathname || '/');
        const shareUrl = (base.endsWith('/') ? base : base + '/') + '#/public/article/' + article.id;
        navigator.clipboard.writeText(shareUrl).then(() => {
            toast.success(t('Share havolasi nusxalandi. Havolani istalgan kishiga yuboring — unda jurnal linki va sertifikat ko‘rinadi.'));
        }).catch(() => {
            toast.error(t('Havolani nusxalashda xatolik.'));
        });
    };

    const handleStatusUpdate = async (newStatus: ArticleStatus) => {
        if (!canUpdateStatus) return;
        
        if (!newStatus) return;
        // Rad etish / tahrirga qaytarish — sabab muallifga yuboriladi (avval bu menyu sabab so'ramasdi)
        const reason = askStatusReason(String(newStatus));
        if (reason === null) return;
        try {
            setIsUpdating(true);
            const res: any = await apiService.articles.updateStatus(article.id, String(newStatus), reason);
            // Server antiplagiat chegarasiga qarab boshqa holat qo'yishi mumkin (Rad etilgan / bosh admin qarori)
            setCurrentStatus((res?.new_status as ArticleStatus) || newStatus);
            setIsStatusDropdownOpen(false);
            if (onStatusUpdate) {
                onStatusUpdate();
            }
        } catch (error: any) {
            toast.error(error?.message || "Holatni o'zgartirib bo'lmadi.");
        } finally {
            setIsUpdating(false);
        }
    };

    // Faqat backend ruxsat bergan o'tishlar (apps/articles/workflow.py). Avval barcha holatlar ko'rsatilardi —
    // to'lanmagan qoralamani "Nashr etilgan" qilish mumkin edi. "Nashr etilgan" — faqat sertifikat bilan.
    const getAvailableStatusOptions = (): ArticleStatus[] =>
        (article.allowed_transitions ?? []).filter((s) => s !== ArticleStatus.Published) as ArticleStatus[];

    const pendingTxId = article.pending_payment_transaction_id;
    const [isPaying, setIsPaying] = useState(false);

    /**
     * Kutilayotgan to'lov bo'lsa — o'sha (Click); bo'lmasa (avvalgisi bekor qilingan / xato) — yangi nashr to'lovi.
     * Summani server hisoblaydi (jurnal narxi × fayldan aniqlangan sahifalar soni).
     */
    const startPublicationPayment = async () => {
        setIsPaying(true);
        try {
            if (pendingTxId) {
                await paymentService.redirectToPaymentPage(pendingTxId);
                return;
            }
            const result = await paymentService.createTransactionAndPay(0, 'UZS', 'publication_fee', article.id);
            if (result?.transaction_id) {
                await paymentService.redirectToPaymentPage(result.transaction_id);
                return;
            }
            toast.error(result?.error || "To'lovni boshlab bo'lmadi.");
        } catch (err: any) {
            toast.error(err?.message || "To'lovni boshlab bo'lmadi.");
        } finally {
            setIsPaying(false);
        }
    };

    // Holat tonusi va ikonkasi ("Ishlarim" kartasi — UDK so'rovlari kartasi uslubida)
    const tone: 'done' | 'bad' | 'pay' | 'progress' = isPlagDoc
        ? plagState === 'done' ? 'done' : plagState === 'failed' ? 'bad' : plagState === 'awaiting_payment' ? 'pay' : 'progress'
        : [ArticleStatus.Published, ArticleStatus.Accepted].includes(currentStatus as ArticleStatus) ? 'done'
            : currentStatus === ArticleStatus.Rejected ? 'bad'
                : currentStatus === ArticleStatus.Draft ? 'pay' : 'progress';
    const StatusIcon = { done: CheckCircle2, bad: XCircle, pay: CreditCard, progress: Hourglass }[tone];
    const dateLabel = new Date(article.submission_date).toLocaleDateString(locale === 'uz-UZ' ? 'ru-RU' : locale);
    const metaParts = [
        article.work_type ? t(article.work_type) : '',
        isPlagDoc
            ? (plagState === 'done' && article.plagiarism_percentage != null
                ? t("O'xshashlik: {value}%", { value: Number(article.plagiarism_percentage).toFixed(2) })
                : '')
            : article.journal_name || '',
        !isAuthor ? article.author_name || '' : '',
    ].filter(Boolean);
    const actionBtn = 'gap-1.5 !px-3 !py-1.5 text-sm';

    return (
        <div
            className="editorial-card cursor-pointer hover:border-[var(--editorial-primary)]/35 transition-colors"
            onClick={() => navigate(openTarget)}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                    <h4 className="m-0 break-words text-base sm:text-lg font-semibold text-[var(--editorial-text)] leading-snug">{article.title}</h4>
                    <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${statusData.color}`}>
                            <StatusIcon className="h-3.5 w-3.5" aria-hidden /> {t(statusData.text)}
                        </span>
                        {article.fast_track && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-yellow-500/20 text-yellow-900">
                                <Rocket size={13} /> TOP
                            </span>
                        )}
                        {canUpdateStatus && getAvailableStatusOptions().length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                                    className="text-xs bg-slate-100/90 hover:bg-slate-200 rounded-full p-1.5 transition-colors"
                                    aria-label={t("Holatni o'zgartirish")}
                                >
                                    <ChevronDown size={14} />
                                </button>
                                {isStatusDropdownOpen && (
                                    <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                                        <div className="py-1 max-h-60 overflow-y-auto">
                                            {getAvailableStatusOptions().map((status) => (
                                                <button
                                                    key={status}
                                                    onClick={() => handleStatusUpdate(status)}
                                                    disabled={isUpdating}
                                                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                                        currentStatus === status ? 'bg-blue-600/30 text-blue-900' : 'text-slate-600 hover:bg-slate-100/80'
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
                    {metaParts.length > 0 && (
                        <p className="m-0 mt-1.5 text-sm text-[var(--editorial-teal)] break-words">{metaParts.join(' · ')}</p>
                    )}
                    {!isAuthor && article.abstract && (
                        <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">{article.abstract}</p>
                    )}
                    <p className="m-0 mt-1.5 flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" aria-hidden /> {dateLabel}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button type="button" variant="secondary" onClick={() => navigate(openTarget)} className={actionBtn}>
                        <Eye className="h-4 w-4" aria-hidden /> {t("Ko'rish")}
                    </Button>
                    {canGetDocuments && (
                        <Button type="button" variant="secondary" onClick={() => setShowReport(true)} className={actionBtn}>
                            <FileText className="h-4 w-4" aria-hidden /> {t('Hisobot olish')}
                        </Button>
                    )}
                    {isAuthor && isAuthorRole && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void openReferencePdf('article', article.id, t("Ma'lumotnomani yaratib bo'lmadi"))}
                            className={actionBtn}
                        >
                            <Award className="h-4 w-4" aria-hidden /> {t("Ma'lumotnoma")}
                        </Button>
                    )}
                    {isAuthor && !isPlagDoc && currentStatus === ArticleStatus.Published && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={(e) => handleShare(e)}
                            className={actionBtn}
                            title={t('Share — jurnal linki va sertifikat havolasini ulashish')}
                        >
                            <Share2 className="h-4 w-4" aria-hidden /> {t('Ulashish')}
                        </Button>
                    )}
                </div>
            </div>
            {isAuthor && !isPlagDoc && currentStatus === ArticleStatus.Draft && (pendingTxId || article.needs_publication_payment) && (
                <div
                    className="mt-3 p-3 rounded-lg bg-amber-500/15 border border-amber-500/30"
                    onClick={(e) => e.stopPropagation()}
                >
                    <p className="text-sm text-amber-950 mb-2">
                        {t("To'lov kutilmoqda — jurnalga yuborish uchun to'lovni tugating.")}
                    </p>
                    <Button
                        type="button"
                        variant="accent"
                        className={`w-full sm:w-auto ${actionBtn}`}
                        disabled={isPaying}
                        onClick={(e) => {
                            e.stopPropagation();
                            startPublicationPayment();
                        }}
                    >
                        <CreditCard className="h-4 w-4" aria-hidden /> {isPaying ? '...' : t("To'lovni tugatish")}
                    </Button>
                </div>
            )}
            {authorWorkflowSteps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200/90" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs text-slate-500 mb-2">{t('Jarayon:')} <span className="text-blue-900">{t(authorStageHint)}</span></p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
                        {authorWorkflowSteps.map((step, i) => (
                            <div key={step.name} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                <span
                                    title={t(step.name)}
                                    className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md truncate max-w-[72px] sm:max-w-none ${
                                        step.done
                                            ? 'bg-emerald-500/20 text-emerald-900'
                                            : step.current
                                              ? 'bg-[rgba(31,63,143,0.12)] text-[var(--editorial-primary)] font-semibold ring-1 ring-[rgba(31,63,143,0.35)]'
                                              : 'bg-slate-100/70 text-slate-500'
                                    }`}
                                >
                                    {t(step.name)}
                                </span>
                                {i < authorWorkflowSteps.length - 1 && (
                                    <span className="text-gray-600 hidden sm:inline" aria-hidden>
                                        →
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
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
            {showReport && (
                <div onClick={(e) => e.stopPropagation()}>
                    <WorksReportModal articleId={article.id} articleTitle={article.title} onClose={() => setShowReport(false)} />
                </div>
            )}
        </div>
    );
}


export default ArticleItem;
