import React, { useState, useEffect } from 'react';
import EmptyState from '../components/EmptyState';
import Card from '../components/ui/Card';
import EditorialPageHeader from '../components/EditorialPageHeader';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { FileText, Loader2 } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

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
  const { t } = useT();
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
    <div className="space-y-6 max-w-5xl mx-auto">
      <EditorialPageHeader
        title={t("Maqola namuna so'rovlari")}
        subtitle={
          isReviewer
            ? t("Mualliflar maqola namunasi olish uchun yuborgan so'rovlar. Talablar va mavzuni ko'ring.")
            : t("Sizning maqola namuna so'rovlaringiz. Taqrizchi bajarganida status yangilanadi.")
        }
      />
      <Card>
        {loading ? (
          <p className="text-[var(--editorial-muted)] flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--editorial-primary)]" /> {t('Yuklanmoqda…')}
          </p>
        ) : list.length === 0 ? (
          <EmptyState compact illustration="inbox" title={t("So'rovlar yo'q")} description={t("Yangi so'rovlar kelganda shu yerda ko'rinadi.")} />
        ) : (
          <div className="space-y-4">
            {list.map((req) => (
              <div
                key={req.id}
                className="editorial-card flex flex-col gap-2 hover:border-[var(--editorial-primary)]/35 transition-colors"
              >
                <p className="font-serif font-medium text-[var(--editorial-text)]">{req.author_short}</p>
                <p className="text-sm text-[var(--editorial-body)] line-clamp-2">{req.topic}</p>
                <p className="text-xs text-[var(--editorial-muted)]">
                  {new Date(req.created_at).toLocaleDateString('uz-UZ')} ·{' '}
                  {qualityLabels[req.quality_level] || req.quality_level} · {req.pages} {t('sahifa ·')}{' '}
                  {req.status === 'submitted'
                    ? t('Kutilmoqda')
                    : req.status === 'in_progress'
                    ? t('Bajarilmoqda')
                    : req.status === 'completed'
                    ? t('Yakunlangan')
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
