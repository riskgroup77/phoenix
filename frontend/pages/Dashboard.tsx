import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import PhoneVerifyCard from '../components/PhoneVerifyCard';
import { Role, ArticleStatus, ARTICLE_STATUS_LABELS } from '../types';
import GirihPattern from '../components/GirihPattern';
import EmptyState from '../components/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import { formatUzDate } from '../utils/uzDate';
import { FileText, CheckCircle, Shield, Upload, Bell, CreditCard, Bot } from 'lucide-react';
import { apiService } from '../services/apiService';
import { txAmount } from '../utils/amount';
import { useT } from '../i18n/LanguageContext';
import ReviewerDashboard from './dashboard/ReviewerDashboard';
import JournalAdminDashboard from './dashboard/JournalAdminDashboard';
import SuperAdminDashboard from './dashboard/SuperAdminDashboard';
import AccountantDashboard from './dashboard/AccountantDashboard';

import { setAuthorUi } from '../utils/authorUi';
const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const { unreadCount, notifications } = useNotifications();
    const navigate = useNavigate();
    const { t } = useT();

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

    useEffect(() => {
        const fetchData = async () => {
            if (!user || user.role === Role.Operator) {
                setLoading(false);
                return;
            }
            
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

    // Operator uchun alohida panel (hooklardan keyin — React qoidalari buzilmaydi)
    if (user.role === Role.Operator) {
        return <Navigate to="/operator-dashboard" replace />;
    }

    if (loading) {
        return <PageSkeleton />;
    }

    if (error) {
        return (
            <EmptyState
                illustration="inbox"
                title={t("Ma'lumotlarni yuklab bo'lmadi")}
                description={error}
                action={{ label: t('Qayta urinish'), onClick: () => window.location.reload() }}
            />
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
                return { label: t('Nashr etildi'), className: 'pinm-badge pinm-badge--success' };
            }
            if (status === ArticleStatus.QabulQilingan || status === 'QabulQilingan') {
                return { label: t('Taqrizda'), className: 'pinm-badge pinm-badge--info' };
            }
            if (status === ArticleStatus.WithEditor || status === 'WithEditor') {
                return { label: t("Ko'rib chiqilmoqda"), className: 'pinm-badge pinm-badge--info' };
            }
            if (status === ArticleStatus.Revision || status === 'Revision') {
                return { label: t('Tahrirga qaytarildi'), className: 'pinm-badge pinm-badge--warning' };
            }
            if (status === ArticleStatus.Rejected || status === 'Rejected') {
                return { label: t('Rad etildi'), className: 'pinm-badge pinm-badge--danger' };
            }
            return { label: t(getStatusLabel(status)), className: 'pinm-badge pinm-badge--neutral' };
        };

        const validTransactions = Array.isArray(transactions) ? transactions : [];
        const totalPayments = validTransactions
            .filter((tx: any) => tx.status === 'completed')
            .reduce((sum, tx) => sum + Math.abs(txAmount(tx.amount)), 0);

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
                    title: art.title || t('Nomsiz maqola'),
                    meta: art.submission_date
                        ? formatUzDate(art.submission_date, true)
                        : '—',
                    badge,
                    sortAt: new Date(art.submission_date || 0).getTime(),
                    link: `/articles/${art.id}`,
                };
            }),
            ...validTransactions.slice(0, 8).map((tx: any) => ({
                id: `tx-${tx.id}`,
                icon: CreditCard,
                title: t(tx.service_label || tx.service_type || "To'lov"),
                meta: tx.created_at
                    ? formatUzDate(tx.created_at, true)
                    : '—',
                badge:
                    tx.status === 'completed'
                        ? { label: t("To'langan"), className: 'pinm-badge pinm-badge--success' }
                        : tx.status === 'pending'
                          ? { label: t('Kutilmoqda'), className: 'pinm-badge pinm-badge--info' }
                          : { label: t('Bekor qilingan'), className: 'pinm-badge pinm-badge--danger' },
                sortAt: new Date(tx.created_at || 0).getTime(),
                link: '/payments',
            })),
            ...(notifications || []).slice(0, 8).map((n: any) => ({
                id: `n-${n.id}`,
                icon: Bell,
                title: n.message || t('Yangi bildirishnoma'),
                meta: n.created_at
                    ? formatUzDate(n.created_at, true)
                    : t('Yaqinda'),
                badge: n.read
                    ? { label: t("O'qilgan"), className: 'pinm-badge pinm-badge--neutral' }
                    : { label: t('Yangi'), className: 'pinm-badge pinm-badge--info' },
                sortAt: new Date(n.created_at || Date.now()).getTime(),
                link: n.link || '/profile',
            })),
        ]
            .sort((a, b) => b.sortAt - a.sortAt)
            .slice(0, 5);

        const publishedCount = myArticles.filter(
            (a: any) => a.status === ArticleStatus.Published || a.status === 'Published',
        ).length;
        const inProgressCount = myArticles.filter((a: any) =>
            ['Yangi', 'WithEditor', 'QabulQilingan', 'NashrgaYuborilgan', 'PlagiarismReview'].includes(a.status),
        ).length;
        const revisionCount = myArticles.filter((a: any) => a.status === 'Revision').length;
        const heroSubtitle =
            myArticles.length === 0
                ? t('Ilmiy faoliyatingiz bir joyda: maqolalar, antiplagiat, UDK va DOI xizmatlari.')
                : [
                      inProgressCount > 0 ? t("{n} ta maqolangiz ko'rib chiqilmoqda", { n: inProgressCount }) : '',
                      revisionCount > 0 ? t('{n} tasi tahrirga qaytarilgan', { n: revisionCount }) : '',
                  ]
                      .filter(Boolean)
                      .join(', ') || t('Barcha maqolalaringiz holati quyida.');

        const services = [
            { to: '/udk-olish', mark: 'UDK', title: t("UDK ma'lumotnoma"), hint: t('Tasdiqlangan hujjat') },
            { to: '/doi-olish', mark: 'DOI', title: t('DOI raqami'), hint: t('Xalqaro identifikator') },
            { to: '/translation-service', mark: 'Aa', title: t('Tarjima'), hint: t("So'z bo'yicha narx") },
            { to: '/submit-book', mark: 'ISBN', title: t('Kitob nashri'), hint: t('Bosma va raqamli') },
        ];

        const formatShortDate = (value?: string) =>
            formatUzDate(value);

        return (
            <div className="flex flex-col gap-7">
                <section className="milliy-hero">
                    <GirihPattern opacity={0.12} />
                    <div className="relative flex flex-wrap items-end justify-between gap-5">
                        <div className="flex flex-col gap-2.5 max-w-2xl">
                            <h1 className="m-0 text-3xl sm:text-4xl leading-tight">{t('Assalomu alaykum, {name}!', { name: user.firstName })}</h1>
                            <p className="milliy-hero-sub m-0 text-base leading-relaxed">{heroSubtitle}</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setAuthorUi('ai');
                                    navigate('/ai');
                                }}
                                className="milliy-btn-on-band milliy-btn-on-band--ghost"
                            >
                                <Bot className="w-4 h-4" aria-hidden /> {t('AI yordamchi')}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/plagiarism-check')}
                                className="milliy-btn-on-band milliy-btn-on-band--ghost"
                            >
                                <Shield className="w-4 h-4" aria-hidden /> {t('Antiplagiat tekshiruvi')}
                            </button>
                            <button type="button" onClick={() => navigate('/submit')} className="milliy-btn-on-band">
                                <Upload className="w-4 h-4" aria-hidden /> {t('Maqola yuborish')}
                            </button>
                        </div>
                    </div>
                </section>

                <section aria-label={t("Ko'rsatkichlar")} className="milliy-hero-overlap grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                    <Link to="/articles" className="milliy-stat">
                        <span className="milliy-icon-tile"><FileText className="w-5 h-5" aria-hidden /></span>
                        <span className="flex flex-col min-w-0">
                            <span className="text-2xl sm:text-[28px] font-extrabold tabular-nums">{myArticles.length}</span>
                            <span className="text-sm font-semibold text-[var(--editorial-muted)]">{t('Maqolalar')}</span>
                        </span>
                    </Link>
                    <Link to="/articles" className="milliy-stat">
                        <span className="milliy-icon-tile"><CheckCircle className="w-5 h-5" aria-hidden /></span>
                        <span className="flex flex-col min-w-0">
                            <span className="text-2xl sm:text-[28px] font-extrabold tabular-nums">{publishedCount}</span>
                            <span className="text-sm font-semibold text-[var(--editorial-muted)]">{t('Nashr etilgan')}</span>
                        </span>
                    </Link>
                    <Link to="/payments" className="milliy-stat">
                        <span className="milliy-icon-tile"><CreditCard className="w-5 h-5" aria-hidden /></span>
                        <span className="flex flex-col min-w-0">
                            <span className="text-2xl sm:text-[28px] font-extrabold tabular-nums truncate">
                                {Math.round(totalPayments).toLocaleString('ru-RU').replace(/,/g, ' ')}
                            </span>
                            <span className="text-sm font-semibold text-[var(--editorial-muted)]">{t("To'lovlar, so'm")}</span>
                        </span>
                    </Link>
                    <Link to="/profile?tab=notifications" className="milliy-stat">
                        <span className="milliy-icon-tile"><Bell className="w-5 h-5" aria-hidden /></span>
                        <span className="flex flex-col min-w-0">
                            <span className="text-2xl sm:text-[28px] font-extrabold tabular-nums">{unreadCount}</span>
                            <span className="text-sm font-semibold text-[var(--editorial-muted)]">{t('Yangi xabarlar')}</span>
                        </span>
                    </Link>
                </section>

                <PhoneVerifyCard compact />

                <div className="flex flex-wrap gap-6 items-start">
                    <section aria-labelledby="author-recent" className="flex flex-col gap-3.5 min-w-0 flex-[2_1_520px]">
                        <div className="flex items-baseline justify-between gap-3">
                            <h2 id="author-recent" className="m-0 text-xl">{t("So'nggi maqolalar")}</h2>
                            <Link to="/articles" className="editorial-link text-sm font-bold">{t('Barchasi')}</Link>
                        </div>
                        {recentArticles.length === 0 ? (
                            <EmptyState
                                illustration="documents"
                                title={t('Hozircha maqola yuborilmagan')}
                                description={t("Birinchi maqolangizni yuboring — holatini shu yerda bosqichma-bosqich kuzatasiz.")}
                                action={{ label: t('Maqola yuborish'), to: '/submit', icon: Upload }}
                            />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {recentArticles.slice(0, 4).map((art: any) => {
                                    const badge = getPinmStatusStyle(art.status);
                                    const journalName = (art.journal_name && String(art.journal_name).trim()) || '';
                                    const dateLabel = formatShortDate(art.submission_date);
                                    return (
                                        <Link key={art.id} to={`/articles/${art.id}`} className="milliy-article-card">
                                            <span className={`${badge.className} self-start`}>{badge.label}</span>
                                            <span className="font-bold text-base leading-snug line-clamp-2">
                                                {art.title || t('Nomsiz maqola')}
                                            </span>
                                            <span className="text-[13px] text-[var(--editorial-muted)]">
                                                {[journalName, dateLabel].filter(Boolean).join(' · ')}
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section
                        aria-labelledby="author-services"
                        className="editorial-card flex flex-col gap-1.5 min-w-0 flex-[1_1_280px]"
                    >
                        <h2 id="author-services" className="m-0 mb-2 text-lg">{t('Xizmatlar')}</h2>
                        {services.map((svc) => (
                            <Link
                                key={svc.to}
                                to={svc.to}
                                className="flex items-center gap-3 min-h-[2.75rem] px-2 py-2 rounded-[10px] hover:bg-[var(--editorial-bg-alt)] transition-colors"
                            >
                                <span className="milliy-icon-tile milliy-icon-tile--sm text-[13px] font-extrabold">{svc.mark}</span>
                                <span className="flex flex-col min-w-0">
                                    <span className="font-bold text-[var(--editorial-text)]">{svc.title}</span>
                                    <span className="text-[13px] text-[var(--editorial-muted)]">{svc.hint}</span>
                                </span>
                            </Link>
                        ))}
                    </section>
                </div>

                {activityRows.length > 0 && (
                    <section aria-labelledby="author-activity" className="editorial-card overflow-hidden !p-0">
                        <div className="px-5 py-4 border-b border-[var(--editorial-border)]">
                            <h2 id="author-activity" className="m-0 text-lg">{t("So'nggi faoliyat")}</h2>
                        </div>
                        <ul className="divide-y divide-[var(--editorial-border)]">
                            {activityRows.map((row) => {
                                const RowIcon = row.icon;
                                const inner = (
                                    <>
                                        <span className="milliy-icon-tile milliy-icon-tile--sm">
                                            <RowIcon className="w-4 h-4" strokeWidth={2} aria-hidden />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-[var(--editorial-text)] truncate">{row.title}</p>
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
                                                className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--editorial-bg-alt)] transition-colors"
                                            >
                                                {inner}
                                            </Link>
                                        ) : (
                                            <div className="flex items-center gap-3 px-5 py-3.5">{inner}</div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}
            </div>
        );
    };

    switch (user.role) {
        case 'author':
            return renderAuthorDashboard();
        case 'reviewer':
            return (
                <ReviewerDashboard
                    firstName={user.firstName}
                    articles={Array.isArray(articles) ? articles : []}
                    doiRequests={doiRequests}
                    articleSampleRequests={articleSampleRequests}
                    translationRequests={translationRequests}
                    udkRequests={udkRequests}
                    onDoiUpdated={setDoiRequests}
                />
            );
        case 'journal_admin':
            return (
                <JournalAdminDashboard
                    userId={String(user.id)}
                    firstName={user.firstName}
                    articles={Array.isArray(articles) ? articles : []}
                    journals={Array.isArray(journals) ? journals : []}
                />
            );
        case 'super_admin':
            return (
                <SuperAdminDashboard
                    firstName={user.firstName}
                    stats={stats}
                    articles={Array.isArray(articles) ? articles : []}
                    transactions={Array.isArray(transactions) ? transactions : []}
                    users={Array.isArray(users) ? users : []}
                />
            );
        case 'accountant':
            return <AccountantDashboard firstName={user.firstName} transactions={Array.isArray(transactions) ? transactions : []} />;
        default:
            return (
                <EmptyState
                    illustration="inbox"
                    title={t('Xush kelibsiz, {name}!', { name: user.firstName })}
                    description={t("Ishlaringizni boshqarish uchun yuqoridagi menyudan foydalaning.")}
                />
            );
    }
};

export default Dashboard;
