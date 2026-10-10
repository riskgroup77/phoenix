import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BookMarked,
  CreditCard,
  FileSearch,
  FileText,
  Hash,
  Languages,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import GirihPattern from '../components/GirihPattern';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSwitcher from '../components/LanguageSwitcher';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/apiService';
import { useT } from '../i18n/LanguageContext';
import { formatUzDate } from '../utils/uzDate';

type PublicJournal = {
  id: string;
  name: string;
  issn: string;
  category: string;
  description: string;
  image: string;
  published_count: number;
  publication_fee: number;
  price_per_page: number;
  pricing_type: string;
};

type PublicOverview = {
  stats: { journals: number; published_articles: number; authors: number };
  journals: PublicJournal[];
  recent_articles: { id: string; title: string; journal: string; authors: string; doi: string; date: string | null; link: string }[];
  prices: { key: string; label: string; amount: number }[];
  publication_fee_from: number | null;
};

const PRICE_META: Record<string, { title: string; hint: string; icon: React.ElementType; unit?: string }> = {
  plagiarism_check: { title: 'Antiplagiat tekshiruvi', hint: "To'liq hisobot va QR sertifikat", icon: ShieldCheck },
  udk_request: { title: "UDK ma'lumotnoma", hint: 'Tasdiqlangan hujjat', icon: Hash },
  doi_request: { title: 'DOI raqami', hint: 'Xalqaro identifikator', icon: BadgeCheck },
  translation_per_word: { title: 'Ilmiy tarjima', hint: "So'z bo'yicha narx", icon: Languages, unit: "1 so'z" },
  article_sample_quyi: { title: 'Maqola namunasi', hint: '1 bet uchun, dan boshlab', icon: FileText, unit: '1 bet' },
  fast_track: { title: "Tezkor ko'rib chiqish", hint: 'Navbatsiz ko‘rib chiqish', icon: ArrowRight },
};

const STEPS = [
  { icon: Upload, title: "Ro'yxatdan o'ting", text: 'Telefon raqamingiz bilan bir daqiqada hisob oching.' },
  { icon: FileSearch, title: 'Maqolani yuboring', text: 'Jurnalni tanlang, faylni yuklang va antiplagiatdan o‘tkazing.' },
  { icon: CreditCard, title: "To'lovni amalga oshiring", text: 'Click yoki Payme orqali, chek darhol yuboriladi.' },
  { icon: BadgeCheck, title: 'Nashr va sertifikat', text: 'Holatni kuzating, nashrdan so‘ng sertifikatni yuklab oling.' },
];

const money = (v: number) => Math.round(v).toLocaleString('ru-RU').replace(/,/g, ' ');

