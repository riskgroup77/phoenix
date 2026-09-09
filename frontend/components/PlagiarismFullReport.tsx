import React from 'react';
import {
    LaurelQRBlock,
    PhoenixLogoMark,
    ReportCoverFrame,
    ReportInnerFrame,
    REPORT_COLOR_DARK,
    REPORT_COLOR_NAVY,
    REPORT_COLOR_TEAL,
    REPORT_COLOR_TEXT,
} from './ReportPageLayout';

export interface PlagiarismSource {
    id: number;
    percentage: string;
    sourceName: string;
    sourceUrl?: string;
    searchModule: string;
    documentFragment?: string;
    sourceFragment?: string;
}

export interface PlagiarismFragmentDetail {
    sourceIndex: number;
    title: string;
    sourceUrl?: string;
    documentFragment: string;
    sourceFragment: string;
    percentage: string;
    searchModule: string;
}

export interface AnnotatedParagraph {
    text: string;
    sourceRefs: number[];
}

export interface PlagiarismFullReportData {
    checkerName: string;
    checkerId: string;
    checkerOrganization?: string;
    documentNumber: string;
    uploadDate: string;
    originalFileName: string;
    documentName: string;
    documentType: string;
    characterCount: number;
    sentenceCount: number;
    fileSize: string;
    plagiarismPercent: number;
    selfCitationPercent: number;
    citationPercent: number;
    originalityPercent: number;
    searchModules: string[];
    sources: PlagiarismSource[];
    fragmentDetails?: PlagiarismFragmentDetail[];
    annotatedDocument?: AnnotatedParagraph[];
}

const MetricBox: React.FC<{ value: number; label: string; color: string; bg: string }> = ({ value, label, color, bg }) => (
    <div className="rounded-md p-2.5 text-center border flex-1 min-w-0" style={{ backgroundColor: bg, borderColor: `${color}44` }}>
        <p className="text-xl sm:text-2xl font-bold leading-none" style={{ color }}>{value.toFixed(2)}%</p>
        <p className="text-[8px] font-bold uppercase tracking-wide mt-1.5 leading-tight" style={{ color: REPORT_COLOR_DARK }}>{label}</p>
    </div>
);

const InfoRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="flex gap-2 text-[10px] leading-snug py-0.5">
        <span className="text-slate-500 shrink-0">{label}:</span>
        <span className="font-medium break-words" style={{ color: REPORT_COLOR_TEXT }}>{value}</span>
    </div>
);

const LEGEND = [
    {
        title: "O'zlashtirib olish",
        color: '#dc2626',
        text: "topilgan barcha matnli kesishmalar ulushi, tizim hujjatning umumiy hajmiga nisbatan iqtibos keltirishga kiritganlaridan tashqari.",
    },
    {
        title: "O'z-o'zidan iqtibos keltirishlar",
        color: '#ca8a04',
        text: "tekshirilayotgan hujjatdagi muallifi yoki hammuallifi tekshirilayotgan hujjatning muallifi bo'lgan manba matni fragmenti bilan mos tushuvchi yoki deyarli mos tushuvchi matn fragmentlarining hujjatning umumiy hajmiga nisbatan ulushi.",
    },
    {
        title: 'Iqtibos keltirish',
        color: '#2563eb',
        text: "muallifniki bo'lmagan, biroq tizim ulardan foydalanishni to'g'ri deb hisoblagan matnli kesishmalarning hujjatning umumiy hajmiga nisbatan ulushi.",
    },
    {
        title: 'Originallik',
        color: '#16a34a',
        text: "tekshirilayotgan hujjat matnidagi tekshiruv borgan birorta ham manbada topilmagan fragmentlarning hujjatning umumiy hajmiga nisbatan ulushi.",
    },
];

const SourceRefBadges: React.FC<{ refs: number[] }> = ({ refs }) => {
    if (!refs.length) return null;
    return (
        <span className="inline-flex flex-wrap gap-0.5 ml-1 align-super">
            {refs.map((r) => (
                <span
                    key={r}
                    className="inline-block text-[7px] font-bold px-1 py-px rounded-sm leading-none"
                    style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
                >
                    {r}
                </span>
            ))}
        </span>
    );
};

