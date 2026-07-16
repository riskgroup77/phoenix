import React, { useEffect, useState } from 'react';
import { Article, User, ArticleStatus } from '../types';
import { CertificateBackground, CertificateQRBlock, CertificateBrandBlock, CERT_COLOR_DARK, CERT_COLOR_TEAL, CERT_COLOR_TEXT } from './CertificateLayout';
import { MOCK_JOURNALS } from '../data/mockData';
import { apiService } from '../services/apiService';

const getStatusDisplayData = (status: ArticleStatus): { text: string; color: string } => {
    const map: Record<ArticleStatus, { text: string; color: string }> = {
        [ArticleStatus.Draft]: { text: 'Qoralama', color: '#64748b' },
        [ArticleStatus.Yangi]: { text: 'Yangi', color: '#2563eb' },
        [ArticleStatus.WithEditor]: { text: 'Redaktorda', color: '#4f46e5' },
        [ArticleStatus.QabulQilingan]: { text: 'Qabul Qilingan', color: '#a16207' },
        [ArticleStatus.Revision]: { text: 'Tahrirda', color: '#ea580c' },
        [ArticleStatus.Accepted]: { text: "Ma'qullangan", color: '#0d9488' },
        [ArticleStatus.Published]: { text: 'Nashr etilgan', color: '#15803d' },
        [ArticleStatus.Rejected]: { text: 'Rad etilgan', color: '#b91c1c' },
        [ArticleStatus.NashrgaYuborilgan]: { text: 'Nashrga Yuborilgan', color: '#7c3aed' },
        [ArticleStatus.WritingInProgress]: { text: 'Yozilmoqda', color: '#0891b2' },
        [ArticleStatus.PlagiarismReview]: { text: 'Antiplagiat tekshiruvi', color: '#db2777' },
        [ArticleStatus.ContractProcessing]: { text: 'Shartnoma jarayonda', color: '#2563eb' },
        [ArticleStatus.IsbnProcessing]: { text: 'ISBN olish', color: '#4f46e5' },
        [ArticleStatus.AuthorDataVerified]: { text: "Muallif ma'lumotlari tasdiqlandi", color: '#16a34a' },
        [ArticleStatus.PaymentCompleted]: { text: "To'lov amalga oshirildi", color: '#059669' },
    };
    return map[status] || { text: status, color: '#64748b' };
};

const BORDER_COLOR = 'rgba(30,41,59,0.28)';

interface AuthorArticleReportProps {
    articles: Article[];
    author: User;
}

