import React, { useState, useMemo, useEffect, useCallback } from 'react';
import EmptyState from '../components/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArticleStatus, Role, TranslationStatus } from '../types';
import Card from '../components/ui/Card';
import EditorialTabs from '../components/EditorialTabs';
import EditorialPageHeader from '../components/EditorialPageHeader';
import { Search, FileText, Filter, X } from 'lucide-react';
import Button from '../components/ui/Button';
import WorksReportModal from '../components/WorksReportModal';
import { apiService } from '../services/apiService';
import { isStandalonePlagiarismArticle } from '../utils/antiplagiatFromArticle';
import { ArticleApiResponse, TranslationRequestApiResponse, JournalApiResponse, getArticleJournalId } from './articles/types';
import { journalAdminTabsBase, authorArticleTabs, BOOK_ORDERS_TAB, matchesAuthorTab, SERVICE_DOCS_TAB } from './articles/helpers';
import ServiceDocItem, { ServiceDoc, SERVICE_DOC_TYPES } from '../components/ServiceDocItem';
import { isBookTitle } from '../utils/articleAuthorWorkflow';

/** Taqrizchining o'z taqrizi hali tugamagan (taklif / qabul qilingan / yozilmoqda) */
const ACTIVE_REVIEW = new Set(['pending', 'accepted', 'in_progress']);
const isActiveReview = (a: { my_review_status?: string | null }) => ACTIVE_REVIEW.has(String(a.my_review_status || ''));
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

    const isAuthorUser = userRole === Role.Author || userRole === 'author';
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState(() => {
        if (isReviewer) return 'reviews';
        if (isJournalAdmin || isSuperAdminUser || isOperator) return 'new';
        return 'all';
    });
    const [showReportModal, setShowReportModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [filterJournal, setFilterJournal] = useState('');
    const [filterPlagiarism, setFilterPlagiarism] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [searchParams] = useSearchParams();
    const [articles, setArticles] = useState<ArticleApiResponse[]>([]);
    const [translations, setTranslations] = useState<TranslationRequestApiResponse[]>([]);
    const [journals, setJournals] = useState<JournalApiResponse[]>([]);
    /** Muallifning UDK / DOI hujjatlari (arxivdan) — "Ishlarim" da ham ko'rinadi */
    const [serviceDocs, setServiceDocs] = useState<ServiceDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const hasActiveFilters = !!(filterJournal || filterPlagiarism || filterDateFrom || filterDateTo);
    const clearFilters = () => { setFilterJournal(''); setFilterPlagiarism(''); setFilterDateFrom(''); setFilterDateTo(''); };

    // Different tabs for different roles
    // FIX: Explicitly type the array to allow a union of statuses and avoid type errors.
    const reviewerTabs: { id: string; label: string; statuses: (ArticleStatus | TranslationStatus)[] }[] = [
        // Faol — taqrizchining o'z taqrizi kutilmoqda/yozilmoqda; yakunlangan — alohida (avval hammasi bitta ro'yxatda edi)
        { id: 'reviews', label: 'Faol taqrizlar', statuses: [ArticleStatus.QabulQilingan] },
        { id: 'reviews-done', label: 'Yakunlangan taqrizlar', statuses: [] },
        { id: 'translations', label: 'Tarjimalar', statuses: [TranslationStatus.Yangi, TranslationStatus.Jarayonda] },
    ];
    // Bosh admin / operator: kitob buyurtmalari alohida tabda (avval taqrizchilarda edi — ularda amal yo'q,
    // buyurtmada esa muallif manzili va telefoni bor). Jurnal muharririga kitoblar umuman ko'rinmaydi.
    const showBookTab = isSuperAdminUser || isOperator;
    const journalAdminTabs = useMemo(
        () => (showBookTab ? [...journalAdminTabsBase.slice(0, -1), BOOK_ORDERS_TAB, ...journalAdminTabsBase.slice(-1)] : journalAdminTabsBase),
        [showBookTab],
    );
    /** Tab bo'yicha filtr: kitob tabi — faqat kitoblar; holat tablari — kitoblarsiz; "Barchasi" — hammasi */
    const matchesStaffTab = (tab: { id: string; statuses?: (ArticleStatus | TranslationStatus)[] }, a: ArticleApiResponse) => {
        if (tab.id === 'all') return true;
        if (tab.id === BOOK_ORDERS_TAB.id) return isBookTitle(a.title);
        return !isBookTitle(a.title) && !!tab.statuses && (tab.statuses as ArticleStatus[]).includes(a.status as ArticleStatus);
    };

    let title = "Maqolalar";
    switch (userRole) {
        case Role.Author: 
        case 'author': 
            title = "Ilmiy ishlarim"; 
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
        if (isSuperAdminUser || isOperator) {
            const selectedTab = journalAdminTabs.find(t => t.id === activeTab);
            if (!selectedTab) return articles;
            return articles
                .filter((a) => matchesStaffTab(selectedTab, a))
                .sort((a, b) => (b.fast_track ? 1 : 0) - (a.fast_track ? 1 : 0));
        }
        if (userRole === Role.Author || userRole === 'author') {
            const selectedTab = authorArticleTabs.find(t => t.id === activeTab);
            if (!selectedTab) return articles;
            const list = articles.filter((a) => matchesAuthorTab(selectedTab, a));
            return list.sort((a, b) => (b.fast_track ? 1 : 0) - (a.fast_track ? 1 : 0));
        }
        if (isReviewer) {
            if (activeTab === 'translations') {
                return [];
            }
            if (activeTab === 'reviews' || activeTab === 'reviews-done') {
                // Backend taqrizchiga faqat o'ziga tayinlangan maqolalarni beradi; my_review_status — o'z taqrizi holati
                const wantActive = activeTab === 'reviews';
                return articles
                    .filter((a) => !isBookTitle(a.title) && isActiveReview(a) === wantActive)
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
        // Muallif o'z antiplagiat hujjatlarini ham holati bilan ko'radi; xodimlar ro'yxatida ular aralashmaydi
        let result = isAuthorUser ? articlesToShow : articlesToShow.filter((a) => !isStandalonePlagiarismArticle(a));

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
    }, [searchQuery, articlesToShow, filterJournal, filterPlagiarism, filterDateFrom, filterDateTo, isAuthorUser]);

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
            } else if (tab.id === 'reviews' || tab.id === 'reviews-done') {
                const wantActive = tab.id === 'reviews';
                count = articles.filter((a) => !isBookTitle(a.title) && isActiveReview(a) === wantActive).length;
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
        return journalAdminTabs.map(tab => ({ id: tab.id, count: articles.filter((a) => matchesStaffTab(tab, a)).length }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [articles, journalAdminTabs]);

    const authorTabCounts = useMemo(
        () => authorArticleTabs.map((tab) => ({
            id: tab.id,
            count: articles.filter((a) => matchesAuthorTab(tab, a)).length
                + (tab.id === 'all' || tab.id === SERVICE_DOCS_TAB ? serviceDocs.length : 0),
        })),
        [articles, serviceDocs],
    );

    const visibleServiceDocs = useMemo(() => {
        if (!isAuthorUser || (activeTab !== 'all' && activeTab !== SERVICE_DOCS_TAB)) return [];
        const q = searchQuery.trim().toLowerCase();
        return q ? serviceDocs.filter((d) => (d.title || '').toLowerCase().includes(q)) : serviceDocs;
    }, [isAuthorUser, activeTab, serviceDocs, searchQuery]);

    /**
     * Muallif: maqolalar va UDK/DOI hujjatlari bitta ro'yxatda — eng oxirgi yaratilgani eng yuqorida,
     * 20 tadan sahifalanadi.
     */
    const AUTHOR_PAGE_SIZE = 20;
    const [authorPage, setAuthorPage] = useState(1);
    const authorItems = useMemo(() => {
        if (!isAuthorUser) return [];
        const items = [
            ...filteredArticles.map((a) => ({ key: `a-${a.id}`, date: a.submission_date || '', article: a, doc: null as ServiceDoc | null })),
            ...visibleServiceDocs.map((d) => ({ key: `d-${d.id}`, date: d.date || '', article: null as ArticleApiResponse | null, doc: d })),
        ];
        return items.sort((x, y) => new Date(y.date || 0).getTime() - new Date(x.date || 0).getTime());
    }, [isAuthorUser, filteredArticles, visibleServiceDocs]);
    const authorPageCount = Math.max(1, Math.ceil(authorItems.length / AUTHOR_PAGE_SIZE));
    useEffect(() => {
        setAuthorPage(1);
    }, [activeTab, searchQuery, filterJournal, filterPlagiarism, filterDateFrom, filterDateTo]);
    useEffect(() => {
        if (authorPage > authorPageCount) setAuthorPage(authorPageCount);
    }, [authorPage, authorPageCount]);

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
            if (isAuthorUser) {
                try {
                    const archive: any = await apiService.auth.getArchive();
                    const items = (archive?.data ?? archive)?.items;
                    setServiceDocs((Array.isArray(items) ? items : []).filter((it: ServiceDoc) => SERVICE_DOC_TYPES.has(it.type)));
                } catch {
                    setServiceDocs([]);
                }
            }
            setJournals(journalsMerged);
        } catch (error: any) {
            setError(error?.message || tt("Maqolalar ma'lumotlarini yuklashda xatolik. Iltimos, keyinroq urinib ko'ring."));
        } finally {
            setLoading(false);
        }
    }, [user, fetchAllArticlesPages, fetchAllJournalsPages, isAuthorUser]);

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
            } else if (reviewerTabs.some((t) => t.id === tab) || journalAdminTabsBase.some((t) => t.id === tab) || tab === BOOK_ORDERS_TAB.id) {
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

        if (filteredArticles.length === 0 && visibleServiceDocs.length === 0) {
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

        if (isAuthorUser) {
            const from = (authorPage - 1) * AUTHOR_PAGE_SIZE;
            const pageItems = authorItems.slice(from, from + AUTHOR_PAGE_SIZE);
            const goTo = (p: number) => {
                setAuthorPage(p);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            const pages = Array.from({ length: authorPageCount }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === authorPageCount || Math.abs(p - authorPage) <= 2);
            return (
                <div className="space-y-4">
                    {pageItems.map((it) => (it.article ? renderArticleList([it.article]) : <ServiceDocItem key={it.key} doc={it.doc as ServiceDoc} />))}
                    {authorPageCount > 1 && (
                        <nav className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2" aria-label={tt('Sahifalar')}>
                            <p className="text-xs text-slate-500">
                                {tt('Jami {total} ta · {from}–{to} ko\'rsatilmoqda', {
                                    total: authorItems.length,
                                    from: from + 1,
                                    to: Math.min(from + AUTHOR_PAGE_SIZE, authorItems.length),
                                })}
                            </p>
                            <div className="flex items-center gap-1">
                                <Button type="button" variant="secondary" className="!px-3 !py-1.5 text-sm" disabled={authorPage === 1} onClick={() => goTo(authorPage - 1)}>
                                    ‹ {tt('Oldingi')}
                                </Button>
                                {pages.map((p, i) => (
                                    <React.Fragment key={p}>
                                        {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-slate-500">…</span>}
                                        <button
                                            type="button"
                                            onClick={() => goTo(p)}
                                            aria-current={p === authorPage ? 'page' : undefined}
                                            className={`min-w-[2.25rem] rounded-lg px-2.5 py-1.5 text-sm font-medium border transition-colors ${
                                                p === authorPage
                                                    ? 'bg-[var(--editorial-primary)] text-white border-[var(--editorial-primary)]'
                                                    : 'border-[var(--editorial-border)] text-[var(--editorial-primary)] hover:bg-slate-100/80'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    </React.Fragment>
                                ))}
                                <Button type="button" variant="secondary" className="!px-3 !py-1.5 text-sm" disabled={authorPage === authorPageCount} onClick={() => goTo(authorPage + 1)}>
                                    {tt('Keyingi')} ›
                                </Button>
                            </div>
                        </nav>
                    )}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {renderArticleList(filteredArticles)}
                {visibleServiceDocs.length > 0 && (
                    <>
                        {activeTab === 'all' && filteredArticles.length > 0 && (
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--editorial-primary)] pt-2">
                                {tt('UDK va DOI hujjatlari')}
                            </h3>
                        )}
                        {visibleServiceDocs.map((doc) => <ServiceDocItem key={doc.id} doc={doc} />)}
                    </>
                )}
            </div>
        );
    }

    return (
        <>
            <EditorialPageHeader
                title={tt(title)}
                actions={
                    user.role === Role.Author ? (
                        <Button onClick={() => setShowReportModal(true)} variant="primary">
                            <FileText className="mr-2 h-4 w-4" /> {tt("Barcha ilmiy ishlar bo'yicha ma'lumotnoma")}
                        </Button>
                    ) : undefined
                }
            />
            <Card>
                {isReviewer && renderTabs(reviewerTabs, reviewerTabCounts)}
                {(userRole === Role.Author || userRole === 'author') && (
                    <div className="mb-4">
                        <label htmlFor="author-status-filter" className="text-xs text-slate-500 mb-1 block">{tt("Holat bo'yicha")}</label>
                        <select
                            id="author-status-filter"
                            value={activeTab}
                            onChange={(e) => setActiveTab(e.target.value)}
                            className="w-full sm:w-auto min-w-[240px] bg-white/50 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500"
                        >
                            {/* "Barchasi" — birinchi va default */}
                            {[...authorArticleTabs.filter((tab) => tab.id === 'all'), ...authorArticleTabs.filter((tab) => tab.id !== 'all')].map((tab) => (
                                <option key={tab.id} value={tab.id}>
                                    {tt(tab.label)} ({authorTabCounts.find((tc) => tc.id === tab.id)?.count ?? 0})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
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
                <WorksReportModal onClose={() => setShowReportModal(false)} />
            )}
        </>
    );
};

export default Articles;
