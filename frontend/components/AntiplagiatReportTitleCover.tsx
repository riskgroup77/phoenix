import React from 'react';
import AntiplagJpgPage from './AntiplagTemplateOverlay';
import { REPORT_COVER_TEMPLATE } from '../constants/antiplagTemplateLayout';
import type { PlagiarismFullReportData } from './PlagiarismFullReport';
import { verifyUrl } from '../utils/verifyLink';

/** Antiplagiat hisobot — 1-sahifa (hisobot1.jpg shablon). */
export const AntiplagiatReportTitleCover: React.FC<{ data: PlagiarismFullReportData }> = ({ data }) => {

    const values: Record<string, string> = {
        upload_date: data.uploadDate,
        document_number: data.documentNumber,
        author: data.checkerName,
        workplace: data.checkerOrganization?.trim() || '—',
        position: data.authorPosition?.trim() || '—',
    };

    return (
        <AntiplagJpgPage
            imageUrl={REPORT_COVER_TEMPLATE.image}
            baseWidth={REPORT_COVER_TEMPLATE.width}
            aspectRatio={REPORT_COVER_TEMPLATE.aspect}
            fields={REPORT_COVER_TEMPLATE.fields}
            values={values}
            qrValue={verifyUrl(data.documentNumber)}
            qrSpec={REPORT_COVER_TEMPLATE.qr}
        />
    );
};

export default AntiplagiatReportTitleCover;
