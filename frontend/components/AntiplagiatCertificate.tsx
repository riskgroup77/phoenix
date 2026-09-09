import React from 'react';
import {
    CertificateSideStripes,
    GoldOrnateFrame,
    LaurelQRBlock,
    PhoenixLogoMark,
    PhoenixSealBadge,
    REPORT_COLOR_GOLD,
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
    /** Masalan: "30 ta moduldan / 30 tasida tekshirilgan" */
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
            className="w-full max-w-5xl mx-auto overflow-hidden relative shadow-xl print:shadow-none"
            style={{ aspectRatio: '297/210', fontFamily: 'Arial, Helvetica, sans-serif', background: '#fff' }}
            id="antipagiat-certificate"
        >
            <WaveLinesPattern />
            <CertificateSideStripes />

            {/* Topographic accent — chap yuqori */}
            <div className="absolute top-0 left-0 w-48 h-32 opacity-20 pointer-events-none" aria-hidden>
                <svg viewBox="0 0 200 120" className="w-full h-full">
                    {[20, 35, 50, 65, 80].map((y) => (
                        <path key={y} d={`M0 ${y} Q80 ${y - 10} 200 ${y + 5}`} fill="none" stroke="#64748b" strokeWidth="0.6" />
                    ))}
                </svg>
            </div>

            <div className="relative z-10 h-full flex flex-col px-8 sm:px-10 py-6 sm:py-8">
                {/* Yuqori meta */}
                <div className="flex justify-between items-start mb-4 pr-[34%]">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: REPORT_COLOR_NAVY }}>
                            TEKSHIRISH SANASI
                        </p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: REPORT_COLOR_TEXT }}>{data.checkDate}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: REPORT_COLOR_NAVY }}>
                            HUJJAT RAQAMI
                        </p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: REPORT_COLOR_TEXT }}>{data.certificateNumber}</p>
                    </div>
                </div>

                {/* Sarlavha */}
                <div className="text-center mb-5 pr-[30%]">
                    <h1
                        className="text-4xl sm:text-5xl font-bold tracking-[0.08em]"
                        style={{ color: REPORT_COLOR_NAVY, fontFamily: 'Georgia, "Times New Roman", serif' }}
                    >
                        SERTIFIKAT
                    </h1>
                </div>

                {/* Ma'lumotlar — oltin ramka */}
                <div className="flex-1 flex min-h-0 pr-[32%]">
                    <GoldOrnateFrame className="flex-1 min-w-0">
                        <div className="flex gap-3 min-h-0">
                            <div className="w-[38%] shrink-0 flex flex-col">
                                {rows.map((r) => (
                                    <div key={r.label} className="min-h-[1.85rem] flex items-center py-0.5">
                                        <span className="text-[9px] sm:text-[10px] font-bold uppercase leading-tight" style={{ color: REPORT_COLOR_TEAL }}>
                                            {r.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="w-px shrink-0 self-stretch opacity-30" style={{ backgroundColor: REPORT_COLOR_GOLD }} />
                            <div className="flex-1 min-w-0 flex flex-col">
                                {rows.map((r) => (
                                    <div key={r.label} className="min-h-[1.85rem] flex items-center py-0.5">
                                        <span
                                            className="text-[10px] sm:text-xs break-words leading-snug"
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
                        </div>
                    </GoldOrnateFrame>

                    {/* Muhr — o'ngda */}
                    <div className="absolute right-6 sm:right-10 top-[38%] -translate-y-1/2 hidden sm:block">
                        <PhoenixSealBadge />
                    </div>
                </div>

                {/* Pastki qism */}
                <div className="mt-auto pt-4 flex items-end justify-between gap-6 pr-[28%]">
                    <LaurelQRBlock
                        qrUrl={qrUrl}
                        label="Ma'lumotnomaning haqiqiyligini tekshirish uchun sertifikatdagi QR kodidan foydalaning."
                    />
                    <PhoenixLogoMark />
                </div>

                <p className="text-[8px] text-center mt-2 opacity-60 pr-[28%]" style={{ color: REPORT_COLOR_TEXT }}>
                    © Phoenix Nashriyoti — ilmiyfaoliyat.uz. Barcha huquqlar himoyalangan.
                </p>
            </div>
        </div>
    );
};

export default AntiplagiatCertificate;
