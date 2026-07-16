import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { Role, ArticleStatus, ActivityLogEvent } from '../types';
import { Check, X, Award, UploadCloud, BookOpen, Download, Edit, Send, GitCommit, UserCheck, FileCheck2, BookUp, XCircle, Clock, FileInput, CheckCircle, Shield, Bot, ExternalLink, Printer, Eye, FileText, Inbox, RefreshCw } from 'lucide-react';
import PlagiarismReport, { PlagiarismReportData } from '../components/PlagiarismReport';
import QabulCertificate, { QabulCertificateData } from '../components/QabulCertificate';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';
import { getAuthorWorkflowStepsFromStatus, getAuthorWorkflowProgressPercent } from '../utils/articleAuthorWorkflow';
import AuthorOperatorChat from '../components/AuthorOperatorChat';
import { ARTICLE_CHAT_DOCK_BREAKPOINT_PX } from '../components/ArticleChatDock';
import { useMediaMinWidth } from '../hooks/useMediaMinWidth';

// Type for the API response which has different field names
interface ArticleApiResponse {
    id: string;
    title: string;
    abstract: string;
    keywords: string[];
    status: ArticleStatus;
    status_label?: string;
    workflow_stage?: string;
    workflow_steps?: { name: string; done: boolean; current: boolean }[];
    status_timeline?: { status: string; date: string; comment?: string; responsible?: string }[];
    author: string;
    author_name?: string;
    journal: string;
    journal_name?: string;
    submission_date: string;
    fast_track: boolean;
    file_url?: string;
    final_pdf_path?: string;
    views: number;
    downloads: number;
    activity_logs?: ActivityLogEvent[];
    plagiarism_percentage?: number;
    ai_content_percentage?: number;
    plagiarism_checked_at?: string | null;
    plagiarism_report?: PlagiarismReportData | null;
    publication_link?: string;
    certificate_download_link?: string;
}

const ArticleDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const isLargeScreen = useMediaMinWidth(ARTICLE_CHAT_DOCK_BREAKPOINT_PX);
    const [article, setArticle] = useState<ArticleApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activityLogs, setActivityLogs] = useState<ActivityLogEvent[]>([]);
    const [showCertificate, setShowCertificate] = useState(false);
    const [certificateData, setCertificateData] = useState<QabulCertificateData | null>(null);
    const [showPdfPreview, setShowPdfPreview] = useState(false);
    const [publicationCertificateFile, setPublicationCertificateFile] = useState<File | null>(null);
    const [publicationUrl, setPublicationUrl] = useState('');
    const [publicationIssueId, setPublicationIssueId] = useState<string>('');
    const [completePublicationLoading, setCompletePublicationLoading] = useState(false);
    const [journalIssues, setJournalIssues] = useState<{ id: string; issue_number: string; journal: string }[]>([]);
    const [showRevisionModal, setShowRevisionModal] = useState(false);
    const [revisionReason, setRevisionReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        const fetchArticleData = async () => {
            if (!id || !user) return;
            
            try {
                setLoading(true);
                setError(null);
                
                // Fetch article data
                const articleResponse = await apiService.articles.get(id);
                const articleData = articleResponse.data || articleResponse;
                setArticle(articleData);
                
                // Fetch activity logs from backend response
                const logs = Array.isArray(articleData.activity_logs) ? articleData.activity_logs : [];
                setActivityLogs(logs);
                
                // Set certificate data
                setCertificateData({
                    certificateNumber: `QBL-${articleData.id.substring(0, 8).toUpperCase()}`,
                    issueDate: new Date().toLocaleDateString('uz-UZ'),
                    author: `${user.lastName} ${user.firstName}`,
                    workType: 'Ilmiy maqola',
                    workTitle: articleData.title,
                    journalName: articleData.journal_name || 'Noma\'lum jurnal',
                    organization: user.affiliation || 'Noma\'lum tashkilot',
                    publishDate: articleData.submission_date ? new Date(articleData.submission_date).toLocaleDateString('uz-UZ') : undefined,
                    currentStatus: articleData.status_label || articleData.status,
                    articleId: articleData.id
                });
            } catch (err: any) {
                console.error('Failed to fetch article data:', err);
                setError('Maqola ma\'lumotlarini yuklashda xatolik yuz berdi.');
            } finally {
                setLoading(false);
            }
        };

        fetchArticleData();
    }, [id, user]);

    useEffect(() => {
        if (article?.status !== ArticleStatus.Accepted || !article?.journal) return;
        const fetchIssues = async () => {
            try {
                const list = await apiService.journals.listIssues();
                const data = Array.isArray(list) ? list : (list as any)?.results ?? [];
                const forJournal = data.filter((i: { journal: string }) => i.journal === article.journal);
                setJournalIssues(forJournal);
            } catch {
                setJournalIssues([]);
            }
        };
        fetchIssues();
    }, [article?.status, article?.journal]);

    const handleStatusUpdate = async (status: ArticleStatus, reason?: string) => {
        if (!id) return;
        
        try {
            await apiService.articles.updateStatus(id, status, reason);
            // Refresh article data
            const articleResponse = await apiService.articles.get(id);
            const articleData = articleResponse.data || articleResponse;
            setArticle(articleData);
        } catch (err) {
            console.error('Failed to update article status:', err);
            setError('Maqola holatini yangilashda xatolik yuz berdi.');
        }
    };

    const handleRevisionSubmit = async () => {
        const trimmed = revisionReason.trim();
        if (!trimmed) {
            toast.error('Tahrirga qaytarish sababini yozing.');
            return;
        }
        if (!id) return;
        setShowRevisionModal(false);
        try {
            await apiService.articles.updateStatus(id, ArticleStatus.Revision, trimmed);
            toast.success('Maqola tahrirga qaytarildi. Muallifga bildirishnoma yuborildi.');
            setRevisionReason('');
            const articleResponse = await apiService.articles.get(id);
            const articleData = articleResponse.data || articleResponse;
            setArticle(articleData);
            const logs = Array.isArray(articleData.activity_logs) ? articleData.activity_logs : [];
            setActivityLogs(logs);
        } catch (err) {
            console.error('Failed to send revision:', err);
            toast.error('Tahrirga qaytarishda xatolik.');
        }
    };

    const handleRejectSubmit = async () => {
        const trimmed = rejectReason.trim();
        if (!trimmed) {
            toast.error('Rad etish sababini yozing.');
            return;
        }
        if (!id) return;
        setShowRejectModal(false);
        try {
            await apiService.articles.updateStatus(id, ArticleStatus.Rejected, trimmed);
            toast.success('Maqola rad etildi. Muallifga bildirishnoma yuborildi.');
            setRejectReason('');
            const articleResponse = await apiService.articles.get(id);
            const articleData = articleResponse.data || articleResponse;
            setArticle(articleData);
            const logs = Array.isArray(articleData.activity_logs) ? articleData.activity_logs : [];
            setActivityLogs(logs);
        } catch (err) {
            console.error('Failed to reject article:', err);
            toast.error('Rad etishda xatolik.');
        }
    };

    const handleCompletePublication = async () => {
        if (!id || !publicationCertificateFile) {
            toast.error('Sertifikat faylini (PDF yoki JPG) tanlang.');
            return;
        }
        const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowed.includes(publicationCertificateFile.type)) {
            toast.error('Sertifikat faqat PDF yoki JPG (PNG) formatida bo\'lishi kerak.');
            return;
        }
        setCompletePublicationLoading(true);
        try {
            const formData = new FormData();
            formData.append('certificate', publicationCertificateFile);
            if (publicationIssueId) formData.append('issue_id', publicationIssueId);
            if (publicationUrl.trim()) formData.append('publication_url', publicationUrl.trim());
            await apiService.articles.completePublication(id, formData);
            toast.success('Nashr qilindi. Muallifga bildirishnoma yuborildi.');
            setPublicationCertificateFile(null);
            setPublicationUrl('');
            setPublicationIssueId('');
            const articleResponse = await apiService.articles.get(id);
            const articleData = articleResponse.data || articleResponse;
            setArticle(articleData);
        } catch (err: any) {
            const msg = err?.response?.error ?? err?.message ?? 'Nashr qilishda xatolik.';
            toast.error(msg);
        } finally {
            setCompletePublicationLoading(false);
        }
    };

    /** Full URL of the main PDF (from API file_url or built from final_pdf_path). */
    const fileUrl = article?.file_url
        || (article?.final_pdf_path ? apiService.getMediaUrl(article.final_pdf_path) : null);

    const handleDownload = () => {
        if (!fileUrl) {
            toast.info('Maqola fayli hali mavjud emas.');
            return;
        }
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', '');
        link.setAttribute('target', '_blank');
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (id) {
            apiService.articles.incrementDownloads(id).catch(err => {
                console.error('Failed to increment download count:', err);
            });
        }
    };

    const handleView = () => {
        if (!fileUrl) {
            toast.info('Maqola fayli hali mavjud emas.');
            return;
        }
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
        if (id) {
            apiService.articles.incrementViews(id).catch(err => {
                console.error('Failed to increment view count:', err);
            });
        }
    };

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
                <Button onClick={() => window.location.reload()} className="mt-4">Qayta urinish</Button>
            </Card>
        );
    }

    if (!article) {
        return (
            <Card title="Maqola topilmadi">
                <p>Ko'rsatilgan ID bo'yicha maqola topilmadi.</p>
                <Button onClick={() => navigate('/articles')} className="mt-4">Orqaga qaytish</Button>
            </Card>
        );
    }

    const getStatusDisplayData = (status: string): { text: string; color: string; icon: React.ElementType } => {
        const map: Record<string, { text: string; color: string; icon: React.ElementType }> = {
            'Draft': { text: 'Yangi topshirildi', color: 'bg-gray-500/20 text-slate-600', icon: FileText },
            'Yangi': { text: 'Yangi topshirildi', color: 'bg-blue-500/20 text-blue-900', icon: Inbox },
            'WithEditor': { text: 'Tekshiruvda', color: 'bg-indigo-500/20 text-indigo-300', icon: Edit },
            'QabulQilingan': { text: 'Ko\'rib chiqilmoqda', color: 'bg-yellow-500/20 text-yellow-900', icon: CheckCircle },
            'WritingInProgress': { text: 'Tuzatish kiritilmoqda', color: 'bg-cyan-500/20 text-cyan-900', icon: Edit },
            'NashrgaYuborilgan': { text: 'Nashrga tayyorlanmoqda', color: 'bg-purple-500/20 text-purple-900', icon: Send },
            'PlagiarismReview': { text: 'Antiplagiat ko\'rib chiqish (bosh admin qarori)', color: 'bg-amber-500/20 text-amber-900', icon: Edit },
            'Revision': { text: 'To\'ldirish talab qilinadi', color: 'bg-orange-500/20 text-orange-900', icon: Edit },
            'Accepted': { text: 'Qabul qilindi', color: 'bg-teal-500/20 text-teal-900', icon: Check },
            'Published': { text: 'Nashr etildi', color: 'bg-green-500/20 text-emerald-900', icon: BookOpen },
            'Rejected': { text: 'Jarayon to\'xtatildi', color: 'bg-red-500/20 text-red-800', icon: XCircle },
        };
        return map[status] || { text: status, color: 'bg-gray-500/20 text-slate-600', icon: FileText };
    };

    const statusData = getStatusDisplayData(article.status);
    const StatusIcon = statusData.icon;
    const viewerRoleNorm =
        typeof user?.role === 'string' ? user.role.toLowerCase() : String(user?.role ?? '');
    const showPlagiarismForAdmin =
        viewerRoleNorm === 'journal_admin' || viewerRoleNorm === 'super_admin';
    const apiWorkflowSteps = Array.isArray(article.workflow_steps) ? article.workflow_steps : [];
    const fallbackSteps = getAuthorWorkflowStepsFromStatus(article.status);
    const workflowSteps = apiWorkflowSteps.length > 0 ? apiWorkflowSteps : fallbackSteps;
    const workflowProgress =
        apiWorkflowSteps.length > 0
            ? Math.round(
                  (apiWorkflowSteps.filter((s) => s.done || s.current).length / apiWorkflowSteps.length) * 100
              )
            : getAuthorWorkflowProgressPercent(article.status);
    const statusTimeline = Array.isArray(article.status_timeline) ? article.status_timeline : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="min-w-0">
                    <Link to="/articles" className="text-blue-800 hover:text-blue-700 flex items-center gap-2 mb-2 text-sm">
                        <span>←</span> Maqolalar ro'yxati
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">{article.title}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${statusData.color}`}>
                        <StatusIcon size={16} />
                        {article.status_label || statusData.text}
                    </span>
                    {article.fast_track && (
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-900 flex items-center gap-2">
                            <Award size={16} />
                            Tezkor
                        </span>
                    )}
                </div>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column - 2/3 width */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Workflow status */}
                    <Card title="Jarayon holati">
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-slate-600">
                                        Joriy bosqich:{' '}
                                        {article.workflow_stage ||
                                            fallbackSteps.find((s) => s.current)?.name ||
                                            statusData.text}
                                    </span>
                                    <span className="text-blue-900 font-semibold">{workflowProgress}%</span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-2.5">
                                    <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${workflowProgress}%` }} />
                                </div>
                            </div>

                            {workflowSteps.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                                    {workflowSteps.map((step) => (
                                        <div
                                            key={step.name}
                                            className={`p-2 rounded text-center border ${step.current ? 'border-blue-400 text-blue-900 bg-blue-500/10' : step.done ? 'border-green-500/30 text-emerald-900 bg-green-500/10' : 'border-slate-200/90 text-slate-500 bg-slate-100/70'}`}
                                        >
                                            {step.name}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-slate-900">Status tarixi</h4>
                                {statusTimeline.length > 0 ? (
                                    statusTimeline.map((item, index) => (
                                        <div key={`${item.status}-${item.date}-${index}`} className="p-3 bg-slate-100/70 rounded-lg border border-slate-200/90">
                                            <p className="text-slate-900 font-medium">{item.status}</p>
                                            <p className="text-xs text-slate-500 mt-1">{item.date ? new Date(item.date).toLocaleString() : 'Sana yo\'q'}</p>
                                            {item.comment ? <p className="text-sm text-slate-600 mt-1">Izoh: {item.comment}</p> : null}
                                            {item.responsible ? <p className="text-xs text-slate-500 mt-1">Mas'ul: {item.responsible}</p> : null}
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 bg-slate-100/70 rounded-lg border border-slate-200/90 text-sm text-slate-500">
                                        Status tarixi hali mavjud emas.
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Plagiarism Report — faqat jurnal admin / super admin uchun (muallifda ko'rinmasin) */}
                    {showPlagiarismForAdmin && (
                        <Card title="Antiplagiat & AI Detektor">
                            <PlagiarismReport
                                plagiarismPercentage={article.plagiarism_percentage ?? 0}
                                aiContentPercentage={article.ai_content_percentage ?? 0}
                                checkedAt={article.plagiarism_checked_at || null}
                                report={article.plagiarism_report || null}
                            />
                        </Card>
                    )}

                    {/* Basic info */}
                    <Card title="Asosiy ma'lumotlar">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-slate-500 mb-1">Muallif(lar)</h3>
                                <p className="text-slate-900">{article.author_name || 'Noma\'lum'}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-slate-500 mb-1">Annotatsiya</h3>
                                <p className="text-slate-600 leading-relaxed">{article.abstract || 'Annotatsiya mavjud emas'}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-slate-500 mb-1">Kalit so'zlar</h3>
                                <div className="flex flex-wrap gap-2">
                                    {article.keywords?.map((keyword: string, index: number) => (
                                        <span key={index} className="px-3 py-1 bg-blue-500/20 text-blue-900 rounded-full text-sm">
                                            {keyword}
                                        </span>
                                    )) || <span className="text-slate-500">Kalit so'zlar mavjud emas</span>}
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Files with PDF preview */}
                    <Card title="Fayllar">
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button onClick={handleDownload} variant="secondary" className="flex items-center justify-center gap-2 flex-1">
                                    <Download size={18} /> Yuklab olish
                                </Button>
                                <Button onClick={handleView} variant="secondary" className="flex items-center justify-center gap-2 flex-1">
                                    <Eye size={18} /> Ko'rish
                                </Button>
                                {fileUrl && (fileUrl.toLowerCase().endsWith('.pdf') || !fileUrl.includes('.')) && (
                                    <Button onClick={() => setShowPdfPreview(!showPdfPreview)} variant="secondary" className="flex items-center justify-center gap-2 flex-1">
                                        <FileText size={18} /> {showPdfPreview ? 'Yopish' : 'PDF ko\'rish'}
                                    </Button>
                                )}
                            </div>
                            {showPdfPreview && fileUrl && (
                                <div className="rounded-xl overflow-hidden border border-slate-200/90 bg-white/55">
                                    <div className="flex items-center justify-between px-4 py-2 bg-slate-100/70 border-b border-slate-200/90">
                                        <span className="text-sm text-slate-600 font-medium">PDF ko'rinishi</span>
                                        <button onClick={() => setShowPdfPreview(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <iframe
                                        src={fileUrl}
                                        className="w-full border-0"
                                        style={{ height: '70vh', minHeight: '400px' }}
                                        title="PDF Preview"
                                    />
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Nashr havolasi va sertifikat — nashr etilganda barcha uchun (ayniqsa muallif) */}
                    {article.status === ArticleStatus.Published && (article.publication_link || article.certificate_download_link) && (
                        <Card title="Nashr natijalari">
                            <div className="space-y-4">
                                {article.publication_link && (
                                    <div>
                                        <p className="text-sm text-slate-500 mb-1">Nashr etilgan maqola havolasi</p>
                                        <a
                                            href={article.publication_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 text-blue-800 hover:text-blue-700 underline"
                                        >
                                            <ExternalLink size={16} />
                                            {article.publication_link}
                                        </a>
                                    </div>
                                )}
                                {article.certificate_download_link && (
                                    <div>
                                        <p className="text-sm text-slate-500 mb-1">Nashr sertifikati</p>
                                        <a
                                            href={article.certificate_download_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
                                        >
                                            <Download size={16} />
                                            Sertifikatni yuklab olish
                                        </a>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Tahrirga qaytarish sababi — muallif uchun */}
                    {article.status === ArticleStatus.Revision && (() => {
                        const revisionLog = activityLogs.find(
                            (l) => l.action && l.action.includes('Revision') && (l.details || '').trim()
                        );
                        const reason = revisionLog?.details?.trim();
                        return reason ? (
                            <Card title="Tahrirga qaytarish sababi">
                                <p className="text-slate-600 whitespace-pre-wrap">{reason}</p>
                                {revisionLog?.timestamp && (
                                    <p className="text-xs text-slate-500 mt-2">
                                        {new Date(revisionLog.timestamp).toLocaleString()}
                                    </p>
                                )}
                            </Card>
                        ) : null;
                    })()}

                    {/* Rad etish sababi — muallif uchun */}
                    {article.status === ArticleStatus.Rejected && (() => {
                        const rejectLog = activityLogs.find(
                            (l) => l.action && l.action.includes('Rejected') && (l.details || '').trim()
                        );
                        const reason = rejectLog?.details?.trim();
                        return reason ? (
                            <Card title="Rad etish sababi">
                                <p className="text-slate-600 whitespace-pre-wrap">{reason}</p>
                                {rejectLog?.timestamp && (
                                    <p className="text-xs text-slate-500 mt-2">
                                        {new Date(rejectLog.timestamp).toLocaleString()}
                                    </p>
                                )}
                            </Card>
                        ) : null;
                    })()}

                    {/* Activity log */}
                    <Card title="Faoliyat jurnali">
                        <div className="space-y-4">
                            {activityLogs.length > 0 ? (
                                activityLogs.map(log => (
                                    <div key={log.id} className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-100/70 rounded-lg">
                                        <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <GitCommit className="h-4 w-4 sm:h-5 sm:w-5 text-blue-800" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-slate-900 text-sm sm:text-base">{log.action}</span>
                                                <span className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm text-slate-600 mt-1">{log.details || ''}</p>
                                            {log.userId && (
                                                <span className="text-xs text-slate-500">Foydalanuvchi ID: {log.userId}</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-slate-500 py-4">Faoliyat jurnali hali mavjud emas.</p>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right sidebar - 1/3 width */}
                <div className="space-y-6">
                    {/* Management actions */}
                    <Card title="Boshqaruv">
                        <div className="space-y-3">
                            {/* Qabul ma'lumotnomasi tugmasi - barcha foydalanuvchilar uchun */}
                            <Button onClick={() => setShowCertificate(true)} variant="secondary" className="w-full flex items-center justify-center gap-2">
                                <Award size={18} /> Qabul ma'lumotnomasi
                            </Button>
                            
                            {user?.role === Role.Author && (
                                <Button onClick={() => navigate(`/submit/${id}`)} variant="secondary" className="w-full flex items-center justify-center gap-2">
                                    <Edit size={18} /> Tahrirlash
                                </Button>
                            )}
                            {(user?.role === Role.JournalAdmin || user?.role === Role.SuperAdmin) && article.status !== ArticleStatus.PlagiarismReview && (
                                <>
                                    <Button onClick={() => handleStatusUpdate(ArticleStatus.Accepted)} variant="primary" className="w-full flex items-center justify-center gap-2">
                                        <Check size={18} /> Qabul qilish
                                    </Button>
                                    <Button onClick={() => setShowRevisionModal(true)} variant="secondary" className="w-full flex items-center justify-center gap-2">
                                        <Edit size={18} /> Tahrirga qaytarish
                                    </Button>
                                    <Button onClick={() => setShowRejectModal(true)} variant="danger" className="w-full flex items-center justify-center gap-2">
                                        <X size={18} /> Rad etish
                                    </Button>
                                </>
                            )}
                            {user?.role === Role.SuperAdmin && article.status === ArticleStatus.PlagiarismReview && (
                                <>
                                    <p className="text-sm text-amber-900 mb-2">Plagiat/AI/originalilik qisman talabga mos. Qaror qiling:</p>
                                    <Button onClick={() => handleStatusUpdate(ArticleStatus.NashrgaYuborilgan)} variant="primary" className="w-full flex items-center justify-center gap-2">
                                        <Check size={18} /> Qabul qilish (nashrga yuborish)
                                    </Button>
                                    <Button onClick={() => setShowRejectModal(true)} variant="danger" className="w-full flex items-center justify-center gap-2">
                                        <X size={18} /> Rad etish
                                    </Button>
                                </>
                            )}
                        </div>
                    </Card>

                    {/* Statistics */}
                    <Card title="Statistika">
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Ko'rishlar</span>
                                <span className="text-slate-900 font-medium">{article.views || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Yuklab olishlar</span>
                                <span className="text-slate-900 font-medium">{article.downloads || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Yuborilgan sana</span>
                                <span className="text-slate-900 font-medium">
                                    {article.submission_date ? new Date(article.submission_date).toLocaleDateString() : 'Noma\'lum'}
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Jurnal admin / bosh admin: nashr etilganda yuklangan link va sertifikat — qaytib kirganda ham ko‘rinsin */}
                    {(user?.role === Role.JournalAdmin || user?.role === Role.SuperAdmin) && article.status === ArticleStatus.Published && (article.publication_link || article.certificate_download_link) && (
                        <Card title="Nashr natijalari">
                            <div className="space-y-3">
                                {article.publication_link && (
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Nashr havolasi</p>
                                        <a href={article.publication_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-800 hover:text-blue-700 text-sm break-all">
                                            <ExternalLink size={14} />
                                            Havolani ochish
                                        </a>
                                    </div>
                                )}
                                {article.certificate_download_link && (
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Sertifikat</p>
                                        <a href={article.certificate_download_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm">
                                            <Download size={14} />
                                            Yuklab olish
                                        </a>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Nashr qilish — faqat Accepted holatida, jurnal/bosh admin uchun */}
                    {(user?.role === Role.JournalAdmin || user?.role === Role.SuperAdmin) && article.status === ArticleStatus.Accepted && (
                        <Card title="Nashr qilish">
                            <p className="text-sm text-slate-500 mb-4">
                                Sertifikat faylini yuklang va muallifga tayyor deb yuboring. Muallifga bildirishnoma keladi.
                            </p>
                            {journalIssues.length > 0 && (
                                <div className="mb-4">
                                    <label className="block text-sm text-slate-500 mb-1">Jurnal soni (ixtiyoriy)</label>
                                    <select
                                        value={publicationIssueId}
                                        onChange={(e) => setPublicationIssueId(e.target.value)}
                                        className="w-full rounded-lg bg-white/50 border border-slate-200 text-slate-900 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    >
                                        <option value="">— Tanlamang —</option>
                                        {journalIssues.map((iss) => (
                                            <option key={iss.id} value={iss.id}>{iss.issue_number}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="mb-4">
                                <label className="block text-sm text-slate-500 mb-1">Nashr etilgan maqola linki (ixtiyoriy)</label>
                                <input
                                    type="url"
                                    value={publicationUrl}
                                    onChange={(e) => setPublicationUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full rounded-lg bg-white/50 border border-slate-200 text-slate-900 placeholder-slate-400 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm text-slate-500 mb-1">Sertifikat fayli (PDF yoki JPG) *</label>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => setPublicationCertificateFile(e.target.files?.[0] ?? null)}
                                    className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:cursor-pointer"
                                />
                                {publicationCertificateFile && (
                                    <span className="text-xs text-slate-500 mt-1 block">{publicationCertificateFile.name}</span>
                                )}
                            </div>
                            <Button
                                onClick={handleCompletePublication}
                                disabled={completePublicationLoading || !publicationCertificateFile}
                                variant="primary"
                                className="w-full flex items-center justify-center gap-2"
                            >
                                <Send size={18} />
                                {completePublicationLoading ? 'Yuborilmoqda...' : 'Muallifga tayyor deb yuborish'}
                            </Button>
                        </Card>
                    )}
                </div>
            </div>

            {/* lg+ da chat Layout ichidagi o‘ng panelda; kichik ekranda shu yerda */}
            {!isLargeScreen &&
                (viewerRoleNorm === 'author' ||
                    viewerRoleNorm === 'operator' ||
                    viewerRoleNorm === 'super_admin') &&
                id && (
                    <AuthorOperatorChat
                        articleId={id}
                        viewerIsAuthor={viewerRoleNorm === 'author'}
                        authorDisplayName={article.author_name}
                    />
                )}

            {/* Tahrirga qaytarish — izoh modali */}
            {showRevisionModal && (
                <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex justify-center items-center p-4">
                    <div className="w-full max-w-lg bg-white/50 border border-slate-200 rounded-xl shadow-2xl">
                        <div className="p-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-900">Tahrirga qaytarish</h3>
                            <p className="text-sm text-slate-500 mt-1">Nega tahrirga qaytarilgani haqida izoh yozing. Bu matn muallifga bildirishnoma orqali yuboriladi.</p>
                        </div>
                        <div className="p-4">
                            <textarea
                                value={revisionReason}
                                onChange={(e) => setRevisionReason(e.target.value)}
                                placeholder="Masalan: Annotatsiya qisqartirilishi, adabiyotlar ro'yxati to'ldirilishi kerak..."
                                rows={4}
                                className="w-full rounded-lg bg-white/55 border border-slate-200 text-slate-900 placeholder-slate-400 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        <div className="p-4 border-t border-slate-200 flex gap-3 justify-end">
                            <Button onClick={() => { setShowRevisionModal(false); setRevisionReason(''); }} variant="secondary">
                                Bekor qilish
                            </Button>
                            <Button onClick={handleRevisionSubmit} variant="primary" disabled={!revisionReason.trim()}>
                                Yuborish
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rad etish — izoh modali */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex justify-center items-center p-4">
                    <div className="w-full max-w-lg bg-white/50 border border-slate-200 rounded-xl shadow-2xl">
                        <div className="p-4 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-900">Rad etish</h3>
                            <p className="text-sm text-slate-500 mt-1">Nega rad etilgani haqida to‘liq izoh yozing. Bu matn muallifga bildirishnoma orqali yuboriladi va maqola sahifasida ko‘rinadi.</p>
                        </div>
                        <div className="p-4">
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Masalan: Maqola mavzusi jurnal doirasiga to‘g‘ri kelmadi; adabiyotlar yangilanishi talab qilinadi..."
                                rows={4}
                                className="w-full rounded-lg bg-white/55 border border-slate-200 text-slate-900 placeholder-slate-400 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        <div className="p-4 border-t border-slate-200 flex gap-3 justify-end">
                            <Button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} variant="secondary">
                                Bekor qilish
                            </Button>
                            <Button onClick={handleRejectSubmit} variant="danger" disabled={!rejectReason.trim()}>
                                Yuborish
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Certificate modal */}
            {showCertificate && certificateData && (
                <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex justify-center items-center p-4 print:p-0 print:bg-white">
                    <div className="w-full max-w-6xl bg-white/55 rounded-lg shadow-2xl print:max-w-none print:bg-white print:rounded-none">
                        <div className="p-4 border-b border-slate-200/90 flex justify-between items-center no-print">
                            <h3 className="text-lg font-semibold text-slate-900">Qabul haqida ma'lumotnoma</h3>
                            <div className="flex items-center gap-2">
                                <Button onClick={() => window.print()} variant="secondary" className="flex items-center gap-2">
                                    <Printer size={16} /> Chop etish / PDF
                                </Button>
                                <Button onClick={() => setShowCertificate(false)} variant="secondary">Yopish</Button>
                            </div>
                        </div>
                        <div className="p-4 max-h-[80vh] overflow-y-auto print:p-0 print:max-h-none print:overflow-visible">
                            <QabulCertificate data={certificateData} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArticleDetail;
