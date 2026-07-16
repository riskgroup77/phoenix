import React from 'react';
import { CertificateBackground, CertificateQRBlock, CertificateBrandBlock, CERT_COLOR_DARK, CERT_COLOR_TEAL, CERT_COLOR_TEXT } from './CertificateLayout';

export interface UDKCertificateData {
    certificateNumber: string;
    issueDate: string;
    author: string;
    workTitle: string;
    udkCode: string;
    udkDescription?: string;
}

const UDKCertificate: React.FC<{ data: UDKCertificateData }> = ({ data }) => {
    return (
        <div
            className="w-full max-w-5xl mx-auto overflow-hidden relative rounded-xl shadow-xl"
            style={{ aspectRatio: '1414/1000', fontFamily: 'Arial, Helvetica, sans-serif' }}
            id="udk-certificate"
        >
            <CertificateBackground />

            <div className="relative z-10 h-full flex flex-col px-8 sm:px-10 py-8 sm:py-10">
                {/* Header — aniq oraliq */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: CERT_COLOR_DARK }}>HUJJAT RAQAMI:</p>
                        <p className="text-sm font-medium mt-1" style={{ color: CERT_COLOR_DARK }}>{data.certificateNumber}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: CERT_COLOR_DARK }}>HUJJAT SANASI:</p>
                        <p className="text-sm font-medium mt-1" style={{ color: CERT_COLOR_DARK }}>{data.issueDate}</p>
                    </div>
                </div>

                {/* Sarlavha — yuqoridan va pastdan oraliq */}
                <div className="text-center mt-2 mb-8">
                    <h2 className="text-lg sm:text-xl font-bold uppercase tracking-widest" style={{ color: CERT_COLOR_TEAL }}>UDK HAQIDA</h2>
                    <h1 className="text-3xl sm:text-4xl font-bold uppercase tracking-wide mt-1" style={{ color: CERT_COLOR_DARK, fontFamily: 'Georgia, serif' }}>MA&apos;LUMOTNOMA</h1>
                </div>

                {/* Kontent — qatorlar orasida katta oraliq, ustunlar ajratilgan */}
                <div className="flex-1 flex min-h-0 pr-4">
                    <div className="flex min-w-0 flex-1 gap-4" style={{ borderLeft: `3px solid ${CERT_COLOR_TEAL}` }}>
                        <div className="w-28 sm:w-32 flex-shrink-0 pl-3 pr-2 flex flex-col">
                            {['MUALLIF', 'ISH NOMI', 'UDK RAQAMI', 'WEB-SAYT'].map((label) => (
                                <div key={label} className="flex items-center min-h-[2.75rem] mb-1">
                                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide leading-tight" style={{ color: CERT_COLOR_TEAL }}>{label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="min-h-[2.75rem] flex items-center mb-1 pt-0.5">
                                <span className="text-xs sm:text-sm break-words" style={{ color: CERT_COLOR_TEXT }}>{data.author}</span>
                            </div>
                            <div className="min-h-[2.75rem] flex items-start pt-1 mb-1">
                                <span className="text-xs sm:text-sm break-words" style={{ color: CERT_COLOR_TEXT }}>{data.workTitle}</span>
                            </div>
                            <div className="min-h-[2.75rem] flex items-center mb-1 pt-0.5">
                                <span className="text-sm font-bold" style={{ color: CERT_COLOR_DARK }}>{data.udkCode}</span>
                            </div>
                            {data.udkDescription && (
                                <div className="mb-4 mt-1">
                                    <p className="text-xs text-gray-600 italic leading-relaxed">{data.udkDescription}</p>
                                </div>
                            )}
                            <div className="min-h-[2.75rem] flex items-center mt-2 mb-1 pt-0.5">
                                <a
                                    href="https://ilmiyfaoliyat.uz"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs sm:text-sm font-medium hover:underline"
                                    style={{ color: CERT_COLOR_TEAL }}
                                >
                                    www.ilmiyfaoliyat.uz
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer: brend + QR — oraliq katta, yopishmaydi */}
                <div className="mt-auto pt-8 flex items-end justify-between gap-8 flex-wrap">
                    <CertificateBrandBlock />
                    <CertificateQRBlock
                        qrUrl={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://ilmiyfaoliyat.uz/udk-verify/${data.certificateNumber}&bgcolor=ffffff`}
                    />
                </div>
            </div>
        </div>
    );
};

export default UDKCertificate;
