import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Library, ExternalLink, Loader2, Check, X, FileText } from 'lucide-react';
import { toast } from 'react-toastify';

interface UdkRequestItem {
  id: string;
  author_first_name: string;
  author_last_name: string;
  author_middle_name: string;
  author_short: string;
  title: string;
  abstract: string;
  file_url: string | null;
  udk_code: string;
  udk_description: string;
  status: string;
  reject_reason: string;
  created_at: string;
  completed_at: string | null;
}

const UdkRequests: React.FC = () => {
  const { user } = useAuth();
  const [list, setList] = useState<UdkRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [udkInputs, setUdkInputs] = useState<Record<string, { code: string; description: string }>>({});
  const [rejectInputs, setRejectInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchList = async () => {
      try {
        const res = await apiService.udc.requests.list();
        const data = Array.isArray(res) ? res : (res?.results ?? res?.data ?? []);
        setList(Array.isArray(data) ? data : []);
      } catch {
        setList([]);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [user]);

  const handleComplete = async (id: string) => {
    const input = udkInputs[id] || { code: '', description: '' };
    const code = (input.code || '').trim();
    if (!code) {
      toast.warning('UDK kodini kiriting.');
      return;
    }
    setSavingId(id);
    try {
      await apiService.udc.requests.complete(id, code, input.description?.trim());
      toast.success('UDK so\'rovi yakunlandi. Muallifga xabar yuborildi.');
      setUdkInputs((prev) => ({ ...prev, [id]: { code: '', description: '' } }));
      const res = await apiService.udc.requests.list();
      const data = Array.isArray(res) ? res : (res?.results ?? res?.data ?? []);
      setList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || 'Saqlashda xatolik.');
    } finally {
      setSavingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = (rejectInputs[id] || '').trim();
    setRejectingId(id);
    try {
      await apiService.udc.requests.reject(id, reason);
      toast.success('UDK so\'rovi rad etildi.');
      setShowRejectModal(null);
      setRejectInputs((prev) => ({ ...prev, [id]: '' }));
      const res = await apiService.udc.requests.list();
      const data = Array.isArray(res) ? res : (res?.results ?? res?.data ?? []);
      setList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || 'Rad etishda xatolik.');
    } finally {
      setRejectingId(null);
    }
  };

  if (!user) return null;

  const isReviewer = user.role === 'reviewer' || user.role === 'super_admin';
  const submittedList = list.filter((r) => r.status === 'submitted');
  const completedList = list.filter((r) => r.status === 'completed');
  const rejectedList = list.filter((r) => r.status === 'rejected');

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_payment': return 'To\'lov kutilmoqda';
      case 'submitted': return 'Taqrizchida';
      case 'completed': return 'Yakunlangan';
      case 'rejected': return 'Rad etilgan';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'text-yellow-800';
      case 'completed': return 'text-emerald-800';
      case 'rejected': return 'text-red-700';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-indigo-500/20">
            <Library className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">UDK so'rovlari</h1>
            <p className="text-sm text-slate-500">
              {isReviewer
                ? "Mualliflar UDK raqami olish uchun yuborgan so'rovlar. Mavzu va annotatsiyani o'qib, mos UDK kodini kiriting."
                : "Sizning UDK so'rovlaringiz. Taqrizchi UDK kodini kiritgach bu yerda ko'rinadi."}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-slate-500 py-4">UDK so'rovlari yo'q.</p>
        ) : (
          <div className="space-y-4">
            {/* Kutilayotgan so'rovlar (submitted) */}
            {isReviewer && submittedList.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-3">Kutilayotgan so'rovlar ({submittedList.length})</h3>
                <div className="space-y-4">
                  {submittedList.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{req.author_short}</p>
                          <p className="text-sm text-indigo-300 mt-1 font-medium">{req.title}</p>
                          {req.abstract && (
                            <p className="text-xs text-slate-500 mt-2 line-clamp-3">{req.abstract}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-2">
                            {new Date(req.created_at).toLocaleDateString('uz-UZ')}
                          </p>
                          {req.file_url && (
                            <a
                              href={req.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-cyan-800 hover:underline mt-2"
                            >
                              <FileText size={14} /> Faylni yuklab olish
                            </a>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 lg:min-w-[300px]">
                          <input
                            type="text"
                            value={udkInputs[req.id]?.code ?? ''}
                            onChange={(e) => setUdkInputs((prev) => ({
                              ...prev,
                              [req.id]: { ...prev[req.id], code: e.target.value }
                            }))}
                            placeholder="UDK kodi (masalan: 332.055.2)"
                            className="px-3 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
                          />
                          <input
                            type="text"
                            value={udkInputs[req.id]?.description ?? ''}
                            onChange={(e) => setUdkInputs((prev) => ({
                              ...prev,
                              [req.id]: { ...prev[req.id], description: e.target.value }
                            }))}
                            placeholder="UDK tavsifi (ixtiyoriy)"
                            className="px-3 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleComplete(req.id)}
                              disabled={savingId === req.id || !(udkInputs[req.id]?.code || '').trim()}
                              className="flex-1 flex items-center justify-center gap-2"
                            >
                              {savingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Tasdiqlash
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => setShowRejectModal(req.id)}
                              className="flex items-center gap-2"
                            >
                              <X className="h-4 w-4" />
                              Rad etish
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Barcha so'rovlar ro'yxati */}
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              {isReviewer ? 'Barcha so\'rovlar' : 'Mening so\'rovlarim'}
            </h3>
            {list.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl bg-slate-100/70 border border-slate-200/90"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-900">{req.author_short}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(req.status)} bg-slate-100/70`}>
                        {getStatusLabel(req.status)}
                      </span>
                    </div>
                    <p className="text-sm text-indigo-300 mt-1">{req.title}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(req.created_at).toLocaleDateString('uz-UZ')}
                    </p>
                    {req.status === 'completed' && req.udk_code && (
                      <p className="text-sm text-emerald-800 mt-2">
                        UDK: {req.udk_code} {req.udk_description && `— ${req.udk_description}`}
                      </p>
                    )}
                    {req.status === 'rejected' && req.reject_reason && (
                      <p className="text-sm text-red-700 mt-2">
                        Sabab: {req.reject_reason}
                      </p>
                    )}
                    {req.file_url && (
                      <a
                        href={req.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-cyan-800 hover:underline mt-2"
                      >
                        <ExternalLink size={14} /> Fayl
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/35 flex items-center justify-center z-50 p-4">
          <div className="bg-white/55 rounded-xl p-6 max-w-md w-full border border-slate-200/90">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">UDK so'rovini rad etish</h3>
            <textarea
              value={rejectInputs[showRejectModal] ?? ''}
              onChange={(e) => setRejectInputs((prev) => ({ ...prev, [showRejectModal]: e.target.value }))}
              placeholder="Rad etish sababi (ixtiyoriy)"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <Button
                variant="secondary"
                onClick={() => setShowRejectModal(null)}
                className="flex-1"
              >
                Bekor qilish
              </Button>
              <Button
                onClick={() => handleReject(showRejectModal)}
                disabled={rejectingId === showRejectModal}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {rejectingId === showRejectModal ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rad etish'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UdkRequests;
