import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { DollarSign, Edit2, Save, X, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';

interface ServicePrice {
  id: number;
  service_key: string;
  amount: number;
  currency: string;
  label: string;
  updated_at: string;
}

const PriceManagement: React.FC = () => {
  const { user } = useAuth();
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newService, setNewService] = useState({
    service_key: '',
    label: '',
    amount: 0,
  });

  useEffect(() => {
    if (!user || user.role !== 'super_admin') return;
    loadPrices();
  }, [user]);

  const loadPrices = async () => {
    setLoading(true);
    try {
      const data = await apiService.udc.servicePrices.list();
      const pricesList = Array.isArray(data) ? data : (data?.results || data?.data || []);
      setPrices(pricesList);
    } catch (error) {
      console.error('Failed to load service prices:', error);
      toast.error('Narxlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (price: ServicePrice) => {
    setEditingId(price.id);
    setEditValues(prev => ({ ...prev, [price.id]: Number(price.amount) }));
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleSave = async (id: number) => {
    const newAmount = editValues[id];
    if (!newAmount || newAmount < 0) {
      toast.warning('Narx 0 dan katta bo\'lishi kerak');
      return;
    }

    setSaving(true);
    try {
      await apiService.udc.servicePrices.update(id, { amount: newAmount });
      toast.success('Narx muvaffaqiyatli yangilandi');
      setEditingId(null);
      loadPrices();
    } catch (error: any) {
      toast.error(error?.message || 'Narxni saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNew = async () => {
    if (!newService.service_key || !newService.label || !newService.amount) {
      toast.warning('Barcha maydonlarni to\'ldiring');
      return;
    }

    setSaving(true);
    try {
      await apiService.udc.servicePrices.create(newService);
      toast.success('Yangi xizmat qo\'shildi');
      setShowAddModal(false);
      setNewService({ service_key: '', label: '', amount: 0 });
      loadPrices();
    } catch (error: any) {
      toast.error(error?.message || 'Xizmat qo\'shishda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu xizmatni o\'chirmoqchimisiz?')) return;

    try {
      await apiService.udc.servicePrices.delete(id);
      toast.success('Xizmat o\'chirildi');
      loadPrices();
    } catch (error: any) {
      toast.error(error?.message || 'O\'chirishda xatolik');
    }
  };

  const formatPrice = (amount: number, currency: string = 'UZS') => {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' ' + currency;
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

  const groupByCategory = () => {
    const grouped: Record<string, ServicePrice[]> = {};
    prices.forEach(price => {
      const category = getServiceCategory(price.service_key);
      if (!grouped[category]) {
        grouped[category] = [];
      }
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

  const groupedPrices = groupByCategory();

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-500/20">
              <DollarSign className="h-6 w-6 text-emerald-800" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Xizmat Narxlari</h1>
              <p className="text-sm text-slate-500">
                Barcha pullik xizmatlar narxlarini boshqarish
              </p>
            </div>
          </div>
          <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Yangi Xizmat
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-800" />
          </div>
        ) : prices.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Hozircha xizmatlar yo'q.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedPrices).map(([category, categoryPrices]) => (
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
                      
                      {editingId === price.id ? (
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
                              onClick={() => handleSave(price.id)}
                              disabled={saving}
                              className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
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
                          <div>
                            <p className="text-lg font-bold text-emerald-800">
                              {formatPrice(price.amount, price.currency)}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Oxirgi yangilanish: {new Date(price.updated_at).toLocaleDateString('uz-UZ')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => handleEdit(price)}
                              className="p-2"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => handleDelete(price.id)}
                              className="p-2 text-red-700 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add New Service Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/35 flex items-center justify-center z-50 p-4">
          <div className="bg-white/55 rounded-xl p-6 max-w-md w-full border border-slate-200/90">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Yangi Xizmat Qo'shish</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Xizmat Kodi (service_key) *</label>
                <input
                  type="text"
                  value={newService.service_key}
                  onChange={(e) => setNewService(prev => ({ ...prev, service_key: e.target.value }))}
                  placeholder="masalan: custom_service"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Xizmat Nomi *</label>
                <input
                  type="text"
                  value={newService.label}
                  onChange={(e) => setNewService(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Masalan: Maxsus xizmat"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Narx (so'm) *</label>
                <input
                  type="number"
                  value={newService.amount}
                  onChange={(e) => setNewService(prev => ({ ...prev, amount: Number(e.target.value) }))}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 focus:ring-2 focus:ring-green-500"
                  min="0"
                  step="1000"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={() => setShowAddModal(false)}
                className="flex-1"
              >
                Bekor qilish
              </Button>
              <Button
                onClick={handleAddNew}
                disabled={saving || !newService.service_key || !newService.label || !newService.amount}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Qo\'shish'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceManagement;
