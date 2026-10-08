import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AlertTriangle, BookOpen, Bot, Clock, ExternalLink, FileText, Inbox, Languages, Library, Rocket } from 'lucide-react';
import { DashboardHero, DueChip, SectionHead, StatRow, StatTile, TodoCard, greeting, type TodoItem } from '../../components/dashboard/DashboardParts';
import EmptyState from '../../components/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { apiService } from '../../services/apiService';
import { useT } from '../../i18n/LanguageContext';
import { formatUzDate } from '../../utils/uzDate';

type WorkItem = {
  kind: string;
  kind_label: string;
  id: string;
  title: string;
  link: string;
  due_at: string;
  hours_left: number;
  overdue: boolean;
  due_soon: boolean;
  fast_track: boolean;
};

type Props = {
  firstName: string;
  articles: any[];
  doiRequests: any[];
  articleSampleRequests: any[];
  translationRequests: any[];
  udkRequests: any[];
  onDoiUpdated: (list: any[]) => void;
};

const KIND_ICON: Record<string, React.ElementType> = {
  article: FileText,
  doi: Bot,
  udk: Library,
  translation: Languages,
  sample: FileText,
  peer_review: FileText,
};

/** Taqrizchi ishchi stoli: muddatlar bo'yicha navbat, kechikkanlar, DOI havolasini tezkor kiritish. */
const ReviewerDashboard: React.FC<Props> = ({
  firstName,
  articles,
  doiRequests,
  articleSampleRequests,
  translationRequests,
  udkRequests,
  onDoiUpdated,
}) => {
  const { t } = useT();
  const [workload, setWorkload] = useState<{ items: WorkItem[]; counts: { total: number; overdue: number; due_soon: number }; processing: any } | null>(null);
  const [loadingWl, setLoadingWl] = useState(true);
  const [doiLinks, setDoiLinks] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiService.analytics
      .workload()
      .then((d) => alive && setWorkload(d))
      .catch(() => alive && setWorkload(null))
      .finally(() => alive && setLoadingWl(false));
    return () => {
      alive = false;
    };
  }, []);

  const forReview = articles.filter((a) => a.status === 'QabulQilingan' && !String(a.title || '').trim().toUpperCase().startsWith('[KITOB]'));
  const bookOrders = articles.filter(
    (a) => String(a.title || '').trim().toUpperCase().startsWith('[KITOB]') && a.status !== 'Published' && a.status !== 'Rejected',
  );
  const doiOpen = doiRequests.filter((r) => r.status === 'submitted');
  const udkOpen = udkRequests.filter((r) => r.status === 'submitted');
  const trOpen = translationRequests.filter((x) => x.status === 'Yangi' || x.status === 'Jarayonda');
  const sampleOpen = articleSampleRequests.filter((r) => r.status === 'submitted' || r.status === 'in_progress');
  const counts = workload?.counts;
  const items = workload?.items || [];
  const byKind = (kind: string) => items.filter((i) => i.kind === kind);
  const overdueOf = (kind: string) => byKind(kind).filter((i) => i.overdue).length;

  const todos: TodoItem[] = [
    {
      key: 'overdue',
      icon: AlertTriangle,
      title: t('Kechikkan ishlar'),
      hint: t("Muddati o'tgan — birinchi navbatda"),
      count: counts?.overdue || 0,
      to: items.find((i) => i.overdue)?.link || '/articles',
      tone: 'danger',
    },
    {
      key: 'articles',
      icon: Inbox,
      title: t('Taqrizga kelgan maqolalar'),
      hint: overdueOf('article') ? t('{n} tasi kechikkan', { n: overdueOf('article') }) : undefined,
      count: forReview.length,
      to: '/articles',
      tone: overdueOf('article') ? 'warning' : 'info',
    },
    { key: 'doi', icon: Bot, title: t("DOI so'rovlari"), count: doiOpen.length, to: '/doi-requests', tone: overdueOf('doi') ? 'warning' : 'info' },
    { key: 'udk', icon: Library, title: t("UDK so'rovlari"), count: udkOpen.length, to: '/udk-requests', tone: overdueOf('udk') ? 'warning' : 'info' },
    { key: 'tr', icon: Languages, title: t('Tarjima buyurtmalari'), count: trOpen.length, to: '/articles?tab=translations' },
    { key: 'sample', icon: FileText, title: t('Maqola namuna buyurtmalari'), count: sampleOpen.length, to: '/article-sample-requests' },
    { key: 'books', icon: BookOpen, title: t('Kitob nashr buyurtmalari'), count: bookOrders.length, to: '/articles?tab=book-orders' },
  ];

  const saveDoi = async (id: string) => {
    const link = (doiLinks[id] || '').trim();
    if (!link.startsWith('http')) {
      toast.warning(t("To'g'ri DOI havolasini (https://...) kiriting."));
      return;
    }
    setSavingId(id);
    try {
      await apiService.doi.updateLink(id, link);
      toast.success(t('DOI saqlandi. Muallifga xabar yuborildi.'));
      setDoiLinks((p) => ({ ...p, [id]: '' }));
      const res = await apiService.doi.list();
      onDoiUpdated(Array.isArray(res) ? res : res?.results ?? res?.data ?? []);
    } catch (e: any) {
      toast.error(e?.message || t('Saqlashda xatolik.'));
    } finally {
      setSavingId(null);
    }
  };

  const subtitle =
    counts && counts.total > 0
      ? [
          t('{n} ta ochiq ish', { n: counts.total }),
          counts.overdue ? t('{n} tasi kechikkan', { n: counts.overdue }) : '',
          counts.due_soon ? t('{n} tasi 24 soatda tugaydi', { n: counts.due_soon }) : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : t('Barcha buyurtmalar shu yerda: taqriz, DOI, UDK, tarjima va kitob nashri.');

  return (
    <div className="flex flex-col gap-7">
      <DashboardHero title={`${greeting(t)}, ${firstName}!`} subtitle={subtitle} />

      <StatRow label={t("Ko'rsatkichlar")}>
        <StatTile icon={Inbox} value={forReview.length} label={t('Taqrizda')} to="/articles" />
        <StatTile icon={AlertTriangle} value={counts?.overdue ?? '—'} label={t('Kechikkan')} tone={counts?.overdue ? 'alert' : 'default'} />
        <StatTile icon={Clock} value={counts?.due_soon ?? '—'} label={t('24 soatda tugaydi')} />
        <StatTile icon={Bot} value={doiOpen.length + udkOpen.length} label={t("DOI va UDK so'rovlari")} to="/doi-requests" />
      </StatRow>

      <div className="flex flex-wrap gap-6 items-start">
        <section aria-labelledby="rv-queue" className="flex flex-col gap-3.5 min-w-0 flex-[2_1_520px]">
          <SectionHead id="rv-queue" title={t('Navbat (muddat bo‘yicha)')} />
          {loadingWl ? (
            <ListSkeleton rows={4} />
          ) : items.length === 0 ? (
            <EmptyState illustration="inbox" title={t("Navbat bo'sh")} description={t("Yangi buyurtmalar kelganda shu yerda muddati bilan ko'rinadi.")} />
          ) : (
            <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
              {items.slice(0, 8).map((it) => {
                const Icon = KIND_ICON[it.kind] || FileText;
                return (
                  <li key={`${it.kind}-${it.id}`}>
                    <Link to={it.link} className="editorial-card flex items-center gap-3 !py-3.5 hover:border-[var(--editorial-primary)]/35 transition-colors">
                      <span className="milliy-icon-tile milliy-icon-tile--sm shrink-0"><Icon className="w-4 h-4" aria-hidden /></span>
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="font-semibold text-[var(--editorial-text)] truncate flex items-center gap-2">
                          {it.fast_track && <Rocket className="w-3.5 h-3.5 text-[#d99a00] shrink-0" aria-label={t('Tezkor')} />}
                          {it.title}
                        </span>
                        <span className="text-xs text-[var(--editorial-muted)]">
                          {t(it.kind_label)} · {t('muddat')}: {formatUzDate(it.due_at, true)}
                        </span>
                      </span>
                      <DueChip hoursLeft={it.hours_left} overdue={it.overdue} dueSoon={it.due_soon} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {items.length > 8 && (
            <p className="m-0 text-sm text-[var(--editorial-muted)]">{t('Yana {n} ta ish navbatda.', { n: items.length - 8 })}</p>
          )}
        </section>

        <TodoCard items={todos} className="min-w-0 flex-[1_1_300px]" />
      </div>

      {doiOpen.length > 0 && (
        <section aria-labelledby="rv-doi" className="editorial-card flex flex-col gap-3">
          <h2 id="rv-doi" className="m-0 text-lg">{t('DOI havolasini kiritish')}</h2>
          <p className="m-0 text-sm text-[var(--editorial-muted)]">{t('Havolani saqlaganingizda muallifga avtomatik xabar boradi.')}</p>
          <ul className="m-0 p-0 list-none flex flex-col divide-y divide-[var(--editorial-border)]">
            {doiOpen.slice(0, 6).map((req) => (
              <li key={req.id} className="flex flex-col md:flex-row md:items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-semibold text-[var(--editorial-text)]">{req.author_short || t('Muallif')}</p>
                  <p className="m-0 text-xs text-[var(--editorial-muted)]">
                    {formatUzDate(req.created_at, true)}
                    {req.file_url && (
                      <>
                        {' · '}
                        <a href={req.file_url} target="_blank" rel="noopener noreferrer" className="editorial-link inline-flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" aria-hidden /> {t('Fayl')}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <label className="sr-only" htmlFor={`doi-${req.id}`}>{t('DOI havolasi')}</label>
                  <input
                    id={`doi-${req.id}`}
                    type="url"
                    placeholder="https://doi.org/10.xxxx/..."
                    value={doiLinks[req.id] || ''}
                    onChange={(e) => setDoiLinks((p) => ({ ...p, [req.id]: e.target.value }))}
                    className="editorial-select flex-1 md:w-72"
                  />
                  <button type="button" onClick={() => saveDoi(req.id)} disabled={savingId === req.id} className="milliy-btn-primary shrink-0">
                    {savingId === req.id ? t('Saqlanmoqda...') : t('Saqlash')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {workload?.processing && (
        <section aria-labelledby="rv-stats" className="editorial-card">
          <h2 id="rv-stats" className="m-0 mb-3 text-lg">{t("O'rtacha bajarilish vaqti (90 kun)")}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {workload.processing.by_kind.map((k: any) => (
              <div key={k.kind} className="rounded-[10px] bg-[var(--editorial-bg-alt)] p-3">
                <p className="m-0 text-xs font-semibold text-[var(--editorial-muted)]">{t(k.label)}</p>
                <p className="m-0 mt-1 text-xl font-extrabold tabular-nums">{k.avg_days === null ? '—' : t('{n} kun', { n: k.avg_days })}</p>
                <p className="m-0 text-xs text-[var(--editorial-muted)]">{t('{n} ta bajarildi', { n: k.completed })}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ReviewerDashboard;
