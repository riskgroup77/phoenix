import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Bot, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

interface DoiRequestItem {
  id: string;
  author_first_name: string;
  author_last_name: string;
  author_short: string;
  file_url: string | null;
  status: string;
  doi_link: string;
  created_at: string;
}

const DoiRequests: React.FC = () => {
  const { user } = useAuth();
  const [list, setList] = useState<DoiRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchList = async () => {
      try {
        const res = await apiService.doi.list();
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

  const handleSaveLink = async (id: string) => {
    const link = (linkInputs[id] || '').trim();
    if (!link || !link.startsWith('http')) {
      toast.warning('To\'g\'ri DOI link (URL) kiriting.');
      return;
    }
    setSavingId(id);
    try {
      await apiService.doi.updateLink(id, link);
      toast.success('DOI link saqlandi. Muallifga bildirishnoma yuborildi.');
      setLinkInputs((prev) => ({ ...prev, [id]: '' }));
      const res = await apiService.doi.list();
      const data = Array.isArray(res) ? res : (res?.results ?? res?.data ?? []);
      setList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || 'Saqlashda xatolik.');
    } finally {
      setSavingId(null);
    }
  };

  if (!user) return null;

  const isReviewer = user.role === 'reviewer' || user.role === 'super_admin';
  const submittedList = list.filter((r) => r.status === 'submitted');

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-cyan-500/20">
            <Bot className="h-6 w-6 text-cyan-800" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">DOI so'rovlari</h1>
            <p className="text-sm text-slate-500">
              {isReviewer
                ? "Mualliflar DOI raqami olish uchun yuborgan so'rovlar. Saytdan DOI raqamini oling, taqrizchi linkini kiriting va saqlang — muallif arxivida ko'radi va bildirishnoma oladi."
                : "Sizning DOI so'rovlaringiz. Taqrizchi link kiritgach shu yerda va arxivda ko'rinadi."}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500">Yuklanmoqda…</p>
        ) : list.length === 0 ? (
          <p className="text-slate-500">So'rovlar yo'q.</p>
        ) : (
          <div className="space-y-4">
            {list.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl bg-slate-100/70 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{req.author_short}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(req.created_at).toLocaleDateString('uz-UZ')} · {req.status === 'submitted' ? 'Taqrizchida' : req.status === 'completed' ? 'Yakunlangan' : req.status}
                  </p>
                  {req.file_url && (
                    <a
                      href={req.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-cyan-800 hover:underline mt-2"
                    >
                      <ExternalLink size={14} /> Faylni yuklab olish
                    </a>
                  )}
                  {req.status === 'completed' && req.doi_link && (
                    <a
                      href={req.doi_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-emerald-800 hover:underline mt-2 ml-4"
                    >
                      DOI link
                    </a>
                  )}
                </div>
                {isReviewer && req.status === 'submitted' && (
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <input
                      type="url"
                      value={linkInputs[req.id] ?? ''}
                      onChange={(e) => setLinkInputs((prev) => ({ ...prev, [req.id]: e.target.value }))}
                      placeholder="https://..."
                      className="px-3 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 min-w-[200px]"
                    />
                    <Button
                      onClick={() => handleSaveLink(req.id)}
                      disabled={savingId === req.id || !(linkInputs[req.id] || '').trim()}
                    >
                      {savingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Linkni saqlash"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default DoiRequests;
