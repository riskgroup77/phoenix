import React from 'react';
import AntiplagJpgPage from './AntiplagTemplateOverlay';
import { ANTIPLAG_TEMPLATE_BASE, CERTIFICATE_TEMPLATE } from '../constants/antiplagTemplateLayout';
import { verifyUrl } from '../utils/verifyLink';
import { localizedTemplateUrl } from '../constants/localizedTemplate';
import { useT } from '../i18n/LanguageContext';

export interface AntiplagiatCertificateData {
    certificateNumber: string;
    checkDate: string;
    author: string;
    /** Muallif va hammualliflar; 2 va undan ko'p bo'lsa — «MUALLIFLAR» yorliqli shablon */
    authors?: string[];
    workType: string;
    fileName: string;
    citations: string;
    selfCitation: string;
    plagiarism: string;
    originality: string;
    aiContent?: string;
    searchModules: string;
}

/** «MUALLIFLAR» yorliqli nusxa (scripts/build_authors_templates.py) — til nusxalari ham shu nom bilan */
export const CERTIFICATE_AUTHORS_IMAGE = `${ANTIPLAG_TEMPLATE_BASE}/sertifikat.authors.jpg`;

const AntiplagiatCertificate: React.FC<{ data: AntiplagiatCertificateData }> = ({ data }) => {
    // Yorliqlar shablon rasmida — interfeys tiliga mos nusxa olinadi
    const { lang } = useT();

    const values: Record<string, string> = {
        check_date: data.checkDate,
        document_number: data.certificateNumber,
        author: data.author,
        work_type: data.workType,
        file_name: data.fileName,
        citations: data.citations,
        self_citation: data.selfCitation,
        plagiarism: data.plagiarism,
        originality: data.originality,
        search_modules: data.searchModules,
    };

    const authors = (data.authors || []).filter((a) => a.trim());
    const multi = authors.length > 1;

    return (
        <AntiplagJpgPage
            id="antipagiat-certificate"
            data-paper className="antiplagiat-certificate"
            imageUrl={localizedTemplateUrl(multi ? CERTIFICATE_AUTHORS_IMAGE : CERTIFICATE_TEMPLATE.image, lang)}
            baseWidth={CERTIFICATE_TEMPLATE.width}
            aspectRatio={CERTIFICATE_TEMPLATE.aspect}
            fields={CERTIFICATE_TEMPLATE.fields}
            values={values}
            nameLists={multi ? { author: authors } : undefined}
            qrValue={verifyUrl(data.certificateNumber)}
            qrSpec={CERTIFICATE_TEMPLATE.qr}
        />
    );
};

export default AntiplagiatCertificate;
