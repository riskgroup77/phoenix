/** Maqolalar ro'yxatidagi bitta maqola kartasi (holat, to'lov, ulashish, admin amallari) */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArticleStatus, Role } from '../../types';
import { Rocket, ChevronDown, Check, Filter, Share2, FileText, Award } from 'lucide-react';
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
    const { t } = useT();
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

    return (
        <div 
            className="editorial-card cursor-pointer hover:border-[var(--editorial-primary)]/35 transition-colors"
            onClick={() => navigate(openTarget)}
        >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4">
                <h4 className="text-base sm:text-lg font-semibold text-[var(--editorial-text)] leading-snug">{article.title}</h4>
                <div className="flex items-center gap-2 shrink-0">
                    {article.fast_track && (
                        <span className="text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap bg-yellow-500/20 text-yellow-900 flex items-center gap-1.5">
                            <Rocket size={14} /> TOP
                        </span>
                    )}
                    <div className="relative flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${statusData.color}`}>
                                {t(statusData.text)}
                            </span>
                            {isAuthor && !isPlagDoc && currentStatus === ArticleStatus.Published && (
                                <button
                                    onClick={handleShare}
                                    className="p-1.5 rounded-lg bg-green-600/20 text-emerald-800 hover:bg-green-500/30 transition-colors"
                                    title={t('Share — jurnal linki va sertifikat havolasini ulashish')}
                                >
                                    <Share2 size={16} />
                                </button>
                            )}
                            {canUpdateStatus && getAvailableStatusOptions().length > 0 && (
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
                        {/* Har qanday hujjat uchun holat haqida ma'lumotnoma (PDF, interfeys tilida) */}
                        {isAuthor && isAuthorRole && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void openReferencePdf('article', article.id, t("Ma'lumotnomani yaratib bo'lmadi"));
                                }}
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-[var(--editorial-border)] text-[var(--editorial-primary)] hover:bg-slate-100/80 whitespace-nowrap"
                            >
                                <Award size={13} /> {t("Ma'lumotnoma")}
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <p className="text-sm text-slate-500 mt-2 line-clamp-2">{article.abstract}</p>
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
                        variant="secondary"
                        className="w-full sm:w-auto"
                        disabled={isPaying}
                        onClick={(e) => {
                            e.stopPropagation();
                            startPublicationPayment();
                        }}
                    >
                        {isPaying ? '...' : t("To'lovni tugatish")}
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
                    <p className="text-[11px] text-slate-500 mt-2">{t('Batafsil bosqichlar uchun maqolani oching.')}</p>
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
            {canGetDocuments && (
                <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => setShowReport(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--editorial-border)] text-[var(--editorial-primary)] hover:bg-slate-100/80"
                    >
                        <FileText size={14} /> {t('Hisobot olish')}
                    </button>
                </div>
            )}
            {showReport && (
                <div onClick={(e) => e.stopPropagation()}>
                    <WorksReportModal articleId={article.id} articleTitle={article.title} onClose={() => setShowReport(false)} />
                </div>
            )}
            <div className="flex flex-wrap justify-between items-center mt-4 text-xs text-slate-500 gap-1">
                <span className="truncate max-w-[60%]">
                    {article.work_type && <span className="font-medium text-[var(--editorial-teal)] mr-1.5">{t(article.work_type)} ·</span>}
                    {article.author_name || t("Noma'lum muallif")}
                </span>
                <span>{new Date(article.submission_date).toLocaleDateString()}</span>
            </div>
        </div>
    );
}


export default ArticleItem;
