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
}

const MetricBox: React.FC<{ value: number; label: string; color: string; bg: string }> = ({ value, label, color, bg }) => (
    <div className="rounded-lg p-3 text-center border" style={{ backgroundColor: bg, borderColor: `${color}33` }}>
        <p className="text-2xl font-bold" style={{ color }}>{value.toFixed(2)}%</p>
        <p className="text-[9px] font-bold uppercase tracking-wide mt-1 leading-tight" style={{ color: REPORT_COLOR_DARK }}>{label}</p>
    </div>
);

const InfoRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="flex gap-2 text-[11px] leading-snug py-0.5">
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
        text: "tekshirilayotgan hujjatdagi muallifi yoki hammuallifi tekshirilayotgan hujjatning muallifi bo'lgan manba matni fragmenti bilan mos tushuvchi matn fragmentlarining ulushi.",
    },
    {
        title: 'Iqtibos keltirish',
        color: '#2563eb',
        text: "muallifniki bo'lmagan, biroq tizim ulardan foydalanishni to'g'ri deb hisoblagan matnli kesishmalarning ulushi.",
    },
    {
        title: 'Originallik',
        color: '#16a34a',
        text: "tekshirilayotgan hujjat matnidagi tekshiruv borgan birorta ham manbada topilmagan fragmentlarning ulushi.",
    },
];

