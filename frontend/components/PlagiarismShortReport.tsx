import React from 'react';
import {
    ReportInnerFrame,
    REPORT_COLOR_NAVY,
} from './ReportPageLayout';
import {
    type PlagiarismFullReportData,
    PlagiarismReportCoverPage,
    SourcesTable,
} from './PlagiarismFullReport';

/** Antiplag.uz qisqacha hisobot: asosiy ko'rsatkichlar + barcha manbalar jadvali (7 sahifagacha). */
const SOURCES_FIRST_PAGE = 10;
const SOURCES_PER_PAGE = 28;
const MAX_PAGES = 7;

const ShortSourcesPage: React.FC<{
    data: PlagiarismFullReportData;
    pageNum: number;
    sources: PlagiarismFullReportData['sources'];
}> = ({ data, pageNum, sources }) => (
    <ReportInnerFrame pageNum={pageNum}>
        <h2
            className="text-sm font-bold uppercase tracking-wide mb-2"
            style={{ color: REPORT_COLOR_NAVY, fontFamily: 'Georgia, serif' }}
        >
            Topilgan manbalar
        </h2>
        <p className="text-[9px] text-slate-500 mb-2">
            Hujjat: {data.documentNumber} · {data.uploadDate}
        </p>
        <div className="flex-1 overflow-hidden min-h-0">
            <SourcesTable sources={sources} compact />
        </div>
    </ReportInnerFrame>
);

const PlagiarismShortReport: React.FC<{ data: PlagiarismFullReportData }> = ({ data }) => {
    const coverSources = data.sources.slice(0, SOURCES_FIRST_PAGE);
    const remaining = data.sources.slice(SOURCES_FIRST_PAGE);
    const maxRemainingSlots = (MAX_PAGES - 1) * SOURCES_PER_PAGE;
    const tableSources = remaining.slice(0, maxRemainingSlots);
    const totalExtraPages = Math.min(MAX_PAGES - 1, Math.ceil(tableSources.length / SOURCES_PER_PAGE));

    return (
        <div className="space-y-6" id="plagiarism-short-report">
            <div className="shadow-xl print:shadow-none">
                <PlagiarismReportCoverPage
                    data={data}
                    coverSources={coverSources}
                    title="Qisqacha hisobot — hujjat tekshirish natijalari"
                />
            </div>

            {Array.from({ length: totalExtraPages }).map((_, pageIndex) => {
                const chunk = tableSources.slice(
                    pageIndex * SOURCES_PER_PAGE,
                    (pageIndex + 1) * SOURCES_PER_PAGE,
                );
                return (
                    <div key={`short-src-${pageIndex}`} className="shadow-xl print:shadow-none page-break-before">
                        <ShortSourcesPage data={data} pageNum={pageIndex + 2} sources={chunk} />
                    </div>
                );
            })}
        </div>
    );
};

export default PlagiarismShortReport;
export type { PlagiarismFullReportData };
