/**
 * Maqola sahifasidagi taqriz jarayoni (backend: apps/reviews).
 *  - Muharrir / bosh admin: tayinlangan taqrizchilar, natijalar, yangi taqrizchi tayinlash.
 *  - Taqrizchi: o'z taqrizini qabul qilish / rad etish va natijani yuborish.
 *  - Muallif: yakunlangan taqrizlar (yopiq taqrizda taqrizchi anonim).
 * Avval taqriz API'si bor edi, lekin interfeysda hech qayerda chaqirilmasdi — jarayon ishlamasdi.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Download, Search, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from './ui/Card';
import Button from './ui/Button';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { formatUzDate } from '../utils/uzDate';

type Review = {
  id: string;
  article: string;
  reviewer: string | null;
  reviewer_name: string;
  status: 'pending' | 'accepted' | 'declined' | 'in_progress' | 'completed';
  review_type: 'open' | 'single_blind' | 'double_blind';
  recommendation: string;
  review_content: string;
  strengths: string;
  weaknesses: string;
  comments_to_author: string;
  comments_to_editor?: string;
  originality_score: number;
  methodology_score: number;
  clarity_score: number;
  significance_score: number;
  references_score: number;
  rating: number;
  deadline: string | null;
  completed_at: string | null;
  /** Taqriz bosqichi: muallif tahrirdan keyin qayta yuborgan har safar +1 */
  round_number?: number;
};

type Specialist = {
  id: string;
  full_name: string;
  affiliation: string;
  specializations: string[];
  reviews_completed: number;
  active_reviews: number;
  already_assigned: boolean;
  /** Shu maqolaning avvalgi bosqichida taqriz yozgan — tuzatishlarni qayta ko'rib chiqishga tanlash mumkin */
  reviewed_before?: boolean;
};

const STATUS_LABELS: Record<Review['status'], string> = {
  pending: 'Javob kutilmoqda',
  accepted: 'Qabul qildi',
  in_progress: 'Taqriz yozilmoqda',
  declined: 'Rad etdi',
  completed: 'Yakunlandi',
};
const STATUS_TONES: Record<Review['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-900',
  accepted: 'bg-sky-500/15 text-sky-900',
  in_progress: 'bg-sky-500/15 text-sky-900',
  declined: 'bg-slate-500/15 text-slate-700',
  completed: 'bg-emerald-500/15 text-emerald-900',
};
const RECOMMENDATIONS: { value: string; label: string }[] = [
  { value: 'accept', label: 'Qabul qilish' },
  { value: 'minor_revision', label: 'Kichik tuzatish bilan (muallifga qaytariladi)' },
  { value: 'major_revision', label: 'Katta tuzatish bilan (muallifga qaytariladi)' },
  { value: 'reject', label: 'Butunlay rad etish (qayta yuborib bo\'lmaydi)' },
];

/** Taqriz yuborilgach maqola o'tadigan holat: taqrizchi qarorini alohida tugma bilan takrorlamaydi */
const RECOMMENDATION_STATUS: Record<string, { status: string; ok: string }> = {
  accept: {
    status: 'Accepted',
    ok: "Taqriz yuborildi. Maqola qabul qilindi — nashr qilish (yoki to'lov kerak bo'lsa, muallif to'lovi) keyingi qadam.",
  },
  minor_revision: { status: 'Revision', ok: "Taqriz yuborildi. Maqola sabab bilan muallifga qaytarildi — u tuzatib qayta yuboradi." },
  major_revision: { status: 'Revision', ok: "Taqriz yuborildi. Maqola sabab bilan muallifga qaytarildi — u tuzatib qayta yuboradi." },
  reject: { status: 'Rejected', ok: 'Taqriz yuborildi. Maqola rad etildi, muallifga sabab bilan xabar berildi.' },
};
const REVIEW_TYPES: { value: Review['review_type']; label: string }[] = [
  { value: 'double_blind', label: 'Ikki tomonlama yopiq' },
  { value: 'single_blind', label: 'Bir tomonlama yopiq' },
  { value: 'open', label: 'Ochiq' },
];
const SCORE_FIELDS: { key: keyof Review; label: string }[] = [
  { key: 'originality_score', label: 'Yangilik' },
  { key: 'methodology_score', label: 'Metodologiya' },
  { key: 'clarity_score', label: 'Bayon aniqligi' },
  { key: 'significance_score', label: 'Ahamiyati' },
  { key: 'references_score', label: 'Adabiyotlar' },
];
const recommendationLabel = (v: string) => RECOMMENDATIONS.find((r) => r.value === v)?.label || v || '—';

