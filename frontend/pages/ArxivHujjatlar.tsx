import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import { Download, FileText, ExternalLink, Filter } from 'lucide-react';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';
import { Role } from '../types';

const ARCHIVE_TYPE_LABELS: Record<string, string> = {
    article_submission: 'Maqola yuborish',
    article_pdf: 'Maqola PDF',
    article_sample_order: 'Maqola yozish buyurtmasi',
    udk_certificate: "UDK ma'lumotnoma",
    udk_standalone: "UDK ma'lumotnoma",
    udk_request_order: 'UDK buyurtmasi',
    publication_certificate: "Nashr sertifikati",
    review_result: "Taqriz natijasi",
    doi_link: "DOI raqami",
    plagiarism_check: 'Antiplagiat tekshiruvi',
};

function archiveTypeLabel(item: ArchiveItem): string {
    return ARCHIVE_TYPE_LABELS[item.type] || item.label || item.type;
}

function archiveStatusLabel(item: ArchiveItem): string | null {
    const fromExtra = item.extra?.status_label;
    if (fromExtra && typeof fromExtra === 'string') return fromExtra;
    if (item.label && item.label !== archiveTypeLabel(item)) return item.label;
    return null;
}

type ArchiveItem = {
    type: string;
    id: string;
    title: string;
    label: string;
    date: string | null;
    download_url: string | null;
    view_url?: string;
    article_id?: string;
    extra?: {
        plagiarism_percentage?: number;
        originality_percentage?: number;
        citation_percent?: number;
        self_citation_percent?: number;
        certificate_number?: string;
        document_type?: string;
        sources_count?: number;
        journal?: string;
        status?: string;
        status_label?: string;
    };
};

function formatPercent(value: unknown): string {
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    return `${n.toFixed(2)}%`;
}

