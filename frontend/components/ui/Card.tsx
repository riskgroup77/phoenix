
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', title, onClick }) => {
  return (
    <div
      className={`pinm-card rounded-2xl border border-slate-200/90 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-5 sm:p-6 ${onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      {title && (
        <div className="mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
