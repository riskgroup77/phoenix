import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Article, ArticleStatus, Role, Journal } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Search, Edit3, Eye, FileText, CheckCircle, XCircle, Clock, Users, FileEdit, BookOpen, TrendingUp } from 'lucide-react';
import { apiService } from '../services/apiService';
import { getArticleJournalIdFromApi } from '../utils/articleIds';

interface JournalAdminPanelProps {}

const JournalAdminPanel: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    const [articles, setArticles] = useState<Article[]>([]);
    const [journals, setJournals] = useState<Journal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'new' | 'pending' | 'all'>('new');
    
    // Fetch articles and journals for the admin
    useEffect(() => {
        const fetchAdminData = async () => {
            if (!user) return;
            
            try {
                setLoading(true);
                setError(null);
                
                // Fetch all journals managed by this admin
                const journalsResponse = await apiService.journals.list();
                let journalsArray: Journal[] = [];
                if (Array.isArray(journalsResponse)) {
                    journalsArray = journalsResponse;
                } else if (journalsResponse && typeof journalsResponse === 'object') {
                    if (Array.isArray(journalsResponse.data)) {
                        journalsArray = journalsResponse.data;
                    } else if (Array.isArray(journalsResponse.results)) {
                        journalsArray = journalsResponse.results;
                    } else {
                        journalsArray = [journalsResponse];
                    }
                }
                
                // Filter journals managed by current user - handle multiple possible field names
                const managedJournals = journalsArray.filter(j => {
                    // Check multiple possible field names for journal admin based on API response variations
                    const journal = j as any; // Type assertion to handle API field variations
                    const journalAdminId = j.journalAdminId || j.journal_admin || journal.admin_id || (journal.admin && journal.admin.id);
                    return journalAdminId === user.id;
                });
                const managedJournalIds = managedJournals.map(j => j.id);
                
                // Fetch articles for these journals
                const articlesResponse = await apiService.articles.list();
                let articlesArray: Article[] = [];
                if (Array.isArray(articlesResponse)) {
                    articlesArray = articlesResponse;
                } else if (articlesResponse && typeof articlesResponse === 'object') {
                    if (Array.isArray(articlesResponse.data)) {
                        articlesArray = articlesResponse.data;
                    } else if (Array.isArray(articlesResponse.results)) {
                        articlesArray = articlesResponse.results;
                    } else {
                        articlesArray = [articlesResponse];
                    }
                }
                
                const managedJournalIdSet = new Set(
                    managedJournalIds.map((id) => String(id).toLowerCase())
                );
                const filteredArticles = articlesArray.filter((article) => {
                    if (managedJournalIdSet.size === 0) return true;
                    const jid = getArticleJournalIdFromApi(article).toLowerCase();
                    return Boolean(jid && managedJournalIdSet.has(jid));
                });
                
                setArticles(filteredArticles);
                setJournals(managedJournals);
            } catch (err: any) {
                console.error('Failed to fetch admin data:', err);
                setError('Ma\'lumotlarni yuklashda xatolik yuz berdi.');
            } finally {
                setLoading(false);
            }
        };
        
        if (user?.role === Role.JournalAdmin) {
            fetchAdminData();
        }
    }, [user]);
    
    // Filter articles based on active tab
    const filteredArticles = useMemo(() => {
        let filtered = articles;
        
        if (activeTab === 'new') {
            filtered = articles.filter(
                (article) =>
                    article.status === ArticleStatus.Yangi || article.status === ArticleStatus.Draft
            );
        } else if (activeTab === 'pending') {
            filtered = articles.filter(article => 
                article.status === ArticleStatus.WithEditor || 
                article.status === ArticleStatus.QabulQilingan
            );
        }
        
        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(article => 
                article.title.toLowerCase().includes(query) ||
                article.abstract.toLowerCase().includes(query) ||
                article.keywords.some(keyword => keyword.toLowerCase().includes(query))
            );
        }
        
        return filtered;
    }, [articles, activeTab, searchQuery]);
    
    // Calculate counts for each tab
    const tabCounts = useMemo(() => {
        return {
            new: articles.filter(
                (a) => a.status === ArticleStatus.Yangi || a.status === ArticleStatus.Draft
            ).length,
            pending: articles.filter(a => 
                a.status === ArticleStatus.WithEditor || 
                a.status === ArticleStatus.QabulQilingan
            ).length,
            all: articles.length
        };
    }, [articles]);
    
    if (user?.role !== Role.JournalAdmin) {
        return (
            <Card title="Ruxsat Rad Etildi">
                <p>Ushbu sahifani ko'rish uchun sizda yetarli ruxsat yo'q.</p>
            </Card>
        );
    }
    
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
    
    const handleEditArticle = (articleId: string) => {
        navigate(`/articles/${articleId}`); // For now, just view the article, we'll implement a proper edit later
    };
    
    const handleViewArticle = (articleId: string) => {
        navigate(`/articles/${articleId}`);
    };
    
    const handleUpdateStatus = async (articleId: string, newStatus: ArticleStatus) => {
        try {
            await apiService.articles.updateStatus(articleId, newStatus);
            // Refresh the data
            const updatedArticles = articles.map(article => 
                article.id === articleId ? { ...article, status: newStatus } : article
            );
            setArticles(updatedArticles);
        } catch (err) {
            console.error('Failed to update article status:', err);
            setError('Maqola holatini yangilashda xatolik yuz berdi.');
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="text-center">
                    <div className="flex items-center justify-center mb-3">
                        <FileText className="h-8 w-8 text-blue-800" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">{tabCounts.new}</h3>
                    <p className="text-slate-500">Yangi Kelganlar</p>
                </Card>
                
                <Card className="text-center">
                    <div className="flex items-center justify-center mb-3">
                        <Clock className="h-8 w-8 text-yellow-800" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">{tabCounts.pending}</h3>
                    <p className="text-slate-500">Nashrni kutmoqda</p>
                </Card>
                
                <Card className="text-center">
                    <div className="flex items-center justify-center mb-3">
                        <BookOpen className="h-8 w-8 text-emerald-800" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900">{tabCounts.all}</h3>
                    <p className="text-slate-500">Jami nashrlar</p>
                </Card>
            </div>
            
            <Card title="Jurnal Administratori Paneli">
                <div className="mb-6 border-b border-slate-200/90 flex">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`px-4 py-3 font-medium text-sm transition-colors ${
                            activeTab === 'new'
                                ? 'border-b-2 border-blue-400 text-blue-800'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        Yangi Kelganlar <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === 'new' ? 'bg-blue-500/20 text-blue-900' : 'bg-white/10 text-slate-600'}`}>{tabCounts.new}</span>
                    </button>
                    
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-4 py-3 font-medium text-sm transition-colors ${
                            activeTab === 'pending'
                                ? 'border-b-2 border-yellow-400 text-yellow-800'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        Nashrni kutmoqda <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === 'pending' ? 'bg-yellow-500/20 text-yellow-900' : 'bg-white/10 text-slate-600'}`}>{tabCounts.pending}</span>
                    </button>
                    
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-4 py-3 font-medium text-sm transition-colors ${
                            activeTab === 'all'
                                ? 'border-b-2 border-green-400 text-emerald-800'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        Barcha Maqolalar <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === 'all' ? 'bg-green-500/20 text-emerald-900' : 'bg-white/10 text-slate-600'}`}>{tabCounts.all}</span>
                    </button>
                </div>
                
                <div className="flex items-center bg-slate-100/70 border border-slate-200/90 rounded-xl mb-6 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                    <Search className="text-slate-500 mx-4 shrink-0" size={20} />
                    <input
                        type="text"
                        placeholder="Maqola sarlavhasi bo'yicha qidirish..."
                        className="w-full !bg-transparent !border-none !py-3 !pr-4 !pl-0 !shadow-none !ring-0"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                
                <div className="space-y-4">
                    {filteredArticles.length > 0 ? (
                        filteredArticles.map(article => {
                            const statusData = {
                                [ArticleStatus.Draft]: { text: 'Qoralama', color: 'bg-gray-500/20 text-slate-600' },
                                [ArticleStatus.Yangi]: { text: 'Yangi', color: 'bg-blue-500/20 text-blue-900' },
                                [ArticleStatus.WithEditor]: { text: 'Redaktorda', color: 'bg-indigo-500/20 text-indigo-300' },
                                [ArticleStatus.QabulQilingan]: { text: 'Qabul Qilingan', color: 'bg-yellow-500/20 text-yellow-900' },
                                [ArticleStatus.Revision]: { text: 'Tahrirga qaytarilgan', color: 'bg-orange-500/20 text-orange-900' },
                                [ArticleStatus.Accepted]: { text: 'Qabul qilingan', color: 'bg-teal-500/20 text-teal-900' },
                                [ArticleStatus.Published]: { text: 'Nashr etilgan', color: 'bg-green-500/20 text-emerald-900' },
                                [ArticleStatus.Rejected]: { text: 'Rad etilgan', color: 'bg-red-500/20 text-red-800' },
                                [ArticleStatus.NashrgaYuborilgan]: { text: 'Nashrga Yuborilgan', color: 'bg-purple-500/20 text-purple-900' },
                                [ArticleStatus.WritingInProgress]: { text: 'Yozilmoqda', color: 'bg-cyan-500/20 text-cyan-900' },
                            }[article.status] || { text: article.status, color: 'bg-gray-500/20 text-slate-600' };
                            
                            return (
                                <div 
                                    key={article.id}
                                    className="p-5 bg-slate-100/70 rounded-xl hover:bg-white/10 transition-all duration-200 border border-transparent hover:border-slate-200/90"
                                >
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <h4 className="text-lg font-semibold text-slate-900">{article.title}</h4>
                                            <p className="text-sm text-slate-500 mt-2 line-clamp-2">{article.abstract}</p>
                                            
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {article.keywords.map((keyword, index) => (
                                                    <span key={index} className="text-xs px-2 py-1 bg-white/10 text-slate-600 rounded">
                                                        {keyword}
                                                    </span>
                                                ))}
                                            </div>
                                            
                                            <div className="flex justify-between items-center mt-4 text-xs text-slate-500">
                                                <span>{new Date(article.submissionDate).toLocaleDateString()}</span>
                                                <span>Sahifalar: {article.pageCount || 0}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${statusData.color}`}>
                                                {statusData.text}
                                            </span>
                                            
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleViewArticle(article.id)}
                                                    className="p-2 rounded-md hover:bg-white/10 transition-colors"
                                                    title="Ko'rish"
                                                >
                                                    <Eye className="h-4 w-4 text-blue-800" />
                                                </button>
                                                
                                                <button 
                                                    onClick={() => handleEditArticle(article.id)}
                                                    className="p-2 rounded-md hover:bg-white/10 transition-colors"
                                                    title="Tahrirlash"
                                                >
                                                    <Edit3 className="h-4 w-4 text-yellow-800" />
                                                </button>
                                                
                                                {article.status !== ArticleStatus.Accepted && article.status !== ArticleStatus.Published && (
                                                    <button 
                                                        onClick={() => handleUpdateStatus(article.id, ArticleStatus.Accepted)}
                                                        className="p-2 rounded-md hover:bg-white/10 transition-colors"
                                                        title="Qabul qilish"
                                                    >
                                                        <CheckCircle className="h-4 w-4 text-emerald-800" />
                                                    </button>
                                                )}
                                                
                                                {article.status !== ArticleStatus.Rejected && (
                                                    <button 
                                                        onClick={() => handleUpdateStatus(article.id, ArticleStatus.Rejected)}
                                                        className="p-2 rounded-md hover:bg-white/10 transition-colors"
                                                        title="Rad etish"
                                                    >
                                                        <XCircle className="h-4 w-4 text-red-700" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center text-slate-500 py-8">
                            {searchQuery 
                                ? `"${searchQuery}" bo'yicha hech narsa topilmadi.` 
                                : "Ushbu bo'limda hozircha maqolalar mavjud emas."}
                        </p>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default JournalAdminPanel;