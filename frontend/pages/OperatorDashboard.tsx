import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import Card from '../components/ui/Card';
import { 
  Eye, FileText, Users, DollarSign, CheckCircle, Clock, XCircle, 
  TrendingUp, BarChart3, Activity, Search, Filter, Download,
  RefreshCw, AlertCircle, Shield, Bot, Settings, Bell, Calendar,
  CreditCard, BookOpen, Library, MessageSquare, Zap, Target, Award,
  ChevronRight
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';
import Button from '../components/ui/Button';
import { Link } from 'react-router-dom';

interface OperatorStats {
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  totalUsers: number;
  totalTransactions: number;
  totalRevenue: number;
  udkRequests: number;
  doiRequests: number;
  articleSamples: number;
  translations: number;
  recentActivities: any[];
}

const OperatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'users' | 'finance'>('overview');
  const [udkRequests, setUdkRequests] = useState<any[]>([]);
  const [doiRequests, setDoiRequests] = useState<any[]>([]);
  const [articleSamples, setArticleSamples] = useState<any[]>([]);
  const [translations, setTranslations] = useState<any[]>([]);
  const [chatInbox, setChatInbox] = useState<
    { id: string; title: string; author_name: string; journal_name: string; last_message_at: string | null }[]
  >([]);

  useEffect(() => {
    fetchOperatorData();
  }, []);

  const fetchOperatorData = async () => {
    try {
      setLoading(true);
      
      // Parallel API calls — users.list operator uchun 403; butun panel buzilmasin
      const [udkRes, doiRes, samplesRes, transRes, usersRes, txRes] = await Promise.all([
        apiService.udc.requests.list().catch(() => []),
        apiService.articles.getDoiRequests().catch(() => []),
        apiService.articles.getArticleSampleRequests().catch(() => []),
        apiService.translations.list().catch(() => []),
        apiService.users.list().catch(() => []),
        apiService.payments.getTransactions().catch(() => []),
      ]);

      const processData = (res: any) => {
        if (Array.isArray(res)) return res;
        if (res?.results && Array.isArray(res.results)) return res.results;
        if (res?.data && Array.isArray(res.data)) return res.data;
        return [];
      };

      const udkData = processData(udkRes);
      const doiData = processData(doiRes);
      const samplesData = processData(samplesRes);
      const transData = processData(transRes);
      const usersData = processData(usersRes);
      const txData = processData(txRes);

      // Calculate statistics
      const totalRequests = udkData.length + doiData.length + samplesData.length + transData.length;
      const pendingRequests = [
        ...udkData.filter((r: any) => r.status === 'submitted' || r.status === 'pending'),
        ...doiData.filter((r: any) => r.status === 'submitted' || r.status === 'pending'),
        ...samplesData.filter((r: any) => r.status === 'submitted' || r.status === 'pending'),
        ...transData.filter((r: any) => r.status === 'Yangi' || r.status === 'Jarayonda'),
      ].length;

      const completedRequests = [
        ...udkData.filter((r: any) => r.status === 'completed'),
        ...doiData.filter((r: any) => r.status === 'completed'),
        ...samplesData.filter((r: any) => r.status === 'completed'),
        ...transData.filter((r: any) => r.status === 'Bajarildi'),
      ].length;

      const totalRevenue = txData
        .filter((tx: any) => tx.status === 'completed')
        .reduce((sum: number, tx: any) => sum + Math.abs(parseFloat(tx.amount)), 0);

      setStats({
        totalRequests,
        pendingRequests,
        completedRequests,
        totalUsers: usersData.length,
        totalTransactions: txData.length,
        totalRevenue,
        udkRequests: udkData.length,
        doiRequests: doiData.length,
        articleSamples: samplesData.length,
        translations: transData.length,
        recentActivities: [...udkData, ...doiData, ...samplesData].slice(0, 10),
      });

      setUdkRequests(udkData);
      setDoiRequests(doiData);
      setArticleSamples(samplesData);
      setTranslations(transData);

      try {
        const inboxRaw = await apiService.articles.getOperatorChatInbox();
        setChatInbox(Array.isArray(inboxRaw) ? inboxRaw : []);
      } catch {
        setChatInbox([]);
      }

    } catch (error) {
      console.error('Error fetching operator data:', error);
      toast.error('Ma\'lumotlarni yuklashda xatolik!');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      submitted: 'bg-yellow-500/20 text-yellow-800 border-yellow-500/30',
      pending: 'bg-yellow-500/20 text-yellow-800 border-yellow-500/30',
      Yangi: 'bg-blue-500/20 text-blue-800 border-blue-500/30',
      Jarayonda: 'bg-purple-500/25 text-purple-900 border-purple-400/40',
      completed: 'bg-green-500/20 text-emerald-800 border-green-500/30',
      Bajarildi: 'bg-green-500/20 text-emerald-800 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-700 border-red-500/30',
      BekorQilindi: 'bg-red-500/20 text-red-700 border-red-500/30',
    };
    return badges[status] || 'bg-gray-500/20 text-slate-500 border-gray-500/30';
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500/25 via-violet-400/20 to-cyan-300/30 p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          <p className="font-medium text-slate-900">Ma&apos;lumotlar yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] border border-white/45 bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 p-[1px] shadow-2xl shadow-indigo-950/25">
      <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-[radial-gradient(ellipse_at_15%_0%,rgba(255,255,255,0.55),transparent_50%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-[radial-gradient(ellipse_at_100%_100%,rgba(250,204,21,0.22),transparent_45%)]" aria-hidden />
      <div className="relative rounded-[26px] bg-gradient-to-br from-white/25 via-white/15 to-cyan-100/25 px-4 py-8 backdrop-blur-md sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-slate-950">
              Operator boshqaruvi
            </h1>
            <p className="font-medium text-slate-800">
              Barcha so&apos;rovlarni nazorat qilish va boshqarish markazi
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={fetchOperatorData} variant="secondary">
              <RefreshCw className="h-4 w-4" />
              Yangilash
            </Button>
            <Link to="/profile">
              <Button variant="primary">
                <Settings className="h-4 w-4" />
                Sozlamalar
              </Button>
            </Link>
          </div>
        </div>

        {/* User Info Card */}
        <div className="rounded-2xl border border-white/55 bg-white/45 p-6 shadow-xl backdrop-blur-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 text-xl font-bold text-white shadow-lg">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  {`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Operator'}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                  <Shield className="h-4 w-4 text-violet-800" />
                  <span>Operator</span>
                  <span className="text-slate-500">•</span>
                  <span>{user?.phone}</span>
                </div>
              </div>
            </div>
            <div className="text-left md:text-right">
              <div className="mb-1 text-sm font-medium text-slate-700">Platformadagi rol</div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/50 bg-white/60 px-4 py-2 shadow-inner backdrop-blur-sm">
                <Award className="h-4 w-4 text-violet-900" />
                <span className="font-semibold text-violet-950">Bosh operator</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={FileText}
          title="Jami So'rovlar"
          value={stats?.totalRequests || 0}
          gradient="from-blue-600 to-cyan-600"
          description="Barcha turdagi so'rovlar"
        />
        <StatCard
          icon={Clock}
          title="Kutilayotgan"
          value={stats?.pendingRequests || 0}
          gradient="from-yellow-600 to-orange-600"
          description="Ko'rib chiqishni kutayotgan"
          alert={true}
        />
        <StatCard
          icon={CheckCircle}
          title="Bajarilgan"
          value={stats?.completedRequests || 0}
          gradient="from-green-600 to-emerald-600"
          description="Muvaffaqiyatli yakunlangan"
        />
        <StatCard
          icon={DollarSign}
          title="Jami Daromad"
          value={`${(stats?.totalRevenue || 0).toLocaleString()} so'm`}
          gradient="from-purple-600 to-pink-600"
          description="Barcha to'lovlar"
        />
      </div>

      {/* Service Type Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <ServiceStatCard
          icon={BookOpen}
          title="UDK So'rovlari"
          count={stats?.udkRequests || 0}
          color="blue"
          link="/udk-requests"
        />
        <ServiceStatCard
          icon={Library}
          title="DOI So'rovlari"
          count={stats?.doiRequests || 0}
          color="purple"
          link="/doi-requests"
        />
        <ServiceStatCard
          icon={FileText}
          title="Maqola Namuna"
          count={stats?.articleSamples || 0}
          color="green"
          link="/article-samples"
        />
        <ServiceStatCard
          icon={MessageSquare}
          title="Tarjimalar"
          count={stats?.translations || 0}
          color="orange"
          link="/translations"
        />
      </div>

      <div className="mb-8 rounded-2xl border border-white/55 bg-white/40 p-6 shadow-xl backdrop-blur-2xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="flex items-center gap-2 text-xl font-bold text-slate-950">
            <MessageSquare className="h-5 w-5 text-violet-800" />
            Muallif chatlari (oxirgi xabarlar)
          </h3>
          <Link to="/articles">
            <Button variant="secondary" className="!px-4 !py-2 text-sm">
              Barcha maqolalar
            </Button>
          </Link>
        </div>
        <p className="mb-4 text-sm font-medium text-slate-800">
          Har bir maqola alohida yozishma. Muallif yozganida barcha operatorlarga bildirishnoma boradi.
        </p>
        {chatInbox.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-slate-700">
            Hozircha faol chatlar yo&apos;q. Maqolalar ro&apos;yxatidan oching.
          </p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {chatInbox.slice(0, 15).map((row) => (
              <li key={row.id}>
                <Link
                  to={`/articles/${row.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/55 p-3 shadow-sm backdrop-blur-md transition-colors hover:bg-white/75"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{row.title}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {row.author_name}
                      {row.journal_name ? ` · ${row.journal_name}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-600">
                    {row.last_message_at
                      ? new Date(row.last_message_at).toLocaleString('uz-UZ')
                      : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent Activity */}
      <div className="mb-8 rounded-2xl border border-white/55 bg-white/35 p-6 shadow-xl backdrop-blur-2xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="flex items-center gap-2 text-xl font-bold text-slate-950">
            <Activity className="h-5 w-5 text-violet-800" />
            Oxirgi faollik
          </h3>
          <Button variant="secondary" className="!px-4 !py-2 text-sm">
            Barchasini ko'rish
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <div className="space-y-3">
          {stats?.recentActivities.slice(0, 5).map((activity, idx) => (
            <div key={idx} className="flex flex-col gap-3 rounded-xl border border-white/55 bg-white/50 p-4 shadow-sm backdrop-blur-md transition-colors hover:bg-white/70 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activity.type === 'udk' ? 'bg-blue-500/20 text-blue-800' :
                  activity.type === 'doi' ? 'bg-purple-500/25 text-purple-900' :
                  'bg-green-500/20 text-emerald-800'
                }`}>
                  {activity.type === 'udk' ? <BookOpen className="h-5 w-5" /> :
                   activity.type === 'doi' ? <Library className="h-5 w-5" /> :
                   <FileText className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{activity.title || 'So\'rov'}</p>
                  <p className="text-sm text-slate-500">{activity.author_name || 'Noma\'lum'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(activity.status)}`}>
                  {activity.status}
                </span>
                <span className="text-sm text-slate-500">
                  {new Date(activity.created_at || activity.submission_date).toLocaleDateString('uz-UZ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickActionCard
          icon={Users}
          title="Foydalanuvchilar"
          description="Barcha foydalanuvchilarni ko'rish va boshqarish"
          link="/users"
          color="blue"
        />
        <QuickActionCard
          icon={CreditCard}
          title="To'lovlar"
          description="To'lov operatsiyalari monitoringi"
          link="/financials"
          color="green"
        />
        <QuickActionCard
          icon={BarChart3}
          title="Hisobotlar"
          description="Platforma statistikasi va tahlillar"
          link="/analytics"
          color="purple"
        />
      </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  icon: any;
  title: string;
  value: string | number;
  gradient: string;
  description?: string;
  alert?: boolean;
}> = ({ icon: Icon, title, value, gradient, description, alert }) => (
  <Card className="relative overflow-hidden border-white/55 bg-white/45 shadow-xl backdrop-blur-2xl">
    <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-25 blur-3xl ${gradient}`} />
    <div className="relative">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-700">{title}</p>
          <p className="text-3xl font-bold text-slate-950">{value}</p>
          {description && <p className="mt-1 text-xs font-medium text-slate-600">{description}</p>}
        </div>
        <div className={`rounded-xl bg-gradient-to-br p-3 shadow-md ${gradient}`}>
          <Icon className="h-6 w-6 text-white drop-shadow-sm" />
        </div>
      </div>
      {alert && (
        <div className="flex items-center gap-2 text-yellow-800 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Diqqat talab qilinadi</span>
        </div>
      )}
    </div>
  </Card>
);

// Service Stat Card
const ServiceStatCard: React.FC<{
  icon: any;
  title: string;
  count: number;
  color: string;
  link: string;
}> = ({ icon: Icon, title, count, color, link }) => {
  const accents: Record<string, string> = {
    blue: 'border-blue-400/35 text-blue-900',
    purple: 'border-purple-400/35 text-purple-950',
    green: 'border-emerald-400/35 text-emerald-950',
    orange: 'border-orange-400/35 text-orange-950',
  };

  const iconGradients: Record<string, string> = {
    blue: 'from-blue-600 to-cyan-600',
    purple: 'from-purple-600 to-pink-600',
    green: 'from-green-600 to-emerald-600',
    orange: 'from-orange-600 to-red-600',
  };

  return (
    <Link to={link}>
      <Card
        className={`h-full cursor-pointer border-white/55 bg-white/40 shadow-lg backdrop-blur-2xl transition-transform hover:scale-[1.02] ${accents[color]}`}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/50 to-transparent opacity-80" aria-hidden />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">{title}</p>
            <p className="text-2xl font-bold text-slate-950">{count}</p>
          </div>
          <div className={`rounded-xl bg-gradient-to-br p-3 shadow-md ${iconGradients[color]}`}>
            <Icon className="h-6 w-6 text-white drop-shadow-sm" />
          </div>
        </div>
      </Card>
    </Link>
  );
};

// Quick Action Card
const QuickActionCard: React.FC<{
  icon: any;
  title: string;
  description: string;
  link: string;
  color: string;
}> = ({ icon: Icon, title, description, link, color }) => {
  const hoverBorder: Record<string, string> = {
    blue: 'hover:border-blue-400/55',
    green: 'hover:border-emerald-400/55',
    purple: 'hover:border-violet-400/55',
  };
  const iconWrap: Record<string, string> = {
    blue: 'bg-gradient-to-br from-blue-600/25 to-cyan-600/15',
    green: 'bg-gradient-to-br from-emerald-600/25 to-green-600/15',
    purple: 'bg-gradient-to-br from-violet-600/25 to-purple-600/15',
  };
  const iconTone: Record<string, string> = {
    blue: 'text-blue-900',
    green: 'text-emerald-900',
    purple: 'text-violet-950',
  };

  return (
    <Link to={link}>
      <Card
        className={`h-full cursor-pointer border-white/55 bg-white/38 shadow-lg backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:shadow-xl ${hoverBorder[color]}`}
      >
        <div className="flex items-start gap-4">
          <div className={`rounded-xl p-4 shadow-inner ${iconWrap[color]}`}>
            <Icon className={`h-8 w-8 ${iconTone[color]}`} />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 font-bold text-slate-950">{title}</h3>
            <p className="text-sm font-medium text-slate-700">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default OperatorDashboard;
