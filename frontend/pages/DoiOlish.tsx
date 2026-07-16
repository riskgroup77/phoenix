import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { paymentService } from '../services/paymentService';
import { Bot, Upload, Loader2, FileText } from 'lucide-react';
import { toast } from 'react-toastify';

const DoiOlish: React.FC = () => {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchPrice = async () => {
      try {
        const res = await apiService.doi.price();
        setAmount(Number((res as { amount?: number })?.amount ?? 0));
      } catch {
        setAmount(0);
      } finally {
        setLoading(false);
      }
    };
    fetchPrice();
  }, [user]);

  useEffect(() => {
    if (user?.firstName && !firstName) setFirstName(user.firstName || '');
    if (user?.lastName && !lastName) setLastName(user.lastName || '');
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      toast.warning('Ism va familyani kiriting.');
      return;
    }
    if (!file) {
      toast.warning('Maqola faylini tanlang (DOC yoki PDF).');
      return;
    }
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.doc') && !name.endsWith('.docx') && !name.endsWith('.pdf')) {
      toast.warning('Faqat DOC, DOCX yoki PDF fayllar qabul qilinadi.');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('first_name', fn);
      formData.append('last_name', ln);
      formData.append('file', file);
      const res = (await apiService.doi.request(formData)) as {
        fulfilled?: boolean;
        message?: string;
        transaction_id?: string;
      };
      if (res?.fulfilled) {
        toast.success(res?.message || 'So\'rov taqrizchiga yuborildi. DOI link tayyor bo\'lgach bildirishnoma orqali xabar beramiz.');
        setFirstName('');
        setLastName('');
        setFile(null);
        return;
      }
      if (res?.transaction_id) {
        paymentService.redirectToPaymentPage(res.transaction_id);
        return;
      }
      toast.error('So\'rov yuborishda xatolik.');
    } catch (err: any) {
      toast.error(err?.message || 'So\'rov yuborishda xatolik.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  const inputClass = 'w-full px-4 py-2 rounded-lg bg-slate-100/70 border border-slate-200/90 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-cyan-500/20">
            <Bot className="h-6 w-6 text-cyan-800" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">DOI Raqami Olish</h1>
            <p className="text-sm text-slate-500">
              Maqolangiz uchun unikal raqamli obyekt identifikatorini (DOI) ro'yxatdan o'tkazish. Ma'lumotlarni kiriting va to'lovni amalga oshiring; so'rov taqrizchiga yuboriladi, DOI link tayyor bo'lgach arxivda ko'rinadi va bildirishnoma keladi.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500">Yuklanmoqda…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Ism *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                  placeholder="Ism"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Familya *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                  placeholder="Familya"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Maqola fayli (DOC yoki PDF) *</label>
              <label className="flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-lg border-slate-300/80 bg-slate-100/70 hover:bg-white/10 cursor-pointer transition-colors">
                <Upload className="w-10 h-10 text-slate-500 mb-2" />
                <span className="text-sm text-slate-500">
                  {file ? file.name : 'Faylni tanlang yoki shu yerga tortib tashlang'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".doc,.docx,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="p-4 rounded-lg bg-slate-100/70 border border-slate-200/90">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-cyan-800">Narx:</span> {amount.toLocaleString()} so'm
              </p>
              <p className="text-xs text-slate-500 mt-1">
                To'lovdan keyin so'rov taqrizchiga yuboriladi. Taqrizchi DOI raqamini olib linkni yuklaydi; link arxivingizda va bildirishnomada chiqadi.
              </p>
            </div>

            <Button
              type="submit"
              variant="cyan"
              disabled={submitting || !firstName.trim() || !lastName.trim() || !file}
              className="w-full sm:min-w-[240px] sm:w-auto mt-1"
            >
              {submitting ? (
                <><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Yuborilmoqda…</>
              ) : (
                <><FileText className="inline h-4 w-4 mr-2" />To'lov va so'rov yuborish</>
              )}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};

export default DoiOlish;
