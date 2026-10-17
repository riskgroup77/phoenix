import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ChevronDown, Mail, MessageSquare, Phone, Send } from 'lucide-react';
import EditorialPageHeader from '../components/EditorialPageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_TELEGRAM } from '../config/env';

const TOPICS: { value: string; label: string }[] = [
  { value: 'payment', label: "To'lov" },
  { value: 'article', label: 'Maqola / nashr' },
  { value: 'service', label: 'Xizmatlar' },
  { value: 'account', label: 'Hisob / kirish' },
  { value: 'other', label: 'Boshqa' },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "To'lov qildim, lekin maqola holati o'zgarmadi. Nima qilish kerak?",
    a: "Click to'lovi odatda bir necha soniyada tasdiqlanadi. «To'lovlarim» sahifasida to'lov holatini tekshiring. 15 daqiqadan keyin ham «Kutilmoqda» bo'lsa, quyidagi forma orqali chek raqami bilan yozing.",
  },
  {
    q: 'Maqolani qanday yuboraman?',
    a: "«Maqola yuborish» bo'limida jurnalni tanlang, faylni yuklang, ma'lumotlarni to'ldiring va to'lovni amalga oshiring. To'lovdan keyin maqola jurnal tahririyatiga o'tadi.",
  },
  {
    q: 'Qoralamani tahrirlash yoki o\'chirish mumkinmi?',
    a: "Ha, to'lov qilinmaguncha. «Ishlarim» bo'limida maqolani oching — «Qoralama» kartasida «Tahrirlash» va «O'chirish» tugmalari bor.",
  },
  {
    q: 'Antiplagiat natijasi qachon chiqadi?',
    a: "To'lovdan keyin tekshiruv avtomatik boshlanadi va odatda bir necha daqiqa davom etadi. Natija va sertifikat «Arxiv hujjatlar» bo'limida saqlanadi.",
  },
  {
    q: 'UDK yoki DOI qancha vaqtda tayyor bo\'ladi?',
    a: "So'rov to'lovdan keyin mutaxassisga yuboriladi. Tayyor bo'lgach sizga bildirishnoma keladi, hujjat «Arxiv hujjatlar» bo'limida paydo bo'ladi.",
  },
  {
    q: 'Parolimni unutdim.',
    a: "Kirish sahifasida «Parolni unutdingizmi?» havolasini bosing. Telefon raqamingiz Telegram orqali tasdiqlangan bo'lsa, parolni o'zingiz tiklashingiz mumkin.",
  },
];

const inputCls =
  'mt-1 w-full rounded-lg border border-[var(--editorial-border)] bg-white px-3 py-2 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100';