const Landing: React.FC = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const [data, setData] = useState<PublicOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  useEffect(() => {
    let alive = true;
    apiService.analytics
      .publicOverview()
      .then((d: PublicOverview) => alive && setData(d))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set((data?.journals || []).map((j) => j.category).filter(Boolean))).sort(),
    [data],
  );

  const journals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.journals || []).filter(
      (j) =>
        (!category || j.category === category) &&
        (!q || j.name.toLowerCase().includes(q) || j.issn.includes(q) || j.category.toLowerCase().includes(q)),
    );
  }, [data, query, category]);

  const feeLabel = (j: PublicJournal) => {
    if (j.pricing_type === 'per_page' && j.price_per_page > 0) return t("{sum} so'm / bet", { sum: money(j.price_per_page) });
    if (j.publication_fee > 0) return t("{sum} so'm", { sum: money(j.publication_fee) });
    return t('Narx kelishiladi');
  };

  const submitVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const code = verifyCode.trim();
    if (code) navigate(`/verify/${encodeURIComponent(code)}`);
  };

  return (
    <div className="milliy-landing">
      {/* Yuqori panel */}
      <header className="milliy-topbar sticky top-0 z-[60]">
        <div className="milliy-topbar-pattern" aria-hidden="true">
          <GirihPattern opacity={0.1} />
        </div>
        <div className="milliy-topbar-inner">
          <Link to="/" className="milliy-brand">
            <span className="milliy-brand-mark" aria-hidden="true">P</span>
            <span className="hidden sm:flex flex-col min-w-0">
              <span className="milliy-brand-title">Phoenix</span>
              <span className="milliy-brand-sub">{t('Ilmiy nashrlar markazi')}</span>
            </span>
          </Link>
          <nav aria-label={t('Asosiy menyu')} className="milliy-nav hidden lg:flex">
            <a href="#jurnallar" onClick={(e) => { e.preventDefault(); document.getElementById('jurnallar')?.scrollIntoView({ behavior: 'smooth' }); }} className="milliy-nav-link inline-flex">{t('Jurnallar')}</a>
            <a href="#narxlar" onClick={(e) => { e.preventDefault(); document.getElementById('narxlar')?.scrollIntoView({ behavior: 'smooth' }); }} className="milliy-nav-link inline-flex">{t('Xizmatlar va narxlar')}</a>
            <a href="#nashrlar" onClick={(e) => { e.preventDefault(); document.getElementById('nashrlar')?.scrollIntoView({ behavior: 'smooth' }); }} className="milliy-nav-link inline-flex">{t("So'nggi nashrlar")}</a>
          </nav>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <LanguageSwitcher variant="band" />
            <ThemeToggle variant="band" />
            <Link to="/login" className="milliy-nav-link inline-flex">{t('Kirish')}</Link>
            {/* display o'rovchida: .milliy-btn-on-band o'z display qiymati bilan Tailwind `hidden`ni bosib ketadi */}
            <span className="hidden sm:inline-flex">
              <Link to="/register" className="milliy-btn-on-band !min-h-[2.5rem] !px-4">
                {t("Ro'yxatdan o'tish")}
              </Link>
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="milliy-landing-hero">
        <GirihPattern opacity={0.12} />
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 pt-14 pb-24 sm:pt-20 sm:pb-28 flex flex-col gap-7">
          <div className="flex flex-col gap-4 max-w-3xl">
            <h1 className="m-0 text-4xl sm:text-5xl font-extrabold leading-[1.1] text-white">
              {t('Ilmiy maqolangizni ishonchli jurnalda nashr qiling')}
            </h1>
            <p className="m-0 text-lg leading-relaxed text-[var(--milliy-band-text)]">
              {t('Jurnallar katalogi, antiplagiat tekshiruvi, UDK va DOI — barchasi bitta platformada. Maqolangiz holatini har bosqichda kuzatib boring.')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/register" className="milliy-btn-on-band">
              <Upload className="w-4 h-4" aria-hidden /> {t('Maqola yuborish')}
            </Link>
            <a href="#jurnallar" onClick={(e) => { e.preventDefault(); document.getElementById('jurnallar')?.scrollIntoView({ behavior: 'smooth' }); }} className="milliy-btn-on-band milliy-btn-on-band--ghost">
              <BookMarked className="w-4 h-4" aria-hidden /> {t("Jurnallarni ko'rish")}
            </a>
          </div>
        </div>
      </section>

      {/* Ko'rsatkichlar */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 -mt-14 relative z-[1]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Jurnallar', value: data?.stats.journals, icon: BookMarked },
            { label: 'Nashr etilgan maqolalar', value: data?.stats.published_articles, icon: FileText },
            { label: 'Mualliflar', value: data?.stats.authors, icon: BadgeCheck },
          ].map((s) => (
            <div key={s.label} className="milliy-stat">
              <span className="milliy-icon-tile"><s.icon className="w-5 h-5" aria-hidden /></span>
              <span className="flex flex-col min-w-0">
                {loading ? (
                  <Skeleton className="h-7 w-16" rounded="sm" />
                ) : (
                  <span className="text-2xl sm:text-[28px] font-extrabold tabular-nums">{(s.value ?? 0).toLocaleString('ru-RU')}</span>
                )}
                <span className="text-sm font-semibold text-[var(--editorial-muted)]">{t(s.label)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Jurnallar katalogi */}
      <section id="jurnallar" className="milliy-landing-section scroll-mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div className="flex flex-col gap-2">
            <h2 className="m-0 text-2xl sm:text-3xl font-extrabold">{t('Jurnallar katalogi')}</h2>
            <p className="m-0 text-[var(--editorial-muted)]">{t("O'z yo'nalishingizdagi jurnalni toping va maqolangizni yuboring.")}</p>
          </div>
          <label className="relative w-full sm:w-80">
            <span className="sr-only">{t('Jurnal qidirish')}</span>
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--editorial-muted)]" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Jurnal nomi yoki ISSN')}
              className="editorial-select w-full !pl-9"
            />
          </label>
        </div>
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label={t("Yo'nalishlar")}>
            {['', ...categories].map((c) => (
              <button
                key={c || 'all'}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`px-3.5 min-h-[2.25rem] rounded-full text-sm font-semibold border transition-colors ${
                  category === c
                    ? 'bg-[var(--milliy-lapis)] text-white border-[var(--milliy-lapis)]'
                    : 'bg-[var(--milliy-surface)] text-[var(--editorial-body)] border-[var(--editorial-border)] hover:border-[var(--editorial-primary)]'
                }`}
              >
                {c || t('Barchasi')}
              </button>
            ))}
          </div>
        )}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="milliy-journal-card">
                <Skeleton className="h-5 w-3/4" rounded="sm" />
                <Skeleton className="h-3 w-1/3" rounded="sm" />
                <Skeleton className="h-12 w-full" rounded="sm" />
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState illustration="search" title={t("Ma'lumotlarni yuklab bo'lmadi")} description={t("Internet aloqasini tekshirib, sahifani yangilang.")} />
        ) : journals.length === 0 ? (
          <EmptyState illustration="search" title={t('Jurnal topilmadi')} description={t("Boshqa nom yoki ISSN bilan qidirib ko'ring.")} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {journals.map((j) => (
              <article key={j.id} className="milliy-journal-card">
                <div className="flex items-start gap-3">
                  {j.image ? (
                    <img src={j.image} alt="" className="w-12 h-16 object-cover rounded-md border border-[var(--editorial-border)] shrink-0" loading="lazy" />
                  ) : (
                    <span className="milliy-icon-tile shrink-0"><BookMarked className="w-5 h-5" aria-hidden /></span>
                  )}
                  <div className="min-w-0">
                    <h3 className="m-0 text-base font-bold leading-snug line-clamp-2">{j.name}</h3>
                    <p className="m-0 mt-1 text-xs text-[var(--editorial-muted)]">ISSN {j.issn}{j.category ? ` · ${j.category}` : ''}</p>
                  </div>
                </div>
                {j.description && <p className="m-0 text-sm text-[var(--editorial-body)] leading-relaxed line-clamp-3">{j.description}</p>}
                <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-[var(--editorial-border)]">
                  <span className="text-sm">
                    <span className="font-bold">{feeLabel(j)}</span>
                    <span className="block text-xs text-[var(--editorial-muted)]">{t('{n} ta nashr', { n: j.published_count })}</span>
                  </span>
                  <Link to="/register" className="milliy-btn-secondary !min-h-[2.375rem] !px-3 text-sm">
                    {t('Maqola yuborish')} <ArrowRight className="w-4 h-4" aria-hidden />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Qanday ishlaydi */}
      <section className="bg-[var(--milliy-surface)] border-y border-[var(--editorial-border)]">
        <div className="milliy-landing-section">
          <h2 className="m-0 mb-8 text-2xl sm:text-3xl font-extrabold">{t('Qanday ishlaydi')}</h2>
          <ol className="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-3">
                <span className="flex items-center gap-3">
                  <span className="milliy-step-num !bg-[var(--milliy-lapis)] !text-white">{i + 1}</span>
                  <s.icon className="w-5 h-5 text-[var(--milliy-firuza)]" aria-hidden />
                </span>
                <h3 className="m-0 text-lg font-bold">{t(s.title)}</h3>
                <p className="m-0 text-sm leading-relaxed text-[var(--editorial-muted)]">{t(s.text)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Narxlar */}
      <section id="narxlar" className="milliy-landing-section scroll-mt-20">
        <h2 className="m-0 mb-2 text-2xl sm:text-3xl font-extrabold">{t('Xizmatlar va narxlar')}</h2>
        <p className="m-0 mb-6 text-[var(--editorial-muted)]">
          {data?.publication_fee_from
            ? t("Maqola nashri — {sum} so'mdan (jurnalga qarab).", { sum: money(data.publication_fee_from) })
            : t('Maqola nashri narxi jurnalga qarab belgilanadi.')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="milliy-price-card">
                  <Skeleton className="h-5 w-1/2" rounded="sm" />
                  <Skeleton className="h-8 w-1/3" rounded="sm" />
                </div>
              ))
            : (data?.prices || []).map((p) => {
                const meta = PRICE_META[p.key];
                const Icon = meta?.icon || FileText;
                return (
                  <div key={p.key} className="milliy-price-card">
                    <span className="flex items-center gap-3">
                      <span className="milliy-icon-tile milliy-icon-tile--sm"><Icon className="w-4 h-4" aria-hidden /></span>
                      <span className="font-bold">{t(meta?.title || p.label)}</span>
                    </span>
                    <span className="text-2xl font-extrabold tabular-nums mt-2">
                      {money(p.amount)} <span className="text-base font-semibold text-[var(--editorial-muted)]">{t("so'm")}{meta?.unit ? ` / ${t(meta.unit)}` : ''}</span>
                    </span>
                    {meta?.hint && <span className="text-sm text-[var(--editorial-muted)]">{t(meta.hint)}</span>}
                  </div>
                );
              })}
        </div>
      </section>

      {/* So'nggi nashrlar */}
      <section id="nashrlar" className="bg-[var(--milliy-surface)] border-y border-[var(--editorial-border)] scroll-mt-20">
        <div className="milliy-landing-section">
          <h2 className="m-0 mb-6 text-2xl sm:text-3xl font-extrabold">{t("So'nggi nashrlar")}</h2>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" rounded="lg" />)}
            </div>
          ) : (data?.recent_articles || []).length === 0 ? (
            <EmptyState compact title={t("Hozircha nashrlar yo'q")} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(data?.recent_articles || []).map((a) => (
                <Link key={a.id} to={a.link} className="milliy-article-card">
                  <span className="pinm-badge pinm-badge--success self-start">{t('Nashr etilgan')}</span>
                  <span className="font-bold text-base leading-snug line-clamp-2">{a.title}</span>
                  <span className="text-[13px] text-[var(--editorial-muted)]">
                    {[a.authors, a.journal, a.date ? formatUzDate(a.date, true) : ''].filter(Boolean).join(' · ')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Hujjatni tekshirish */}
      <section className="milliy-landing-section">
        <div className="editorial-card flex flex-col lg:flex-row lg:items-center gap-5 !p-6">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <span className="milliy-icon-tile shrink-0"><ShieldCheck className="w-5 h-5" aria-hidden /></span>
            <div>
              <h2 className="m-0 text-xl font-extrabold">{t('Hujjatni tekshirish')}</h2>
              <p className="m-0 mt-1 text-sm text-[var(--editorial-muted)]">
                {t("Sertifikat, ma'lumotnoma yoki chekdagi raqamni kiriting — hujjat platformada haqiqatan berilganini tekshiring.")}
              </p>
            </div>
          </div>
          <form onSubmit={submitVerify} className="flex flex-col min-[360px]:flex-row gap-2 w-full lg:w-auto">
            <label className="sr-only" htmlFor="landing-verify">{t('Hujjat raqami')}</label>
            <input
              id="landing-verify"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="CHK-1A2B3C4D"
              className="editorial-select flex-1 min-w-0 lg:w-64"
            />
            <button type="submit" className="milliy-btn-primary shrink-0">{t('Tekshirish')}</button>
          </form>
        </div>
      </section>

      <footer className="border-t border-[var(--editorial-border)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-[var(--editorial-muted)]">
          <span>© {new Date().getFullYear()} Phoenix — {t('Ilmiy nashrlar markazi')}</span>
          <span className="flex flex-wrap gap-x-4 gap-y-2">
            <Link to="/login" className="editorial-link">{t('Kirish')}</Link>
            <Link to="/register" className="editorial-link">{t("Ro'yxatdan o'tish")}</Link>
            <Link to="/oferta" className="editorial-link">Ommaviy oferta</Link>
            <Link to="/maxfiylik" className="editorial-link">Maxfiylik siyosati</Link>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
