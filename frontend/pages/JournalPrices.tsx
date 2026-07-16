import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { DollarSign, Edit2, Save, X, Loader2, TrendingUp } from 'lucide-react';
import { toast } from 'react-toastify';

interface JournalPrice {
    id: string;
    name: string;
    issn?: string;
    publicationFee: number;
    pricePerPage: number;
    pricingType: string;
    category_name?: string;
}

const JournalPrices: React.FC = () => {
    const { user } = useAuth();
    const [prices, setPrices] = useState<JournalPrice[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Record<string, { publicationFee: number; pricePerPage: number }>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user || user.role !== 'super_admin') return;
        loadPrices();
    }, [user]);

    const loadPrices = async () => {
        setLoading(true);
        try {
            const data = await apiService.journals.list();
            const journalsList = Array.isArray(data) ? data : (data?.results || data?.data || []);
            setPrices(journalsList);
        } catch (error) {
            console.error('Failed to load journal prices:', error);
            toast.error('Jurnal narxlarini yuklashda xatolik');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (journal: JournalPrice) => {
        setEditingId(journal.id);
        setEditValues(prev => ({
            ...prev,
            [journal.id]: {
                publicationFee: Number(journal.publicationFee),
                pricePerPage: Number(journal.pricePerPage),
            }
        }));
    };

    const handleCancel = () => {
        setEditingId(null);
    };

    const handleSave = async (id: string) => {
        const values = editValues[id];
        if (!values || values.publicationFee < 0 || values.pricePerPage < 0) {
            toast.warning('Narxlar 0 dan katta bo\'lishi kerak');
            return;
        }

        setSaving(true);
        try {
            await apiService.journals.update(id, {
                publicationFee: values.publicationFee,
                pricePerPage: values.pricePerPage,
            });
            toast.success('Jurnal narxlari muvaffaqiyatli yangilandi');
            setEditingId(null);
            loadPrices();
        } catch (error: any) {
            toast.error(error?.message || 'Narxlarni saqlashda xatolik');
        } finally {
            setSaving(false);
        }
    };

    const formatPrice = (amount: number) => {
        return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
    };

    if (!user || user.role !== 'super_admin') {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Bu sahifaga faqat bosh administrator kirishi mumkin.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-500/20">
                            <TrendingUp className="h-6 w-6 text-blue-800" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Jurnal Narxlari</h1>
                            <p className="text-sm text-slate-500">
                                Barcha jurnallar narxlarini boshqarish
                            </p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-800" />
                    </div>
                ) : prices.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">Hozircha jurnallar yo'q.</p>
                ) : (
                    <div className="space-y-4">
                        {prices.map((journal) => (
                            <div
                                key={journal.id}
                                className="p-4 rounded-xl bg-slate-100/70 border border-slate-200/90 hover:border-blue-500/30 transition-colors"
                            >
                                <div className="mb-3">
                                    <div className="flex items-center gap-2">
                                        <p className="text-lg font-semibold text-slate-900">{journal.name}</p>
                                        {journal.issn && (
                                            <span className="text-xs px-2 py-1 rounded bg-white/10 text-slate-600">
                                                ISSN: {journal.issn}
                                            </span>
                                        )}
                                    </div>
                                    {journal.category_name && (
                                        <p className="text-sm text-slate-500 mt-1">Kategoriya: {journal.category_name}</p>
                                    )}
                                    <p className="text-xs text-slate-500 mt-1">
                                        Narx turi: {journal.pricingType === 'fixed' ? 'Sabit' : 'Dinamik'}
                                    </p>
                                </div>
                                
                                {editingId === journal.id ? (
                                    <div className="space-y-3 p-4 rounded-lg bg-slate-100/70">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-500 mb-1">
                                                    Nashr qilish to'lovi
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editValues[journal.id]?.publicationFee || 0}
                                                    onChange={(e) => setEditValues(prev => ({
                                                        ...prev,
                                                        [journal.id]: {
                                                            ...prev[journal.id],
                                                            publicationFee: Number(e.target.value)
                                                        }
                                                    }))}
                                                    className="w-full px-3 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 focus:ring-2 focus:ring-blue-500"
                                                    min="0"
                                                    step="1000"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-500 mb-1">
                                                    Bet narxi
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editValues[journal.id]?.pricePerPage || 0}
                                                    onChange={(e) => setEditValues(prev => ({
                                                        ...prev,
                                                        [journal.id]: {
                                                            ...prev[journal.id],
                                                            pricePerPage: Number(e.target.value)
                                                        }
                                                    }))}
                                                    className="w-full px-3 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 focus:ring-2 focus:ring-blue-500"
                                                    min="0"
                                                    step="1000"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleSave(journal.id)}
                                                disabled={saving}
                                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                                            >
                                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                Saqlash
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                onClick={handleCancel}
                                                className="flex items-center gap-2"
                                            >
                                                <X className="h-4 w-4" />
                                                Bekor qilish
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Nashr qilish to'lovi</p>
                                                <p className="text-lg font-bold text-emerald-800">
                                                    {formatPrice(journal.publicationFee)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Bet narxi</p>
                                                <p className="text-lg font-bold text-cyan-800">
                                                    {formatPrice(journal.pricePerPage)}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="secondary"
                                            onClick={() => handleEdit(journal)}
                                            className="ml-4"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default JournalPrices;
