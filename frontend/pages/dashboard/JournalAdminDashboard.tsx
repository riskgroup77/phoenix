import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, BookOpen, CheckCircle, Clock, FileText, Inbox, RotateCcw, Send } from 'lucide-react';
import { DashboardHero, SectionHead, StatRow, StatTile, TodoCard, greeting, type TodoItem } from '../../components/dashboard/DashboardParts';
import EmptyState from '../../components/EmptyState';
import { useT } from '../../i18n/LanguageContext';
import { getArticleJournalIdFromApi } from '../../utils/articleIds';
import { formatUzDate } from '../../utils/uzDate';
import { ARTICLE_STATUS_LABELS } from '../../types';

type Props = { userId: string; firstName: string; articles: any[]; journals: any[] };

const journalAdminId = (j: any): string => {
  const raw = j?.journal_admin ?? j?.journalAdminId ?? j?.journal_admin_id;
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && 'id' in raw) return String(raw.id);
  return String(raw);
};

/** Jurnal administratori: yangi kelganlar, nashrga tayyorlar, tahrirdagilar va o'z jurnallari. */
const JournalAdminDashboard: React.FC<Props> = ({ userId, firstName, articles, journals }) => {
  const { t } = useT();
  const navigate = useNavigate();

  // Backend jurnal admini uchun ro'yxatni allaqachon filtrlaydi; ID mos kelmasa ham ko'rinsin
  const managed = journals.filter((j) => {
    const aid = journalAdminId(j);
    return !aid || aid === String(userId);
  });
  const managedIds = new Set(managed.map((j) => String(j.id).toLowerCase()));
  const mine = articles.filter((a) => {
    if (managedIds.size === 0) return true;
    const jid = getArticleJournalIdFromApi(a).toLowerCase();
    return !!jid && managedIds.has(jid);
  });
  const by = (...statuses: string[]) => mine.filter((a) => statuses.includes(a.status));
  const newOnes = by('Yangi', 'WithEditor');
  const accepted = by('Accepted');
  const toPublish = by('NashrgaYuborilgan');
  const revision = by('Revision');
  const published = by('Published');
  const plagReview = by('PlagiarismReview');

  const todos: TodoItem[] = [
    { key: 'new', icon: Inbox, title: t("Yangi maqolalarni ko'rib chiqish"), hint: t("Qabul qiling yoki tahrirga qaytaring"), count: newOnes.length, to: '/articles', tone: 'warning' },
    { key: 'accepted', icon: Send, title: t('Qabul qilinganlarni nashr qilish'), hint: t('Sertifikat yuklab, nashrni yakunlang'), count: accepted.length, to: '/articles?tab=ready', tone: 'info' },
    { key: 'publish', icon: Clock, title: t('Nashrga yuborilganlar'), count: toPublish.length, to: '/articles?tab=ready' },
    { key: 'plag', icon: FileText, title: t('Antiplagiat bo‘yicha bosh admin qarori kutilmoqda'), count: plagReview.length, to: '/articles' },
    { key: 'rev', icon: RotateCcw, title: t('Muallif tahrir qilmoqda'), hint: t("Muallif javobini kutish"), count: revision.length, to: '/articles' },
  ];

  const recent = [...mine]
    .sort((a, b) => new Date(b.submission_date || 0).getTime() - new Date(a.submission_date || 0).getTime())
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-7">
      <DashboardHero
        title={`${greeting(t)}, ${firstName}!`}
        subtitle={
          newOnes.length
            ? t("{n} ta yangi maqola ko'rib chiqishni kutmoqda.", { n: newOnes.length })
            : t('Sizga biriktirilgan jurnallar va maqolalar holati.')
        }
        actions={
          <>
            <Link to="/analytics" className="milliy-btn-on-band milliy-btn-on-band--ghost">
              <BarChart3 className="w-4 h-4" aria-hidden /> {t('Analitika')}
            </Link>
            <Link to="/articles" className="milliy-btn-on-band">
              <Inbox className="w-4 h-4" aria-hidden /> {t('Maqolalar')}
            </Link>
          </>
        }
      />

      <StatRow label={t("Ko'rsatkichlar")}>
        <StatTile icon={Inbox} value={newOnes.length} label={t('Yangi kelganlar')} to="/articles" />
        <StatTile icon={Send} value={accepted.length + toPublish.length} label={t('Nashrga tayyor')} to="/articles?tab=ready" />
        <StatTile icon={RotateCcw} value={revision.length} label={t('Tahrirda')} to="/articles" />
        <StatTile icon={CheckCircle} value={published.length} label={t('Nashr etilgan')} to="/published-articles" />
      </StatRow>

      <div className="flex flex-wrap gap-6 items-start">
        <section aria-labelledby="ja-recent" className="flex flex-col gap-3.5 min-w-0 flex-[2_1_520px]">
          <SectionHead id="ja-recent" title={t("So'nggi kelgan maqolalar")} to="/articles" />
          {recent.length === 0 ? (
            <EmptyState illustration="inbox" title={t('Hozircha maqolalar kelmagan')} description={t("Mualliflar jurnalingizga maqola yuborganda shu yerda ko'rinadi.")} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {recent.map((a) => (
                <Link key={a.id} to={`/articles/${a.id}`} className="milliy-article-card">
                  <span className="pinm-badge pinm-badge--info self-start">{t(ARTICLE_STATUS_LABELS[a.status] || a.status)}</span>
                  <span className="font-bold text-base leading-snug line-clamp-2">{a.title || t('Nomsiz maqola')}</span>
                  <span className="text-[13px] text-[var(--editorial-muted)]">
                    {[a.author_name, a.journal_name, formatUzDate(a.submission_date)].filter(Boolean).join(' · ')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <TodoCard items={todos} className="min-w-0 flex-[1_1_300px]" />
      </div>

      <section aria-labelledby="ja-journals" className="flex flex-col gap-3.5">
        <SectionHead id="ja-journals" title={t('Mening jurnallarim')} />
        {managed.length === 0 ? (
          <EmptyState compact title={t("Sizga hali jurnal biriktirilmagan")} description={t("Bosh administrator bilan bog'laning.")} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {managed.map((j) => {
              const jid = String(j.id).toLowerCase();
              const jArticles = mine.filter((a) => getArticleJournalIdFromApi(a).toLowerCase() === jid);
              const jNew = jArticles.filter((a) => a.status === 'Yangi' || a.status === 'WithEditor').length;
              const jPub = jArticles.filter((a) => a.status === 'Published').length;
              return (
                <div key={j.id} className="milliy-journal-card">
                  <div className="flex items-start gap-3">
                    <span className="milliy-icon-tile shrink-0"><BookOpen className="w-5 h-5" aria-hidden /></span>
                    <div className="min-w-0">
                      <h3 className="m-0 text-base font-bold leading-snug line-clamp-2">{j.name || '—'}</h3>
                      <p className="m-0 mt-1 text-xs text-[var(--editorial-muted)]">ISSN {j.issn || '—'}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span><b className="tabular-nums">{jNew}</b> <span className="text-[var(--editorial-muted)]">{t('yangi')}</span></span>
                    <span><b className="tabular-nums">{jPub}</b> <span className="text-[var(--editorial-muted)]">{t('nashr')}</span></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/articles?journal=${encodeURIComponent(String(j.id))}`)}
                    className="milliy-btn-secondary !min-h-[2.375rem] text-sm mt-auto"
                  >
                    {t('Maqolalar')} <ArrowRight className="w-4 h-4" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default JournalAdminDashboard;
