import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'accent' | 'cyan';

const BASE_CLASSES =
  'editorial-btn px-6 py-2.5 font-semibold focus:outline-none focus:ring-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'editorial-btn-primary',
  secondary: 'editorial-btn-secondary',
  danger: 'editorial-btn-danger',
  accent: 'editorial-btn-accent',
  cyan: 'editorial-btn-teal',
};

const buttonClassName = (variant: ButtonVariant, className = '') =>
  [BASE_CLASSES, VARIANT_CLASSES[variant], className].filter(Boolean).join(' ');

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const mergedClassName = buttonClassName(variant, className);

  return (
    <button className={mergedClassName} disabled={isLoading || disabled} {...props}>
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

/**
 * Tugma ko'rinishidagi havola. Avval <Link><Button/></Link> yozilardi — havola ichida tugma (HTML qoidasiga zid):
 * klaviatura bilan ikki marta to'xtardi, ekran o'quvchi ikki marta o'qirdi.
 */
export const ButtonLink: React.FC<LinkProps & { variant?: ButtonVariant }> = ({ variant = 'primary', className = '', ...props }) => (
  <Link className={buttonClassName(variant, String(className || ''))} {...props} />
);

export default Button;
