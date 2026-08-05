import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role, ArticleStatus } from '../types';
import { FileText, Search, Eye, Calendar, User, BookOpen, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { apiService } from '../services/apiService';
import {
  fetchAllOperatorRequests,
  OperatorRequestRow,
  OperatorServiceType,
} from '../utils/operatorRequests';
import { toast } from 'react-toastify';

const AllRequests: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OperatorRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const rows = await fetchAllOperatorRequests(apiService);
      setRequests(rows);
    } catch (error) {
      console.error('Failed to load requests:', error);
      setLoadError('So\'rovlarni yuklashda xatolik. Qayta urinib ko\'ring.');
      toast.error('So\'rovlarni yuklab bo\'lmadi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const getServiceTypeColor = (type: OperatorServiceType) => {
    switch (type) {
      case 'DOI': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
      case 'UDK': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200';
      case 'ArticleSample': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
      case 'PlagiarismCheck': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200';
      case 'Translation': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200';
      case 'BookPublication': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-200';
    }
  };

  const getServiceLabel = (type: OperatorServiceType) => {
    if (type === 'ArticleSample') return 'Namuna';
    if (type === 'JournalArticle') return 'Maqola';
    return type;
  };

  const getStatusDisplayData = (status: string): { text: string; color: string } => {
    const map: Record<string, { text: string; color: string }> = {
      [ArticleStatus.Yangi]: { text: 'Yangi', color: 'text-blue-600 bg-blue-50 dark:text-blue-200 dark:bg-blue-900/30' },
      [ArticleStatus.WithEditor]: { text: 'Redaktorda', color: 'text-indigo-600 bg-indigo-50 dark:text-indigo-200 dark:bg-indigo-900/30' },
      [ArticleStatus.PlagiarismReview]: { text: 'Antiplagiat', color: 'text-pink-600 bg-pink-50 dark:text-pink-200 dark:bg-pink-900/30' },
      [ArticleStatus.ContractProcessing]: { text: 'Shartnoma', color: 'text-orange-600 bg-orange-50 dark:text-orange-200 dark:bg-orange-900/30' },
      [ArticleStatus.Published]: { text: 'Nashr etilgan', color: 'text-green-600 bg-green-50 dark:text-green-200 dark:bg-green-900/30' },
      [ArticleStatus.Rejected]: { text: 'Rad etilgan', color: 'text-red-600 bg-red-50 dark:text-red-200 dark:bg-red-900/30' },
      submitted: { text: 'Yuborilgan', color: 'text-gray-600 bg-gray-50 dark:text-slate-300 dark:bg-slate-700/50' },
      pending: { text: 'Kutilmoqda', color: 'text-gray-600 bg-gray-50 dark:text-slate-300 dark:bg-slate-700/50' },
      in_progress: { text: 'Jarayonda', color: 'text-blue-600 bg-blue-50 dark:text-blue-200 dark:bg-blue-900/30' },
      completed: { text: 'Yakunlangan', color: 'text-green-600 bg-green-50 dark:text-green-200 dark:bg-green-900/30' },
      rejected: { text: 'Rad etilgan', color: 'text-red-600 bg-red-50 dark:text-red-200 dark:bg-red-900/30' },
    };
    return map[status] || { text: status, color: 'text-gray-600 bg-gray-50 dark:text-slate-300 dark:bg-slate-700/50' };
  };

  const filteredRequests = requests.filter((request) => {
    const matchesType = filterType === 'all' || request.serviceType === filterType;
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (request.articleTitle || '').toLowerCase().includes(q) ||
      (request.authorName || '').toLowerCase().includes(q) ||
      (request.journalName || '').toLowerCase().includes(q);
    return matchesType && matchesStatus && matchesSearch;
  });

  if (user?.role !== Role.Operator) {
    return <div className="text-red-500 text-center mt-8">Bu sahifa faqat operatorlar uchun.</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Barcha So&apos;rovlar</h1>
          <p className="text-slate-500">UDK, DOI, namuna, tarjima va maqola so&apos;rovlari (API)</p>
        </div>
        <button
          type="button"
          onClick={() => loadRequests()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Yangilash
        </button>
      </div>

      {loadError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">{loadError}</div>
      )}

      <div className="bg-slate-100/70 backdrop-blur-lg rounded-xl p-6 mb-6 border border-slate-200/90">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Qidiruv (maqola, muallif, jurnal)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Barcha xizmatlar</option>
            <option value="DOI">DOI</option>
            <option value="UDK">UDK</option>
            <option value="ArticleSample">Maqola namuna</option>
            <option value="PlagiarismCheck">Antiplagiat</option>
            <option value="Translation">Tarjima</option>
            <option value="BookPublication">Kitob nashr</option>
            <option value="JournalArticle">Jurnal maqolasi</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Barcha holatlar</option>
            <option value={ArticleStatus.Yangi}>Yangi</option>
            <option value="submitted">Yuborilgan</option>
            <option value="pending">Kutilmoqda</option>
            <option value={ArticleStatus.WithEditor}>Redaktorda</option>
            <option value={ArticleStatus.PlagiarismReview}>Tekshiruvda</option>
            <option value="completed">Yakunlangan</option>
            <option value={ArticleStatus.Published}>Nashr etilgan</option>
            <option value="rejected">Rad etilgan</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-100/70 backdrop-blur-lg rounded-xl border border-slate-200/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-100/70">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Maqola</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Muallif</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Jurnal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Xizmat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Holat</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sana</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">Yuklanmoqda...</td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">So&apos;rovlar topilmadi</td>
                </tr>
              ) : (
                filteredRequests.map((request, index) => {
                  const statusInfo = getStatusDisplayData(request.status);
                  return (
                    <tr key={request.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{index + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <BookOpen className="w-4 h-4 mr-2 text-blue-800 shrink-0" />
                          <span className="text-sm text-slate-900 font-medium line-clamp-2">{request.articleTitle}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2 text-slate-500" />
                          <span className="text-sm text-slate-600">{request.authorName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{request.journalName || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getServiceTypeColor(request.serviceType)}`}>
                          {getServiceLabel(request.serviceType)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${statusInfo.color}`}>{statusInfo.text}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          {new Date(request.createdAt).toLocaleDateString('uz-UZ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {request.detailPath ? (
                          <Link to={request.detailPath} className="text-blue-800 hover:text-blue-600 transition-colors">
                            <Eye className="w-5 h-5" />
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-6 border border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-900 mb-1">Jami</p>
              <p className="text-3xl font-bold text-slate-900">{requests.length}</p>
            </div>
            <FileText className="w-12 h-12 text-blue-800 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-xl p-6 border border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-900 mb-1">Kutilmoqda</p>
              <p className="text-3xl font-bold text-slate-900">
                {requests.filter((r) => r.status === 'pending' || r.status === 'submitted').length}
              </p>
            </div>
            <Clock className="w-12 h-12 text-yellow-800 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl p-6 border border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-900 mb-1">Yakunlangan</p>
              <p className="text-3xl font-bold text-slate-900">
                {requests.filter((r) => r.status === 'completed' || r.status === ArticleStatus.Published).length}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-emerald-800 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-6 border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-900 mb-1">Rad etilgan</p>
              <p className="text-3xl font-bold text-slate-900">
                {requests.filter((r) => r.status === 'rejected' || r.status === ArticleStatus.Rejected).length}
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
