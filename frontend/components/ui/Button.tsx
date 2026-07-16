import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'accent' | 'cyan';
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
  const baseClasses =
    'px-6 py-3 font-semibold rounded-full focus:outline-none focus:ring-4 transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 inline-flex items-center justify-center active:scale-[0.97] hover:scale-[1.02] shadow-md hover:shadow-xl';

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 focus:ring-indigo-400/45 border border-white/20 shadow-indigo-500/25 hover:shadow-indigo-500/35',
    secondary:
      'bg-gradient-to-br from-white/95 to-slate-50/90 text-slate-800 hover:from-white hover:to-indigo-50/50 focus:ring-indigo-200/60 backdrop-blur-md border border-slate-200/80 shadow-sm hover:border-indigo-200/60',
    danger:
      'bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-500 hover:to-red-500 focus:ring-rose-400/50 shadow-rose-500/20',
    accent:
      'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-gray-950 hover:from-amber-400 hover:via-orange-400 hover:to-rose-400 focus:ring-amber-400/50 border border-amber-200/90 shadow-lg shadow-amber-500/30',
    cyan:
      'bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-600 text-white hover:from-cyan-400 hover:via-teal-400 hover:to-emerald-500 focus:ring-cyan-400/50 border border-cyan-300/40 shadow-lg shadow-cyan-500/30',
  };

  const mergedClassName = [baseClasses, variantClasses[variant], className].filter(Boolean).join(' ');

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

export default Button;