/** Barcha maqolalar bo'yicha ma'lumotnoma — A4, barcha maqolalar, boy dizayn */
const AuthorArticleReport: React.FC<AuthorArticleReportProps> = ({ articles, author }) => {
    const listArticles = articles;
    const documentDate = new Date().toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });
    const documentNumber = `MAQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    /** Skaner qilganda brauzerda to'g'ridan-to'g'ri PDF ochiladi (backend imzoli havola) */
    const [pdfOpenUrl, setPdfOpenUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        apiService.articles
            .getAuthorMalumotnomaSignedUrl()
            .then((res: { url?: string }) => {
                if (!cancelled && res?.url) setPdfOpenUrl(res.url);
            })
            .catch(() => {
                if (!cancelled && typeof window !== 'undefined') {
                    setPdfOpenUrl(window.location.href);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const qrPayload =
        pdfOpenUrl ||
        (typeof window !== 'undefined' ? window.location.href : 'https://ilmiyfaoliyat.uz/#/articles');

    const getJournalName = (article: Article): string =>
        article.journalName || MOCK_JOURNALS.find((j) => j.id === article.journalId)?.name || '-';

    return (
        <div
            className="w-full mx-auto overflow-hidden relative rounded-xl shadow-xl bg-transparent print:shadow-none print:rounded-none"
            style={{
                aspectRatio: '210/297',
                minHeight: '297mm',
                maxWidth: '210mm',
                fontFamily: 'Arial, Helvetica, sans-serif',
            }}
            id="author-article-report"
        >
            <CertificateBackground />

            <div className="relative z-10 h-full flex flex-col px-8 sm:px-10 py-8 sm:py-10 print:py-8">
                <div className="flex justify-between items-start mb-5">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: CERT_COLOR_DARK }}>
                            HUJJAT RAQAMI
                        </p>
                        <p className="text-sm font-medium mt-1" style={{ color: CERT_COLOR_DARK }}>
                            {documentNumber}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: CERT_COLOR_DARK }}>
                            HUJJAT SANASI
                        </p>
                        <p className="text-sm font-medium mt-1" style={{ color: CERT_COLOR_DARK }}>
                            {documentDate}
                        </p>
                    </div>
                </div>

                <div className="h-0.5 w-full rounded-full mb-5 opacity-30" style={{ backgroundColor: CERT_COLOR_TEAL }} />

                <div className="text-center mt-1 mb-5">
                    <h2 className="text-lg sm:text-xl font-bold uppercase tracking-widest" style={{ color: CERT_COLOR_TEAL }}>
                        BARCHA MAQOLALAR BO&apos;YICHA
                    </h2>
                    <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-wide mt-1" style={{ color: CERT_COLOR_DARK, fontFamily: 'Georgia, serif' }}>
                        MA&apos;LUMOTNOMA
                    </h1>
                </div>
                <div className="flex justify-center gap-3 mb-5">
                    <div className="h-0.5 w-12 rounded-full" style={{ backgroundColor: CERT_COLOR_TEAL }} />
                    <div className="h-0.5 w-16 rounded-full opacity-70" style={{ backgroundColor: CERT_COLOR_DARK }} />
                    <div className="h-0.5 w-12 rounded-full" style={{ backgroundColor: CERT_COLOR_TEAL }} />
                </div>

                <p className="text-sm text-center mb-5" style={{ color: CERT_COLOR_TEXT }}>
                    Ushbu ma&apos;lumotnoma muallifning tizimdagi barcha maqolalarini ro&apos;yxatlaydi.
                </p>

                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: CERT_COLOR_TEAL }}>
                    Muallif ma&apos;lumotlari
                </p>
                <div className="flex pl-4 mb-5" style={{ borderLeft: `3px solid ${CERT_COLOR_TEAL}` }}>
                    <div className="flex flex-col gap-3 min-w-0">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: CERT_COLOR_DARK }}>
                                Familya, ismi, sharifi
                            </p>
                            <p className="text-sm" style={{ color: CERT_COLOR_TEXT }}>
                                {[author.lastName, author.firstName, author.patronymic].filter(Boolean).join(' ') || author.email}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: CERT_COLOR_DARK }}>
                                Tashkilot
                            </p>
                            <p className="text-sm" style={{ color: CERT_COLOR_TEXT }}>
                                {author.affiliation || "Ko'rsatilmagan"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="h-0.5 w-full rounded-full mb-4 opacity-20" style={{ backgroundColor: CERT_COLOR_DARK }} />

                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: CERT_COLOR_TEAL }}>
                    Maqolalar ro&apos;yxati
                </p>
                <div className="flex-1 overflow-auto min-h-[200px] px-1 print:min-h-0" style={{ flex: '1 1 auto' }}>
                    <table className="w-full border-collapse text-sm" style={{ borderColor: BORDER_COLOR }}>
                        <thead>
                            <tr>
                                <th className="border px-3 py-2 text-center w-10 font-semibold" style={{ color: CERT_COLOR_DARK, borderColor: BORDER_COLOR }}>
                                    №
                                </th>
                                <th className="border px-3 py-2 text-left font-semibold" style={{ color: CERT_COLOR_DARK, borderColor: BORDER_COLOR }}>
                                    Sarlavha
                                </th>
                                <th className="border px-3 py-2 text-left font-semibold" style={{ color: CERT_COLOR_DARK, borderColor: BORDER_COLOR }}>
                                    Jurnal
                                </th>
                                <th className="border px-3 py-2 text-left font-semibold" style={{ color: CERT_COLOR_DARK, borderColor: BORDER_COLOR }}>
                                    Sana
                                </th>
                                <th className="border px-3 py-2 text-left font-semibold" style={{ color: CERT_COLOR_DARK, borderColor: BORDER_COLOR }}>
                                    Holati
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {listArticles.length > 0 ? (
                                listArticles.map((article, index) => {
                                    const statusInfo = getStatusDisplayData(article.status);
                                    return (
                                        <tr key={article.id}>
                                            <td className="border px-3 py-2 text-center font-medium" style={{ color: CERT_COLOR_TEXT, borderColor: BORDER_COLOR }}>
                                                {index + 1}
                                            </td>
                                            <td className="border px-3 py-2" style={{ color: CERT_COLOR_TEXT, borderColor: BORDER_COLOR }}>
                                                {article.title}
                                            </td>
                                            <td className="border px-3 py-2" style={{ color: CERT_COLOR_TEXT, borderColor: BORDER_COLOR }}>
                                                {getJournalName(article)}
                                            </td>
                                            <td className="border px-3 py-2 whitespace-nowrap" style={{ color: CERT_COLOR_TEXT, borderColor: BORDER_COLOR }}>
                                                {article.submissionDate ? new Date(article.submissionDate).toLocaleDateString('uz-UZ') : '-'}
                                            </td>
                                            <td className="border px-3 py-2 font-semibold" style={{ color: statusInfo.color, borderColor: BORDER_COLOR }}>
                                                {statusInfo.text}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="border px-3 py-6 text-center text-sm" style={{ color: CERT_COLOR_TEXT, borderColor: BORDER_COLOR }}>
                                        Hozircha ro&apos;yxatda maqolalar yo&apos;q.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {listArticles.length > 0 && (
                    <p className="text-xs font-semibold mt-3" style={{ color: CERT_COLOR_DARK }}>
                        Jami: {listArticles.length} ta maqola
                    </p>
                )}

                <div className="h-0.5 w-full rounded-full mt-4 opacity-20" style={{ backgroundColor: CERT_COLOR_DARK }} />

                <div className="mt-auto pt-6 flex items-end justify-between gap-8 flex-wrap">
                    <CertificateBrandBlock />
                    <CertificateQRBlock
                        qrUrl={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrPayload)}&bgcolor=ffffff`}
                        label="PDF faylni ochish uchun QR kodni skanerlang"
                    />
                </div>
            </div>
        </div>
    );
};

export default AuthorArticleReport;
