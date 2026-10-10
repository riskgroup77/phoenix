import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { apiService } from '../services/apiService';
import { useT } from '../i18n/LanguageContext';

/** Telegram bot yuborgan bir martalik havola: #/reset-password/<token> — yangi parol o'rnatish. */
const ResetPassword: React.FC = () => {
  const { t } = useT();
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(t("Parol kamida 8 belgidan iborat bo'lsin."));
      return;
    }
    if (password !== confirm) {
      setError(t('Parollar bir xil emas.'));
      return;
    }
    setLoading(true);
    try {
      await apiService.auth.passwordResetConfirm(token, password, confirm);
      setDone(true);
      toast.success(t('Parol yangilandi'));
      window.setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(err?.message || t("Parolni yangilab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t('Yangi parol')}>
      <Card>
        {done ? (
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-700 mx-auto" aria-hidden />
            <p className="font-semibold text-slate-900">{t('Parol yangilandi')}</p>
            <p className="text-sm text-slate-500">{t('Boshqa qurilmalardagi sessiyalar yopildi. Yangi parol bilan kiring.')}</p>
            <Link to="/login" className="milliy-btn-primary inline-flex">{t('Kirish')}</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center">
                <KeyRound className="h-7 w-7 text-blue-800" aria-hidden />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-4">{t("Yangi parol o'rnating")}</h2>
            </div>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-slate-600 mb-2">{t('Yangi parol')}</label>
              <input id="new-password" type="password" autoComplete="new-password" className="w-full" value={password}
                onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <div>
              <label htmlFor="new-password-2" className="block text-sm font-medium text-slate-600 mb-2">{t('Parolni takrorlang')}</label>
              <input id="new-password-2" type="password" autoComplete="new-password" className="w-full" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
            </div>
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            <Button type="submit" className="w-full flex items-center justify-center gap-2" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {t('Parolni saqlash')}
            </Button>
            <Link to="/forgot-password" className="block text-center text-sm text-blue-800 hover:underline">
              {t('Havola eskirganmi? Qaytadan boshlash')}
            </Link>
          </form>
        )}
      </Card>
    </AuthLayout>
  );
};

export default ResetPassword;
