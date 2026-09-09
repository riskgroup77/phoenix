import React from 'react';
import {
    A4_LANDSCAPE_CERT_STYLE,
    CertificateSideStripes,
    GoldOrnateFrame,
    LaurelQRBlock,
    PhoenixLogoMark,
    PhoenixSealBadge,
    REPORT_COLOR_NAVY,
    REPORT_COLOR_TEAL,
    REPORT_COLOR_TEXT,
    WaveLinesPattern,
} from './ReportPageLayout';

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
    const verifyUrl = `https://ilmiyfaoliyat.uz/verify/${encodeURIComponent(data.certificateNumber)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verifyUrl)}&bgcolor=ffffff`;

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
            className="antiplagiat-certificate mx-auto overflow-hidden relative shadow-xl print:shadow-none print:overflow-visible"
            style={{ ...A4_LANDSCAPE_CERT_STYLE, fontFamily: 'Arial, Helvetica, sans-serif', background: '#fff' }}
            id="antipagiat-certificate"
        >
            <WaveLinesPattern />
            <CertificateSideStripes />

            <div className="absolute top-0 left-0 w-40 h-24 opacity-20 pointer-events-none print:opacity-10" aria-hidden>
                <svg viewBox="0 0 200 120" className="w-full h-full">
                    {[20, 35, 50, 65, 80].map((y) => (
                        <path key={y} d={`M0 ${y} Q80 ${y - 10} 200 ${y + 5}`} fill="none" stroke="#64748b" strokeWidth="0.6" />
                    ))}
                </svg>
            </div>

            <div className="relative z-10 flex flex-col h-full px-6 py-5 print:px-5 print:py-4" style={{ minHeight: '210mm' }}>
                {/* Meta + sarlavha */}
                <div className="flex justify-between items-start mb-3 pr-[36%] print:pr-[32%]">
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: REPORT_COLOR_NAVY }}>
                            TEKSHIRISH SANASI
                        </p>
                        <p className="text-xs font-semibold mt-0.5" style={{ color: REPORT_COLOR_TEXT }}>{data.checkDate}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: REPORT_COLOR_NAVY }}>
                            HUJJAT RAQAMI
                        </p>
                        <p className="text-xs font-semibold mt-0.5" style={{ color: REPORT_COLOR_TEXT }}>{data.certificateNumber}</p>
                    </div>
                </div>

                <div className="text-center mb-4 pr-[32%] print:pr-[28%]">
                    <h1
                        className="text-3xl print:text-[28pt] font-bold tracking-[0.1em]"
                        style={{ color: REPORT_COLOR_NAVY, fontFamily: 'Georgia, "Times New Roman", serif' }}
                    >
                        SERTIFIKAT
                    </h1>
                </div>

                {/* Oltin ramka — har qator: label + value (sertifikat.jpg) */}
                <div className="flex-1 min-h-0 pr-[34%] print:pr-[30%] relative">
                    <GoldOrnateFrame className="h-full">
                        <div className="space-y-1 print:space-y-0.5">
                            {rows.map((r) => (
                                <div key={r.label} className="flex gap-3 items-start py-0.5 print:py-0">
                                    <span
                                        className="w-[38%] shrink-0 text-[8px] print:text-[7.5pt] font-bold uppercase leading-tight"
                                        style={{ color: REPORT_COLOR_TEAL }}
                                    >
                                        {r.label}
                                    </span>
                                    <span
                                        className="flex-1 text-[9px] print:text-[8pt] break-words leading-snug"
                                        style={{
                                            color:
                                                r.highlight === 'red' ? '#b91c1c'
                                                : r.highlight === 'green' ? '#15803d'
                                                : r.label === 'WEB-SAYT' ? REPORT_COLOR_TEAL
                                                : REPORT_COLOR_TEXT,
                                            fontWeight: r.highlight || r.label === 'WEB-SAYT' ? 700 : 500,
                                        }}
                                    >
                                        {r.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </GoldOrnateFrame>

                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 print:right-0">
                        <PhoenixSealBadge />
                    </div>
                </div>

                <div className="mt-3 pt-2 flex items-end justify-between gap-4 pr-[28%] print:pr-[24%] shrink-0">
                    <LaurelQRBlock
                        qrUrl={qrUrl}
                        label="TEKSHIRISH UCHUN QR KODDAN FOYDALANING"
                    />
                    <PhoenixLogoMark size="sm" />
                </div>

                <p className="text-[7px] print:text-[6pt] text-center mt-1 opacity-60 pr-[28%]" style={{ color: REPORT_COLOR_TEXT }}>
                    © Phoenix Nashriyoti — ilmiyfaoliyat.uz
                </p>
            </div>
        </div>
    );
};

export default AntiplagiatCertificate;
