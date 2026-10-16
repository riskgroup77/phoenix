import React, { useState, useEffect, useCallback } from 'react';
import EmptyState from '../components/EmptyState';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EditorialPageHeader from '../components/EditorialPageHeader';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Download, FileText, Loader2, PlayCircle, UploadCloud } from 'lucide-react';
import { toast } from 'react-toastify';
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
  reviewer_note?: string;
  result_file_url?: string | null;
  taken_by_me?: boolean;
  reviewer_name?: string | null;
}

const qualityLabels: Record<string, string> = {
  quyi: 'Quyi sifatli',
  orta: "O'rta sifatli",
  yuqori: 'Yuqori sifatli',
};

const statusLabels: Record<string, string> = {
  submitted: 'Kutilmoqda',
  in_progress: 'Bajarilmoqda',
  completed: 'Yakunlangan',
};

const ArticleSampleRequests: React.FC = () => {
  const { t } = useT();
  const { user } = useAuth();
  const [list, setList] = useState<ArticleSampleRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const fetchList = useCallback(async () => {
    try {
      const res = await apiService.articleSample.list();
      const data = Array.isArray(res) ? res : (res?.results ?? res?.data ?? []);
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchList();
  }, [user, fetchList]);

  if (!user) return null;

  const isReviewer = user.role === 'reviewer' || user.role === 'super_admin';

  const take = async (id: string) => {
    setBusyId(id);
    try {
      await apiService.articleSample.take(id);
      toast.success(t("So'rov sizga biriktirildi. Tayyor bo'lgach namunani yuklang."));
      await fetchList();
    } catch (err: any) {
      toast.error(err?.message || t("So'rovni ishga olib bo'lmadi."));
    } finally {
      setBusyId(null);
    }
  };

  const complete = async (id: string) => {
    const file = files[id];
    if (!file) {
      toast.error(t('Tayyor namuna faylini tanlang (DOC, DOCX yoki PDF).'));
      return;
    }
    setBusyId(id);
    try {
      await apiService.articleSample.complete(id, file, notes[id] || '');
      toast.success(t('Namuna yuklandi. Muallifga bildirishnoma yuborildi.'));
      await fetchList();
    } catch (err: any) {
      toast.error(err?.message || t("Namunani yuklab bo'lmadi."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <EditorialPageHeader
        title={t("Maqola namuna so'rovlari")}
        subtitle={
          isReviewer
            ? t("So'rovni ishga oling, tayyor namunani yuklang — muallif uni shu yerdan yuklab oladi.")
            : t("Sizning maqola namuna so'rovlaringiz. Namuna tayyor bo'lgach shu yerdan yuklab olasiz.")
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-serif font-medium text-[var(--editorial-text)]">{req.topic}</p>
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-500/10 text-slate-700 whitespace-nowrap">
                    {t(statusLabels[req.status] || req.status)}
                  </span>
                </div>
                <p className="text-xs text-[var(--editorial-muted)]">
                  {req.author_short} · {new Date(req.created_at).toLocaleDateString('uz-UZ')} ·{' '}
                  {t(qualityLabels[req.quality_level] || req.quality_level)} · {req.pages} {t('sahifa')}
                  {isReviewer && req.reviewer_name ? ` · ${t('Bajaruvchi')}: ${req.reviewer_name}` : ''}
                </p>
                {req.requirements && (
                  <p className="text-sm text-slate-500 whitespace-pre-wrap">{req.requirements}</p>
                )}

                {req.status === 'completed' && (
                  <div className="mt-2 rounded-lg border border-[var(--editorial-border)] p-3 space-y-2">
                    {req.reviewer_note && (
                      <p className="text-sm text-[var(--editorial-body)] whitespace-pre-wrap">{req.reviewer_note}</p>
                    )}
                    {req.result_file_url && (
                      <a
                        href={req.result_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--editorial-primary)] hover:underline"
                      >
                        <Download size={16} /> {t('Tayyor namunani yuklab olish')}
                      </a>
                    )}
                  </div>
                )}

                {isReviewer && req.status === 'submitted' && (
                  <div>
                    <Button onClick={() => take(req.id)} disabled={busyId === req.id} className="inline-flex items-center gap-2">
                      {busyId === req.id ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                      {t('Ishga olish')}
                    </Button>
                  </div>
                )}

                {isReviewer && req.status === 'in_progress' && (req.taken_by_me || user.role === 'super_admin') && (
                  <div className="mt-2 rounded-lg border border-[var(--editorial-border)] p-3 space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      {t('Tayyor namuna fayli (DOC, DOCX yoki PDF)')}
                      <input
                        type="file"
                        accept=".doc,.docx,.pdf,.odt,.rtf"
                        className="mt-1 block w-full text-sm"
                        onChange={(e) => setFiles((prev) => ({ ...prev, [req.id]: e.target.files?.[0] ?? null }))}
                      />
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-[var(--editorial-border)] px-3 py-2 text-sm"
                      rows={2}
                      placeholder={t('Muallifga izoh (ixtiyoriy)')}
                      value={notes[req.id] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    />
                    <Button onClick={() => complete(req.id)} disabled={busyId === req.id} className="inline-flex items-center gap-2">
                      {busyId === req.id ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                      {t('Namunani yuklash va yakunlash')}
                    </Button>
                  </div>
                )}

                {!isReviewer && req.status !== 'completed' && (
                  <p className="text-xs text-[var(--editorial-muted)] flex items-center gap-1">
                    <FileText size={14} />
                    {req.status === 'in_progress'
                      ? t('Mutaxassis namunani tayyorlamoqda.')
                      : t("So'rov mutaxassis tomonidan ishga olinishini kutmoqda.")}
                  </p>
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
