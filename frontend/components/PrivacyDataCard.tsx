import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from './ui/Card';
import Button from './ui/Button';
import { apiService } from '../services/apiService';
import { getUserFriendlyError } from '../utils/errorHandler';
import { useT } from '../i18n/LanguageContext';

/** Maxfiylik siyosati, 6-bo'lim: ma'lumotlar nusxasini olish va hisobni o'chirish so'rovi. */
const PrivacyDataCard: React.FC = () => {
  const { t } = useT();
  const [exporting, setExporting] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await apiService.auth.myDataExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phoenix-malumotlarim-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t("Ma'lumotlaringiz yuklab olindi."));
    } catch (err) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteRequest = async () => {
    setSending(true);
    try {
      const res = await apiService.auth.accountDeletionRequest(reason.trim());
      toast.success(res?.detail || t("So'rovingiz qabul qilindi."));
      setAskDelete(false);
      setReason('');
    } catch (err) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card title={t("Shaxsiy ma'lumotlar")}>
      <p className="text-sm text-slate-500 mb-3">
        <Link to="/maxfiylik" className="underline text-blue-800">{t('Maxfiylik siyosati')}</Link>{t("ga muvofiq o'z ma'lumotlaringiz nusxasini olishingiz yoki hisobni o'chirishni so'rashingiz mumkin.")}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button type="button" variant="secondary" onClick={handleExport} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" /> {exporting ? t('Tayyorlanmoqda...') : t("Ma'lumotlarimni yuklab olish")}
        </Button>
        {!askDelete && (
          <Button type="button" variant="secondary" onClick={() => setAskDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> {t("Hisobni o'chirish so'rovi")}
          </Button>
        )}
      </div>
      {askDelete && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50/60 p-4 space-y-3">
          <p className="text-sm text-red-900">
            {t("So'rov administratorga yuboriladi va 10 ish kuni ichida ko'rib chiqiladi. To'lov yozuvlari qonunchilikka ko'ra saqlanadi; nashr etilgan maqolalar jurnal arxivida qoladi.")}
          </p>
          <label className="block text-sm text-slate-700">
            {t('Sabab (ixtiyoriy)')}
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="danger" onClick={handleDeleteRequest} disabled={sending}>
              {sending ? t('Yuborilmoqda...') : t("So'rovni yuborish")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAskDelete(false)} disabled={sending}>
              {t('Bekor qilish')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default PrivacyDataCard;
