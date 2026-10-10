import React, { Suspense, useMemo } from 'react';
import { Link, Route, Routes, UNSAFE_RouteContext } from 'react-router-dom';
import { ArrowLeft, ExternalLink, PanelRightClose, Sparkles } from 'lucide-react';
import { useT } from '../../i18n/LanguageContext';
import { lazyPage } from '../../utils/lazyPage';
import { PageSkeleton } from '../ui/Skeleton';
import { AiEmbeddedContext, AiPrefill, AiPrefillContext } from '../../contexts/AiPrefillContext';
import { ErrorBoundary } from '../ErrorBoundary';
import { FIELD_LABELS, PanelTarget, formatSom } from './types';

// Panel ichidagi marshrutlar ota (/ai/:id) marshrutiga bog'lanmasin — ildiz kontekst bilan ishlaydi,
// shunda sahifalar o'z yo'llarini (/udk-olish, /articles/:id ...) va useParams ni odatdagidek ko'radi.
const ROOT_ROUTE_CONTEXT = { outlet: null, matches: [], isDataRoute: false } as React.ContextType<typeof UNSAFE_RouteContext>;

// Panelda ochiladigan sahifalar (marshrutlar App.tsx dagi bilan bir xil yo'llar)
const SubmitArticle = lazyPage(() => import('../../pages/SubmitArticle'));
const PlagiarismCheck = lazyPage(() => import('../../pages/PlagiarismCheck'));
const UdkOlish = lazyPage(() => import('../../pages/UdkOlish'));
const DoiOlish = lazyPage(() => import('../../pages/DoiOlish'));
const TranslationService = lazyPage(() => import('../../pages/TranslationService'));
const SubmitBook = lazyPage(() => import('../../pages/SubmitBook'));
const MaqolaNamunaOlish = lazyPage(() => import('../../pages/MaqolaNamunaOlish'));
const ArticleDetail = lazyPage(() => import('../../pages/ArticleDetail'));
const Articles = lazyPage(() => import('../../pages/Articles'));
const Payments = lazyPage(() => import('../../pages/Payments'));
const ArxivHujjatlar = lazyPage(() => import('../../pages/ArxivHujjatlar'));
const Profile = lazyPage(() => import('../../pages/Profile'));
const Services = lazyPage(() => import('../../pages/Services'));

type Props = {
  target: PanelTarget | null;
  file: File | null;
  onClose: () => void;
  /** Telefonda panel chat ustida to'liq ekran — «Chatga qaytish» tugmasi */
  mobile?: boolean;
};

const AiWorkspacePanel: React.FC<Props> = ({ target, file, onClose, mobile }) => {
  const { t } = useT();
  const prefill: AiPrefill | null = useMemo(
    () =>
      target?.action
        ? { intent: target.action.intent, fields: target.action.fields, file, nonce: target.nonce }
        : null,
    [target, file],
  );

  if (!target) {
    return (
      <div className="hidden h-full flex-col items-center justify-center gap-3 p-10 text-center lg:flex">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--editorial-bg)] text-[var(--editorial-teal,#0b6f74)]">
          <Sparkles className="h-6 w-6" aria-hidden />
        </div>
        <h2 className="text-lg font-bold text-[var(--editorial-text)]">{t('Ish maydoni')}</h2>
        <p className="max-w-sm text-sm leading-relaxed text-[var(--editorial-muted)]">
          {t("Chatda xizmat so'rasangiz, shu yerda uning formasi tayyor holda ochiladi: tekshirasiz, kerak bo'lsa tuzatasiz va o'zingiz tasdiqlaysiz.")}
        </p>
      </div>
    );
  }

  const action = target.action;
  const [pathname, search = ''] = target.path.split('?');
  const location = { pathname, search: search ? `?${search}` : '', hash: '', state: null, key: `ai-${target.nonce}` };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--editorial-border)] bg-[var(--editorial-bg)] px-3 py-2.5 sm:px-4">
        {mobile ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[var(--editorial-primary)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> {t('Chatga qaytish')}
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-[var(--editorial-text)]">{t(target.label)}</div>
          {action && (
            <div className="truncate text-xs text-[var(--editorial-muted)]">
              {action.filled.length > 0
                ? t("AI to'ldirdi: {fields}", {
                    fields: action.filled.slice(0, 4).map((k) => t(FIELD_LABELS[k] || k)).join(', ') + (action.filled.length > 4 ? '…' : ''),
                  })
                : t("Maydonlarni to'ldiring")}
              {action.quote?.amount ? ` · ${formatSom(action.quote.amount)} ${t("so'm")}` : ''}
            </div>
          )}
        </div>
        <Link
          to={target.path}
          className="hidden h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-[var(--editorial-muted)] hover:bg-[var(--editorial-bg-alt)] sm:inline-flex"
          title={t("To'liq sahifada ochish")}
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          <span className="hidden xl:inline">{t("To'liq sahifa")}</span>
        </Link>
        {!mobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Panelni yopish')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--editorial-muted)] hover:bg-[var(--editorial-bg-alt)]"
          >
            <PanelRightClose className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>

      {action?.missing?.includes('file') && !file && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
          {t("Fayl biriktirilmagan — formada faylni tanlang yoki chatga yuboring.")}
        </div>
      )}

      <div className="ai-embedded-page min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <AiEmbeddedContext.Provider value>
          <AiPrefillContext.Provider value={prefill}>
            <ErrorBoundary key={target.nonce}>
              <Suspense fallback={<div className="p-6"><PageSkeleton /></div>}>
                <UNSAFE_RouteContext.Provider value={ROOT_ROUTE_CONTEXT}>
                <Routes location={location}>
                  <Route path="/submit" element={<SubmitArticle />} />
                  <Route path="/plagiarism-check" element={<PlagiarismCheck />} />
                  <Route path="/udk-olish" element={<UdkOlish />} />
                  <Route path="/doi-olish" element={<DoiOlish />} />
                  <Route path="/translation-service" element={<TranslationService />} />
                  <Route path="/submit-book" element={<SubmitBook />} />
                  <Route path="/maqola-namuna-olish" element={<MaqolaNamunaOlish />} />
                  <Route path="/articles/:id" element={<ArticleDetail />} />
                  <Route path="/articles" element={<Articles />} />
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/arxiv" element={<ArxivHujjatlar />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/services" element={<Services />} />
                  <Route path="*" element={<div className="p-6 text-sm text-[var(--editorial-muted)]">{t("Bu sahifani panelda ochib bo'lmaydi.")}</div>} />
                </Routes>
                </UNSAFE_RouteContext.Provider>
              </Suspense>
            </ErrorBoundary>
          </AiPrefillContext.Provider>
        </AiEmbeddedContext.Provider>
      </div>
    </div>
  );
};

export default AiWorkspacePanel;
