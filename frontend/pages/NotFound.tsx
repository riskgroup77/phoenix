import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Search } from 'lucide-react';
import GirihPattern from '../components/GirihPattern';
import ThemeToggle from '../components/ThemeToggle';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { Role } from '../types';

/** 404 — sahifa topilmadi. Kirgan foydalanuvchi o'z paneliga, mehmon bosh sahifaga qaytadi. */
const NotFound: React.FC = () => {
  const { user } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const home = user ? (user.role === Role.Operator ? '/operator-dashboard' : '/dashboard') : '/';

  const suggestions = user
    ? [
        { to: '/articles', label: 'Maqolalar' },
        { to: '/services', label: 'Xizmatlar' },
        { to: '/profile?tab=profile', label: 'Profil' },
      ]
    : [
        { to: '/', label: 'Jurnallar katalogi' },
        { to: '/login', label: 'Kirish' },
        { to: '/register', label: "Ro'yxatdan o'tish" },
      ];

  return (
    <div className="milliy-landing flex flex-col">
      <section className="milliy-landing-hero flex-1 flex items-center">
        <GirihPattern opacity={0.12} />
        <div className="!absolute top-4 right-4 flex items-center gap-1 z-[1]">
          <LanguageSwitcher variant="band" />
          <ThemeToggle variant="band" />
        </div>
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-16 flex flex-col gap-6">
          <Link to={home} className="milliy-brand self-start">
            <span className="milliy-brand-mark" aria-hidden="true">P</span>
            <span className="flex flex-col">
              <span className="milliy-brand-title">Phoenix</span>
              <span className="milliy-brand-sub">{t('Ilmiy nashrlar markazi')}</span>
            </span>
          </Link>
          <p className="milliy-notfound-code m-0" aria-hidden="true">404</p>
          <div className="flex flex-col gap-3 max-w-xl">
            <h1 className="m-0 text-3xl sm:text-4xl font-extrabold text-white">{t('Sahifa topilmadi')}</h1>
            <p className="m-0 text-base leading-relaxed text-[var(--milliy-band-text)]">
              {t("Siz qidirgan sahifa o'chirilgan, nomi o'zgargan yoki manzil noto'g'ri yozilgan bo'lishi mumkin.")}
            </p>
            <p className="m-0 text-sm text-[var(--milliy-band-text)] break-all opacity-80">
              <code>{location.pathname}</code>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={home} className="milliy-btn-on-band">
              <Home className="w-4 h-4" aria-hidden /> {t('Bosh sahifaga')}
            </Link>
            <button type="button" onClick={() => navigate(-1)} className="milliy-btn-on-band milliy-btn-on-band--ghost">
              <ArrowLeft className="w-4 h-4" aria-hidden /> {t('Orqaga qaytish')}
            </button>
          </div>
        </div>
      </section>
      <section className="milliy-landing-section !py-10 w-full">
        <p className="m-0 mb-3 text-sm font-bold uppercase tracking-wider text-[var(--editorial-muted)] flex items-center gap-2">
          <Search className="w-4 h-4" aria-hidden /> {t('Balki shulardan biri kerakdir')}
        </p>
        <div className="flex flex-wrap gap-3">
          {suggestions.map((s) => (
            <Link key={s.to} to={s.to} className="milliy-btn-secondary">
              {t(s.label)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default NotFound;
