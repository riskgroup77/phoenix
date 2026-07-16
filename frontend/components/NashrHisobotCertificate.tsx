import React from 'react';
import { CertificateBackground, CertificateQRBlock, CertificateBrandBlock, CERT_COLOR_DARK, CERT_COLOR_TEAL, CERT_COLOR_TEXT } from './CertificateLayout';

export interface PublishedArticle {
    id: number;
    title: string;
    publishName: string;
    publishDate?: string;
    internetLink: string;
    coAuthors: string[];
}

export interface NashrHisobotData {
    documentNumber: string;
    documentDate: string;
    authorFullName: string;
    authorWorkplace: string;
    authorPosition: string;
    articles: PublishedArticle[];
}

/** 1-sahifa: bosh sahifa — boy elementlar, katta bo'shliqlar, ramkadan uzoq */
const CoverPage: React.FC<{ data: NashrHisobotData }> = ({ data }) => (
    <div className="relative w-full min-h-[700px] overflow-hidden rounded-xl shadow-xl" style={{ aspectRatio: '210/297' }}>
        <CertificateBackground />
        <div className="relative z-10 h-full flex flex-col px-10 sm:px-12 py-10 sm:py-12">
            {/* Header: sana va raqam — bir-biridan uzoq */}
            <div className="flex justify-between items-start gap-8 mb-8">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: CERT_COLOR_DARK }}>Hujjat yaratilgan sana</p>
                    <p className="text-sm font-medium" style={{ color: CERT_COLOR_TEXT }}>{data.documentDate}</p>
                </div>
                <div className="text-right min-w-0 flex-1 flex flex-col items-end">
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: CERT_COLOR_DARK }}>Hujjat raqami</p>
                    <p className="text-sm font-medium" style={{ color: CERT_COLOR_TEXT }}>{data.documentNumber}</p>
                </div>
            </div>

            {/* Dekorativ chiziq */}
            <div className="h-0.5 w-full rounded-full mb-8 opacity-40" style={{ backgroundColor: CERT_COLOR_TEAL }} />

            {/* Asosiy sarlavha */}
            <div className="text-center mb-4">
                <h1
                    className="text-3xl sm:text-4xl font-bold uppercase tracking-wide leading-tight"
                    style={{ color: CERT_COLOR_DARK, fontFamily: 'Georgia, serif' }}
                >
                    MAQOLALAR NASHRI<br />HAQIDA HISOBOT
                </h1>
            </div>
            <div className="flex justify-center gap-4 mb-10">
                <div className="h-0.5 w-16 rounded-full" style={{ backgroundColor: CERT_COLOR_TEAL }} />
                <div className="h-0.5 w-24 rounded-full opacity-70" style={{ backgroundColor: CERT_COLOR_DARK }} />
                <div className="h-0.5 w-16 rounded-full" style={{ backgroundColor: CERT_COLOR_TEAL }} />
            </div>

            {/* Kirish matni */}
            <p className="text-sm text-center mb-10" style={{ color: CERT_COLOR_TEXT }}>
                Ushbu hisobot muallif tomonidan nashr qilingan ilmiy maqolalar ro&apos;yxatini o&apos;z ichiga oladi.
            </p>

            {/* Bo'lim sarlavhasi */}
            <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: CERT_COLOR_TEAL }}>
                Muallif ma&apos;lumotlari
            </p>

            {/* Muallif bloki — vertikal chiziq va katta oraliqlar */}
            <div className="flex-1 flex items-start min-h-0">
                <div className="flex pl-5 pr-2" style={{ borderLeft: `4px solid ${CERT_COLOR_TEAL}` }}>
                    <div className="space-y-6">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: CERT_COLOR_DARK }}>Familya, ismi, sharifi</p>
                            <p className="text-base font-medium" style={{ color: CERT_COLOR_TEXT }}>{data.authorFullName}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: CERT_COLOR_DARK }}>Ish yoki o&apos;qish joyi</p>
                            <p className="text-base" style={{ color: CERT_COLOR_TEXT }}>{data.authorWorkplace}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: CERT_COLOR_DARK }}>Lavozimi</p>
                            <p className="text-base" style={{ color: CERT_COLOR_TEXT }}>{data.authorPosition}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pastki dekorativ chiziq */}
            <div className="h-0.5 w-full rounded-full mt-6 mb-6 opacity-30" style={{ backgroundColor: CERT_COLOR_DARK }} />

            {/* Footer — brand va QR bir-biridan uzoq */}
            <div className="mt-auto pt-8 flex items-end justify-between gap-10 flex-wrap">
                <CertificateBrandBlock />
                <CertificateQRBlock
                    qrUrl={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://ilmiyfaoliyat.uz/verify/${data.documentNumber}&bgcolor=ffffff`}
                    label="HUJJATNI TEKSHIRISH UCHUN QR KODDAN FOYDALANING"
                />
            </div>
        </div>
    </div>
);

/** 2-sahifa: jadval — ko'p elementlar, katta bo'shliqlar, ramkadan ichkarida */
const BORDER_COLOR = 'rgba(30,41,59,0.28)';

