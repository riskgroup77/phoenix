import React from 'react';
import { useT } from '../i18n/LanguageContext';
import FlowPages from './ReportFlow';
import {
    type PlagiarismFullReportData,
    ReportCoverSheet,
    buildSourcesSection,
    useInnerPageRenderer,
} from './PlagiarismFullReport';
import './antiplagReport.css';

/** Antiplag.uz qisqacha hisobot: muqova + asosiy ko'rsatkichlar + manbalar jadvali (jami 7 sahifagacha). */
const MAX_PAGES = 7;

const PlagiarismShortReport: React.FC<{ data: PlagiarismFullReportData; id?: string }> = ({
    data,
    id = 'plagiarism-short-report',
}) => {
    const { t, lang } = useT();
    const renderPage = useInnerPageRenderer(data.documentNumber);
    const sections = [
        buildSourcesSection(data, 'Qisqacha hisobot — hujjat tekshirish natijalari', data.sources, (hidden) => (
            <p className="ap-note">{t("+ yana {value} ta manba to'liq hisobotda", { value: hidden })}</p>
        )),
    ];

    return (
        <div className="ap-report ap-report-pages" id={id} data-paper>
            <ReportCoverSheet data={data} />
            {/* Muqova 1-sahifa — qolgan sahifalar MAX_PAGES - 1 */}
            <FlowPages sections={sections} renderPage={renderPage} maxPages={MAX_PAGES - 1} layoutKey={lang} />
        </div>
    );
};

export default PlagiarismShortReport;
export type { PlagiarismFullReportData };