const CoverPage: React.FC<{ data: PlagiarismFullReportData }> = ({ data }) => (
    <ReportCoverFrame>
        <div className="flex justify-between gap-6 mb-4 text-[11px]">
            <div>
                <p className="font-bold uppercase tracking-wide" style={{ color: REPORT_COLOR_NAVY }}>Hujjat yaratilgan sana</p>
                <p className="font-medium mt-0.5">{data.uploadDate.split(',')[0] || data.uploadDate}</p>
            </div>
            <div className="text-right">
                <p className="font-bold uppercase tracking-wide" style={{ color: REPORT_COLOR_NAVY }}>Hujjat raqami</p>
                <p className="font-medium mt-0.5">{data.documentNumber}</p>
            </div>
        </div>

        <div className="text-center mb-5">
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide" style={{ color: REPORT_COLOR_NAVY, fontFamily: 'Georgia, serif' }}>
                Hujjat tekshirish natijalari
            </h1>
            <p className="text-xs mt-2" style={{ color: REPORT_COLOR_TEXT }}>
                Tekshiruvchi: <strong>{data.checkerName}</strong> (ID: {data.checkerId})
            </p>
            {data.checkerOrganization && (
                <p className="text-[11px] text-slate-500 mt-0.5">Tashkilot: {data.checkerOrganization}</p>
            )}
            <p className="text-[10px] italic text-slate-500 mt-1">
                Hisobot &quot;Phoenix Antiplagiat&quot; servisi tomonidan taqdim etilgan
            </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 flex-1 min-h-0">
            <div className="rounded-lg border border-slate-200 p-3 bg-white/80">
                <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2 pb-1 border-b" style={{ color: REPORT_COLOR_TEAL, borderColor: '#e2e8f0' }}>
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

            <div className="rounded-lg border border-slate-200 p-3 bg-white/80">
                <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2 pb-1 border-b" style={{ color: REPORT_COLOR_TEAL, borderColor: '#e2e8f0' }}>
                    Tekshiruv natijalari
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    <MetricBox value={data.plagiarismPercent} label="O'zlashtirib olishlar" color="#dc2626" bg="#fef2f2" />
                    <MetricBox value={data.originalityPercent} label="Originallik" color="#16a34a" bg="#f0fdf4" />
                    <MetricBox value={data.selfCitationPercent} label="O'z-o'zidan iqtibos" color="#ca8a04" bg="#fefce8" />
                    <MetricBox value={data.citationPercent} label="Iqtibos keltirishlar" color="#2563eb" bg="#eff6ff" />
                </div>
            </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3 bg-white/80 mb-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: REPORT_COLOR_TEAL }}>
                Hisobot to&apos;g&apos;risidagi ma&apos;lumotlar — qidirish modullari
            </h3>
            <p className="text-[9px] leading-relaxed text-slate-600">
                {data.searchModules.length
                    ? data.searchModules.map((m) => `${m} qidiruv moduli`).join(', ')
                    : 'Modullar ko\'rsatilmagan'}
            </p>
        </div>

        <div className="rounded-lg border p-3 text-[8px] leading-relaxed text-slate-600 bg-slate-50/90" style={{ borderColor: '#99f6e4' }}>
            {LEGEND.map((item) => (
                <p key={item.title} className="mb-1.5">
                    <strong style={{ color: item.color }}>{item.title}</strong> — {item.text}
                </p>
            ))}
            <p className="mt-2 italic text-[7.5px]">
                O&apos;zlashtirib olishlar, o&apos;z-o&apos;zidan iqtibos keltirishlar, iqtibos keltirishlar va originallik alohida ko&apos;rsatkichlar hisoblanadi.
                Tizim yordamchi vosita hisoblanadi; yakuniy xulosa tekshiruvchi vakolatida qoladi.
            </p>
        </div>

        <div className="mt-4 flex items-end justify-between gap-4 shrink-0">
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
            <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: REPORT_COLOR_NAVY, fontFamily: 'Georgia, serif' }}>
                Manbalar ro&apos;yxati
            </h2>
            <p className="text-[10px] text-slate-500 mb-3">
                Hujjat: {data.documentNumber} · {data.uploadDate}
            </p>

            <div className="flex-1 overflow-hidden min-h-0">
                <table className="w-full text-[9px] border-collapse">
                    <thead>
                        <tr style={{ backgroundColor: REPORT_COLOR_TEAL, color: '#fff' }}>
                            <th className="border border-teal-700 px-1.5 py-1.5 w-10 text-center">№</th>
                            <th className="border border-teal-700 px-1.5 py-1.5 w-14 text-center">Ulushi</th>
                            <th className="border border-teal-700 px-1.5 py-1.5 text-left">Manba</th>
                            <th className="border border-teal-700 px-1.5 py-1.5 w-[32%] text-left">Qidirish moduli</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageSources.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="border border-slate-200 px-3 py-6 text-center text-slate-500">
                                    Manbalar topilmadi
                                </td>
                            </tr>
                        ) : (
                            pageSources.map((source) => {
                                const pct = parseFloat(source.percentage) || 0;
                                return (
                                    <tr key={source.id} className="align-top">
                                        <td className="border border-slate-200 px-1.5 py-1 text-center font-bold" style={{ color: REPORT_COLOR_TEAL }}>
                                            [{String(source.id).padStart(2, '0')}]
                                        </td>
                                        <td className="border border-slate-200 px-1.5 py-1 text-center font-semibold" style={{ color: pct > 5 ? '#dc2626' : pct > 0 ? '#ca8a04' : '#64748b' }}>
                                            {source.percentage}
                                        </td>
                                        <td className="border border-slate-200 px-1.5 py-1">
                                            <div className="font-medium break-words" style={{ color: REPORT_COLOR_TEXT }}>
                                                {source.sourceName}
                                            </div>
                                            {source.sourceUrl && (
                                                <a
                                                    href={source.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[8px] break-all hover:underline mt-0.5 block"
                                                    style={{ color: REPORT_COLOR_TEAL }}
                                                >
                                                    {source.sourceUrl}
                                                </a>
                                            )}
                                        </td>
                                        <td className="border border-slate-200 px-1.5 py-1 text-slate-600 leading-snug">
                                            {source.searchModule}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </ReportInnerFrame>
    );
};

const PlagiarismFullReport: React.FC<{ data: PlagiarismFullReportData }> = ({ data }) => {
    const SOURCES_PER_PAGE = 14;
    const totalSourcePages = Math.max(1, Math.ceil(data.sources.length / SOURCES_PER_PAGE));

    return (
        <div className="space-y-6" id="plagiarism-full-report">
            <div className="shadow-xl print:shadow-none">
                <CoverPage data={data} />
            </div>

            {Array.from({ length: totalSourcePages }).map((_, pageIndex) => (
                <div key={pageIndex} className="shadow-xl print:shadow-none page-break-before">
                    <SourcesPage
                        data={data}
                        pageNum={pageIndex + 2}
                        startIdx={pageIndex * SOURCES_PER_PAGE}
                        endIdx={(pageIndex + 1) * SOURCES_PER_PAGE}
                    />
                </div>
            ))}
        </div>
    );
};

export default PlagiarismFullReport;
