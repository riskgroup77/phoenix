import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Role, ArticleStatus } from '../types';
import { FileText, Search, Filter, Eye, Calendar, User, BookOpen, Clock, CheckCircle, XCircle } from 'lucide-react';
import { apiService } from '../services/apiService';

interface Request {
    id: string;
    articleTitle?: string;
    authorName?: string;
    authorId?: string;
    journalName?: string;
    journalId?: string;
    serviceType: 'DOI' | 'UDK' | 'ArticleSample' | 'PlagiarismCheck' | 'Translation' | 'BookPublication';
    status: ArticleStatus | 'pending' | 'in_progress' | 'completed' | 'rejected';
    createdAt: string;
    assignedTo?: string;
    assignedRole?: 'reviewer' | 'journal_admin';
}

const AllRequests: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        try {
            setLoading(true);
            // TODO: Backend API bitta umumiy endpoint qilish kerak
            // Hozircha mock data ishlatamiz
            const mockRequests: Request[] = [
                {
                    id: '1',
                    articleTitle: 'Sun\'iy intellekt rivoji',
                    authorName: 'Aliyev Vali',
                    journalName: 'Ilmiy Axborot',
                    serviceType: 'DOI',
                    status: ArticleStatus.PlagiarismReview,
                    createdAt: '2026-03-13T10:00:00Z',
                    assignedTo: 'Reviewer 1',
                    assignedRole: 'reviewer'
                },
                {
                    id: '2',
                    articleTitle: 'Iqtisodiy islohotlar',
                    authorName: 'Valiyeva Madina',
                    journalName: 'Iqtisodiyot Va Innovatsiyalar',
                    serviceType: 'UDK',
                    status: ArticleStatus.WithEditor,
                    createdAt: '2026-03-13T09:30:00Z',
                    assignedTo: 'Journal Admin 1',
                    assignedRole: 'journal_admin'
                },
                {
                    id: '3',
                    articleTitle: 'Pedagogik texnologiyalar',
                    authorName: 'Rustamov Botir',
                    journalName: 'Ta\'lim Texnologiyalari',
                    serviceType: 'ArticleSample',
                    status: ArticleStatus.ContractProcessing,
                    createdAt: '2026-03-12T14:20:00Z',
                },
                {
                    id: '4',
                    articleTitle: 'Tibbiyot yutuqlari',
                    authorName: 'Karimova Zebo',
                    journalName: 'Tibbiyot Jurnali',
                    serviceType: 'PlagiarismCheck',
                    status: ArticleStatus.Published,
                    createdAt: '2026-03-12T11:15:00Z',
                    assignedTo: 'Journal Admin 2',
                    assignedRole: 'journal_admin'
                },
            ];
            setRequests(mockRequests);
        } catch (error) {
            console.error('Failed to load requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const getServiceTypeColor = (type: string) => {
        switch (type) {
            case 'DOI': return 'bg-blue-100 text-blue-800';
            case 'UDK': return 'bg-purple-100 text-purple-800';
            case 'ArticleSample': return 'bg-green-100 text-green-800';
            case 'PlagiarismCheck': return 'bg-yellow-100 text-yellow-800';
            case 'Translation': return 'bg-pink-100 text-pink-800';
            case 'BookPublication': return 'bg-indigo-100 text-indigo-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusDisplayData = (status: string): { text: string; color: string } => {
        const map: Record<string, { text: string; color: string }> = {
            [ArticleStatus.Yangi]: { text: 'Yangi', color: 'text-blue-600 bg-blue-50' },
            [ArticleStatus.WithEditor]: { text: 'Redaktorda', color: 'text-indigo-600 bg-indigo-50' },
            [ArticleStatus.PlagiarismReview]: { text: 'Antiplagiat tekshiruvi', color: 'text-pink-600 bg-pink-50' },
            [ArticleStatus.ContractProcessing]: { text: 'Shartnoma jarayonda', color: 'text-orange-600 bg-orange-50' },
            [ArticleStatus.Published]: { text: 'Nashr etilgan', color: 'text-green-600 bg-green-50' },
            pending: { text: 'Kutilmoqda', color: 'text-gray-600 bg-gray-50' },
            in_progress: { text: 'Jarayonda', color: 'text-blue-600 bg-blue-50' },
            completed: { text: 'Yakunlangan', color: 'text-green-600 bg-green-50' },
            rejected: { text: 'Rad etilgan', color: 'text-red-600 bg-red-50' },
        };
        return map[status] || { text: status, color: 'text-gray-600 bg-gray-50' };
    };

    const filteredRequests = requests.filter(request => {
        const matchesType = filterType === 'all' || request.serviceType === filterType;
        const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
        const matchesSearch = searchQuery === '' || 
            request.articleTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            request.authorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            request.journalName?.toLowerCase().includes(searchQuery.toLowerCase());
        
        return matchesType && matchesStatus && matchesSearch;
    });

    if (user?.role !== Role.Operator) {
        return <div className="text-red-500 text-center mt-8">Bu sahifa faqat operatorlar uchun.</div>;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Barcha So'rovlar</h1>
                <p className="text-slate-500">Barcha mualliflarning so'rovlarini nazorat qiling</p>
            </div>

            {/* Filters */}
            <div className="bg-slate-100/70 backdrop-blur-lg rounded-xl p-6 mb-6 border border-slate-200/90">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Qidiruv (maqola, muallif, jurnal)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/60 border border-slate-200/90 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Service Type Filter */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-4 py-2 bg-white/60 border border-slate-200/90 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all" className="bg-white/50">Barcha xizmatlar</option>
                        <option value="DOI" className="bg-white/50">DOI</option>
                        <option value="UDK" className="bg-white/50">UDK</option>
                        <option value="ArticleSample" className="bg-white/50">Maqola namuna</option>
                        <option value="PlagiarismCheck" className="bg-white/50">Antiplagiat</option>
                        <option value="Translation" className="bg-white/50">Tarjima</option>
                        <option value="BookPublication" className="bg-white/50">Kitob nashr</option>
                    </select>

                    {/* Status Filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-4 py-2 bg-white/60 border border-slate-200/90 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all" className="bg-white/50">Barcha holatlar</option>
                        <option value={ArticleStatus.Yangi} className="bg-white/50">Yangi</option>
                        <option value={ArticleStatus.WithEditor} className="bg-white/50">Redaktorda</option>
                        <option value={ArticleStatus.PlagiarismReview} className="bg-white/50">Tekshiruvda</option>
                        <option value={ArticleStatus.ContractProcessing} className="bg-white/50">Shartnoma</option>
                        <option value={ArticleStatus.Published} className="bg-white/50">Nashr etilgan</option>
                    </select>
                </div>
            </div>

            {/* Requests Table */}
            <div className="bg-slate-100/70 backdrop-blur-lg rounded-xl border border-slate-200/90 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-slate-100/70">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">#</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Maqola</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Muallif</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Jurnal</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Xizmat</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Holat</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mas'ul</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sana</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Amal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                                        Yuklanmoqda...
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                                        So'rovlar topilmadi
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((request, index) => {
                                    const statusInfo = getStatusDisplayData(request.status);
                                    return (
                                        <tr key={request.id} className="hover:bg-slate-100/70 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{index + 1}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <BookOpen className="w-4 h-4 mr-2 text-blue-800" />
                                                    <span className="text-sm text-slate-900 font-medium">{request.articleTitle}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <User className="w-4 h-4 mr-2 text-slate-500" />
                                                    <span className="text-sm text-slate-600">{request.authorName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{request.journalName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded ${getServiceTypeColor(request.serviceType)}`}>
                                                    {request.serviceType === 'ArticleSample' ? 'Namuna' : request.serviceType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded ${statusInfo.color}`}>
                                                    {statusInfo.text}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {request.assignedTo ? (
                                                    <div className="flex items-center gap-1">
                                                        {request.assignedRole === 'reviewer' ? (
                                                            <CheckCircle className="w-4 h-4 text-indigo-400" />
                                                        ) : (
                                                            <FileText className="w-4 h-4 text-emerald-800" />
                                                        )}
                                                        <span>{request.assignedTo}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-4 h-4 text-slate-500" />
                                                    {new Date(request.createdAt).toLocaleDateString('uz-UZ')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <button className="text-blue-800 hover:text-blue-700 transition-colors">
                                                    <Eye className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-lg rounded-xl p-6 border border-blue-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-blue-900 mb-1">Jami so'rovlar</p>
                            <p className="text-3xl font-bold text-slate-900">{requests.length}</p>
                        </div>
                        <FileText className="w-12 h-12 text-blue-800 opacity-50" />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 backdrop-blur-lg rounded-xl p-6 border border-yellow-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-yellow-900 mb-1">Tekshiruvda</p>
                            <p className="text-3xl font-bold text-slate-900">
                                {requests.filter(r => r.status === ArticleStatus.PlagiarismReview).length}
                            </p>
                        </div>
                        <Clock className="w-12 h-12 text-yellow-800 opacity-50" />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur-lg rounded-xl p-6 border border-green-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-emerald-900 mb-1">Yakunlangan</p>
                            <p className="text-3xl font-bold text-slate-900">
                                {requests.filter(r => r.status === ArticleStatus.Published).length}
                            </p>
                        </div>
                        <CheckCircle className="w-12 h-12 text-emerald-800 opacity-50" />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-lg rounded-xl p-6 border border-purple-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-purple-900 mb-1">Rad etilgan</p>
                            <p className="text-3xl font-bold text-slate-900">
                                {requests.filter(r => r.status === ArticleStatus.Rejected).length}
                            </p>
                        </div>
                        <XCircle className="w-12 h-12 text-purple-400 opacity-50" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AllRequests;