/** Yordam / Aloqa: aloqa kanallari, murojaat formasi va ko'p beriladigan savollar */
const Help: React.FC = () => {
  const { t } = useT();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', email: '', topic: 'other', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (!user) return;
    const u = user as any;
    setForm((f) => ({
      ...f,
      name: f.name || [u.firstName ?? u.first_name, u.lastName ?? u.last_name].filter(Boolean).join(' '),
      phone: f.phone || u.phone || '',
      email: f.email || u.email || '',
    }));
  }, [user]);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('Ismingizni kiriting.'));
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      toast.error(t('Javob berishimiz uchun telefon yoki email kiriting.'));
      return;
    }
    if (form.message.trim().length < 10) {
      toast.error(t('Murojaat matnini batafsilroq yozing (kamida 10 ta belgi).'));
      return;
    }
    setSending(true);
    try {
      await apiService.support.contact(form);
      setSent(true);
      setForm((f) => ({ ...f, message: '' }));
      toast.success(t('Murojaatingiz qabul qilindi. Tez orada javob beramiz.'));
    } catch (err: any) {
      toast.error(
        err?.status === 429
          ? t("Juda ko'p murojaat yuborildi. Birozdan keyin qayta urinib ko'ring.")
          : err?.message || t("Murojaatni yuborib bo'lmadi. Keyinroq qayta urinib ko'ring."),
      );
    } finally {
      setSending(false);
    }
  };

  const phoneHref = `tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`;
  const telegramHref = SUPPORT_TELEGRAM
    ? SUPPORT_TELEGRAM.startsWith('http') ? SUPPORT_TELEGRAM : `https://t.me/${SUPPORT_TELEGRAM.replace(/^@/, '')}`
    : '';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <EditorialPageHeader
        title={t('Yordam va aloqa')}
        subtitle={t("Savolingiz bormi? Bizga yozing yoki qo'ng'iroq qiling — ish vaqtida tez javob beramiz.")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <a href={phoneHref} className="editorial-card flex items-center gap-3 !p-4 hover:border-[var(--editorial-primary)]/40">
          <span className="milliy-icon-tile"><Phone className="h-5 w-5" aria-hidden /></span>
          <span className="min-w-0">
            <span className="block text-xs text-[var(--editorial-muted)]">{t('Telefon')}</span>
            <span className="block whitespace-nowrap font-semibold text-[var(--editorial-text)]">{SUPPORT_PHONE}</span>
          </span>
        </a>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="editorial-card flex items-center gap-3 !p-4 hover:border-[var(--editorial-primary)]/40">
          <span className="milliy-icon-tile"><Mail className="h-5 w-5" aria-hidden /></span>
          <span className="min-w-0">
            <span className="block text-xs text-[var(--editorial-muted)]">{t('Email')}</span>
            <span className="block break-all font-semibold text-[var(--editorial-text)]">{SUPPORT_EMAIL}</span>
          </span>
        </a>
        {telegramHref ? (
          <a href={telegramHref} target="_blank" rel="noopener noreferrer" className="editorial-card flex items-center gap-3 !p-4 hover:border-[var(--editorial-primary)]/40">
            <span className="milliy-icon-tile"><Send className="h-5 w-5" aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-xs text-[var(--editorial-muted)]">{t('Telegram')}</span>
              <span className="block font-semibold text-[var(--editorial-text)]">{SUPPORT_TELEGRAM}</span>
            </span>
          </a>
        ) : null}
        {user ? (
          <Link to="/articles" className="editorial-card flex items-center gap-3 !p-4 hover:border-[var(--editorial-primary)]/40">
            <span className="milliy-icon-tile"><MessageSquare className="h-5 w-5" aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-xs text-[var(--editorial-muted)]">{t('Operator chat')}</span>
              <span className="block font-semibold text-[var(--editorial-text)]">{t('Maqola sahifasida yozing')}</span>
            </span>
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card title={t('Murojaat yuborish')}>
            {sent && (
              <p className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                {t('Murojaatingiz qabul qilindi. Tez orada javob beramiz.')}
              </p>
            )}
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-[var(--editorial-text)]">
                  {t('Ism familiya *')}
                  <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
                </label>
                <label className="text-sm font-medium text-[var(--editorial-text)]">
                  {t('Mavzu')}
                  <select className={inputCls} value={form.topic} onChange={(e) => set('topic', e.target.value)}>
                    {TOPICS.map((o) => (
                      <option key={o.value} value={o.value}>{t(o.label)}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-[var(--editorial-text)]">
                  {t('Telefon')}
                  <input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" placeholder="+998 90 123 45 67" />
                </label>
                <label className="text-sm font-medium text-[var(--editorial-text)]">
                  {t('Email')}
                  <input className={inputCls} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
                </label>
              </div>
              <label className="text-sm font-medium text-[var(--editorial-text)]">
                {t('Xabar *')}
                <textarea
                  className={inputCls}
                  rows={6}
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  placeholder={t("Muammoni batafsil yozing: qaysi sahifa, nima qildingiz, chek yoki maqola raqami...")}
                />
              </label>
              <p className="m-0 text-xs text-[var(--editorial-muted)]">
                {t("Javob berishimiz uchun telefon yoki emaildan kamida bittasini kiriting.")}
              </p>
              <div>
                <Button type="submit" disabled={sending} className="flex items-center gap-2">
                  <Send className="h-4 w-4" aria-hidden /> {sending ? t('Yuborilmoqda...') : t('Yuborish')}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title={t("Ko'p beriladigan savollar")}>
            <ul className="m-0 flex list-none flex-col p-0">
              {FAQ.map((item, i) => {
                const open = openFaq === i;
                return (
                  <li key={item.q} className="border-b border-[var(--editorial-border)] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      className="flex w-full items-start justify-between gap-3 py-3 text-left text-sm font-semibold text-[var(--editorial-text)]"
                      aria-expanded={open}
                    >
                      <span>{t(item.q)}</span>
                      <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
                    </button>
                    {open && <p className="m-0 pb-3 text-sm leading-relaxed text-[var(--editorial-muted)]">{t(item.a)}</p>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Help;
