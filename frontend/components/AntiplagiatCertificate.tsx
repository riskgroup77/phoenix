import React from 'react';
import AntiplagJpgPage from './AntiplagTemplateOverlay';
import { CERTIFICATE_TEMPLATE } from '../constants/antiplagTemplateLayout';
import { verifyUrl } from '../utils/verifyLink';
import { localizedTemplateUrl } from '../constants/localizedTemplate';
import { useT } from '../i18n/LanguageContext';

export interface AntiplagiatCertificateData {
    certificateNumber: string;
    checkDate: string;
    author: string;
    workType: string;
    fileName: string;
    citations: string;
    selfCitation: string;
    plagiarism: string;
    originality: string;
    aiContent?: string;
    searchModules: string;
}

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

    return (
        <AntiplagJpgPage
            id="antipagiat-certificate"
            data-paper className="antiplagiat-certificate"
            imageUrl={localizedTemplateUrl(CERTIFICATE_TEMPLATE.image, lang)}
            baseWidth={CERTIFICATE_TEMPLATE.width}
            aspectRatio={CERTIFICATE_TEMPLATE.aspect}
            fields={CERTIFICATE_TEMPLATE.fields}
            values={values}
            qrValue={verifyUrl(data.certificateNumber)}
            qrSpec={CERTIFICATE_TEMPLATE.qr}
        />
    );
};

export default AntiplagiatCertificate;
