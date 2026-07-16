import React from 'react';
import { CertificateBackground, CertificateQRBlock, CertificateBrandBlock, CERT_COLOR_DARK, CERT_COLOR_TEAL } from './CertificateLayout';

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
    searchModules: string;
}

const AntiplagiatCertificate: React.FC<{ data: AntiplagiatCertificateData }> = ({ data }) => {
    const rows: { label: string; value: string; highlight?: 'red' | 'green' }[] = [
        { label: 'MUALLIF', value: data.author },
        { label: 'ISH TURI', value: data.workType },
        { label: 'FAYL NOMI', value: data.fileName },
        { label: 'IQTIBOSLAR', value: data.citations },
        { label: "O'Z-O'ZIGA IQTIBOS", value: data.selfCitation },
        { label: "O'ZLASHTIRISH", value: data.plagiarism, highlight: 'red' },
        { label: 'ORIGINALLAIK', value: data.originality, highlight: 'green' },
        { label: 'WEB-SAYT', value: 'www.ilmiyfaoliyat.uz' },
        { label: 'QIDIRUV TIZIMLARI', value: data.searchModules },
    ];

    return (
        <div
            className="w-full max-w-5xl mx-auto overflow-hidden relative rounded-xl shadow-xl"
            style={{ aspectRatio: '1414/1000', fontFamily: 'Arial, Helvetica, sans-serif' }}
            id="antipagiat-certificate"
        >
            <CertificateBackground />

            <div className="relative z-10 h-full flex flex-col px-8 sm:px-10 py-8 sm:py-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: CERT_COLOR_DARK }}>TEKSHIRISH SANASI</p>
                        <p className="text-sm font-medium mt-1" style={{ color: CERT_COLOR_DARK }}>{data.checkDate}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: CERT_COLOR_DARK }}>HUJJAT RAQAMI</p>
                        <p className="text-sm font-medium mt-1" style={{ color: CERT_COLOR_DARK }}>{data.certificateNumber}</p>
                    </div>
                </div>

                <div className="text-center mt-2 mb-8">
                    <h1
                        className="text-4xl sm:text-5xl font-bold tracking-wide"
                        style={{ color: CERT_COLOR_DARK, fontFamily: 'Georgia, serif' }}
                    >
                        SERTIFIKAT
                    </h1>
                    <div className="h-0.5 w-24 mx-auto mt-3 rounded-full" style={{ backgroundColor: CERT_COLOR_TEAL }} />
                </div>

                <div className="flex-1 flex min-h-0 pr-4">
                    <div className="flex min-w-0 flex-1 gap-4" style={{ borderLeft: `3px solid ${CERT_COLOR_TEAL}` }}>
                        <div className="w-36 sm:w-40 flex-shrink-0 pl-3 pr-2 flex flex-col">
                            {rows.map((r) => (
                                <div key={r.label} className="flex items-center min-h-[2.75rem] mb-1">
                                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide leading-tight" style={{ color: CERT_COLOR_TEAL }}>{r.label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 pl-0 flex flex-col min-w-0">
                            {rows.map((r, i) => (
                                <div key={i} className="min-h-[2.75rem] flex items-center mb-1 pt-0.5">
                                    <span
                                        className="text-xs sm:text-sm break-words"
                                        style={{
                                            color: r.highlight === 'red' ? '#b91c1c' : r.highlight === 'green' ? '#15803d' : r.label === 'WEB-SAYT' ? CERT_COLOR_TEAL : CERT_COLOR_DARK,
                                            fontWeight: r.highlight || r.label === 'WEB-SAYT' ? 600 : 400,
                                        }}
                                    >
                                        {r.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-8 flex items-end justify-between gap-8 flex-wrap">
                    <CertificateBrandBlock />
                    <CertificateQRBlock
                        qrUrl={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://ilmiyfaoliyat.uz/verify/${data.certificateNumber}&bgcolor=ffffff`}
                    />
                </div>
            </div>
        </div>
    );
};

export default AntiplagiatCertificate;
