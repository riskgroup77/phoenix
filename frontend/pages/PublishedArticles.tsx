import React, { useState, useMemo, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { ArticleStatus, Role, Issue } from '../types';
import { UploadCloud, Send, Link as LinkIcon, Loader2, Share2, ExternalLink, Download, FileCheck } from 'lucide-react';

const MONTH_NAMES = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);

/** API journal_admin (UUID string yoki nested) / journalAdminId — bitta string ID */
function getJournalAdminIdFromJournal(j: Record<string, unknown>): string {
    const ja = j.journal_admin;
    if (ja != null && typeof ja === 'object' && ja !== null && 'id' in (ja as object)) {
        return String((ja as { id: string }).id);
    }
    if (typeof ja === 'string' || typeof ja === 'number') {
        return String(ja);
    }
    const raw = j.journalAdminId ?? j.journal_admin_id;
    return raw != null && raw !== '' ? String(raw) : '';
}

function getArticleJournalId(a: { journal?: unknown }): string {
    const j = a.journal;
    if (typeof j === 'string') return j;
    if (j && typeof j === 'object' && 'id' in (j as object)) return String((j as { id: string }).id);
    return '';
}

const PublishedArticles: React.FC = () => {
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const userRole = typeof user?.role === 'string' ? user.role.toLowerCase() : user?.role;
    const isJournalAdminUser = userRole === 'journal_admin' || user?.role === Role.JournalAdmin;
    const isSuperAdminUser = userRole === 'super_admin' || user?.role === Role.SuperAdmin;
    const [issues, setIssues] = useState<Issue[]>([]);
    const [journals, setJournals] = useState<any[]>([]);
    const [articles, setArticles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [selectedJournalId, setSelectedJournalId] = useState('');
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [collectionUrl, setCollectionUrl] = useState('');
    const [collectionPdf, setCollectionPdf] = useState<File | null>(null);
    const [copiedArticleId, setCopiedArticleId] = useState<string | null>(null);
    /** Nashr havolasi / sertifikat — muallifga yuborish (har bir maqola) */
    const [pubUrlByArticle, setPubUrlByArticle] = useState<Record<string, string>>({});
    const [certFileByArticle, setCertFileByArticle] = useState<Record<string, File | null>>({});
    const [sendingDeliveryId, setSendingDeliveryId] = useState<string | null>(null);

    const managedJournals = useMemo(() => {
        if (!user) return [];
        if (isSuperAdminUser) return journals;
        if (isJournalAdminUser) {
            const uid = String(user.id);
            return journals.filter((j) => getJournalAdminIdFromJournal(j as Record<string, unknown>) === uid);
        }
        return [];
    }, [user, journals, isJournalAdminUser, isSuperAdminUser]);

    const selectedJournal = useMemo(
        () => managedJournals.find((j) => j.id === selectedJournalId) ?? null,
        [managedJournals, selectedJournalId]
    );

    // Set initial selected journal
    useEffect(() => {
        if (managedJournals.length > 0 && !selectedJournalId) {
            setSelectedJournalId(managedJournals[0].id);
        }
    }, [managedJournals, selectedJournalId]);

    // Fetch data from API (JournalAdmin / SuperAdmin)
    useEffect(() => {
        const fetchData = async () => {
            if (!user || (!isJournalAdminUser && !isSuperAdminUser)) return;
            
            setLoading(true);
            setError(null);
            
            try {
                const [issuesData, journalsData, articlesData] = await Promise.all([
                    apiService.journals.listIssues(),
                    apiService.journals.list(),
                    apiService.articles.list()
                ]);
                
                setIssues(issuesData.results || issuesData);
                setJournals(journalsData.results || journalsData);
                setArticles(articlesData.results || articlesData);

                try {
                    const usersData = await apiService.users.list();
                    setUsers(usersData.results || usersData);
                } catch {
                    setUsers([]);
                }
            } catch (err: any) {
                const isForbidden = err?.status === 403;
                if (!isForbidden) {
                    console.error('Failed to fetch data:', err);
                    setError('Ma\'lumotlarni yuklashda xatolik yuz berdi: ' + (err.message || 'Noma\'lum xatolik'));
                }
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [user, isJournalAdminUser, isSuperAdminUser]);

    const activeIssue = useMemo(() => {
        return issues.find((issue) => {
            const rawJ = issue.journalId ?? (issue as any).journal;
            const journalId =
                typeof rawJ === 'object' && rawJ !== null && 'id' in rawJ
                    ? String((rawJ as { id: string }).id)
                    : rawJ != null
                      ? String(rawJ)
                      : '';
            const pubDate = issue.publicationDate ?? (issue as any).publication_date;
            if (!journalId || !pubDate) return false;
            const d = new Date(pubDate);
            return journalId === String(selectedJournalId) && d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
        });
    }, [issues, selectedJournalId, selectedYear, selectedMonth]);

    const articlesForNewIssue = useMemo(() => {
        return articles.filter((article) => {
            const jId = getArticleJournalId(article);
            return (
                jId === selectedJournalId &&
                (article.status === 'Published' || article.status === 'published') &&
                new Date(article.submission_date).getFullYear() === selectedYear &&
                new Date(article.submission_date).getMonth() === selectedMonth
            );
        });
    }, [selectedJournalId, selectedYear, selectedMonth, articles]);

    const getPublicShareLink = (articleId: string) => {
        // HashRouter uchun to'g'ri URL format
        return `${window.location.origin}${window.location.pathname}#/public/article/${articleId}`;
    };

    const handleShareArticle = async (articleId: string) => {
        const shareUrl = getPublicShareLink(articleId);

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(shareUrl);
            } else {
                throw new Error('Clipboard API not available');
            }

            setCopiedArticleId(articleId);
            setTimeout(() => setCopiedArticleId(null), 2000);
        } catch (err) {
            window.prompt('Havolani nusxalang:', shareUrl);
        }
    };

    const handleSendPublicationDelivery = async (articleId: string) => {
        const article = articles.find((a) => a.id === articleId);
        const draftUrl = (pubUrlByArticle[articleId] ?? (article as any)?.publication_url ?? '').trim();
        const file = certFileByArticle[articleId] ?? null;
        if (!draftUrl && !file) {
            alert("Kamida bittasini kiriting: nashr havolasi (URL) yoki sertifikat fayli.");
            return;
        }
        if (file) {
            const ok = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(file.type);
            if (!ok) {
                alert("Sertifikat faqat PDF yoki JPG/PNG bo'lishi kerak.");
                return;
            }
        }
        setSendingDeliveryId(articleId);
        try {
            const fd = new FormData();
            if (draftUrl) fd.append('publication_url', draftUrl);
            if (file) fd.append('certificate', file);
            await apiService.articles.sendPublicationDelivery(articleId, fd);
            addNotification({
                message: 'Nashr havolasi/sertifikat saqlandi, muallifga bildirishnoma yuborildi.',
                link: '/published-articles',
            });
            const articlesData = await apiService.articles.list();
            setArticles(articlesData.results || articlesData);
            setCertFileByArticle((prev) => {
                const next = { ...prev };
                delete next[articleId];
                return next;
            });
            setPubUrlByArticle((prev) => {
                const next = { ...prev };
                delete next[articleId];
                return next;
            });
            alert("Ma'lumotlar saqlandi va muallifga xabar yuborildi.");
        } catch (err: any) {
            console.error(err);
            alert(err?.message || 'Yuborishda xatolik.');
        } finally {
            setSendingDeliveryId(null);
        }
    };

    if (!user || (!isJournalAdminUser && !isSuperAdminUser)) {
        return <Card title="Ruxsat Rad Etildi"><p>Ushbu sahifani ko'rish uchun sizda yetarli ruxsat yo'q.</p></Card>;
    }
    
    if (loading) {
        return (
            <Card title="Oylik Sonlar va Arxiv">
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <span className="ml-3">Ma'lumotlar yuklanmoqda...</span>
                </div>
            </Card>
        );
    }
    
    if (error) {
        return (
            <Card title="Xatolik">
                <div className="text-red-700 p-4 bg-red-900/20 rounded-lg">
                    <p>{error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                        Qayta urinib ko'rish
                    </button>
                </div>
            </Card>
        );
    }

    const handleCreateOrUpdateIssue = async () => {
        if (!selectedJournalId) {
            alert("Iltimos, jurnalni tanlang.");
            return;
        }
        if (!collectionPdf && !collectionUrl) {
            alert("Iltimos, oylik to'plamning faylini (DOC/DOCX/PDF) yuklang yoki havola kiriting.");
            return;
        }

        try {
            const issueIdentifier = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
            const monthName = MONTH_NAMES[selectedMonth];
            const journal = journals.find(j => j.id === selectedJournalId);
            
            // Ensure articlesForNewIssue is an array and has valid IDs
            const articleIds = Array.isArray(articlesForNewIssue) 
                ? articlesForNewIssue.map(a => a.id).filter(id => id !== undefined)
                : [];
            
            const issueData = {
                journal: selectedJournalId,
                issue_number: `${selectedYear}-${monthName}`,
                publication_date: new Date(selectedYear, selectedMonth, 28).toISOString().split('T')[0],
                articles: articleIds,
                collection_url: collectionUrl || ''
            };

            if (activeIssue) {
                // Update existing issue
                await apiService.journals.updateIssue(activeIssue.id, issueData, collectionPdf);
                addNotification({
                    message: `Jurnalning ${monthName} ${selectedYear} soni muvaffaqiyatli yangilandi!`,
                    link: '/published-articles'
                });
            } else {
                // Create new issue
                await apiService.journals.createIssue(issueData, collectionPdf);
                addNotification({
                    message: `Jurnalning ${monthName} ${selectedYear} soni muvaffaqiyatli yaratildi!`,
                    link: '/published-articles'
                });
            }

            // Refresh issues
            const issuesData = await apiService.journals.listIssues();
            setIssues(issuesData.results || issuesData);
            
            // Notify authors
            if (Array.isArray(articlesForNewIssue)) {
                articlesForNewIssue.forEach(article => {
                    const author = users.find(u => u.id === article.author);
                    if (author) {
                        addNotification({
                            message: `Sizning maqolangiz kiritilgan "${journal?.name}" jurnalining ${monthName} soni to'plami tayyor!`,
                            link: '/my-collections'
                        });
                    }
                });
            }

            alert(`Jurnalning ${monthName} ${selectedYear} soni muvaffaqiyatli saqlandi va mualliflarga xabar yuborildi.`);
            setCollectionPdf(null);
            setCollectionUrl('');
        } catch (err: any) {
            console.error('Failed to save issue:', err);
            alert('Sonni saqlashda xatolik yuz berdi: ' + (err.message || 'Noma\'lum xatolik'));
        }
    };

    return (
        <Card title="Oylik Sonlar va Arxiv">
            <p className="text-slate-600 mb-4 -mt-4">
                Bu yerda <strong className="text-slate-900">o‘z jurnallaringiz</strong> uchun oylik to‘plamlarni boshqarishingiz mumkin.
                {isSuperAdminUser && (
                    <span className="block mt-1 text-amber-950 text-sm">Super admin: barcha jurnallardan birini tanlashingiz mumkin.</span>
                )}
            </p>

            {managedJournals.length === 0 && !loading && (
                <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-100 text-sm">
                    <strong>Sizga biriktirilgan jurnal topilmadi.</strong> Agar bu xato bo‘lsa, super admin jurnal sozlamalarida sizni &quot;jurnal administratori&quot; sifatida biriktirganini tekshiring.
                </div>
            )}

            {managedJournals.length > 0 && (
                <div className="mb-4 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-sm text-slate-600">
                    <span className="text-slate-500">Siz boshqaradigan jurnal{managedJournals.length > 1 ? 'lar' : ''} </span>
                    <span className="text-slate-900 font-medium">
                        {managedJournals.map((j) => j.name).join(' · ')}
                    </span>
                    {managedJournals.length > 1 && (
                        <span className="text-slate-500"> ({managedJournals.length} ta)</span>
                    )}
                </div>
            )}
            
            <div className="p-4 bg-slate-100/70 rounded-lg mb-6 flex flex-col md:flex-row gap-4">
                {managedJournals.length > 0 && (
                    <div className="md:min-w-[220px] flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Jurnal (shu bo‘yicha son va maqolalar)</label>
                        <select 
                            value={selectedJournalId} 
                            onChange={e => setSelectedJournalId(e.target.value)} 
                            className="w-full bg-white/50 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900"
                            disabled={loading}
                        >
                            {managedJournals.map(j => (
                                <option key={j.id} value={j.id}>
                                    {j.name}{j.issn ? ` — ISSN ${j.issn}` : ''}
                                </option>
                            ))}
                        </select>
                        {selectedJournal && (
                            <p className="text-xs text-slate-500 mt-1.5">
                                Tanlangan: <span className="text-slate-600">{selectedJournal.name}</span>
                                {selectedJournal.issn ? ` · ISSN: ${selectedJournal.issn}` : ''}
                            </p>
                        )}
                    </div>
                )}
                <div>
                    <label className="text-sm">Yil</label>
                    <select 
                        value={selectedYear} 
                        onChange={e => setSelectedYear(parseInt(e.target.value))} 
                        className="w-full"
                        disabled={loading}
                    >
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-sm">Oy</label>
                    <select 
                        value={selectedMonth} 
                        onChange={e => setSelectedMonth(parseInt(e.target.value))} 
                        className="w-full"
                        disabled={loading}
                    >
                        {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </select>
                </div>
            </div>

            {activeIssue ? (
                <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                    <h3 className="text-xl font-bold text-emerald-900">
                        {MONTH_NAMES[selectedMonth]} {selectedYear} soni allaqachon yaratilgan.
                    </h3>
                    <p className="text-emerald-900 mt-2">Ma'lumotlarni yangilash uchun quyidagi formadan foydalanishingiz mumkin.</p>
                </div>
            ) : null}

            <div className="mt-6 space-y-6">
                <h3 className="text-lg font-semibold text-slate-900">{activeIssue ? "Ma'lumotlarni Yangilash" : "Yangi Son Yaratish"}</h3>
                <p className="text-sm text-slate-500">Tanlangan oy uchun <strong className="text-slate-900">{Array.isArray(articlesForNewIssue) ? articlesForNewIssue.length : 0}</strong> ta nashr etilgan maqola mavjud.</p>

                <div className="space-y-3">
                    {Array.isArray(articlesForNewIssue) && articlesForNewIssue.length > 0 ? (
                        articlesForNewIssue.map((article) => {
                            const pubLink = (article as any).publication_link as string | undefined;
                            const certLink = (article as any).certificate_download_link as string | undefined;
                            const rawUrl = (article as any).publication_url as string | undefined;
                            const urlInput =
                                pubUrlByArticle[article.id] ?? (typeof rawUrl === 'string' ? rawUrl : '');
                            return (
                            <div key={article.id} className="p-4 bg-slate-100/70 border border-slate-200/90 rounded-lg space-y-4">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-slate-900 font-medium">{article.title}</h4>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {new Date(article.submission_date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <Button
                                        onClick={() => handleShareArticle(article.id)}
                                        variant="secondary"
                                        className="w-full md:w-auto shrink-0"
                                    >
                                        <Share2 className="mr-2 h-4 w-4" />
                                        {copiedArticleId === article.id ? 'Havola nusxalandi' : 'Ochiq sahifa havolasi'}
                                    </Button>
                                </div>

                                {(pubLink || certLink) && (
                                    <div className="flex flex-wrap gap-3 text-sm border-t border-slate-200/90 pt-3">
                                        {pubLink ? (
                                            <a
                                                href={pubLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-blue-800 hover:text-blue-700"
                                            >
                                                <ExternalLink className="h-4 w-4" /> Nashr havolasi
                                            </a>
                                        ) : null}
                                        {certLink ? (
                                            <a
                                                href={certLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300"
                                            >
                                                <Download className="h-4 w-4" /> Sertifikat
                                            </a>
                                        ) : null}
                                    </div>
                                )}

                                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                                    <p className="text-xs font-semibold text-amber-950 flex items-center gap-2">
                                        <FileCheck className="h-4 w-4" /> Muallifga nashr havolasi va sertifikat
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Jurnal saytidagi maqola havolasini kiriting va/yoki sertifikat faylini yuklang.
                                        Saqlagach muallifga bildirishnoma boradi.
                                    </p>
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Nashr havolasi (URL)</label>
                                        <input
                                            type="url"
                                            className="w-full bg-white/95 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900 shadow-sm"
                                            placeholder="https://jurnal.uz/article/..."
                                            value={urlInput}
                                            onChange={(e) =>
                                                setPubUrlByArticle((p) => ({ ...p, [article.id]: e.target.value }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Sertifikat (PDF / JPG / PNG)</label>
                                        <input
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                                            className="text-sm text-slate-600 w-full file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-slate-900"
                                            onChange={(e) =>
                                                setCertFileByArticle((p) => ({
                                                    ...p,
                                                    [article.id]: e.target.files?.[0] ?? null,
                                                }))
                                            }
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        className="w-full sm:w-auto"
                                        disabled={sendingDeliveryId === article.id}
                                        onClick={() => handleSendPublicationDelivery(article.id)}
                                    >
                                        {sendingDeliveryId === article.id ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yuborilmoqda...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="mr-2 h-4 w-4" /> Muallifga yuborish
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                            );
                        })
                    ) : (
                        <div className="p-4 bg-slate-100/70 border border-slate-200/90 rounded-lg text-sm text-slate-500">
                            Tanlangan oy uchun nashr etilgan maqolalar topilmadi.
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">To'plam fayli (DOC/DOCX/PDF)</label>
                    <label htmlFor="collection-pdf-upload" className="cursor-pointer">
                        <div className="p-8 border-2 border-dashed rounded-lg border-slate-200 text-center bg-slate-100/70 hover:bg-white/10 transition-colors">
                            <UploadCloud className="mx-auto h-10 w-10 text-slate-500" />
                            <p className="mt-2 text-sm text-slate-500">{collectionPdf ? `Tanlangan: ${collectionPdf.name}` : 'DOC, DOCX yoki PDF faylni tanlang'}</p>
                        </div>
                        <input 
                            id="collection-pdf-upload" 
                            type="file" 
                            className="sr-only" 
                            onChange={(e) => setCollectionPdf(e.target.files ? e.target.files[0] : null)} 
                            accept=".pdf,.doc,.docx" 
                            disabled={loading}
                        />
                    </label>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">To'plam havolasi (ixtiyoriy)</label>
                    <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                        <input 
                            type="text" 
                            className="w-full !pl-10"
                            placeholder="https://jurnal-sayti.uz/arxiv/2025-09.pdf"
                            value={collectionUrl}
                            onChange={(e) => setCollectionUrl(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button 
                        onClick={handleCreateOrUpdateIssue} 
                        disabled={loading || (!collectionPdf && !collectionUrl && !activeIssue)}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yuklanmoqda...
                            </>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4"/> {activeIssue ? "Yangilash" : "Sonni Yopish va Saqlash"}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default PublishedArticles;