const ArxivHujjatlar: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [archiveFilter, setArchiveFilter] = useState('');

    const fetchArchive = useCallback(async () => {
        if (!user || user.role !== Role.Author) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const res = await apiService.auth.getArchive();
            const data = res?.data ?? res;
            setArchiveItems(Array.isArray(data?.items) ? data.items : []);
        } catch (e) {
            console.error('Archive fetch failed', e);
            setArchiveItems([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        void fetchArchive();
    }, [fetchArchive]);

    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                void fetchArchive();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [fetchArchive]);

    const handleView = useCallback(
        (item: ArchiveItem) => {
            if (item.type === 'plagiarism_check' && item.article_id) {
                navigate(`/plagiarism-check/result/${encodeURIComponent(item.article_id)}`);
                return;
            }
            if (!item.view_url) return;
            if (item.view_url.startsWith('http')) {
                window.open(item.view_url, '_blank', 'noopener');
                return;
            }
            navigate(item.view_url);
        },
        [navigate],
    );

    const handleArchiveDownload = useCallback(
        async (item: ArchiveItem) => {
            const url = item.download_url;
            if (!url) {
                handleView(item);
                return;
            }
            const token = localStorage.getItem('access_token');
            const isApiUrl = url.includes('/api/v1/') || url.includes('/reviews/');
            if (isApiUrl && token) {
                try {
                    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                    if (!response.ok) throw new Error('Yuklab olish amalga oshmadi');
                    const blob = await response.blob();
                    const disposition = response.headers.get('Content-Disposition');
                    let filename = `document_${item.id}.pdf`;
                    if (disposition) {
                        const match = disposition.match(/filename="?([^";\n]+)"?/);
                        if (match) filename = match[1].trim();
                    }
                    const a = document.createElement('a');
                    a.href = window.URL.createObjectURL(blob);
                    a.download = filename;
                    a.click();
                    window.URL.revokeObjectURL(a.href);
                    toast.success('Yuklab olindi');
                } catch {
                    toast.error('Yuklab olishda xatolik');
                }
            } else {
                window.open(url, '_blank', 'noopener');
            }
        },
        [handleView],
    );

    if (!user) return null;

    if (user.role !== Role.Author) {
        return (
            <Card title="Arxiv hujjatlar">
                <p className="text-slate-500">Arxiv hujjatlar faqat mualliflar uchun.</p>
            </Card>
        );
    }

    const filtered = archiveFilter ? archiveItems.filter((it) => it.type === archiveFilter) : archiveItems;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Arxiv hujjatlar</h1>
                <p className="text-slate-500 mt-1">
                    Nashr sertifikatlari, UDK ma&apos;lumotnomalar, taqriz natijalari, DOI va antiplagiat tekshiruvlari shu yerga avtomatik yig&apos;iladi.
                    Muallif yuborgan dastlabki fayl (docx) bu ro&apos;yxatda ko&apos;rinmaydi.
                </p>
            </div>

            <Card title="">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                    </div>
                ) : archiveItems.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <FileText className="h-14 w-14 mx-auto mb-3 opacity-50" />
                        <p className="text-lg">Hozircha arxiv hujjatlari yo&apos;q.</p>
                        <p className="text-sm mt-2 max-w-md mx-auto">
                            Maqola PDFlari, antiplagiat tekshiruvlari, UDK buyurtmalari va taqrizlar shu yerda ko&apos;rinadi.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <Filter className="h-4 w-4 text-slate-500" />
                            <select
                                value={archiveFilter}
                                onChange={(e) => setArchiveFilter(e.target.value)}
                                className="bg-slate-100/70 border border-slate-200/90 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                            >
                                <option value="">Barcha turi</option>
                                {Object.entries(ARCHIVE_TYPE_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-200/90">
                                        <th className="pb-2 text-sm font-medium text-slate-500">Tur</th>
                                        <th className="pb-2 text-sm font-medium text-slate-500">Nomi / ma&apos;lumot</th>
                                        <th className="pb-2 text-sm font-medium text-slate-500 hidden md:table-cell">Natija</th>
                                        <th className="pb-2 text-sm font-medium text-slate-500 hidden sm:table-cell">Sana</th>
                                        <th className="pb-2 text-sm font-medium text-slate-500 w-32">Amallar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((it) => {
                                        const typeLabel = archiveTypeLabel(it);
                                        const statusLabel = archiveStatusLabel(it);
                                        return (
                                        <tr key={it.id} className="border-b border-white/5 hover:bg-slate-100/70 align-top">
                                            <td className="py-3 text-sm text-blue-900 whitespace-nowrap font-medium">
                                                {typeLabel}
                                            </td>
                                            <td className="py-3 text-slate-900 max-w-[280px]">
                                                <p className="truncate font-medium" title={it.title}>{it.title}</p>
                                                {statusLabel && (
                                                    <p className="text-xs text-slate-500 mt-0.5">{statusLabel}</p>
                                                )}
                                                {it.type === 'plagiarism_check' && it.extra && (
                                                    <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                                                        {it.extra.certificate_number && (
                                                            <p>Sertifikat № {String(it.extra.certificate_number)}</p>
                                                        )}
                                                        {it.extra.document_type && (
                                                            <p>Turi: {String(it.extra.document_type)}</p>
                                                        )}
                                                        {typeof it.extra.sources_count === 'number' && (
                                                            <p>{it.extra.sources_count} ta manba tekshirildi</p>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 text-sm hidden md:table-cell">
                                                {it.type === 'plagiarism_check' && it.extra ? (
                                                    <div className="text-xs space-y-1">
                                                        <p><span className="text-slate-500">Originallik:</span>{' '}
                                                            <strong className="text-emerald-700">{formatPercent(it.extra.originality_percentage)}</strong></p>
                                                        <p><span className="text-slate-500">O&apos;zlashtirish:</span>{' '}
                                                            <strong className="text-red-700">{formatPercent(it.extra.plagiarism_percentage)}</strong></p>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 text-sm text-slate-500 hidden sm:table-cell whitespace-nowrap">
                                                {it.date ? new Date(it.date).toLocaleDateString('uz-UZ') : '—'}
                                            </td>
                                            <td className="py-3 whitespace-nowrap">
                                                {it.type === 'plagiarism_check' && it.view_url ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleView(it)}
                                                        className="inline-flex items-center gap-1 text-sm text-blue-800 hover:text-blue-700 font-medium"
                                                    >
                                                        <ExternalLink className="h-4 w-4" /> Ko&apos;rish
                                                    </button>
                                                ) : it.download_url ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleArchiveDownload(it)}
                                                        className="inline-flex items-center gap-1 text-sm text-blue-800 hover:text-blue-700"
                                                    >
                                                        <Download className="h-4 w-4" /> Yuklab olish
                                                    </button>
                                                ) : it.view_url ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleView(it)}
                                                        className="inline-flex items-center gap-1 text-sm text-blue-800 hover:text-blue-700"
                                                    >
                                                        <ExternalLink className="h-4 w-4" /> Ko&apos;rish
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );})}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-slate-500 mt-3">Jami: {filtered.length} ta hujjat</p>
                    </>
                )}
            </Card>
        </div>
    );
};

export default ArxivHujjatlar;
