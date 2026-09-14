import React, { useState, useEffect } from 'react';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import { Role, ArticleStatus, ARTICLE_STATUS_LABELS } from '../types';
import Card from '../components/ui/Card';
import EditorialPageHeader from '../components/EditorialPageHeader';
import { FileText, Edit3, UserCheck, CheckCircle, Users, Inbox, Clock, XCircle, DollarSign, User as UserIcon, Timer, ArrowRight, Wallet, Rocket, Shield, Bot, Eye, Download, TrendingUp, BarChart3, PieChart as PieChartIcon, Upload, BookOpen, Archive, ChevronRight, Languages, ExternalLink, Library, Bell, CreditCard } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../components/ui/Button';
import { useNavigate, Link } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { getArticleJournalIdFromApi } from '../utils/articleIds';
import { txAmount } from '../utils/amount';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const CHART_COLORS = ['#8b1538', '#eab308', '#0a7a8c', '#64748b', '#6b1029', '#c45a6a'];

const PinmSummaryCard: React.FC<{
  icon: React.ElementType;
  title: string;
  value: string | number;
  linkLabel: string;
  to: string;
}> = ({ icon: Icon, title, value, linkLabel, to }) => (
  <Link
    to={to}
    className="editorial-card block p-5 hover:border-[var(--editorial-primary)]/35 transition-colors"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="p-2.5 rounded-md bg-[rgba(139,21,56,0.08)] text-[var(--editorial-primary)]">
        <Icon className="w-5 h-5" strokeWidth={2} />
      </div>
    </div>
    <p className="mt-4 text-sm text-[var(--editorial-muted)]">{title}</p>
    <p className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-[var(--editorial-text)] tabular-nums">{value}</p>
    <p className="mt-3 text-sm font-medium text-[var(--editorial-primary)]">{linkLabel} →</p>
  </Link>
);

