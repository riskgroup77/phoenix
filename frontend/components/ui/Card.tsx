
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
      className={`editorial-card pinm-card ${onClick ? 'cursor-pointer hover:border-[var(--editorial-primary)]/30 transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      {title && (
        <div className="mb-4 pb-3 border-b border-[var(--editorial-border)]">
          <h3 className="font-serif text-base font-semibold text-[var(--editorial-text)]">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
