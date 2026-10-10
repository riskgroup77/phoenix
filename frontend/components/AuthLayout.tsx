import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import GirihPattern from './GirihPattern';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import { useT } from '../i18n/LanguageContext';

const FEATURES = [
  "Maqola yuborish va holatini kuzatish",
  'Antiplagiat tekshiruvi va sertifikat',
  "UDK, DOI, tarjima va kitob nashri xizmatlari",
];

/** "Milliy zamonaviy" kirish sahifasi: chapda lojuvard panel (girih naqshi), o'ngda forma. */
const AuthLayout: React.FC<{ children: React.ReactNode; title: string }> = ({ children }) => {
  const { t } = useT();
  return (
    <div className="milliy-auth">
      <aside className="milliy-auth-aside">
        <GirihPattern opacity={0.12} />
        <Link to="/" className="milliy-brand">
          <span className="milliy-brand-mark" aria-hidden="true">P</span>
          <span className="flex flex-col">
            <span className="milliy-brand-title">Phoenix</span>
            <span className="milliy-brand-sub">{t('Ilmiy nashrlar markazi')}</span>
          </span>
        </Link>

        <div className="flex flex-col gap-5 max-w-md">
          <h1 className="m-0 text-3xl sm:text-4xl font-extrabold leading-tight text-white">
            {t('Ilmiy faoliyatingiz — bir joyda')}
          </h1>
          <p className="m-0 text-base leading-relaxed text-[var(--milliy-band-text)]">
            {t('Jurnallarga maqola yuboring, antiplagiat natijasini oling va kerakli hujjatlarni tez rasmiylashtiring.')}
          </p>
          <ul className="m-0 p-0 list-none hidden sm:flex flex-col gap-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-[15px] font-medium text-white">
                <CheckCircle className="w-5 h-5 mt-0.5 shrink-0 text-[#7fd6da]" aria-hidden />
                {t(f)}
              </li>
            ))}
          </ul>
        </div>

        <p className="m-0 text-xs text-[var(--milliy-band-text)]">
          © {new Date().getFullYear()} Phoenix — {t('Ilmiy nashrlar markazi')}{' · '}
          <Link to="/" className="underline underline-offset-2 text-white/90 hover:text-white">{t('Jurnallar katalogi')}</Link>
          {' · '}
          <Link to="/oferta" className="underline underline-offset-2 text-white/90 hover:text-white">Ommaviy oferta</Link>
          {' · '}
          <Link to="/maxfiylik" className="underline underline-offset-2 text-white/90 hover:text-white">Maxfiylik siyosati</Link>
        </p>
      </aside>

      <main className="milliy-auth-main relative">
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md motion-safe:animate-[phoenix-main-in_0.5s_ease-out_both]">{children}</div>
      </main>
    </div>
  );
};

export default AuthLayout;
