import React, { useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { Printer, Download, FileText, X, Link as LinkIcon, ArrowLeft } from 'lucide-react';
import AntiplagiatCertificate from './AntiplagiatCertificate';
import PlagiarismFullReport from './PlagiarismFullReport';
import PlagiarismShortReport from './PlagiarismShortReport';
import type { AntiplagiatCertificateData } from './AntiplagiatCertificate';
import type { PlagiarismFullReportData } from './PlagiarismFullReport';

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
  const [showFullReport, setShowFullReport] = useState(false);
  const [showShortReport, setShowShortReport] = useState(false);

  const handlePrint = () => {
    window.print();
  };

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
          <h2 className="text-xl font-bold text-slate-900 mb-1">Antiplagiat tekshiruvi natijasi</h2>
          <p className="text-sm text-slate-500 mb-4">
            Hujjat: <strong>{certificateData.fileName}</strong> · Sertifikat № {certificateData.certificateNumber} ·{' '}
            {certificateData.checkDate}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
            <ScoreBar label="Originallik" value={originalityPercent} color="#16a34a" />
            <ScoreBar label="Iqtibos keltirishlar" value={result.citations} color="#2563eb" />
            <ScoreBar label="O'z-o'zidan iqtibos keltirishlar" value={result.selfCitation} color="#ca8a04" />
            <ScoreBar label="O'zlashtirib olishlar" value={result.plagiarism} color="#dc2626" />
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
            Tekshiruv matnli kesishmalarni, iboralarni almashtirish va parafraz qilish holatlarini ham hisobga oladi.
            Ko&apos;rsatkichlar jami 100% ni tashkil qiladi. Haqiqiy manbalar: platforma korpusi,
            OpenAlex, Crossref va (sozlangan bo&apos;lsa) Semantic Scholar / CORE — simulyatsiyasiz overlap.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-600">SI matn</p>
              <p className="text-xl font-bold text-violet-700">{result.aiContent.toFixed(2)}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center col-span-2 md:col-span-1">
              <p className="text-xs font-semibold text-slate-600">Manbalar</p>
              <p className="text-xl font-bold text-slate-800">{result.sources.length} ta</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div><dt className="text-slate-500 inline">Muallif: </dt><dd className="inline font-medium">{certificateData.author}</dd></div>
            <div><dt className="text-slate-500 inline">Ish turi: </dt><dd className="inline font-medium">{certificateData.workType}</dd></div>
            <div><dt className="text-slate-500 inline">Modullar: </dt><dd className="inline font-medium">{certificateData.searchModules}</dd></div>
            <div><dt className="text-slate-500 inline">Manbalar: </dt><dd className="inline font-medium">{result.sources.length} ta</dd></div>
          </dl>
        </div>

        <div className="flex flex-wrap gap-2 no-print">
          <Button onClick={() => setShowShortReport(true)} variant="secondary">
            <FileText className="mr-2 h-4 w-4" />
            Qisqacha hisobot
          </Button>
          <Button onClick={() => setShowFullReport(true)}>
            <FileText className="mr-2 h-4 w-4" />
            To&apos;liq hisobot
          </Button>
          <Button onClick={handlePrint} variant="secondary">
            <Download className="mr-2 h-4 w-4" />
            PDF yuklab olish
          </Button>
          <Button onClick={handlePrint} variant="secondary">
            <Printer className="mr-2 h-4 w-4" />
            Chop etish
          </Button>
        </div>

        <Card title="Topilgan manbalar (namuna)" className="no-print max-h-96 overflow-hidden flex flex-col">
          <div className="overflow-y-auto max-h-72 space-y-3 pr-1">
            {result.sources.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Aniq manba topilmadi.</p>
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
              <p className="text-xs text-slate-500 text-center">+ yana {result.sources.length - 30} ta manba to&apos;liq hisobotda</p>
            )}
          </div>
        </Card>

        <div id="certificate-print-area">
          <h3 className="text-lg font-bold text-slate-900 mb-3">Tekshiruv sertifikati</h3>
          <AntiplagiatCertificate data={certificateData} />
        </div>
      </div>

      {showShortReport && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col print:bg-white">
          <div className="flex justify-between items-center p-4 bg-white/55 border-b border-slate-200/90 no-print">
            <h3 className="text-xl font-bold text-slate-900">Qisqacha antiplagiat hisoboti</h3>
            <div className="flex gap-3">
              <Button onClick={() => window.print()} variant="primary">
                <Printer className="mr-2 h-4 w-4" />
                Chop etish / PDF
              </Button>
              <Button onClick={() => setShowShortReport(false)} variant="secondary">
                <X className="mr-2 h-4 w-4" />
                Yopish
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6 print:p-0 print:overflow-visible">
            <PlagiarismShortReport data={fullReportData} />
          </div>
        </div>
      )}

      {showFullReport && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col print:bg-white">
          <div className="flex justify-between items-center p-4 bg-white/55 border-b border-slate-200/90 no-print">
            <h3 className="text-xl font-bold text-slate-900">To&apos;liq antiplagiat hisoboti</h3>
            <div className="flex gap-3">
              <Button onClick={() => window.print()} variant="primary">
                <Printer className="mr-2 h-4 w-4" />
                Chop etish / PDF
              </Button>
              <Button onClick={() => setShowFullReport(false)} variant="secondary">
                <X className="mr-2 h-4 w-4" />
                Yopish
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6 print:p-0 print:overflow-visible">
            <PlagiarismFullReport data={fullReportData} />
          </div>
        </div>
      )}
    </>
  );
};

export default AntiplagiatResultView;
