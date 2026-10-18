import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Card from './ui/Card';
import Button from './ui/Button';
import { Printer, Download, FileText, X, Link as LinkIcon, ArrowLeft } from 'lucide-react';
import AntiplagiatCertificate from './AntiplagiatCertificate';
import PlagiarismFullReport from './PlagiarismFullReport';
import PlagiarismShortReport from './PlagiarismShortReport';
import AntiplagiatHighlightView from './AntiplagiatHighlightView';
import type { AntiplagiatCertificateData } from './AntiplagiatCertificate';
import type { PlagiarismFullReportData } from './PlagiarismFullReport';
import { ReportSheet } from './AntiplagReportInnerPage';
import { useT } from '../i18n/LanguageContext';
import './antiplagReport.css';

type PrintKind = 'full' | 'short' | 'certificate';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Chop etish / PDF uchun alohida ildiz (document.body ichida): ekranda ko'rinmaydi, chop etishda faqat u chiqadi.
 * Hisobot xuddi oynadagi komponent bilan chiziladi — PDF ekrandagi to'liq hisobot bilan bir xil.
 * `beforeprint`da body ga `ap-printing` klassi va @page (A4, chetlarsiz) qo'yiladi — Ctrl+P ham shu yo'l bilan ishlaydi.
 */
const ReportPrintRoot: React.FC<{
  kind: PrintKind;
  fullReportData: PlagiarismFullReportData;
  certificateData: AntiplagiatCertificateData;
  /** true — tayyor bo'lgach window.print() chaqiriladi */
  printNow: boolean;
  onPrinted: () => void;
}> = ({ kind, fullReportData, certificateData, printNow, onPrinted }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const landscape = kind === 'certificate';
  const onPrintedRef = useRef(onPrinted);
  onPrintedRef.current = onPrinted;

  useEffect(() => {
    let style: HTMLStyleElement | null = null;
    const before = () => {
      document.body.classList.add('ap-printing');
      style = document.createElement('style');
      style.setAttribute('data-ap-print', '');
      style.textContent = `@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }`;
      document.head.appendChild(style);
    };
    const after = () => {
      document.body.classList.remove('ap-printing');
      style?.remove();
      style = null;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      after();
    };
  }, [landscape]);

  useEffect(() => {
    if (!printNow) return;
    let cancelled = false;
    (async () => {
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
      if (fonts) await fonts.ready;
      await nextFrame();
      await nextFrame();
      const imgs = Array.from(rootRef.current?.querySelectorAll('img') ?? []);
      await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))));
      await nextFrame();
      if (cancelled) return;
      const done = () => {
        window.removeEventListener('afterprint', done);
        onPrintedRef.current();
      };
      window.addEventListener('afterprint', done);
      window.print();
    })();
    return () => {
      cancelled = true;
    };
  }, [printNow, kind]);

  return createPortal(
    <div id="ap-print-root" ref={rootRef} className={landscape ? 'ap-print-landscape' : undefined} aria-hidden="true">
      {kind === 'full' && <PlagiarismFullReport data={fullReportData} id="ap-print-report" />}
      {kind === 'short' && <PlagiarismShortReport data={fullReportData} id="ap-print-report" />}
      {kind === 'certificate' && (
        <div className="ap-report ap-report-pages" data-paper>
          <ReportSheet landscape>
            <div className="ap-cover">
              <AntiplagiatCertificate data={certificateData} />
            </div>
          </ReportSheet>
        </div>
      )}
    </div>,
    document.body,
  );
};

/** Hisobotni ko'rish oynasi — #root ichiga portal (sayt sarlavhasi ustida, tema o'zgaruvchilari saqlanadi). */
const ReportViewer: React.FC<{
  title: string;
  onPrint: () => void;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, onPrint, onClose, children }) => {
  const { t } = useT();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="ap-viewer no-print" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ap-viewer-bar">
        <h3>{title}</h3>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onPrint} variant="primary">
            <Printer className="mr-2 h-4 w-4" />
            {t('Chop etish / PDF')}
          </Button>
          <Button onClick={onClose} variant="secondary">
            <X className="mr-2 h-4 w-4" />
            {t('Yopish')}
          </Button>
        </div>
      </div>
      <div className="ap-viewer-body">{children}</div>
    </div>,
    document.getElementById('root') || document.body,
  );
};

const ScoreBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div>
    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
      <span>{label}</span>
      <span style={{ color }}>{value.toFixed(2)}%</span>
    </div>
    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

interface ResultSummary {
  plagiarism: number;
  aiContent: number;
  citations: number;
  selfCitation: number;
  sources: { source: string; similarity: number; snippet: string }[];
}

interface Props {
  result: ResultSummary;
  certificateData: AntiplagiatCertificateData;
  fullReportData: PlagiarismFullReportData;
  originalityPercent: number;
  onBack?: () => void;
  backLabel?: string;
}

const AntiplagiatResultView: React.FC<Props> = ({
  result,
  certificateData,
  fullReportData,
  originalityPercent,
  onBack,
  backLabel = "Arxiv hujjatlarga qaytish",
}) => {
  const { t } = useT();
  const [viewer, setViewer] = useState<'full' | 'short' | null>(null);
  /** Chop etish ildizi: oyna ochiq bo'lsa — o'sha hisobot; aks holda tugma bosilganda vaqtincha */
  const [printJob, setPrintJob] = useState<{ kind: PrintKind; printNow: boolean } | null>(null);

  const startPrint = useCallback((kind: PrintKind) => setPrintJob({ kind, printNow: true }), []);
  const closeViewer = useCallback(() => setViewer(null), []);
  const onPrinted = useCallback(
    () => setPrintJob((job) => (job && viewer ? { kind: viewer, printNow: false } : null)),
    [viewer],
  );

  useEffect(() => {
    // Oyna ochiq bo'lsa chop etish ildizi o'sha hisobotni tayyor tutadi (Ctrl+P ham to'g'ri chiqadi)
    setPrintJob((job) => (job?.printNow ? job : viewer ? { kind: viewer, printNow: false } : null));
  }, [viewer]);

  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {onBack && (
          <Button type="button" variant="secondary" onClick={onBack} className="no-print">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-1">{t('Antiplagiat tekshiruvi natijasi')}</h2>
          <p className="text-sm text-slate-500 mb-4">
            {t('Hujjat:')} <strong>{certificateData.fileName}</strong> {t('· Sertifikat №')} {certificateData.certificateNumber} ·{' '}
            {certificateData.checkDate}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
            <ScoreBar label={t('Originallik')} value={originalityPercent} color="#16a34a" />
            <ScoreBar label={t('Iqtibos keltirishlar')} value={result.citations} color="#2563eb" />
            <ScoreBar label={t("O'z-o'zidan iqtibos keltirishlar")} value={result.selfCitation} color="#ca8a04" />
            <ScoreBar label={t("O'zlashtirib olishlar")} value={result.plagiarism} color="#dc2626" />
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
            {t("Tekshiruv matnli kesishmalarni, iboralarni almashtirish va parafraz qilish holatlarini ham hisobga oladi. Ko'rsatkichlar jami 100% ni tashkil qiladi. Haqiqiy manbalar: platforma korpusi, OpenAlex, Crossref va (sozlangan bo'lsa) Semantic Scholar / CORE — simulyatsiyasiz overlap.")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-600">{t('SI matn')}</p>
              <p className="text-xl font-bold text-violet-700">{result.aiContent.toFixed(2)}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center col-span-2 md:col-span-1">
              <p className="text-xs font-semibold text-slate-600">{t('Manbalar')}</p>
              <p className="text-xl font-bold text-slate-800">{t('{length} ta', { length: result.sources.length })}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div><dt className="text-slate-500 inline">{t('Muallif:')} </dt><dd className="inline font-medium">{certificateData.author}</dd></div>
            <div><dt className="text-slate-500 inline">{t('Ish turi:')} </dt><dd className="inline font-medium">{certificateData.workType}</dd></div>
            <div><dt className="text-slate-500 inline">{t('Modullar:')} </dt><dd className="inline font-medium">{certificateData.searchModules}</dd></div>
            <div><dt className="text-slate-500 inline">{t('Manbalar:')} </dt><dd className="inline font-medium">{t('{length} ta', { length: result.sources.length })}</dd></div>
          </dl>
        </div>

        <div className="flex flex-wrap gap-2 no-print">
          <Button onClick={() => setViewer('short')} variant="secondary">
            <FileText className="mr-2 h-4 w-4" />
            {t('Qisqacha hisobot')}
          </Button>
          <Button onClick={() => setViewer('full')}>
            <FileText className="mr-2 h-4 w-4" />
            {t("To'liq hisobot")}
          </Button>
          <Button onClick={() => startPrint('full')} variant="secondary">
            <Download className="mr-2 h-4 w-4" />
            {t('PDF yuklab olish')}
          </Button>
          <Button onClick={() => startPrint('certificate')} variant="secondary">
            <Printer className="mr-2 h-4 w-4" />
            {t('Chop etish')}
          </Button>
        </div>

        {(fullReportData.annotatedDocument || []).length > 0 && (
          <div className="no-print">
            <AntiplagiatHighlightView
              paragraphs={fullReportData.annotatedDocument || []}
              sources={fullReportData.sources.map((s) => ({
                id: Number(s.id),
                sourceName: s.sourceName,
                sourceUrl: s.sourceUrl,
                percentage: s.percentage,
              }))}
            />
          </div>
        )}

        <Card title={t('Topilgan manbalar (namuna)')} className="no-print max-h-96 overflow-hidden flex flex-col">
          <div className="overflow-y-auto max-h-72 space-y-3 pr-1">
            {result.sources.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">{t('Aniq manba topilmadi.')}</p>
            ) : (
              result.sources.slice(0, 30).map((source, index) => (
                <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-mono text-xs text-slate-500">[{String(index + 1).padStart(2, '0')}]</span>
                    <span className="font-bold text-amber-800">{Number(source.similarity).toFixed(2)}%</span>
                  </div>
                  {source.source.startsWith('http') ? (
                    <a
                      href={source.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline break-all text-xs flex items-center gap-1 mt-1"
                    >
                      <LinkIcon size={12} />
                      {source.source.length > 80 ? `${source.source.slice(0, 77)}...` : source.source}
                    </a>
                  ) : null}
                  <p className="text-xs text-slate-600 mt-1 italic line-clamp-2">{source.snippet}</p>
                </div>
              ))
            )}
            {result.sources.length > 30 && (
              <p className="text-xs text-slate-500 text-center">{t("+ yana {value} ta manba to'liq hisobotda", { value: result.sources.length - 30 })}</p>
            )}
          </div>
        </Card>

        <div id="certificate-print-area">
          <h3 className="text-lg font-bold text-slate-900 mb-3">{t('Tekshiruv sertifikati')}</h3>
          <AntiplagiatCertificate data={certificateData} />
        </div>
      </div>

      {viewer && (
        <ReportViewer
          title={viewer === 'full' ? t("To'liq antiplagiat hisoboti") : t('Qisqacha antiplagiat hisoboti')}
          onPrint={() => startPrint(viewer)}
          onClose={closeViewer}
        >
          {viewer === 'full' ? (
            <PlagiarismFullReport data={fullReportData} />
          ) : (
            <PlagiarismShortReport data={fullReportData} />
          )}
        </ReportViewer>
      )}

      {printJob && (
        <ReportPrintRoot
          kind={printJob.kind}
          printNow={printJob.printNow}
          fullReportData={fullReportData}
          certificateData={certificateData}
          onPrinted={onPrinted}
        />
      )}
    </>
  );
};

export default AntiplagiatResultView;
