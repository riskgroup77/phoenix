import React from 'react';
import { publicArticleUrl } from '../utils/verifyLink';
import { useT } from '../i18n/LanguageContext';
import { CertificateBackground, CertificateQRBlock, CertificateBrandBlock, CERT_COLOR_DARK, CERT_COLOR_TEAL, CERT_COLOR_TEXT } from './CertificateLayout';

export interface QabulCertificateData {
    certificateNumber: string;
    issueDate: string;
    author: string;
    workType: string;
    workTitle: string;
    journalName: string;
    organization: string;
    publishDate?: string;
    currentStatus: string;
    articleId: string;
}

const QabulCertificate: React.FC<{ data: QabulCertificateData }> = ({ data }) => {
    const { t } = useT();
    const labels = [
        t('MUALLIF'),
        t('ISH TURI'),
        t('ISH NOMI'),
        t('JURNAL NOMI'),
        t('TASHKILOT NOMI'),
        ...(data.publishDate ? [t('NASHR ETILISH SANASI')] : []),
        t('HOZIRGI HOLATI'),
        t('WEB-SAYT'),
    ];
    // Standart (o'zbekcha) qiymatlar — ish turi, holat va "Noma'lum ..." o'rinbosarlari — joriy tilga
    const known = (value: string, keys: string[]) => (keys.includes(value) ? t(value) : value);
    const values = [
        data.author,
        data.workType ? t(data.workType) : '',
        data.workTitle,
        known(data.journalName, ["Noma'lum jurnal"]),
        known(data.organization, ["Noma'lum tashkilot"]),
        ...(data.publishDate ? [data.publishDate] : []),
        data.currentStatus ? t(data.currentStatus) : '',
        'www.ilmiyfaoliyat.uz',
    ];

    return (
        <div
            data-paper
            className="w-full max-w-5xl mx-auto overflow-hidden relative rounded-xl shadow-xl"
            style={{ aspectRatio: '1414/1000', fontFamily: 'Arial, Helvetica, sans-serif' }}
            id="qabul-certificate"
        >
            <CertificateBackground />

            <div className="relative z-10 h-full flex flex-col px-8 sm:px-10 py-8 sm:py-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: CERT_COLOR_DARK }}>{t('HUJJAT RAQAMI:')}</p>
                        <p className="text-sm font-medium mt-1" style={{ color: CERT_COLOR_DARK }}>{data.certificateNumber}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: CERT_COLOR_DARK }}>{t('HUJJAT SANASI:')}</p>
                        <p className="text-sm font-medium mt-1" style={{ color: CERT_COLOR_DARK }}>{data.issueDate}</p>
                    </div>
                </div>

                <div className="text-center mt-2 mb-8">
                    <h2 className="text-lg sm:text-xl font-bold uppercase tracking-widest" style={{ color: CERT_COLOR_TEAL }}>{t('QABUL HAQIDA')}</h2>
                    <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wide mt-1" style={{ color: CERT_COLOR_DARK, fontFamily: 'Georgia, serif' }}>{t("MA'LUMOTNOMA")}</h1>
                </div>

                <div className="flex-1 flex min-h-0 pr-4">
                    <div className="flex min-w-0 flex-1 gap-4" style={{ borderLeft: `3px solid ${CERT_COLOR_TEAL}` }}>
                        <div className="w-28 sm:w-32 flex-shrink-0 pl-3 pr-2 flex flex-col">
                            {labels.map((label) => (
                                <div key={label} className="flex items-center min-h-[2.75rem] mb-1">
                                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide leading-tight" style={{ color: CERT_COLOR_TEAL }}>{label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 pl-0 flex flex-col min-w-0">
                            {values.map((value, i) => (
                                <div key={i} className="min-h-[2.75rem] flex items-center mb-1 pt-0.5">
                                    <span
                                        className="text-xs sm:text-sm break-words"
                                        style={{
                                            color: i === values.length - 1 ? CERT_COLOR_TEAL : CERT_COLOR_TEXT,
                                            fontWeight: i === values.length - 1 ? 600 : 400,
                                        }}
                                    >
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-8 flex items-end justify-between gap-8 flex-wrap">
                    <CertificateBrandBlock />
                    <CertificateQRBlock
                        qrValue={publicArticleUrl(data.articleId)}
                    />
                </div>
            </div>
        </div>
    );
};

export default QabulCertificate;
