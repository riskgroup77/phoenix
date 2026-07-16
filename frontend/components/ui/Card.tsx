
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
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white/92 via-white/78 to-indigo-50/35 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_12px_48px_-18px_rgba(79,70,229,0.08),0_4px_24px_-8px_rgba(15,23,42,0.08)] transition-all duration-500 ease-out hover:border-indigo-200/50 hover:shadow-[0_20px_56px_-16px_rgba(79,70,229,0.12),0_8px_32px_-12px_rgba(6,182,212,0.1)] hover:-translate-y-0.5 ${className}`}
      onClick={onClick}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-violet-400/20 to-cyan-400/15 blur-3xl transition-opacity duration-700 group-hover:opacity-100 opacity-70"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent"
        aria-hidden
      />
      <div className="relative">
        {title && (
          <div className="mb-6 pb-4 border-b border-slate-200/80">
            <h3 className="phoenix-title-accent text-xl font-extrabold tracking-tight">{title}</h3>
            <div className="phoenix-underline-gradient" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default Card;
