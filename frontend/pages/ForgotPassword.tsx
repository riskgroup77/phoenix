import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { ArrowLeft, Mail, Phone, Copy, Check } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_TELEGRAM } from '../config/env';
import { toast } from 'react-toastify';

/**
 * Parol tiklash: avtomatik API hozircha yo'q — foydalanuvchi qo'llab-quvvatlashga murojaat qiladi.
 */
const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState(false);

  const supportMessage = `Assalomu alaykum. Parolni tiklash uchun yordam kerak.${
    phone.trim() ? ` Telefon: ${phone.trim()}` : ''
  }`;

  const copySupportMessage = async () => {
    try {
      await navigator.clipboard.writeText(supportMessage);
      setCopied(true);
      toast.success('Xabar nusxalandi — qo\'llab-quvvatlashga yuboring');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Nusxalash muvaffaqiyatsiz');
    }
  };

  return (
    <AuthLayout title="Parolni tiklash">
      <Card>
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Mail className="h-7 w-7 text-blue-800" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-4 mb-2">Parolni unutdingizmi?</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Hozircha self-service parol tiklash mavjud emas. Quyidagi ma&apos;lumotlarni yuborib,
              administrator parolingizni qayta o&apos;rnatishda yordam beradi.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Ro&apos;yxatdan o&apos;tgan telefon raqamingiz
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="998901234567"
              className="w-full"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3 text-sm">
            <div className="flex items-start gap-2 text-slate-700">
              <Phone className="w-4 h-4 mt-0.5 shrink-0 text-blue-700" />
              <span>
                Telefon:{' '}
                <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} className="text-blue-800 hover:underline">
                  {SUPPORT_PHONE}
                </a>
              </span>
            </div>
            <div className="flex items-start gap-2 text-slate-700">
              <Mail className="w-4 h-4 mt-0.5 shrink-0 text-blue-700" />
              <span>
                Email:{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-800 hover:underline">
                  {SUPPORT_EMAIL}
                </a>
              </span>
            </div>
            {SUPPORT_TELEGRAM ? (
              <div className="text-slate-700">
                Telegram:{' '}
                <a href={SUPPORT_TELEGRAM} target="_blank" rel="noreferrer" className="text-blue-800 hover:underline">
                  {SUPPORT_TELEGRAM}
                </a>
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full flex items-center justify-center gap-2"
            onClick={copySupportMessage}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Nusxalandi' : 'Murojaat matnini nusxalash'}
          </Button>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="primary"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft className="h-4 w-4" />
              Kirish sahifasiga qaytish
            </Button>
            <Link to="/register" className="text-sm text-blue-800 hover:text-blue-700 text-center">
              Yangi hisob yaratish
            </Link>
          </div>
        </div>
      </Card>
    </AuthLayout>
  );
};

export default ForgotPassword;
