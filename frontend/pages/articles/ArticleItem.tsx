/** Maqolalar ro'yxatidagi bitta maqola kartasi (holat, to'lov, ulashish, admin amallari) */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArticleStatus, Role } from '../../types';
import { Rocket, ChevronDown, Check, Filter, Share2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { PlagiarismBadges } from '../../components/PlagiarismReport';
import { getAuthorWorkflowStepsFromStatus, getAuthorWorkflowStageLabel } from '../../utils/articleAuthorWorkflow';
import { apiService } from '../../services/apiService';
import { paymentService } from '../../services/paymentService';
import { toast } from 'react-toastify';
import { ArticleApiResponse } from './types';
import { getStatusDisplayData } from './helpers';
import { useT } from '../../i18n/LanguageContext';

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
            toast.success(t('Share havolasi nusxalandi. Havolani istalgan kishiga yuboring — unda jurnal linki va sertifikat ko‘rinadi.'));
        }).catch(() => {
            toast.error(t('Havolani nusxalashda xatolik.'));
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
            className="editorial-card cursor-pointer hover:border-[var(--editorial-primary)]/35 transition-colors"
            onClick={() => navigate(`/articles/${article.id}`)}
        >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4">
                <h4 className="text-base sm:text-lg font-semibold text-[var(--editorial-text)] leading-snug">{article.title}</h4>
                <div className="flex items-center gap-2 shrink-0">
                    {article.fast_track && (
                        <span className="text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap bg-yellow-500/20 text-yellow-900 flex items-center gap-1.5">
                            <Rocket size={14} /> TOP
                        </span>
                    )}
                    <div className="relative">
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${statusData.color}`}>
                                {t(statusData.text)}
                            </span>
                            {isAuthor && currentStatus === ArticleStatus.Published && (
                                <button
                                    onClick={handleShare}
                                    className="p-1.5 rounded-lg bg-green-600/20 text-emerald-800 hover:bg-green-500/30 transition-colors"
                                    title={t('Share — jurnal linki va sertifikat havolasini ulashish')}
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
                        {t("To'lov kutilmoqda — jurnalga yuborish uchun to'lovni tugating.")}
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
                        {t("To'lovni tugatish")}
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
            <div className="flex flex-wrap justify-between items-center mt-4 text-xs text-slate-500 gap-1">
                <span className="truncate max-w-[60%]">{article.author_name || t("Noma'lum muallif")}</span>
                <span>{new Date(article.submission_date).toLocaleDateString()}</span>
            </div>
        </div>
    );
}


export default ArticleItem;
