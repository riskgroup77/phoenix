import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { DollarSign, TrendingUp, Edit2, Save, X, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

interface ServicePrice {
    id: number;
    service_key: string;
    amount: number;
    currency: string;
    label: string;
    updated_at: string;
}

interface JournalPrice {
    id: string;
    name: string;
    issn?: string;
    publicationFee: number;
    pricePerPage: number;
    pricingType: string;
    category_name?: string;
}

const Prices: React.FC = () => {
    const { user } = useAuth();
    const [servicePrices, setServicePrices] = useState<ServicePrice[]>([]);
    const [journalPrices, setJournalPrices] = useState<JournalPrice[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'services' | 'journals'>('services');
    const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
    const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<any>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user || user.role !== 'super_admin') return;
        loadAllPrices();
    }, [user]);

    const loadAllPrices = async () => {
        setLoading(true);
        try {
            const [serviceData, journalData] = await Promise.all([
                apiService.udc.servicePrices.list(),
                apiService.journals.list(),
            ]);
            const servicesList = Array.isArray(serviceData) ? serviceData : (serviceData?.results || serviceData?.data || []);
            const journalsList = Array.isArray(journalData) ? journalData : (journalData?.results || journalData?.data || []);
            setServicePrices(servicesList);
            setJournalPrices(journalsList);
        } catch (error) {
            console.error('Failed to load prices:', error);
            toast.error('Narxlarni yuklashda xatolik');
        } finally {
            setLoading(false);
        }
    };

    const handleEditService = (price: ServicePrice) => {
        setEditingServiceId(price.id);
        setEditValues(prev => ({ ...prev, [price.id]: Number(price.amount) }));
    };

    const handleEditJournal = (journal: JournalPrice) => {
        setEditingJournalId(journal.id);
        setEditValues(prev => ({
            ...prev,
            [journal.id]: {
                publicationFee: Number(journal.publicationFee),
                pricePerPage: Number(journal.pricePerPage),
            }
        }));
    };

    const handleSaveService = async (id: number) => {
        const newAmount = editValues[id];
        if (!newAmount || newAmount < 0) {
            toast.warning('Narx 0 dan katta bo\'lishi kerak');
            return;
        }

        setSaving(true);
        try {
            await apiService.udc.servicePrices.update(id, { amount: newAmount });
            toast.success('Xizmat narxi muvaffaqiyatli yangilandi');
            setEditingServiceId(null);
            loadAllPrices();
        } catch (error: any) {
            toast.error(error?.message || 'Narxni saqlashda xatolik');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveJournal = async (id: string) => {
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
            setEditingJournalId(null);
            loadAllPrices();
        } catch (error: any) {
            toast.error(error?.message || 'Narxlarni saqlashda xatolik');
        } finally {
            setSaving(false);
        }
    };

    const formatPrice = (amount: number) => {
        return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
    };

    const getServiceCategory = (serviceKey: string) => {
        if (serviceKey.includes('udk')) return 'UDK Xizmatlari';
        if (serviceKey.includes('plagiarism')) return 'Antiplagiat';
        if (serviceKey.includes('doi')) return 'DOI Xizmatlari';
        if (serviceKey.includes('article_sample')) return 'Maqola Namuna';
        if (serviceKey.includes('translation')) return 'Tarjima Xizmatlari';
        if (serviceKey.includes('book')) return 'Kitob Nashr';
        if (serviceKey.includes('fast_track')) return 'Fast Track';
        if (serviceKey.includes('language_editing')) return 'Tahrir Qilish';
        if (serviceKey.includes('publication_fee')) return 'Nashr To\'lovlari';
        return 'Boshqa Xizmatlar';
    };

    const groupServicesByCategory = () => {
        const grouped: Record<string, ServicePrice[]> = {};
        servicePrices.forEach(price => {
            const category = getServiceCategory(price.service_key);
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(price);
        });
        return grouped;
    };

    if (!user || user.role !== 'super_admin') {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Bu sahifaga faqat bosh administrator kirishi mumkin.</p>
            </div>
        );
    }

    const groupedServices = groupServicesByCategory();

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-green-500/20">
                            <DollarSign className="h-6 w-6 text-emerald-800" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Barcha Narxlar</h1>
                            <p className="text-sm text-slate-500">
                                Xizmat va jurnal narxlarini boshqarish
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-slate-200/90">
                    <button
                        onClick={() => setActiveTab('services')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'services'
                                ? 'text-emerald-800 border-b-2 border-green-400'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        Xizmat Narxlari ({servicePrices.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('journals')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'journals'
                                ? 'text-blue-800 border-b-2 border-blue-400'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        Jurnal Narxlari ({journalPrices.length})
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-800" />
                    </div>
                ) : (
                    <>
                        {/* Service Prices Tab */}
                        {activeTab === 'services' && (
                            <div className="space-y-6">
                                {Object.entries(groupedServices).map(([category, categoryPrices]) => (
                                    <div key={category}>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                            {category}
                                            <span className="text-xs px-2 py-1 rounded bg-white/10 text-slate-600">
                                                {categoryPrices.length} ta xizmat
                                            </span>
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {categoryPrices.map((price) => (
                                                <div
                                                    key={price.id}
                                                    className="p-4 rounded-xl bg-slate-100/70 border border-slate-200/90 hover:border-green-500/30 transition-colors"
                                                >
                                                    <div className="mb-3">
                                                        <p className="text-sm font-medium text-slate-600">{price.label}</p>
                                                        <p className="text-xs text-slate-500 mt-1">{price.service_key}</p>
                                                    </div>
                                                    
                                                    {editingServiceId === price.id ? (
                                                        <div className="space-y-3">
                                                            <input
                                                                type="number"
                                                                value={editValues[price.id] || 0}
                                                                onChange={(e) => setEditValues(prev => ({
                                                                    ...prev,
                                                                    [price.id]: Number(e.target.value)
                                                                }))}
                                                                className="w-full px-3 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 focus:ring-2 focus:ring-green-500"
                                                                min="0"
                                                                step="1000"
                                                            />
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    onClick={() => handleSaveService(price.id)}
                                                                    disabled={saving}
                                                                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
                                                                >
                                                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                                    Saqlash
                                                                </Button>
                                                                <Button
                                                                    variant="secondary"
                                                                    onClick={() => setEditingServiceId(null)}
                                                                    className="flex items-center gap-2"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-lg font-bold text-emerald-800">
                                                                    {formatPrice(price.amount)}
                                                                </p>
                                                                <p className="text-xs text-slate-500 mt-1">
                                                                    {new Date(price.updated_at).toLocaleDateString('uz-UZ')}
                                                                </p>
                                                            </div>
                                                            <Button
                                                                variant="secondary"
                                                                onClick={() => handleEditService(price)}
                                                                className="p-2"
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Journal Prices Tab */}
                        {activeTab === 'journals' && (
                            <div className="space-y-4">
                                {journalPrices.map((journal) => (
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
                                        </div>
                                        
                                        {editingJournalId === journal.id ? (
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
                                                        onClick={() => handleSaveJournal(journal.id)}
                                                        disabled={saving}
                                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                                                    >
                                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                        Saqlash
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() => setEditingJournalId(null)}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <X className="h-4 w-4" />
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
                                                    onClick={() => handleEditJournal(journal)}
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
                    </>
                )}
            </Card>
        </div>
    );
};

export default Prices;
