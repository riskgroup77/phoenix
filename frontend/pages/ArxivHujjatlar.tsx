import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';
import { Download, FileText, ExternalLink, Filter } from 'lucide-react';
import { apiService } from '../services/apiService';
import { toast } from 'react-toastify';
import { Role } from '../types';

const ARCHIVE_TYPE_LABELS: Record<string, string> = {
    article_pdf: 'Maqola PDF',
    article_sample_order: 'Maqola yozish buyurtmasi',
    udk_certificate: "UDK ma'lumotnoma",
    udk_standalone: "UDK ma'lumotnoma",
    udk_request_order: 'UDK buyurtmasi',
    publication_certificate: "Nashr sertifikati",
    review_result: "Taqriz natijasi",
    doi_link: "DOI raqami",
};

type ArchiveItem = {
    type: string;
    id: string;
    title: string;
    label: string;
    date: string | null;
    download_url: string | null;
    view_url?: string;
    extra?: Record<string, unknown>;
};

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

    const handleArchiveDownload = useCallback(
        async (item: ArchiveItem) => {
            const url = item.download_url;
            if (!url) {
                if (item.view_url) {
                    if (item.view_url.startsWith('http')) {
                        window.open(item.view_url, '_blank', 'noopener');
                    } else {
                        navigate(item.view_url);
                    }
                }
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
        [navigate]
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
                    Barcha maqolalar, UDK ma&apos;lumotnomalar, nashr sertifikatlari va taqriz natijalari shu yerga avtomatik yig&apos;iladi.
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
                            Maqola PDFlari, UDK buyurtmalari (to&apos;lovdan keyin), tayyor ma&apos;lumotnomalar va taqrizlar shu yerda ko&apos;rinadi. UDK bo&apos;yicha avval
                            &quot;Taqrizchida&quot;, keyin PDF yuklab olish paydo bo&apos;ladi.
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
                                        <th className="pb-2 text-sm font-medium text-slate-500">Nomi</th>
                                        <th className="pb-2 text-sm font-medium text-slate-500 hidden sm:table-cell">Sana</th>
                                        <th className="pb-2 text-sm font-medium text-slate-500 w-32">Amallar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((it) => (
                                        <tr key={it.id} className="border-b border-white/5 hover:bg-slate-100/70">
                                            <td className="py-3 text-sm text-blue-900">{it.label || ARCHIVE_TYPE_LABELS[it.type] || it.type}</td>
                                            <td className="py-3 text-slate-900 truncate max-w-[200px] sm:max-w-none" title={it.title}>{it.title}</td>
                                            <td className="py-3 text-sm text-slate-500 hidden sm:table-cell">
                                                {it.date ? new Date(it.date).toLocaleDateString('uz-UZ') : '—'}
                                            </td>
                                            <td className="py-3">
                                                {it.download_url ? (
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
                                                        onClick={() => navigate(it.view_url!)}
                                                        className="inline-flex items-center gap-1 text-sm text-blue-800 hover:text-blue-700"
                                                    >
                                                        <ExternalLink className="h-4 w-4" /> Ko&apos;rish
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ))}
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
