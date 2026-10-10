import React, { useState, useMemo, useEffect, useCallback } from 'react';
import EmptyState from '../components/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArticleStatus, Role, TranslationStatus, User } from '../types';
import Card from '../components/ui/Card';
import EditorialTabs from '../components/EditorialTabs';
import EditorialPageHeader from '../components/EditorialPageHeader';
import { Search, FileText, Printer, Filter, X, BookOpen, FileDown } from 'lucide-react';
import Button from '../components/ui/Button';
import AuthorArticleReport from '../components/AuthorArticleReport';
import NashrHisobotCertificate, { NashrHisobotData } from '../components/NashrHisobotCertificate';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';
import { isStandalonePlagiarismArticle } from '../utils/antiplagiatFromArticle';
import { ArticleApiResponse, TranslationRequestApiResponse, JournalApiResponse, getArticleJournalId } from './articles/types';
import { journalAdminTabsBase, authorArticleTabs, convertToArticleType } from './articles/helpers';
import ArticleItem from './articles/ArticleItem';
import TranslationItem from './articles/TranslationItem';
import { useT } from '../i18n/LanguageContext';

const Articles: React.FC = () => {
    const { t: tt } = useT();
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
        let result = articlesToShow.filter((a) => !isStandalonePlagiarismArticle(a));

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
            setError(error?.message || tt("Maqolalar ma'lumotlarini yuklashda xatolik. Iltimos, keyinroq urinib ko'ring."));
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
        return <ListSkeleton rows={6} />;
    }
    
    if (error) {
        return (
            <Card title={tt('Xatolik')}>
                <p className="text-red-700">{error}</p>
                <Button onClick={() => { setError(null); fetchData(); }} className="mt-4">{tt('Qayta urinish')}</Button>
            </Card>
        );
    }

    const renderTabs = (tabs: {id: string, label: string, statuses?: (ArticleStatus | TranslationStatus)[]}[], tabCounts: {id: string, count: number}[]) => (
        <EditorialTabs
            tabs={tabs.map((tab) => ({
                id: tab.id,
                label: tt(tab.label),
                count: tabCounts.find((tc) => tc.id === tab.id)?.count ?? 0,
            }))}
            activeId={activeTab}
            onChange={setActiveTab}
        />
    );
    
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
                        <div className="editorial-empty py-8">
                            {searchQuery 
                                ? `"${searchQuery}" bo'yicha hech narsa topilmadi.` 
                                : tt("Yangi tarjima so'rovlari mavjud emas.")}
                        </div>
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
                    {searchQuery ? (
                        <EmptyState
                            compact
                            illustration="search"
                            title={`"${searchQuery}" bo'yicha hech narsa topilmadi`}
                            description={tt("Boshqa so'z bilan qidirib ko'ring yoki filtrni tozalang.")}
                        />
                    ) : userRole === Role.Author || userRole === 'author' ? (
                        <EmptyState
                            illustration="documents"
                            title={tt("Bu bo'limda hozircha maqola yo'q")}
                            description={tt("Maqola yuborganingizdan so'ng uning har bir bosqichini shu yerda kuzatasiz.")}
                            action={{ label: 'Maqola yuborish', to: '/submit' }}
                        />
                    ) : (
                        <EmptyState
                            illustration="inbox"
                            title={tt("Bu bo'limda hozircha maqola yo'q")}
                            description={tt("Yangi maqolalar kelganda shu yerda ko'rinadi.")}
                        />
                    )}
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
            <EditorialPageHeader
                title={tt(title)}
                actions={
                    user.role === Role.Author ? (
                        <>
                            <Button onClick={() => setShowReportModal(true)} variant="secondary">
                                <FileText className="mr-2 h-4 w-4" /> {tt("Barcha maqolalar bo'yicha ma'lumotnoma")}
                            </Button>
                            <Button onClick={() => setShowNashrHisobotModal(true)} variant="primary">
                                <BookOpen className="mr-2 h-4 w-4" /> {tt('Nashri haqida hisobot')}
                            </Button>
                        </>
                    ) : undefined
                }
            />
            <Card>
                {isReviewer && renderTabs(reviewerTabs, reviewerTabCounts)}
                {(userRole === Role.Author || userRole === 'author') && renderTabs(authorArticleTabs, authorTabCounts)}
                {isJournalAdmin && renderTabs(journalAdminTabs, journalAdminTabCounts)}
                {isSuperAdminUser && renderTabs(journalAdminTabs, superAdminTabCounts)}
                {isOperator && renderTabs(journalAdminTabs, superAdminTabCounts)}

                {/* Jurnal admin bir nechta jurnalda: jurnal bo'yicha filtrlash (alohida-alohida) */}
                {isJournalAdmin && journals.length > 1 && (
                    <div className="mb-4">
                        <label className="text-xs text-slate-500 mb-2 block">{tt("Jurnal bo'yicha")}</label>
                        <select
                            value={filterJournal}
                            onChange={(e) => setFilterJournal(e.target.value)}
                            className="w-full sm:w-auto min-w-[200px] bg-white/50 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">{tt('Barcha jurnallar')}</option>
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
                            placeholder={tt("Sarlavha, muallif yoki kalit so'z bo'yicha qidirish...")}
                            className="input-bare w-full !py-3 !pr-4 !pl-0"
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
                            <label className="text-xs text-slate-500 mb-1 block">{tt('Jurnal')}</label>
                            <select value={filterJournal} onChange={(e) => setFilterJournal(e.target.value)} className="w-full bg-white/50 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900">
                                <option value="">{tt('Barchasi')}</option>
                                {journals.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">{tt('Plagiat darajasi')}</label>
                            <select value={filterPlagiarism} onChange={(e) => setFilterPlagiarism(e.target.value)} className="w-full bg-white/50 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900">
                                <option value="">{tt('Barchasi')}</option>
                                <option value="low">{tt('Past (<20%)')}</option>
                                <option value="medium">{tt("O'rtacha (20-50%)")}</option>
                                <option value="high">{tt('Yuqori (>50%)')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">{tt('Sanadan')}</label>
                            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full bg-white/50 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">{tt('Sanagacha')}</label>
                            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full bg-white/50 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900" />
                        </div>
                    </div>
                )}

                {hasActiveFilters && (
                    <p className="text-xs text-slate-500 mb-4">{tt('Natijalar: {length} ta maqola topildi', { length: filteredArticles.length })}</p>
                )}

                {renderContent()}
            </Card>

            {showReportModal && user && (
                <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex justify-center items-center p-4 no-print">
                    <div className="w-full max-w-4xl h-[90vh] bg-white/50 rounded-lg shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-200/90 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-slate-900">{tt("Maqolalar bo'yicha ma'lumotnoma")}</h3>
                            <div className="flex gap-2">
                                <Button onClick={handlePrintReport} variant="primary">
                                    <Printer className="mr-2 h-4 w-4"/> {tt('Chop Etish')}
                                </Button>
                                <Button onClick={() => setShowReportModal(false)} variant="secondary">
                                    {tt('Yopish')}
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
                    documentNumber: user.id
                        ? `HSB-${String(user.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`
                        : `HSB-${Date.now().toString(36).toUpperCase()}`,
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
                                <h3 className="text-lg font-semibold text-slate-900">{tt('Maqolalar nashri haqida hisobot')}</h3>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={async () => {
                                            try {
                                                await (await import('../utils/exportNashrHisobotDocx')).downloadNashrHisobotDocx(nashrHisobotData);
                                                toast.success(tt('Hisobot .docx fayl sifatida yuklandi'));
                                            } catch (e) {
                                                toast.error(tt('Yuklab olishda xatolik'));
                                            }
                                        }}
                                        variant="primary"
                                        className="flex items-center gap-2"
                                    >
                                        <FileDown className="h-4 w-4" /> {tt('Yuklab olish (.docx)')}
                                    </Button>
                                    <Button onClick={() => window.print()} variant="primary">
                                        <Printer className="mr-2 h-4 w-4"/> {tt('Chop Etish / PDF')}
                                    </Button>
                                    <Button onClick={() => setShowNashrHisobotModal(false)} variant="secondary">
                                        {tt('Yopish')}
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
                                {publishedArticles.length > 0 ? (
                                    <NashrHisobotCertificate data={nashrHisobotData} />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <BookOpen size={64} className="text-gray-600 mb-4" />
                                        <h4 className="text-xl font-semibold text-slate-900 mb-2">{tt("Nashr etilgan maqolalar yo'q")}</h4>
                                        <p className="text-slate-500 max-w-md">
                                            {tt("Sizda hali nashr etilgan maqolalar mavjud emas. Maqolangiz nashr etilgandan so'ng bu yerda hisobot yaratishingiz mumkin bo'ladi.")}
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