const TablePage: React.FC<{ data: NashrHisobotData }> = ({ data }) => (
    <div className="relative w-full min-h-[700px] overflow-hidden rounded-xl shadow-xl" style={{ aspectRatio: '210/297' }}>
        <CertificateBackground />
        <div className="relative z-10 h-full flex flex-col px-10 sm:px-12 py-8 sm:py-10">
            {/* Sarlavha va dekorativ chiziq */}
            <div className="mb-4">
                <h2
                    className="text-xl font-bold uppercase tracking-wide"
                    style={{ color: CERT_COLOR_DARK, fontFamily: 'Georgia, serif' }}
                >
                    MAQOLALAR NASHRI HAQIDA HISOBOT
                </h2>
            </div>
            <div className="flex items-center gap-3 mb-2">
                <div className="h-0.5 w-20 rounded-full" style={{ backgroundColor: CERT_COLOR_TEAL }} />
                <div className="h-0.5 flex-1 max-w-[120px] rounded-full opacity-60" style={{ backgroundColor: CERT_COLOR_DARK }} />
            </div>

            {/* Hujjat ma'lumoti (raqam, sana) — jadvaldan ajratilgan */}
            <div className="flex flex-wrap gap-6 mb-6">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: CERT_COLOR_DARK }}>Hujjat raqami</p>
                    <p className="text-xs font-medium" style={{ color: CERT_COLOR_TEXT }}>{data.documentNumber}</p>
                </div>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: CERT_COLOR_DARK }}>Sana</p>
                    <p className="text-xs font-medium" style={{ color: CERT_COLOR_TEXT }}>{data.documentDate}</p>
                </div>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: CERT_COLOR_DARK }}>Muallif</p>
                    <p className="text-xs font-medium" style={{ color: CERT_COLOR_TEXT }}>{data.authorFullName}</p>
                </div>
            </div>

            {/* Bo'lim sarlavhasi — jadval ustidan */}
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: CERT_COLOR_TEAL }}>
                Nashr qilingan maqolalar ro&apos;yxati
            </p>

            {/* Jadval — ramkadan uzoq, katta padding */}
            <div className="flex-1 overflow-auto min-h-0 px-2 sm:px-4">
                <table className="w-full border-collapse text-sm" style={{ borderColor: BORDER_COLOR }}>
                    <thead>
                        <tr>
                            <th className="border px-3 py-2.5 text-center w-12 font-semibold" style={{ color: CERT_COLOR_DARK, borderColor: BORDER_COLOR }}>№</th>
                            <th className="border px-3 py-2.5 text-left font-semibold" style={{ color: CERT_COLOR_DARK, borderColor: BORDER_COLOR }}>Ilmiy ish nomi</th>
                            <th className="border px-3 py-2.5 text-left font-semibold" style={{ color: CERT_COLOR_DARK, borderColor: BORDER_COLOR }}>Nashr nomi va shakli</th>
                            <th className="border px-3 py-2.5 text-left font-semibold" style={{ color: CERT_COLOR_DARK, borderColor: BORDER_COLOR }}>Internet havolasi</th>
                            <th className="border px-3 py-2.5 text-left font-semibold" style={{ color: CERT_COLOR_DARK, borderColor: BORDER_COLOR }}>Hammualliflar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.articles.map((article, index) => (
                            <tr key={article.id}>
                                <td className="border px-3 py-2.5 text-center font-medium" style={{ color: CERT_COLOR_TEXT, borderColor: BORDER_COLOR }}>{index + 1}.</td>
                                <td className="border px-3 py-2.5" style={{ color: CERT_COLOR_TEXT, borderColor: BORDER_COLOR }}>{article.title}</td>
                                <td className="border px-3 py-2.5" style={{ color: CERT_COLOR_TEXT, borderColor: BORDER_COLOR }}>
                                    {article.publishName}
                                    {article.publishDate && <div className="text-xs mt-1" style={{ color: CERT_COLOR_TEXT }}>{article.publishDate}</div>}
                                </td>
                                <td className="border px-3 py-2.5">
                                    <a href={article.internetLink} target="_blank" rel="noopener noreferrer" className="text-xs break-all hover:underline" style={{ color: CERT_COLOR_TEAL }}>
                                        {article.internetLink}
                                    </a>
                                </td>
                                <td className="border px-3 py-2.5" style={{ color: CERT_COLOR_TEXT, borderColor: BORDER_COLOR }}>
                                    {article.coAuthors.length > 0 ? (
                                        <ol className="list-decimal list-inside text-xs">
                                            {article.coAuthors.map((author, i) => (
                                                <li key={i}>{author}</li>
                                            ))}
                                        </ol>
                                    ) : (
                                        <span className="text-slate-500">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pastki chiziq va footer — bir-biridan uzoq */}
            <div className="h-0.5 w-full rounded-full mt-6 opacity-25 shrink-0" style={{ backgroundColor: CERT_COLOR_DARK }} />
            <div className="mt-6 pt-6 flex items-end justify-between gap-10 flex-wrap shrink-0">
                <CertificateBrandBlock />
                <CertificateQRBlock
                    qrUrl={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://ilmiyfaoliyat.uz/verify/${data.documentNumber}&bgcolor=ffffff`}
                    label="QR KODDAN FOYDALANING"
                />
            </div>
        </div>
    </div>
);

const NashrHisobotCertificate: React.FC<{ data: NashrHisobotData }> = ({ data }) => {
    return (
        <div className="space-y-8" id="nashr-hisobot">
            <CoverPage data={data} />
            <div className="page-break-before">
                <TablePage data={data} />
            </div>
        </div>
    );
};

export default NashrHisobotCertificate;
