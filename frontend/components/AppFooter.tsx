import React from 'react';
import { Link } from 'react-router-dom';
import { LegalLinks } from './LegalLinks';
import { useT } from '../i18n/LanguageContext';

const AppFooter: React.FC = () => {
  const { t } = useT();
  return (
  <footer className="editorial-footer hidden lg:block shrink-0 border-t border-[var(--editorial-border)] bg-[var(--milliy-surface)]">
    <div className="max-w-[1264px] mx-auto px-8 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--editorial-muted)]">
      <div className="flex flex-wrap gap-2">
        <span className="editorial-issn-badge">{t('ISSN 2181-0325 (Print)')}</span>
        <span className="editorial-issn-badge">{t('ISSN 2181-0333 (Online)')}</span>
      </div>
      <p className="text-center">{t('© {value} Phoenix Ilmiy nashrlar markazi. Barcha huquqlar himoyalangan.', { value: new Date().getFullYear() })}</p>
      <div className="flex flex-wrap gap-3">
        <Link to="/services" className="editorial-footer-link">
          {t('Nashr siyosati')}
        </Link>
        <span className="text-[var(--editorial-border)]">|</span>
        <LegalLinks />
        <span className="text-[var(--editorial-border)]">|</span>
        <a href="mailto:support@ilmiyfaoliyat.uz" className="editorial-footer-link">
          {t('Aloqa')}
        </a>
      </div>
    </div>
  </footer>
);
};

export default AppFooter;
