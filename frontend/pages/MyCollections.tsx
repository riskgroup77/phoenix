import React, { useMemo, useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Archive, Download, BookOpen, Loader2, Share2 } from 'lucide-react';

const MyCollections: React.FC = () => {
    const { user } = useAuth();
    const [issues, setIssues] = useState<any[]>([]);
    const [journals, setJournals] = useState<any[]>([]);
    const [articles, setArticles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch data from API
    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            
            setLoading(true);
            setError(null);
            
            try {
                const [issuesData, journalsData, articlesData] = await Promise.all([
                    apiService.journals.listIssues(),
                    apiService.journals.list(),
                    apiService.articles.list()
                ]);
                const toArray = (data: any): any[] =>
                    Array.isArray(data) ? data : (data?.results || data?.data || []);
                setIssues(toArray(issuesData));
                setJournals(toArray(journalsData));
                setArticles(toArray(articlesData));
            } catch (err: any) {
                console.error('Failed to fetch data:', err);
                setError('Ma\'lumotlarni yuklashda xatolik yuz berdi: ' + (err.message || 'Noma\'lum xatolik'));
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [user]);

    const myPublishedArticlesIds = useMemo(() => {
        if (!user) return [];
        return articles
            .filter(a => a.author === user.id && a.status === 'Published')
            .map(a => a.id);
    }, [user, articles]);

    const myCollections = useMemo(() => {
        return issues
            .filter(issue => {
                const articlesArray = Array.isArray(issue.articles) ? issue.articles : [];
                const hasMyArticle = articlesArray.some((articleId: string) => myPublishedArticlesIds.includes(articleId));
                const hasDownload = !!(issue.collection_url || issue.collection_file_url);
                return hasMyArticle && hasDownload;
            })
            .sort((a, b) => new Date(b.publication_date).getTime() - new Date(a.publication_date).getTime());
    }, [issues, myPublishedArticlesIds]);

    const getPublicCollectionLink = (issueId: string) => {
        const base = window.location.origin + window.location.pathname;
        return (base.endsWith('/') ? base : base + '/') + '#/public/collection/' + issueId;
    };

    const handleShareCollection = async (issueId: string) => {
        const link = getPublicCollectionLink(issueId);
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(link);
                alert('To\'plam havolasi nusxalandi. Havolani istalgan kishiga yuboring.');
            } else {
                window.prompt('Havolani nusxalang:', link);
            }
        } catch {
            window.prompt('Havolani nusxalang:', link);
        }
    };

    if (!user) {
        return <Card title="Xatolik"><p>Foydalanuvchi topilmadi.</p></Card>;
    }
    
    if (loading) {
        return (
            <Card title="Mening To'plamlarim">
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

    return (
        <Card title="Mening To'plamlarim">
            <p className="text-slate-600 mb-6 -mt-4">Bu yerda sizning maqolalaringiz kiritilgan jurnallarning oylik to'plamlarini topishingiz mumkin.</p>
            <div className="space-y-4">
                {myCollections.length > 0 ? (
                    myCollections.map(issue => {
                        const journal = journals.find(j => j.id === issue.journal);
                        return (
                             <div key={issue.id} className="p-5 bg-slate-100/70 rounded-xl border border-slate-200/90">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">{journal?.name}</h3>
                                        <p className="font-semibold text-blue-900 mt-1">{issue.issue_number} soni</p>
                                        <p className="text-xs text-slate-500 mt-2">
                                            Nashr sanasi: {new Date(issue.publication_date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                        {(issue.collection_file_url || issue.collection_url) && (
                                            <a
                                                href={issue.collection_file_url || issue.collection_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-block"
                                            >
                                                <Button variant="secondary" className="w-full sm:w-auto">
                                                    <Download className="mr-2 h-4 w-4" /> To'plamni Yuklash
                                                </Button>
                                            </a>
                                        )}
                                        <Button
                                            variant="secondary"
                                            className="w-full sm:w-auto"
                                            onClick={() => handleShareCollection(issue.id)}
                                        >
                                            <Share2 className="mr-2 h-4 w-4" /> Ulashish
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="text-center py-12">
                        <Archive className="mx-auto h-16 w-16 text-slate-500" />
                        <h3 className="mt-4 text-xl font-semibold text-slate-900">To'plamlar Hozircha Mavjud Emas</h3>
                        <p className="mt-2 text-sm text-slate-500">Maqolangiz biror sonda nashr etilganda va admin to'plam havolasini yuborganda, u shu yerda paydo bo'ladi.</p>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default MyCollections;