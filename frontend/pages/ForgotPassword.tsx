import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { ArrowLeft, KeyRound, Mail, Phone, Send, Loader2 } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '../config/env';
import { apiService } from '../services/apiService';
import { useT } from '../i18n/LanguageContext';

/**
 * Parolni tiklash — Telegram orqali (bepul): raqam kiritiladi → bot ochiladi → «Raqamni ulashish» →
 * bot bir martalik havola yuboradi → yangi parol o'rnatiladi (#/reset-password/<token>).
 */
const ForgotPassword: React.FC = () => {
  const { t } = useT();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiService.auth.passwordResetStart(phone);
      setLink(res.deep_link);
      window.open(res.deep_link, '_blank', 'noopener');
    } catch (err: any) {
      setError(err?.message || t("So'rovni yuborib bo'lmadi"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t('Parolni tiklash')}>
      <Card>
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center">
              <KeyRound className="h-7 w-7 text-blue-800" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">{t('Parolni unutdingizmi?')}</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              {t("Telegram orqali bir daqiqada tiklang: raqamingizni kiriting, botda «📱 Raqamni ulashish» tugmasini bosing — bot yangi parol o'rnatish havolasini yuboradi.")}
            </p>
          </div>

          {!link ? (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="reset-phone" className="block text-sm font-medium text-slate-600 mb-2">
                  {t("Ro'yxatdan o'tgan telefon raqamingiz")}
                </label>
                <input
                  id="reset-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="90 123 45 67"
                  className="w-full"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
              <Button type="submit" className="w-full flex items-center justify-center gap-2" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                {t('Telegram orqali tiklash')}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
                <li>{t("Telegram'da bot ochildi (ochilmagan bo'lsa — pastdagi tugmani bosing).")}</li>
                <li>{t('«📱 Raqamni ulashish» tugmasini bosing.')}</li>
                <li>{t("Bot yuborgan havolani ochib, yangi parol o'rnating (havola 30 daqiqa amal qiladi).")}</li>
              </ol>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="milliy-btn-primary w-full inline-flex items-center justify-center gap-2"
              >
                <Send className="h-4 w-4" aria-hidden /> {t('Telegram botni ochish')}
              </a>
              <button type="button" onClick={() => setLink('')} className="text-sm text-blue-800 hover:underline w-full">
                {t('Boshqa raqam kiritish')}
              </button>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-2 text-sm">
            <p className="text-slate-600">{t("Telegram'dan foydalanmasangiz — qo'llab-quvvatlash xizmati yordam beradi:")}</p>
            <div className="flex items-start gap-2 text-slate-700">
              <Phone className="w-4 h-4 mt-0.5 shrink-0 text-blue-700" aria-hidden />
              <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} className="text-blue-800 hover:underline">{SUPPORT_PHONE}</a>
            </div>
            <div className="flex items-start gap-2 text-slate-700">
              <Mail className="w-4 h-4 mt-0.5 shrink-0 text-blue-700" aria-hidden />
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-800 hover:underline break-all">{SUPPORT_EMAIL}</a>
            </div>
          </div>

          <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-blue-800 hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden /> {t('Kirish sahifasiga qaytish')}
          </Link>
        </div>
      </Card>
    </AuthLayout>
  );
};

export default ForgotPassword;