const StatCard: React.FC<{
  icon: React.ElementType;
  title: string;
  value: string | number;
  gradient: string;
  to?: string;
  animationDelay?: string;
}> = ({ icon: Icon, title, value, gradient, to, animationDelay = '0s' }) => {
  const cardContent = (
    <div
      className="dashboard-card-hover relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white/85 to-white/55 backdrop-blur-xl p-6 h-full shadow-[0_8px_40px_-16px_rgba(15,23,42,0.1)]"
      style={{ animationDelay }}
    >
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-30 blur-3xl ${gradient}`} />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-transparent via-transparent to-white/[0.03]" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">{title}</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight truncate tabular-nums">{value}</p>
        </div>
        <div className={`p-3.5 rounded-2xl shrink-0 ${gradient} shadow-lg`}>
          <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-white drop-shadow-sm" strokeWidth={2.5} />
        </div>
      </div>
      <div className={`relative mt-5 h-1.5 rounded-full ${gradient} opacity-90 shadow-sm`} />
    </div>
  );

  if (to) {
    return <Link to={to} className="block h-full">{cardContent}</Link>;
  }
  return <div className="h-full">{cardContent}</div>;
};

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const { unreadCount, notifications } = useNotifications();
    const navigate = useNavigate();
    
    // Operator uchun maxsus dashboard'ga yo'naltirish
    if (user?.role === Role.Operator) {
        navigate('/operator-dashboard');
        return null;
    }
    
    const [articles, setArticles] = useState<any[]>([]);
    const [journals, setJournals] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    /** Taqrizchi ishchi stoli: DOI, maqola namuna, tarjima, kitob buyurtmalari */
    const [doiRequests, setDoiRequests] = useState<any[]>([]);
    const [udkRequests, setUdkRequests] = useState<any[]>([]);
    const [articleSampleRequests, setArticleSampleRequests] = useState<any[]>([]);
    const [translationRequests, setTranslationRequests] = useState<any[]>([]);
    const [doiSavingId, setDoiSavingId] = useState<string | null>(null);
    const [doiLinkInputs, setDoiLinkInputs] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            
            try {
                setLoading(true);
                setError(null);

                // DRF: { results: [...] }, ba'zan { data: [...] } yoki to'g'ridan-to'g'ri massiv
                const processApiResponse = (data: any): any[] => {
                    if (Array.isArray(data)) {
                        return data;
                    }
                    if (data?.data && Array.isArray(data.data)) {
                        return data.data;
                    }
                    if (data?.results && Array.isArray(data.results)) {
                        return data.results;
                    }
                    return [];
                };

                let usersRaw: any = null;
                if (user.role === Role.SuperAdmin) {
                    try {
                        const [allUsersRes, journalAdminsRes] = await Promise.all([
                            apiService.users.list(),
                            apiService.users.list({ role: 'journal_admin' }),
                        ]);
                        const base = processApiResponse(allUsersRes);
                        const jaOnly = processApiResponse(journalAdminsRes);
                        const byId = new Map<string, any>();
                        [...base, ...jaOnly].forEach((u: any) => {
                            if (u?.id) byId.set(String(u.id), u);
                        });
                        usersRaw = Array.from(byId.values());
                    } catch (err) {
                        console.error('Failed to fetch users:', err);
                        usersRaw = null;
                    }
                }

                const roleNorm = String(user.role || '').toLowerCase();
                const [articlesData, journalsData, transactionsData] = await Promise.all([
                    apiService.articles.listAllForRole(roleNorm),
                    apiService.journals.list(),
                    apiService.payments.listTransactions()
                ]);

                const articlesArray = processApiResponse(articlesData);
                const journalsArray = processApiResponse(journalsData);
                const transactionsArray = processApiResponse(transactionsData);
                const usersArray = user.role === Role.SuperAdmin ? processApiResponse(usersRaw) : [];
                
                setArticles(articlesArray);
                setJournals(journalsArray);
                setUsers(usersArray);
                setTransactions(transactionsArray);

                if (user.role === Role.Reviewer || user.role === 'reviewer') {
                    try {
                        const [doiRes, sampleRes, transRes, udkRes] = await Promise.all([
                            apiService.doi.list(),
                            apiService.articleSample.list(),
                            apiService.translations.list(),
                            apiService.udc.requests.list()
                        ]);
                        setDoiRequests(processApiResponse(doiRes));
                        setArticleSampleRequests(processApiResponse(sampleRes));
                        setTranslationRequests(processApiResponse(transRes));
                        setUdkRequests(processApiResponse(udkRes));
                    } catch {
                        setDoiRequests([]);
                        setArticleSampleRequests([]);
                        setTranslationRequests([]);
                        setUdkRequests([]);
                    }
                }
                
                // Fetch stats for super admin
                if (user.role === Role.SuperAdmin) {
                    try {
                        const statsData = await apiService.users.stats();
                        setStats(statsData);
                    } catch (err) {
                        console.error('Failed to fetch stats:', err);
                    }
                }
            } catch (error: any) {
                setError(error?.message || 'Boshqaruv paneli ma\'lumotlarini yuklashda xatolik. Iltimos, keyinroq urinib ko\'ring.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    if (!user) return null;

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-[320px] gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--editorial-primary)] border-t-transparent" />
                <p className="text-[var(--editorial-muted)] text-sm">Yuklanmoqda...</p>
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

    const renderAuthorDashboard = () => {
        const validArticles = Array.isArray(articles) ? articles : [];
        const myArticles = validArticles.filter((a: any) => a.author === user.id);
        const recentArticles = [...myArticles]
            .sort((a: any, b: any) => new Date(b.submission_date || 0).getTime() - new Date(a.submission_date || 0).getTime())
            .slice(0, 5);
        const getStatusLabel = (status: string) => ARTICLE_STATUS_LABELS[status] || status;
        const getPinmStatusStyle = (status: string) => {
            if (status === ArticleStatus.Published || status === 'Published') {
                return { label: 'Nashr etildi', className: 'pinm-badge pinm-badge--success' };
            }
            if (status === ArticleStatus.QabulQilingan || status === 'QabulQilingan') {
                return { label: 'Yuborildi', className: 'pinm-badge pinm-badge--info' };
            }
            if (status === ArticleStatus.WithEditor || status === 'WithEditor') {
                return { label: 'Ko\'rib chiqilmoqda', className: 'pinm-badge pinm-badge--info' };
            }
            if (status === ArticleStatus.Revision || status === 'Revision') {
                return { label: 'Tahrirga qaytarildi', className: 'pinm-badge pinm-badge--warning' };
            }
            if (status === ArticleStatus.Rejected || status === 'Rejected') {
                return { label: 'Rad etildi', className: 'pinm-badge pinm-badge--danger' };
            }
            return { label: getStatusLabel(status), className: 'pinm-badge pinm-badge--neutral' };
        };

        const validTransactions = Array.isArray(transactions) ? transactions : [];
        const totalPayments = validTransactions
            .filter((t: any) => t.status === 'completed')
            .reduce((sum, t) => sum + Math.abs(txAmount(t.amount)), 0);

        type ActivityRow = {
            id: string;
            icon: React.ElementType;
            title: string;
            meta: string;
            badge: { label: string; className: string };
            sortAt: number;
            link?: string;
        };

        const activityRows: ActivityRow[] = [
            ...recentArticles.map((art: any) => {
                const badge = getPinmStatusStyle(art.status);
                return {
                    id: `art-${art.id}`,
                    icon: FileText,
                    title: art.title || 'Maqola yuborildi',
                    meta: art.submission_date
                        ? new Date(art.submission_date).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—',
                    badge,
                    sortAt: new Date(art.submission_date || 0).getTime(),
                    link: `/articles/${art.id}`,
                };
            }),
            ...validTransactions.slice(0, 8).map((tx: any) => ({
                id: `tx-${tx.id}`,
                icon: CreditCard,
                title: tx.service_type ? `To'lov: ${tx.service_type}` : "To'lov amalga oshirildi",
                meta: tx.created_at
                    ? new Date(tx.created_at).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—',
                badge:
                    tx.status === 'completed'
                        ? { label: 'Tasdiqlandi', className: 'pinm-badge pinm-badge--success' }
                        : tx.status === 'pending'
                          ? { label: 'Kutilmoqda', className: 'pinm-badge pinm-badge--info' }
                          : { label: 'Bekor qilindi', className: 'pinm-badge pinm-badge--danger' },
                sortAt: new Date(tx.created_at || 0).getTime(),
                link: '/profile',
            })),
            ...(notifications || []).slice(0, 8).map((n: any) => ({
                id: `n-${n.id}`,
                icon: Bell,
                title: n.message || 'Yangi bildirishnoma',
                meta: n.created_at
                    ? new Date(n.created_at).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Yaqinda',
                badge: n.read
                    ? { label: "O'qilgan", className: 'pinm-badge pinm-badge--neutral' }
                    : { label: 'Yangi', className: 'pinm-badge pinm-badge--info' },
                sortAt: new Date(n.created_at || Date.now()).getTime(),
                link: n.link || '/profile',
            })),
        ]
            .sort((a, b) => b.sortAt - a.sortAt)
            .slice(0, 5);

        return (
            <div className="space-y-8 max-w-6xl">
                <EditorialPageHeader
                    title={`Xush kelibsiz, ${user.firstName}`}
                    subtitle="Ilmiy faoliyatingizni boshqarish paneliga xush kelibsiz."
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <PinmSummaryCard
                        icon={FileText}
                        title="Jami maqolalarim"
                        value={myArticles.length}
                        linkLabel="Barchasini ko'rish"
                        to="/articles"
                    />
                    <PinmSummaryCard
                        icon={CreditCard}
                        title="Jami to'lovlar"
                        value={`${totalPayments.toLocaleString('uz-UZ')} so'm`}
                        linkLabel="To'lovlar tarixi"
                        to="/profile"
                    />
                    <PinmSummaryCard
                        icon={Bell}
                        title="Bildirishnomalar"
                        value={unreadCount}
                        linkLabel="Barchasini ko'rish"
                        to="/profile"
                    />
                </div>

                <div className="editorial-card overflow-hidden p-0">
                    <div className="px-5 py-4 border-b border-[var(--editorial-border)]">
                        <h2 className="font-serif text-base font-semibold text-[var(--editorial-text)]">So&apos;nggi faoliyat</h2>
                    </div>
                    {activityRows.length === 0 ? (
                        <div className="px-5 py-12 text-center text-[var(--editorial-muted)]">
                            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                            <p className="text-sm">Hozircha faoliyat yo&apos;q.</p>
                            <Button onClick={() => navigate('/submit')} className="mt-4">
                                <Upload className="mr-2 h-4 w-4" /> Maqola yuborish
                            </Button>
                        </div>
                    ) : (
                        <ul className="divide-y divide-[var(--editorial-border)]">
                            {activityRows.map((row) => {
                                const RowIcon = row.icon;
                                const inner = (
                                    <>
                                        <div className="p-2 rounded-md bg-[rgba(139,21,56,0.08)] text-[var(--editorial-primary)] shrink-0">
                                            <RowIcon className="w-4 h-4" strokeWidth={2} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-[var(--editorial-text)] truncate">{row.title}</p>
                                            <p className="text-xs text-[var(--editorial-muted)] mt-0.5">{row.meta}</p>
                                        </div>
                                        <span className={row.badge.className}>{row.badge.label}</span>
                                    </>
                                );
                                return (
                                    <li key={row.id}>
                                        {row.link ? (
                                            <Link
                                                to={row.link}
                                                className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--editorial-bg-alt)] transition-colors"
                                            >
                                                {inner}
                                            </Link>
                                        ) : (
                                            <div className="flex items-center gap-3 px-5 py-4">{inner}</div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        );
    };

    const handleDoiSaveLink = async (id: string) => {
        const link = (doiLinkInputs[id] || '').trim();
        if (!link || !link.startsWith('http')) {
            toast.warning('To\'g\'ri DOI link (URL) kiriting.');
            return;
        }
        setDoiSavingId(id);
        try {
            await apiService.doi.updateLink(id, link);
            toast.success('DOI link saqlandi. Muallifga bildirishnoma yuborildi.');
            setDoiLinkInputs((prev) => ({ ...prev, [id]: '' }));
            const res = await apiService.doi.list();
            const data = Array.isArray(res) ? res : (res?.results ?? res?.data ?? []);
            setDoiRequests(Array.isArray(data) ? data : []);
        } catch (err: any) {
            toast.error(err?.message || 'Saqlashda xatolik.');
        } finally {
            setDoiSavingId(null);
        }
    };

    const renderReviewerDashboard = () => {
        const validArticles = Array.isArray(articles) ? articles : [];
        const articlesForReview = validArticles
            .filter(a => a.status === 'QabulQilingan')
            .sort((a, b) => (b.fast_track ? 1 : 0) - (a.fast_track ? 1 : 0));
        const articlesInProgress = validArticles.filter(a => a.status === 'QabulQilingan');
        const doiSubmitted = (doiRequests || []).filter((r: any) => r.status === 'submitted');
        const bookOrders = validArticles.filter(
            (a) =>
                (a.title || '').trim().toUpperCase().startsWith('[KITOB]') &&
                a.status !== 'Published' &&
                a.status !== 'Rejected'
        );
        const translationsPending = (translationRequests || []).filter((t: any) => t.status === 'Yangi' || t.status === 'Jarayonda');
        const qualityLabels: Record<string, string> = { quyi: 'Quyi', orta: "O'rta", yuqori: 'Yuqori' };

        return (
            <div className="space-y-8 max-w-6xl mx-auto">
                <EditorialPageHeader
                    title={`Ishchi stol — ${user.firstName}`}
                    subtitle="Barcha buyurtmalar shu yerda: taqriz, DOI, maqola namuna, tarjima va kitob nashr."
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <PinmSummaryCard icon={Inbox} title="Taqrizga kelganlar" value={articlesForReview.length} linkLabel="Ko'rish" to="/articles" />
                    <PinmSummaryCard icon={Bot} title="DOI so'rovlari" value={doiSubmitted.length} linkLabel="Ko'rish" to="/doi-requests" />
                    <PinmSummaryCard icon={Languages} title="Tarjima buyurtmalari" value={translationsPending.length} linkLabel="Ko'rish" to="/articles?tab=translations" />
                    <PinmSummaryCard icon={BookOpen} title="Kitob nashr buyurtmalari" value={bookOrders.length} linkLabel="Ko'rish" to="/articles?tab=book-orders" />
                </div>

                {/* Taqrizga kelgan maqolalar */}
                <Card title="Taqrizga kelgan maqolalar">
                    <div className="space-y-4">
                        {articlesForReview.length > 0 ? (
                            articlesForReview.slice(0, 5).map((article: any) => {
                                const author = users.find((u: any) => u.id === article.author);
                                const journal = journals.find((j: any) => j.id === article.journal);
                                const authorLabel =
                                    (article.author_name && String(article.author_name).trim()) ||
                                    (author ? `${author.first_name} ${author.last_name}` : '') ||
                                    "Noma'lum";
                                const journalLabel =
                                    (article.journal_name && String(article.journal_name).trim()) ||
                                    (journal ? journal.name : '') ||
                                    "Noma'lum";
                                return (
                                    <div key={article.id} className="editorial-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                {article.fast_track && (
                                                    <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap bg-yellow-500/20 text-yellow-900 flex items-center gap-1.5">
                                                        <Rocket size={14} /> TOP
                                                    </span>
                                                )}
                                                <p className="font-semibold text-[var(--editorial-text)]">{article.title}</p>
                                            </div>
                                            <p className="text-sm text-[var(--editorial-muted)] mt-1">Muallif: {authorLabel} | Jurnal: {journalLabel}</p>
                                        </div>
                                        <Button onClick={() => navigate(`/articles/${article.id}`)} variant="secondary" className="w-full sm:w-auto">
                                            Ko'rib chiqish <ArrowRight className="ml-2 h-4 w-4"/>
                                        </Button>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="editorial-empty py-8">Hozircha taqriz uchun yangi so'rovlar yo'q.</div>
                        )}
                        {articlesForReview.length > 0 && (
                            <div className="pt-2 border-t border-[var(--editorial-border)]">
                                <Link to="/articles" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--editorial-primary)] hover:opacity-80">Barchasi <ArrowRight className="h-4 w-4" /></Link>
                            </div>
                        )}
                    </div>
                </Card>

                {/* DOI so'rovlari */}
                <Card title="DOI raqami olish — taqrizchida">
                    <p className="text-slate-500 text-sm mb-4">Mualliflar DOI so'rovi yuborgan. Link kiriting va saqlang — muallifga xabar ketadi.</p>
                    {doiSubmitted.length === 0 ? (
                        <div className="editorial-empty py-6">Kutilayotgan DOI so'rovlari yo'q.</div>
                    ) : (
                        <div className="space-y-4">
                            {doiSubmitted.map((req: any) => (
                                <div key={req.id} className="editorial-card flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-[var(--editorial-text)]">{req.author_short}</p>
                                        <p className="text-xs text-[var(--editorial-muted)]">{new Date(req.created_at).toLocaleDateString('uz-UZ')}</p>
                                        {req.file_url && (
                                            <a href={req.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[var(--editorial-primary)] hover:underline mt-1">
                                                <ExternalLink size={14} /> Fayl
                                            </a>
                                        )}
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <input
                                            type="url"
                                            placeholder="DOI link (https://...)"
                                            value={doiLinkInputs[req.id] || ''}
                                            onChange={(e) => setDoiLinkInputs((p) => ({ ...p, [req.id]: e.target.value }))}
                                            className="editorial-select flex-1 min-w-[200px]"
                                        />
                                        <Button
                                            onClick={() => handleDoiSaveLink(req.id)}
                                            disabled={doiSavingId === req.id}
                                            variant="secondary"
                                            className="shrink-0"
                                        >
                                            {doiSavingId === req.id ? 'Saqlanmoqda...' : 'Saqlash'}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Maqola namuna so'rovlari */}
                <Card title="Maqola namuna olish buyurtmalari">
                    <p className="text-slate-500 text-sm mb-4">Mualliflar maqola namunasi uchun buyurtma bergan.</p>
                    {(!articleSampleRequests || articleSampleRequests.length === 0) ? (
                        <div className="editorial-empty py-6">So'rovlar yo'q.</div>
                    ) : (
                        <ul className="space-y-3">
                            {articleSampleRequests.slice(0, 5).map((req: any) => (
                                <li key={req.id} className="editorial-card">
                                    <p className="font-medium text-[var(--editorial-text)]">{req.author_short}</p>
                                    <p className="text-sm text-[var(--editorial-body)] line-clamp-2">{req.topic}</p>
                                    <p className="text-xs text-[var(--editorial-muted)] mt-1">
                                        {new Date(req.created_at).toLocaleDateString('uz-UZ')} · {qualityLabels[req.quality_level] || req.quality_level} · {req.pages} sahifa
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                {/* Ilmiy tarjima buyurtmalari */}
                <Card title="Ilmiy tarjima buyurtmalari">
                    <p className="text-slate-500 text-sm mb-4">Tarjima qilish uchun kelgan buyurtmalar.</p>
                    {translationsPending.length === 0 ? (
                        <div className="editorial-empty py-6">Kutilayotgan tarjima buyurtmalari yo'q.</div>
                    ) : (
                        <ul className="space-y-3">
                            {translationsPending.slice(0, 5).map((tr: any) => (
                                <li key={tr.id}>
                                    <Link
                                        to={`/translations/${tr.id}`}
                                        className="editorial-card flex items-center justify-between gap-3 hover:border-[var(--editorial-primary)]/35 transition-colors"
                                    >
                                        <div>
                                            <p className="font-medium text-[var(--editorial-text)]">{tr.title}</p>
                                            <p className="text-sm text-[var(--editorial-muted)]">{tr.source_language} → {tr.target_language} · {tr.status}</p>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-[var(--editorial-muted)] shrink-0" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                    {translationsPending.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[var(--editorial-border)]">
                            <Link to="/articles?tab=translations" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--editorial-primary)] hover:opacity-80">Barcha tarjimalar <ArrowRight className="h-4 w-4" /></Link>
                        </div>
                    )}
                </Card>

                {/* Kitob nashr etish buyurtmalari */}
                <Card title="Kitob nashr etish buyurtmalari">
                    <p className="text-slate-500 text-sm mb-4">Kitob chop etish bo'yicha buyurtmalar.</p>
                    {bookOrders.length === 0 ? (
                        <div className="editorial-empty py-6">Hozircha buyurtmalar yo'q.</div>
                    ) : (
                        <ul className="space-y-3">
                            {bookOrders.slice(0, 5).map((a: any) => (
                                <li key={a.id}>
                                    <Link
                                        to={`/articles/${a.id}`}
                                        className="editorial-card flex items-center justify-between gap-3 hover:border-[var(--editorial-primary)]/35 transition-colors"
                                    >
                                        <div>
                                            <p className="font-medium text-[var(--editorial-text)]">{a.title}</p>
                                            <p className="text-sm text-[var(--editorial-muted)]">{a.status}</p>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-[var(--editorial-muted)] shrink-0" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        );
    };
    
    const renderJournalAdminDashboard = () => {
        /** journal_admin FK ba'zan UUID string, ba'zan { id } ko'rinishida keladi */
        const journalAdminUserIdFromJournal = (j: any): string => {
            const raw = j?.journal_admin ?? j?.journalAdminId ?? j?.journal_admin_id;
            if (raw == null || raw === '') return '';
            if (typeof raw === 'object' && raw !== null && 'id' in raw) {
                return String((raw as { id: string }).id);
            }
            return String(raw);
        };
        const journalsList = Array.isArray(journals) ? journals : [];
        /** Backend journal_admin uchun ro'yxatni allaqachon filtrlaydi; qo'shimcha ID tekshiruvi noto'g'ri bo'lsa ham jurnallar ko'rinsin */
        const managedJournals = journalsList.filter((j) => {
            const aid = journalAdminUserIdFromJournal(j);
            if (!aid) return true;
            return aid === String(user.id);
        });
        const managedJournalIds = managedJournals.map((j) => String(j.id));
        const managedJournalIdSet = new Set(managedJournalIds.map((id) => String(id).toLowerCase()));
        const validArticles = Array.isArray(articles) ? articles : [];
        /** Backend journal_admin uchun allaqachon journal__journal_admin bo'yicha filtrlangan. */
        const isManagedArticle = (a: any) => {
            if (managedJournalIdSet.size === 0) return true;
            const jid = getArticleJournalIdFromApi(a).toLowerCase();
            if (!jid) return false;
            return managedJournalIdSet.has(jid);
        };

        const pendingPublicationCount = validArticles.filter(
            (a) => isManagedArticle(a) && a.status === 'NashrgaYuborilgan'
        ).length;
        const newSubmissionsCount = validArticles.filter(
            (a) => isManagedArticle(a) && (a.status === 'Yangi' || a.status === 'Draft')
        ).length;

        const totalPublishedCount = validArticles.filter(
            (a) => isManagedArticle(a) && a.status === 'Published'
        ).length;

        return (
            <div className="space-y-8 max-w-6xl mx-auto">
                <EditorialPageHeader
                    title="Jurnal administratori paneli"
                    subtitle="Sizga biriktirilgan jurnallar va maqolalar holati."
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <PinmSummaryCard icon={Inbox} title="Yangi Kelganlar" value={newSubmissionsCount} linkLabel="Ko'rish" to="/articles" />
                   <PinmSummaryCard icon={Clock} title="Nashrni kutmoqda" value={pendingPublicationCount} linkLabel="Ko'rish" to="/articles?tab=ready" />
                   <PinmSummaryCard icon={CheckCircle} title="Jami nashrlar" value={totalPublishedCount} linkLabel="Ko'rish" to="/published-articles" />
                </div>

                <Card title="Mening jurnallarim">
                    <p className="text-[var(--editorial-muted)] text-sm mb-4">Sizga biriktirilgan barcha jurnallar. Maqolalar uchun jurnalni tanlang.</p>
                    {managedJournals.length === 0 ? (
                        <div className="editorial-empty py-8">
                            Hozircha sizga biriktirilgan jurnal yo&apos;q. Super administrator bilan bog&apos;laning.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {managedJournals.map((j: any) => (
                                <div
                                    key={j.id}
                                    className="editorial-card flex flex-col gap-3 hover:border-[var(--editorial-primary)]/35 transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 rounded-md bg-[rgba(139,21,56,0.08)] shrink-0">
                                            <BookOpen className="h-6 w-6 text-[var(--editorial-primary)]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-serif font-semibold text-[var(--editorial-text)] text-lg leading-snug line-clamp-2">{j.name || '—'}</h3>
                                            <p className="text-xs text-[var(--editorial-muted)] mt-1">ISSN: {j.issn || '—'}</p>
                                            {(j.category_name || j.category) && (
                                                <p className="text-sm text-[var(--editorial-muted)] mt-1 line-clamp-2">{j.category_name || (typeof j.category === 'object' && j.category?.name) || j.category}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-end mt-auto pt-2 border-t border-[var(--editorial-border)]">
                                        <Button
                                            variant="secondary"
                                            className="text-sm"
                                            onClick={() => navigate(`/articles?journal=${encodeURIComponent(String(j.id))}`)}
                                        >
                                            Maqolalar <ArrowRight className="ml-1 h-4 w-4" />
                                        </Button>
                                        <Link to="/published-articles">
                                            <Button variant="secondary" className="text-sm">Nashr etilganlar</Button>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        );
    };

    const renderSuperAdminDashboard = () => {
        const validTransactions = Array.isArray(transactions) ? transactions : [];
        const totalRevenue = stats?.finance?.total_revenue || validTransactions
            .filter(t => t.service_type !== 'top_up' && t.status === 'completed')
            .reduce((sum, t) => sum + Math.abs(txAmount(t.amount)), 0);
        const bookTransactions = validTransactions.filter(t => t.service_type === 'book_publication');
        const bookOrdersTotal = stats?.finance?.book_orders_total ?? bookTransactions.length;
        const bookOrdersCompleted = stats?.finance?.book_orders_completed ?? bookTransactions.filter(t => t.status === 'completed').length;
        const bookOrdersPending = stats?.finance?.book_orders_pending ?? bookTransactions.filter(t => t.status === 'pending').length;
        const bookOrdersFailed = stats?.finance?.book_orders_failed ?? bookTransactions.filter(t => t.status === 'failed').length;
        const bookTotalRevenue = stats?.finance?.book_total_revenue ?? bookTransactions
            .filter(t => t.status === 'completed')
            .reduce((sum, t) => sum + Math.abs(txAmount(t.amount)), 0);
        const totalUsersCount = stats?.users?.total || users.length;
        const totalAuthors = stats?.users?.authors || users.filter(u => u.role === Role.Author || u.role === 'author').length;
        const totalReviewers = stats?.users?.reviewers || users.filter(u => u.role === Role.Reviewer || u.role === 'reviewer').length;
        const validArticles = Array.isArray(articles) ? articles : [];
        const totalArticlesCount = stats?.articles?.total || validArticles.length;
        const newSubmissions = stats?.articles?.new_submissions || validArticles.filter(a => a.status === 'Yangi' || a.status === 'WithEditor').length;
        const inReview = stats?.articles?.in_review || validArticles.filter(a => a.status === 'QabulQilingan').length;
        const published = stats?.articles?.published || validArticles.filter(a => a.status === 'Published').length;
        const rejected = stats?.articles?.rejected || validArticles.filter(a => a.status === 'Rejected').length;
        const checked = validArticles.filter((a: any) => a.plagiarism_percentage != null && Number(a.plagiarism_percentage) > 0);
        const avgPlag = checked.length > 0 ? (checked.reduce((s: number, a: any) => s + Number(a.plagiarism_percentage || 0), 0) / checked.length).toFixed(1) : '0';
        const avgAi = checked.length > 0 ? (checked.reduce((s: number, a: any) => s + Number(a.ai_content_percentage || 0), 0) / checked.length).toFixed(1) : '0';
        const highPlag = checked.filter((a: any) => Number(a.plagiarism_percentage) >= 50).length;
        const roleNorm = (r: unknown) => String(r ?? '').toLowerCase();
        const journalAdminIdsFromJournals = new Set(
            journals
                .map((j: any) => {
                    const ja = j.journal_admin ?? j.journalAdminId ?? j.journal_admin_id;
                    if (ja != null && typeof ja === 'object' && 'id' in ja) return String((ja as { id: string }).id);
                    return ja != null ? String(ja) : '';
                })
                .filter(Boolean)
        );
        const journalAdmins = users.filter((u: any) => {
            const uid = String(u.id);
            if (roleNorm(u.role) === 'journal_admin') return true;
            if (journalAdminIdsFromJournals.has(uid)) return true;
            return false;
        });
        const topArticles = [...validArticles].sort((a: any, b: any) => (b.views_count || 0) - (a.views_count || 0)).slice(0, 5);

        const articleStatusData = [
            { name: 'Yangi', value: newSubmissions, color: CHART_COLORS[0] },
            { name: 'Taqrizda', value: inReview, color: CHART_COLORS[1] },
            { name: 'Nashr etilgan', value: published, color: CHART_COLORS[2] },
            { name: 'Rad etilgan', value: rejected, color: CHART_COLORS[3] },
        ].filter(d => d.value > 0);
        if (articleStatusData.length === 0) articleStatusData.push({ name: 'Maqolalar yo\'q', value: 1, color: '#6b7280' });

        const bookOrdersData = [
            { name: 'Muvaffaqiyatli', soni: bookOrdersCompleted, fill: '#22c55e' },
            { name: 'Kutilmoqda', soni: bookOrdersPending, fill: '#eab308' },
            { name: 'Muvaffaqiyatsiz', soni: bookOrdersFailed, fill: '#ef4444' },
        ];

        const serviceLabels: Record<string, string> = {
            'fast-track': 'Tezkor', 'publication_fee': 'Nashr', 'language_editing': 'Tahrir',
            'top_up': 'To\'ldirish', 'book_publication': 'Kitob', 'translation': 'Tarjima',
        };
        const recentTx = [...validTransactions].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Hayrli tong' : hour < 18 ? 'Hayrli kun' : 'Hayrli kech';

        return (
            <div className="space-y-8 pb-10 max-w-6xl mx-auto">
                <EditorialPageHeader
                    title="Platforma boshqaruvi"
                    subtitle={`${greeting}. Statistika, maqolalar va moliya bo'yicha barcha ko'rsatkichlar bir joyda.`}
                    actions={
                        <>
                            <Link to="/articles"><Button variant="secondary" className="text-sm"><FileText className="mr-2 h-4 w-4" /> Maqolalar</Button></Link>
                            <Link to="/users"><Button variant="secondary" className="text-sm"><Users className="mr-2 h-4 w-4" /> Foydalanuvchilar</Button></Link>
                            <Link to="/financials"><Button variant="secondary" className="text-sm"><DollarSign className="mr-2 h-4 w-4" /> Moliya</Button></Link>
                            <Link to="/journal-management"><Button variant="secondary" className="text-sm"><BarChart3 className="mr-2 h-4 w-4" /> Jurnallar</Button></Link>
                        </>
                    }
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <PinmSummaryCard icon={DollarSign} title="Jami tushum" value={`${(totalRevenue / 1000).toFixed(0)}k so'm`} linkLabel="Moliya" to="/financials" />
                    <PinmSummaryCard icon={Users} title="Foydalanuvchilar" value={totalUsersCount} linkLabel="Ko'rish" to="/users" />
                    <PinmSummaryCard icon={FileText} title="Jami maqolalar" value={totalArticlesCount} linkLabel="Ko'rish" to="/articles" />
                    <PinmSummaryCard icon={CheckCircle} title="Nashr etilgan" value={published} linkLabel="Ko'rish" to="/articles" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="editorial-card overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="p-2.5 rounded-md bg-[rgba(139,21,56,0.08)]">
                                    <PieChartIcon className="h-6 w-6 text-[var(--editorial-primary)]" />
                                </div>
                                <h3 className="text-lg font-serif font-bold text-[var(--editorial-text)]">Maqolalar holati</h3>
                            </div>
                            <div className="w-full" style={{ minHeight: 256, height: 256 }}>
                                <ResponsiveContainer width="100%" height={256}>
                                    <PieChart>
                                        <Pie data={articleStatusData} cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value" nameKey="name"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                            {articleStatusData.map((entry, index) => (
                                                <Cell key={index} fill={entry.color} stroke="rgba(0,0,0,0.25)" strokeWidth={2} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => [value, 'ta']} contentStyle={{ backgroundColor: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(12px)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 12px 40px -12px rgba(15,23,42,0.15)' }} labelStyle={{ color: '#0f172a', fontWeight: 600 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap gap-4 justify-center pt-4 border-t border-[var(--editorial-border)]">
                                {[{ l: 'Yangi', c: 'bg-[var(--editorial-primary)]', v: newSubmissions }, { l: 'Taqrizda', c: 'bg-amber-500', v: inReview }, { l: 'Nashr', c: 'bg-[var(--editorial-teal)]', v: published }, { l: 'Rad', c: 'bg-red-500', v: rejected }].map(({ l, c, v }) => (
                                    <span key={l} className="inline-flex items-center gap-2 text-sm text-[var(--editorial-muted)]"><span className={`w-2.5 h-2.5 rounded-full ${c} shadow-sm`} /> {l}: <span className="font-semibold text-[var(--editorial-text)]">{v}</span></span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="editorial-card overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="p-2.5 rounded-md bg-[rgba(139,21,56,0.08)]">
                                    <BarChart3 className="h-6 w-6 text-[var(--editorial-primary)]" />
                                </div>
                                <h3 className="text-lg font-serif font-bold text-[var(--editorial-text)]">Kitob buyurtmalari</h3>
                            </div>
                            <div className="w-full" style={{ minHeight: 256, height: 256 }}>
                                <ResponsiveContainer width="100%" height={256}>
                                    <BarChart data={bookOrdersData} layout="vertical" margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
                                        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                                        <YAxis type="category" dataKey="name" width={90} tick={{ fill: '#475569', fontSize: 12 }} />
                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(12px)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: '12px', boxShadow: '0 12px 40px -12px rgba(15,23,42,0.15)' }} labelStyle={{ color: '#0f172a', fontWeight: 600 }} />
                                        <Bar dataKey="soni" name="Soni" radius={[0, 6, 6, 0]}>{bookOrdersData.map((entry, index) => (<Cell key={index} fill={entry.fill} />))}</Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-between items-center text-sm pt-4 border-t border-[var(--editorial-border)]">
                                <span className="text-[var(--editorial-muted)]">Jami: <span className="font-semibold text-[var(--editorial-text)]">{bookOrdersTotal}</span></span>
                                <span className="font-semibold text-[var(--editorial-teal)]">Tushum: {(bookTotalRevenue / 1000).toFixed(0)}k so'm</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <PinmSummaryCard icon={Inbox} title="Yangi kelganlar" value={newSubmissions} linkLabel="Ko'rish" to="/articles" />
                    <PinmSummaryCard icon={Clock} title="Taqrizda" value={inReview} linkLabel="Ko'rish" to="/articles" />
                    <PinmSummaryCard icon={Shield} title="O'rtacha plagiat" value={`${avgPlag}%`} linkLabel="Maqolalar" to="/articles" />
                    <PinmSummaryCard icon={Bot} title="O'rtacha AI" value={`${avgAi}%`} linkLabel="Maqolalar" to="/articles" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card title="Eng ko'p ko'rilgan maqolalar" className="lg:col-span-2">
                        <div className="space-y-2">
                            {topArticles.length > 0 ? topArticles.map((a: any, i: number) => {
                                const rankStyle = i === 0 ? 'bg-[rgba(139,21,56,0.12)] text-[var(--editorial-primary)] border-[var(--editorial-primary)]/30' : i === 1 ? 'bg-slate-100 text-[var(--editorial-muted)] border-[var(--editorial-border)]' : i === 2 ? 'bg-amber-500/15 text-amber-900 border-amber-500/30' : 'bg-transparent text-[var(--editorial-muted)] border-[var(--editorial-border)]';
                                return (
                                    <Link key={a.id} to={`/articles/${a.id}`} className="editorial-card flex items-center gap-4 p-3 hover:border-[var(--editorial-primary)]/35 transition-colors group">
                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm font-bold ${rankStyle}`}>{i + 1}</span>
                                        <span className="flex-1 text-sm text-[var(--editorial-text)] truncate group-hover:text-[var(--editorial-primary)]">{a.title}</span>
                                        <span className="flex items-center gap-1 text-sm font-medium text-[var(--editorial-primary)] shrink-0"><Eye size={14} /> {a.views_count || 0}</span>
                                    </Link>
                                );
                            }) : (
                                <div className="editorial-empty py-12">Hozircha maqolalar yo'q</div>
                            )}
                        </div>
                    </Card>

                    <Card title="Jurnal adminlari">
                        <div className="space-y-3">
                            {journalAdmins.length > 0 ? journalAdmins.map((admin: any) => {
                                const aid = String(admin.id);
                                const mJournalIds = journals
                                    .filter((j: any) => {
                                        const ja = j.journal_admin ?? j.journalAdminId ?? j.journal_admin_id;
                                        const jid =
                                            ja != null && typeof ja === 'object' && ja !== null && 'id' in ja
                                                ? String((ja as { id: string }).id)
                                                : ja != null
                                                  ? String(ja)
                                                  : '';
                                        return jid === aid;
                                    })
                                    .map((j: any) => String(j.id));
                                const pubCount = validArticles.filter((a: any) => {
                                    const aj = getArticleJournalIdFromApi(a);
                                    return aj && mJournalIds.includes(aj) && a.status === 'Published';
                                }).length;
                                return (
                                    <div key={admin.id} className="editorial-card flex items-center gap-4 p-3">
                                        {admin.avatar_url || admin.avatarUrl ? (
                                            <img src={admin.avatar_url || admin.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-[var(--editorial-border)]" />
                                        ) : (
                                            <div className="h-11 w-11 rounded-full bg-[rgba(139,21,56,0.12)] ring-2 ring-[var(--editorial-border)] flex items-center justify-center text-[var(--editorial-primary)] font-bold text-sm">
                                                {(admin.first_name || admin.firstName || '?')[0]}{(admin.last_name || admin.lastName || '')[0]}
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-[var(--editorial-text)] truncate">{admin.first_name || admin.firstName} {admin.last_name || admin.lastName}</p>
                                            <p className="text-xs text-[var(--editorial-muted)]">Nashrlar: <span className="text-[var(--editorial-primary)] font-semibold">{pubCount}</span></p>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="editorial-empty py-10">Ro'yxat bo'sh</div>
                            )}
                        </div>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card title="So'ngi to'lovlar">
                        <div className="flex justify-end -mt-2 mb-3">
                            <Link to="/financials" className="text-sm text-[var(--editorial-primary)] hover:opacity-80 font-medium">Barchasi →</Link>
                        </div>
                        <div className="space-y-2">
                            {recentTx.length > 0 ? recentTx.map((t: any) => {
                                const isCompleted = t.status === 'completed';
                                const isFailed = t.status === 'failed' || t.status === 'cancelled';
                                const isPending = t.status === 'pending';
                                const amountStr = `${isFailed ? '' : '+'}${Number(t.amount || 0).toLocaleString()} so'm`;
                                return (
                                    <div key={t.id} className="editorial-card flex flex-col gap-1 p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-[var(--editorial-muted)]">{serviceLabels[t.service_type] || t.service_type}</span>
                                            <span className={`text-sm font-semibold ${
                                                isCompleted ? 'text-[var(--editorial-teal)]' : isFailed ? 'text-red-700' : 'text-amber-800'
                                            }`}>
                                                {amountStr}
                                                {isPending && <span className="text-xs font-normal text-[var(--editorial-muted)] ml-1">(kutilmoqda)</span>}
                                            </span>
                                        </div>
                                        {isFailed && (
                                            <p className="text-xs text-red-800/90">Sabab: {t.error_note || 'To\'lov bekor qilindi'}</p>
                                        )}
                                    </div>
                                );
                            }) : (
                                <div className="editorial-empty py-6">Tranzaksiyalar yo'q</div>
                            )}
                        </div>
                    </Card>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <PinmSummaryCard icon={UserIcon} title="Mualliflar" value={totalAuthors} linkLabel="Ko'rish" to="/users" />
                        <PinmSummaryCard icon={UserCheck} title="Taqrizchilar" value={totalReviewers} linkLabel="Ko'rish" to="/users" />
                        <PinmSummaryCard icon={TrendingUp} title="Yuqori plagiat ≥50%" value={highPlag} linkLabel="Maqolalar" to="/articles" />
                    </div>
                </div>
            </div>
        );
    };

    const serviceTypeNames: Record<string, string> = {
        'fast-track': 'Tezkor ko\'rib chiqish',
        'publication_fee': 'Nashr haqi',
        'language_editing': 'Tilni tahrirlash',
        'top_up': 'Hisobni to\'ldirish',
        'book_publication': 'Kitob nashri',
        'translation': 'Tarjima',
    };

    const renderAccountantDashboard = () => {
        const validTransactions = Array.isArray(transactions) ? transactions : [];
        const successfulTransactions = validTransactions.filter(t => t.status === 'completed' && t.service_type !== 'top_up');
        const totalRevenue = successfulTransactions.reduce((sum, t) => sum + Math.abs(txAmount(t.amount)), 0);
        
        const today = new Date().toISOString().split('T')[0];
        const todaysTransactions = successfulTransactions.filter(t => {
            const transactionDate = new Date(t.created_at).toISOString().split('T')[0];
            return transactionDate === today;
        });
        const revenueToday = todaysTransactions.reduce((sum, t) => sum + Math.abs(txAmount(t.amount)), 0);

        // Calculate weekly revenue
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const weeklyTransactions = successfulTransactions.filter(t => {
            const transactionDate = new Date(t.created_at);
            return transactionDate >= oneWeekAgo;
        });
        const revenueThisWeek = weeklyTransactions.reduce((sum, t) => sum + Math.abs(txAmount(t.amount)), 0);

        return (
            <div className="space-y-8">
                <h2 className="text-3xl font-bold text-slate-900">Moliyachi Boshqaruv Paneli</h2>
                <p className="text-slate-600 -mt-6">Platformaning moliyaviy holatini kuzatib boring.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   <StatCard icon={DollarSign} title="Jami Tushum" value={`${(totalRevenue / 1000).toFixed(0)}k so'm`} gradient="bg-gradient-to-r from-green-500 to-emerald-400" to="/financials" />
                   <StatCard icon={Wallet} title="Bugungi Tushum" value={`${revenueToday.toLocaleString()} so'm`} gradient="bg-gradient-to-r from-blue-500 to-cyan-400" to="/financials" />
                   <StatCard icon={FileText} title="Bugungi Tranzaksiyalar" value={todaysTransactions.length} gradient="bg-gradient-to-r from-yellow-500 to-orange-400" to="/financials" />
                   <StatCard icon={Timer} title="Haftalik Tushum" value={`${(revenueThisWeek / 1000).toFixed(0)}k so'm`} gradient="bg-gradient-to-r from-purple-500 to-indigo-400" to="/financials" />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card title="So'ngi Tranzaksiyalar">
                        <div className="space-y-4">
                            {validTransactions.slice(0, 5).map(transaction => {
                                const user = users.find(u => u.id === transaction.user);
                                const userName = user ? `${user.first_name} ${user.last_name}` : 'Noma\'lum foydalanuvchi';
                                const isCompleted = transaction.status === 'completed';
                                const isFailed = transaction.status === 'failed' || transaction.status === 'cancelled';
                                const isPending = transaction.status === 'pending';
                                const amountStr = `${isFailed ? '' : '+'}${Number(transaction.amount || 0).toLocaleString()} so'm`;
                                return (
                                    <div key={transaction.id} className="p-4 bg-slate-100/70 rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium text-slate-900">{userName}</p>
                                                <p className="text-sm text-slate-500">
                                                    {serviceTypeNames[transaction.service_type] || transaction.service_type || 'Noma\'lum xizmat'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-medium ${isCompleted ? 'text-emerald-800' : isFailed ? 'text-red-700' : 'text-yellow-800'}`}>
                                                    {amountStr}
                                                    {isPending && <span className="text-xs font-normal text-slate-500 ml-1">(kutilmoqda)</span>}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {new Date(transaction.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        {isFailed && (
                                            <p className="text-xs text-red-800/90 mt-1">Sabab: {transaction.error_note || 'To\'lov bekor qilindi'}</p>
                                        )}
                                    </div>
                                );
                            })}
                            
                            {validTransactions.length === 0 && (
                                <p className="text-center text-slate-500 py-4">Hozircha tranzaksiyalar mavjud emas.</p>
                            )}
                        </div>
                    </Card>
                    
                    <Card title="To'lov Statistikasi">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Muvaffaqiyatli to'lovlar</span>
                                <span className="font-medium text-slate-900">
                                    {validTransactions.filter(t => t.status === 'completed').length}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Kutilayotgan to'lovlar</span>
                                <span className="font-medium text-slate-900">
                                    {validTransactions.filter(t => t.status === 'pending').length}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Muvaffaqiyatsiz to'lovlar</span>
                                <span className="font-medium text-slate-900">
                                    {validTransactions.filter(t => t.status === 'failed').length}
                                </span>
                            </div>
                            <div className="pt-4 mt-4 border-t border-slate-200/90">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Umumiy tranzaksiyalar</span>
                                    <span className="font-bold text-slate-900">{validTransactions.length}</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
                
                <Card title="Tezkor Amallar">
                    <div className="flex flex-wrap gap-4 justify-center">
                        <Link
                            to="/financials"
                            className="inline-flex items-center justify-center px-6 py-3 font-semibold rounded-full bg-white/10 text-slate-900 hover:bg-white/20 border border-slate-200/90 focus:ring-4 focus:ring-white/30 transition-all duration-200"
                        >
                            Batafsil Moliyaviy Hisobot <ArrowRight className="ml-2 h-4 w-4"/>
                        </Link>
                    </div>
                </Card>
            </div>
        );
    };

    const renderOperatorDashboard = () => {
        return (
            <div className="space-y-6">
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-blue-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-900 mb-1">Jami so'rovlar</p>
                                <p className="text-3xl font-bold text-slate-900">{stats?.totalRequests || 0}</p>
                            </div>
                            <FileText className="w-12 h-12 text-blue-800 opacity-50" />
                        </div>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border-yellow-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-yellow-900 mb-1">Tekshiruvda</p>
                                <p className="text-3xl font-bold text-slate-900">{stats?.pendingRequests || 0}</p>
                            </div>
                            <Clock className="w-12 h-12 text-yellow-800 opacity-50" />
                        </div>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-green-500/20 to-green-600/20 border-green-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-emerald-900 mb-1">Yakunlangan</p>
                                <p className="text-3xl font-bold text-slate-900">{stats?.completedRequests || 0}</p>
                            </div>
                            <CheckCircle className="w-12 h-12 text-emerald-800 opacity-50" />
                        </div>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-purple-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-purple-900 mb-1">Rad etilgan</p>
                                <p className="text-3xl font-bold text-slate-900">{stats?.rejectedRequests || 0}</p>
                            </div>
                            <XCircle className="w-12 h-12 text-purple-400 opacity-50" />
                        </div>
                    </Card>
                </div>

                {/* Quick Actions */}
                <Card title="Tezkor Amallar">
                    <div className="flex flex-wrap gap-4">
                        <Link
                            to="/all-requests"
                            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                        >
                            <FileText className="w-5 h-5 mr-2" />
                            Barcha So'rovlar
                        </Link>
                        <Link
                            to="/doi-requests"
                            className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                        >
                            <Bot className="w-5 h-5 mr-2" />
                            DOI So'rovlari
                        </Link>
                        <Link
                            to="/udk-requests"
                            className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                        >
                            <Library className="w-5 h-5 mr-2" />
                            UDK So'rovlari
                        </Link>
                    </div>
                </Card>

                {/* Recent Requests */}
                <Card title="Oxirgi So'rovlar">
                    <p className="text-slate-600">Bu yerda oxirgi so'rovlar ko'rsatiladi...</p>
                </Card>
            </div>
        );
    };

    const renderDefaultDashboard = () => (
        <Card>
            <h2 className="text-3xl font-bold text-slate-900">Xush kelibsiz, {user.firstName}!</h2>
            <p className="text-slate-600 mt-2">PINM tizimiga xush kelibsiz. Ishlaringizni boshqarish uchun yon menyudan foydalaning.</p>
        </Card>
    );

    switch (user.role) {
        case 'author':
            return renderAuthorDashboard();
        case 'reviewer':
            return renderReviewerDashboard();
        case 'journal_admin':
            return renderJournalAdminDashboard();
        case 'super_admin':
            return renderSuperAdminDashboard();
        case 'accountant':
            return renderAccountantDashboard();
        case 'operator':
            return renderOperatorDashboard();
        default:
            return renderDefaultDashboard();
    }
};

export default Dashboard;