const SourcesTable: React.FC<{ sources: PlagiarismSource[]; compact?: boolean }> = ({ sources, compact }) => (
    <table className="w-full text-[9px] border-collapse">
        <thead>
            <tr style={{ backgroundColor: REPORT_COLOR_TEAL, color: '#fff' }}>
                <th className="border border-teal-700 px-1 py-1 w-10 text-center">№</th>
                <th className="border border-teal-700 px-1 py-1 w-14 text-center">Ulushi</th>
                <th className="border border-teal-700 px-1 py-1 text-left">Manba</th>
                <th className="border border-teal-700 px-1 py-1 w-[30%] text-left">Qidirish moduli</th>
            </tr>
        </thead>
        <tbody>
            {sources.length === 0 ? (
                <tr>
                    <td colSpan={4} className="border border-slate-200 px-3 py-4 text-center text-slate-500">
                        Manbalar topilmadi
                    </td>
                </tr>
            ) : (
                sources.map((source) => {
                    const pct = parseFloat(source.percentage) || 0;
                    return (
                        <tr key={source.id} className="align-top">
                            <td className="border border-slate-200 px-1 py-0.5 text-center font-bold" style={{ color: REPORT_COLOR_TEAL }}>
                                [{String(source.id).padStart(2, '0')}]
                            </td>
                            <td
                                className="border border-slate-200 px-1 py-0.5 text-center font-semibold"
                                style={{ color: pct > 5 ? '#dc2626' : pct > 0 ? '#ca8a04' : '#64748b' }}
                            >
                                {source.percentage}
                            </td>
                            <td className="border border-slate-200 px-1 py-0.5">
                                <div className="font-medium break-words leading-snug" style={{ color: REPORT_COLOR_TEXT }}>
                                    {source.sourceName}
                                </div>
                                {source.sourceUrl && (
                                    <a
                                        href={source.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[7.5px] break-all hover:underline mt-0.5 block"
                                        style={{ color: REPORT_COLOR_TEAL }}
                                    >
                                        {source.sourceUrl}
                                    </a>
                                )}
                            </td>
                            <td className="border border-slate-200 px-1 py-0.5 text-slate-600 leading-snug">
                                {source.searchModule}
                            </td>
                        </tr>
                    );
                })
            )}
        </tbody>
    </table>
);

const CoverPage: React.FC<{ data: PlagiarismFullReportData; coverSources: PlagiarismSource[] }> = ({ data, coverSources }) => (
    <ReportCoverFrame>
        <div className="flex justify-between items-start gap-4 mb-3 text-[10px] shrink-0">
            <PhoenixLogoMark size="sm" showText={false} />
            <div className="text-right flex-1">
                <p className="font-bold uppercase tracking-wide text-[9px]" style={{ color: REPORT_COLOR_NAVY }}>
                    Hisobot &quot;Phoenix Antiplagiat&quot; servisi tomonidan taqdim etilgan
                </p>
                <p className="text-[10px] mt-1" style={{ color: REPORT_COLOR_TEXT }}>
                    Tekshiruvchi: <strong>{data.checkerName}</strong> (ID: {data.checkerId})
                </p>
                {data.checkerOrganization && (
                    <p className="text-[10px] text-slate-500">Tashkilot: {data.checkerOrganization}</p>
                )}
            </div>
        </div>

        <div className="text-center mb-3 shrink-0">
            <h1
                className="text-lg sm:text-xl font-bold uppercase tracking-wide"
                style={{ color: REPORT_COLOR_NAVY, fontFamily: 'Georgia, serif' }}
            >
                Hujjat tekshirish natijalari
            </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 shrink-0">
            <div className="rounded-lg border border-slate-200 p-2.5 bg-white/90">
                <h3
                    className="text-[9px] font-bold uppercase tracking-wider mb-1.5 pb-1 border-b"
                    style={{ color: REPORT_COLOR_TEAL, borderColor: '#e2e8f0' }}
                >
                    Hujjat to&apos;g&apos;risidagi ma&apos;lumotlar
                </h3>
                <InfoRow label="Hujjat raqami" value={data.documentNumber} />
                <InfoRow label="Yuklangan vaqti" value={data.uploadDate} />
                <InfoRow label="Dastlabki fayl nomi" value={data.originalFileName} />
                <InfoRow label="Hujjat nomi" value={data.documentName} />
                <InfoRow label="Hujjat turi" value={data.documentType} />
                <InfoRow label="Matndagi belgilar" value={data.characterCount.toLocaleString('uz-UZ')} />
                <InfoRow label="Gaplar soni" value={data.sentenceCount.toLocaleString('uz-UZ')} />
                <InfoRow label="Matn o&apos;lchami" value={data.fileSize} />
            </div>

            <div className="rounded-lg border border-slate-200 p-2.5 bg-white/90">
                <h3
                    className="text-[9px] font-bold uppercase tracking-wider mb-1.5 pb-1 border-b"
                    style={{ color: REPORT_COLOR_TEAL, borderColor: '#e2e8f0' }}
                >
                    Hisobot to&apos;g&apos;risidagi ma&apos;lumotlar
                </h3>
                <p className="text-[8px] text-slate-500 mb-1.5">Qidirish oralig&apos;i: ko&apos;rsatilmagan</p>
                <div className="flex gap-1.5 mb-2">
                    <MetricBox value={data.plagiarismPercent} label="O'zlashtirib olishlar" color="#dc2626" bg="#fef2f2" />
                    <MetricBox value={data.selfCitationPercent} label="O'z-o'zidan iqtibos" color="#ca8a04" bg="#fefce8" />
                    <MetricBox value={data.citationPercent} label="Iqtibos keltirishlar" color="#2563eb" bg="#eff6ff" />
                    <MetricBox value={data.originalityPercent} label="Originallik" color="#16a34a" bg="#f0fdf4" />
                </div>
                <p className="text-[7.5px] leading-relaxed text-slate-600 line-clamp-4">
                    {data.searchModules.length
                        ? data.searchModules.map((m) => `${m} qidiruv moduli`).join(', ')
                        : "Modullar ko'rsatilmagan"}
                </p>
            </div>
        </div>

        <div className="rounded-lg border p-2 mb-2 text-[7px] leading-relaxed text-slate-600 bg-slate-50/90 shrink-0" style={{ borderColor: '#99f6e4' }}>
            {LEGEND.map((item) => (
                <p key={item.title} className="mb-1">
                    <strong style={{ color: item.color }}>{item.title}</strong> — {item.text}
                </p>
            ))}
        </div>

        {coverSources.length > 0 && (
            <div className="flex-1 min-h-0 overflow-hidden mt-2">
                <SourcesTable sources={coverSources} compact />
            </div>
        )}

        <div className="mt-2 flex items-end justify-between gap-4 shrink-0">
            <LaurelQRBlock
                qrUrl={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`https://ilmiyfaoliyat.uz/verify/${data.documentNumber}`)}&bgcolor=ffffff`}
                label="HUJJATNI TEKSHIRISH UCHUN QR KODDAN FOYDALANING"
            />
            <PhoenixLogoMark size="sm" />
        </div>
    </ReportCoverFrame>
);

const SourcesPage: React.FC<{
    data: PlagiarismFullReportData;
    pageNum: number;
    startIdx: number;
    endIdx: number;
}> = ({ data, pageNum, startIdx, endIdx }) => {
    const pageSources = data.sources.slice(startIdx, endIdx);

    return (
        <ReportInnerFrame pageNum={pageNum}>
            <h2 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: REPORT_COLOR_NAVY, fontFamily: 'Georgia, serif' }}>
                Manbalar ro&apos;yxati
            </h2>
            <p className="text-[9px] text-slate-500 mb-2">
                Hujjat: {data.documentNumber} · {data.uploadDate}
            </p>
            <div className="flex-1 overflow-hidden min-h-0">
                <SourcesTable sources={pageSources} />
            </div>
        </ReportInnerFrame>
    );
};

const FragmentDetailPage: React.FC<{
    fragment: PlagiarismFragmentDetail;
    pageNum: number;
}> = ({ fragment, pageNum }) => (
    <ReportInnerFrame pageNum={pageNum}>
        <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: REPORT_COLOR_NAVY, fontFamily: 'Georgia, serif' }}>
                Matnli kesishma — [{String(fragment.sourceIndex).padStart(2, '0')}]
            </h2>
            <span className="text-sm font-bold shrink-0" style={{ color: '#dc2626' }}>{fragment.percentage}</span>
        </div>

        <div className="rounded border border-slate-200 p-2 mb-2 bg-white">
            <p className="text-[8px] font-bold uppercase mb-1" style={{ color: REPORT_COLOR_TEAL }}>Manba</p>
            <p className="text-[9px] font-semibold break-words" style={{ color: REPORT_COLOR_TEXT }}>{fragment.title}</p>
            {fragment.sourceUrl && (
                <a href={fragment.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[8px] break-all mt-0.5 block" style={{ color: REPORT_COLOR_TEAL }}>
                    {fragment.sourceUrl}
                </a>
            )}
            <p className="text-[8px] text-slate-500 mt-1">{fragment.searchModule}</p>
        </div>

        <div className="grid grid-cols-1 gap-2 flex-1 min-h-0">
            <div className="rounded border p-2" style={{ borderColor: '#fecaca', backgroundColor: '#fffbfb' }}>
                <p className="text-[8px] font-bold uppercase mb-1" style={{ color: '#b91c1c' }}>
                    Tekshirilayotgan hujjat matni
                </p>
                <p className="text-[9px] leading-relaxed" style={{ color: REPORT_COLOR_TEXT }}>{fragment.documentFragment}</p>
            </div>
            <div className="rounded border p-2" style={{ borderColor: '#bfdbfe', backgroundColor: '#f8fbff' }}>
                <p className="text-[8px] font-bold uppercase mb-1" style={{ color: '#1d4ed8' }}>
                    Manba matni
                </p>
                <p className="text-[9px] leading-relaxed" style={{ color: REPORT_COLOR_TEXT }}>{fragment.sourceFragment}</p>
            </div>
        </div>
    </ReportInnerFrame>
);

const DocumentTextPage: React.FC<{
    paragraphs: AnnotatedParagraph[];
    pageNum: number;
    documentName: string;
}> = ({ paragraphs, pageNum, documentName }) => (
    <ReportInnerFrame pageNum={pageNum}>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: REPORT_COLOR_NAVY, fontFamily: 'Georgia, serif' }}>
            Tekshirilayotgan hujjat matni
        </h2>
        <p className="text-[9px] text-slate-500 mb-3">{documentName}</p>
        <p className="text-[8px] text-slate-500 mb-2 italic">
            Qizil raqamlar mos manba indeksini ko&apos;rsatadi (manbalar jadvalidagi [01], [02], …).
        </p>
        <div className="flex-1 min-h-0 space-y-2 overflow-hidden">
            {paragraphs.map((para, idx) => (
                <p key={idx} className="text-[9px] leading-relaxed text-justify" style={{ color: REPORT_COLOR_TEXT }}>
                    {para.text}
                    <SourceRefBadges refs={para.sourceRefs} />
                </p>
            ))}
        </div>
    </ReportInnerFrame>
);

const PlagiarismFullReport: React.FC<{ data: PlagiarismFullReportData }> = ({ data }) => {
    const COVER_SOURCES = 10;
    const SOURCES_PER_PAGE = 14;
    const PARAGRAPHS_PER_PAGE = 8;

    const coverSources = data.sources.slice(0, COVER_SOURCES);
    const remainingSources = data.sources.slice(COVER_SOURCES);
    const totalSourcePages = Math.max(0, Math.ceil(remainingSources.length / SOURCES_PER_PAGE));

    const fragments: PlagiarismFragmentDetail[] =
        data.fragmentDetails && data.fragmentDetails.length > 0
            ? data.fragmentDetails
            : data.sources
                  .filter((s) => parseFloat(s.percentage) > 0 && (s.documentFragment || s.sourceFragment))
                  .slice(0, 40)
                  .map((s) => ({
                      sourceIndex: s.id,
                      title: s.sourceName,
                      sourceUrl: s.sourceUrl,
                      documentFragment: s.documentFragment || '',
                      sourceFragment: s.sourceFragment || '',
                      percentage: s.percentage,
                      searchModule: s.searchModule,
                  }));

    const annotated = data.annotatedDocument || [];
    const totalDocPages = Math.ceil(annotated.length / PARAGRAPHS_PER_PAGE);

    const sourcePageStart = 2;
    const fragmentPageStart = sourcePageStart + totalSourcePages;
    const documentPageStart = fragmentPageStart + fragments.length;

    return (
        <div className="space-y-6" id="plagiarism-full-report">
            <div className="shadow-xl print:shadow-none">
                <CoverPage data={data} coverSources={coverSources} />
            </div>

            {Array.from({ length: totalSourcePages }).map((_, pageIndex) => {
                const startIdx = pageIndex * SOURCES_PER_PAGE;
                return (
                    <div key={`src-${pageIndex}`} className="shadow-xl print:shadow-none page-break-before">
                        <SourcesPage
                            data={{
                                ...data,
                                sources: remainingSources.slice(startIdx, startIdx + SOURCES_PER_PAGE),
                            }}
                            pageNum={sourcePageStart + pageIndex}
                            startIdx={0}
                            endIdx={SOURCES_PER_PAGE}
                        />
                    </div>
                );
            })}

            {fragments.map((frag, pageIndex) => (
                <div key={`frag-${frag.sourceIndex}`} className="shadow-xl print:shadow-none page-break-before">
                    <FragmentDetailPage fragment={frag} pageNum={fragmentPageStart + pageIndex} />
                </div>
            ))}

            {Array.from({ length: totalDocPages }).map((_, pageIndex) => {
                const chunk = annotated.slice(
                    pageIndex * PARAGRAPHS_PER_PAGE,
                    (pageIndex + 1) * PARAGRAPHS_PER_PAGE,
                );
                return (
                    <div key={`doc-${pageIndex}`} className="shadow-xl print:shadow-none page-break-before">
                        <DocumentTextPage
                            paragraphs={chunk}
                            pageNum={documentPageStart + pageIndex}
                            documentName={data.documentName}
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default PlagiarismFullReport;
