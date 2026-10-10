import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/LanguageContext';

/** Footer'lar uchun: Ommaviy oferta · Maxfiylik siyosati */
export const LegalLinks: React.FC<{ className?: string; linkClassName?: string }> = ({
  className = 'flex flex-wrap gap-3',
  linkClassName = 'editorial-footer-link',
}) => {
  const { t } = useT();
  return (
  <span className={className}>
    <Link to="/oferta" className={linkClassName}>{t('Ommaviy oferta')}</Link>
    <Link to="/maxfiylik" className={linkClassName}>{t('Maxfiylik siyosati')}</Link>
  </span>
);
};

/** To'lov tugmasi yonidagi eslatma: to'lov = oferta shartlarini qabul qilish (aksept). */
export const PaymentConsentNote: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useT();
  return (
  <p className={`text-xs text-slate-500 leading-relaxed ${className}`}>
    {t("To'lovni amalga oshirib, siz")}{' '}
    <a href="/#/oferta" target="_blank" rel="noopener noreferrer" className="underline text-blue-800">{t('ommaviy oferta')}</a>
    {' '}{t('shartlarini (jumladan, pulni qaytarish tartibini) qabul qilasiz.')}
  </p>
);
};