const inputClass =
  'w-full rounded-lg bg-white/55 border border-slate-200 text-slate-900 placeholder-slate-400 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

const asList = <T,>(raw: unknown): T[] =>
  Array.isArray(raw) ? (raw as T[]) : ((raw as { results?: T[] })?.results ?? []);

/** Yakunlangan taqriz natijasi (tahririyatga izohni faqat muharrir ko'radi — backend ham muallifga bermaydi) */
const ReviewResult: React.FC<{ review: Review; forEditor: boolean }> = ({ review, forEditor }) => (
  <div className="mt-2 space-y-2 text-sm">
    <p>
      <span className="text-slate-500">Tavsiya:</span>{' '}
      <span className="font-semibold">{recommendationLabel(review.recommendation)}</span>
      {review.rating ? <span className="text-slate-500"> · umumiy ball {review.rating}/10</span> : null}
    </p>
    {review.review_content && (
      <p className="whitespace-pre-line text-slate-700">{review.review_content}</p>
    )}
    {review.strengths && <p className="whitespace-pre-line"><span className="text-slate-500">Kuchli tomonlar:</span> {review.strengths}</p>}
    {review.weaknesses && <p className="whitespace-pre-line"><span className="text-slate-500">Zaif tomonlar:</span> {review.weaknesses}</p>}
    {review.comments_to_author && (
      <p className="whitespace-pre-line"><span className="text-slate-500">Muallifga:</span> {review.comments_to_author}</p>
    )}
    {forEditor && review.comments_to_editor && (
      <p className="whitespace-pre-line"><span className="text-slate-500">Tahririyatga (muallif ko'rmaydi):</span> {review.comments_to_editor}</p>
    )}
  </div>
);

/**
 * Taqrizchi taqrizni yakunlagach maqolani nashrgacha o'zi olib boradi (jurnal admini tasdig'i shart emas):
 * "Qabul qilish" tavsiyasi bilan yuborilsa maqola darhol qabul qilinadi, keyin «Nashr qilish» bloki ochiladi.
 */
const ReviewerForm: React.FC<{ review: Review; articleId: string; onDone: () => void }> = ({ review, articleId, onDone }) => {
  const [form, setForm] = useState({
    recommendation: '',
    review_content: '',
    strengths: '',
    weaknesses: '',
    comments_to_author: '',
    comments_to_editor: '',
    originality_score: 7,
    methodology_score: 7,
    clarity_score: 7,
    significance_score: 7,
    references_score: 7,
  });
  const [declineReason, setDeclineReason] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onDone();
    } catch (err: any) {
      toast.error(err?.message || 'Amalni bajarib bo\'lmadi.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recommendation || !form.review_content.trim()) {
      toast.error('Tavsiya va taqriz matni majburiy.');
      return;
    }
    const next = RECOMMENDATION_STATUS[form.recommendation];
    // Qaytarish / rad etish sababi — muallifga izoh (bo'lmasa taqriz matni)
    const reason = (form.comments_to_author || form.review_content).trim();
    run(async () => {
      await apiService.reviews.submitReview(review.id, form);
      try {
        await apiService.articles.updateStatus(articleId, next.status, next.status === 'Accepted' ? undefined : reason);
      } catch (err: any) {
        // Masalan, antiplagiat tekshiruvi hali tayyor emas — taqriz saqlandi, qarorni keyinroq «Boshqaruv» dan bosadi
        toast.info(err?.message || "Qarorni «Boshqaruv» bo'limidan qiling.", { autoClose: 8000 });
      }
    }, next.ok);
  };

  return (
    <div className="space-y-3">
      {review.status === 'pending' && (
        <div className="rounded-lg border border-[var(--editorial-border)] p-3 space-y-2">
          <p className="text-sm">Sizga ushbu maqolani taqrizlash taklif qilindi{review.deadline ? ` (muddat: ${formatUzDate(review.deadline, true)})` : ''}.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => run(() => apiService.reviews.acceptReview(review.id), 'Taklif qabul qilindi.')} className="flex items-center gap-2">
              <Check size={16} /> Qabul qilaman
            </Button>
          </div>
          <textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Rad etish sababi (masalan: mavzu mutaxassisligimga mos emas)"
            rows={2}
            className={inputClass}
          />
          <Button
            type="button"
            variant="danger"
            disabled={busy}
            onClick={() => run(() => apiService.reviews.declineReview(review.id, declineReason), 'Taklif rad etildi. Tahririyat xabardor qilindi.')}
            className="flex items-center gap-2"
          >
            <X size={16} /> Rad etaman
          </Button>
        </div>
      )}
      {(review.status === 'accepted' || review.status === 'in_progress') && (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Tavsiya *
            <select
              value={form.recommendation}
              onChange={(e) => setForm({ ...form, recommendation: e.target.value })}
              className="editorial-select w-full mt-1"
              required
            >
              <option value="">— tanlang —</option>
              {RECOMMENDATIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SCORE_FIELDS.map((f) => (
              <label key={f.key} className="block text-xs text-slate-600">
                {f.label} (1–10)
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form[f.key as keyof typeof form] as number}
                  onChange={(e) => setForm({ ...form, [f.key]: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
                  className={`${inputClass} mt-1`}
                />
              </label>
            ))}
          </div>
          {([
            ['review_content', 'Taqriz matni *', 5],
            ['strengths', 'Kuchli tomonlar', 2],
            ['weaknesses', 'Zaif tomonlar', 2],
            ['comments_to_author', 'Muallifga izoh', 3],
            ['comments_to_editor', 'Tahririyatga izoh (muallif ko\'rmaydi)', 2],
          ] as const).map(([key, label, rows]) => (
            <label key={key} className="block text-sm font-medium text-slate-700">
              {label}
              <textarea
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                rows={rows}
                className={`${inputClass} mt-1`}
              />
            </label>
          ))}
          <Button type="submit" disabled={busy} className="w-full">Taqrizni yuborish</Button>
        </form>
      )}
      {review.status === 'completed' && <ReviewResult review={review} forEditor />}
      {review.status === 'declined' && <p className="text-sm text-slate-500">Siz bu taklifni rad etgansiz.</p>}
    </div>
  );
};

const AssignReviewer: React.FC<{ articleId: string; onAssigned: () => void }> = ({ articleId, onAssigned }) => {
  const [query, setQuery] = useState('');
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [reviewerId, setReviewerId] = useState('');
  const [reviewType, setReviewType] = useState<Review['review_type']>('double_blind');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);

  const search = useCallback(async () => {
    try {
      const data = await apiService.reviews.findSpecialists({ article: articleId, q: query.trim() });
      setSpecialists(asList<Specialist>(data));
    } catch (err: any) {
      toast.error(err?.message || 'Taqrizchilar ro\'yxatini yuklab bo\'lmadi.');
    }
  }, [articleId, query]);

  useEffect(() => {
    search();
    // faqat birinchi ochilishda; keyin qidiruv tugmasi bilan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  const assign = async () => {
    if (!reviewerId) {
      toast.error('Taqrizchini tanlang.');
      return;
    }
    setBusy(true);
    try {
      await apiService.reviews.create({
        article: articleId,
        reviewer: reviewerId,
        review_type: reviewType,
        ...(deadline ? { deadline: new Date(`${deadline}T23:59:00`).toISOString() } : {}),
      });
      toast.success('Taqrizchi tayinlandi va xabardor qilindi.');
      setReviewerId('');
      setDeadline('');
      onAssigned();
      search();
    } catch (err: any) {
      toast.error(err?.message || 'Tayinlab bo\'lmadi.');
    } finally {
      setBusy(false);
    }
  };

  const available = specialists.filter((s) => !s.already_assigned);
  return (
    <div className="mt-4 pt-4 border-t border-[var(--editorial-border)] space-y-2">
      <p className="text-sm font-semibold flex items-center gap-2"><UserPlus size={16} /> Taqrizchi tayinlash</p>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
          placeholder="Ism yoki mutaxassislik"
          className={inputClass}
        />
        <Button type="button" variant="secondary" onClick={search} aria-label="Qidirish" className="!px-3">
          <Search size={16} />
        </Button>
      </div>
      <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className="editorial-select w-full">
        <option value="">— taqrizchini tanlang ({available.length}) —</option>
        {available.map((s) => (
          <option key={s.id} value={s.id}>
            {s.full_name}
            {s.reviewed_before ? ' (avvalgi bosqichda taqriz yozgan)' : ''}
            {s.specializations?.length ? ` — ${s.specializations.slice(0, 3).join(', ')}` : ''}
            {` · faol: ${s.active_reviews}, bajargan: ${s.reviews_completed}`}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select value={reviewType} onChange={(e) => setReviewType(e.target.value as Review['review_type'])} className="editorial-select w-full">
          {REVIEW_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          title="Muddat (bo'sh qoldirilsa — standart)"
          className={inputClass}
        />
      </div>
      <Button type="button" onClick={assign} disabled={busy || !reviewerId} className="w-full">Tayinlash</Button>
    </div>
  );
};

const ArticleReviewsPanel: React.FC<{ articleId: string; canManage: boolean; onArticleChanged?: () => void }> = ({
  articleId,
  canManage,
  onArticleChanged,
}) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setReviews(asList<Review>(await apiService.reviews.listForArticle(articleId)));
    } catch {
      setReviews([]);
    } finally {
      setLoaded(true);
    }
  }, [articleId]);

  useEffect(() => {
    load();
  }, [load]);

  const isReviewer = user?.role === Role.Reviewer;
  const isAuthor = user?.role === Role.Author;
  const myReview = useMemo(
    () => (isReviewer ? reviews.find((r) => String(r.reviewer) === String(user?.id)) : undefined),
    [isReviewer, reviews, user?.id],
  );
  const visible = isAuthor ? reviews.filter((r) => r.status === 'completed') : reviews;

  if (!loaded) return null;
  if (isReviewer && !myReview) return null;
  if (isAuthor && visible.length === 0) return null;
  if (!canManage && !isReviewer && !isAuthor) return null;

  const remove = async (id: string) => {
    if (!window.confirm('Taqrizchini bu maqoladan olib tashlaysizmi?')) return;
    try {
      await apiService.reviews.delete(id);
      toast.success('Taqrizchi olib tashlandi.');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Olib tashlab bo\'lmadi.');
    }
  };

  return (
    <Card title={isReviewer ? 'Mening taqrizim' : 'Taqrizlar'}>
      {isReviewer && myReview ? (
        <ReviewerForm
          review={myReview}
          articleId={articleId}
          onDone={() => {
            load();
            onArticleChanged?.();
          }}
        />
      ) : (
        <div className="space-y-3">
          {visible.length === 0 && <p className="text-sm text-slate-500">Hali taqrizchi tayinlanmagan.</p>}
          {visible.map((r) => (
            <div key={r.id} className="rounded-lg border border-[var(--editorial-border)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-sm">
                  {r.reviewer_name}
                  {(r.round_number ?? 1) > 1 && <span className="ml-2 text-xs text-slate-500">{r.round_number}-bosqich</span>}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_TONES[r.status]}`}>{STATUS_LABELS[r.status]}</span>
              </div>
              {canManage && (
                <p className="text-xs text-slate-500 mt-1">
                  {REVIEW_TYPES.find((t) => t.value === r.review_type)?.label}
                  {r.deadline && r.status !== 'completed' ? ` · muddat: ${formatUzDate(r.deadline, true)}` : ''}
                </p>
              )}
              {r.status === 'completed' && <ReviewResult review={r} forEditor={canManage} />}
              <div className="flex flex-wrap gap-2 mt-2">
                {r.status === 'completed' && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="!px-3 !py-1.5 text-xs flex items-center gap-1"
                    onClick={() => apiService.reviews.downloadReviewDocument(r.id).catch((e) => toast.error(e?.message))}
                  >
                    <Download size={14} /> Yuklab olish
                  </Button>
                )}
                {canManage && (r.status === 'pending' || r.status === 'declined') && (
                  <Button type="button" variant="danger" className="!px-3 !py-1.5 text-xs flex items-center gap-1" onClick={() => remove(r.id)}>
                    <Trash2 size={14} /> Olib tashlash
                  </Button>
                )}
              </div>
            </div>
          ))}
          {canManage && <AssignReviewer articleId={articleId} onAssigned={load} />}
        </div>
      )}
    </Card>
  );
};

export default ArticleReviewsPanel;
