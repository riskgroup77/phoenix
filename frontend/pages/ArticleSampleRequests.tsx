import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { FileText, Loader2 } from 'lucide-react';

interface ArticleSampleRequestItem {
  id: string;
  author_first_name: string;
  author_last_name: string;
  author_short: string;
  requirements: string;
  pages: number;
  topic: string;
  quality_level: string;
  amount: string;
  status: string;
  created_at: string;
}

const qualityLabels: Record<string, string> = {
  quyi: 'Quyi sifatli',
  orta: "O'rta sifatli",
  yuqori: 'Yuqori sifatli',
};

const ArticleSampleRequests: React.FC = () => {
  const { user } = useAuth();
  const [list, setList] = useState<ArticleSampleRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchList = async () => {
      try {
        const res = await apiService.articleSample.list();
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

  if (!user) return null;

  const isReviewer = user.role === 'reviewer' || user.role === 'super_admin';

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-amber-500/20">
            <FileText className="h-6 w-6 text-amber-800" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Maqola namuna so'rovlari</h1>
            <p className="text-sm text-slate-500">
              {isReviewer
                ? "Mualliflar maqola namunasi olish uchun yuborgan so'rovlar. Talablar va mavzuni ko'ring."
                : "Sizning maqola namuna so'rovlaringiz. Taqrizchi bajarganida status yangilanadi."}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda…
          </p>
        ) : list.length === 0 ? (
          <p className="text-slate-500">So'rovlar yo'q.</p>
        ) : (
          <div className="space-y-4">
            {list.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl bg-slate-100/70 border border-slate-200/90 flex flex-col gap-2"
              >
                <p className="font-medium text-slate-900">{req.author_short}</p>
                <p className="text-sm text-slate-600 line-clamp-2">{req.topic}</p>
                <p className="text-xs text-slate-500">
                  {new Date(req.created_at).toLocaleDateString('uz-UZ')} ·{' '}
                  {qualityLabels[req.quality_level] || req.quality_level} · {req.pages} sahifa ·{' '}
                  {req.status === 'submitted'
                    ? 'Kutilmoqda'
                    : req.status === 'in_progress'
                    ? 'Bajarilmoqda'
                    : req.status === 'completed'
                    ? 'Yakunlangan'
                    : req.status}
                </p>
                {req.requirements && (
                  <p className="text-sm text-slate-500 mt-1 line-clamp-3">{req.requirements}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ArticleSampleRequests;
