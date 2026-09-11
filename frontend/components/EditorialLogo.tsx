import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

type Props = {
  compact?: boolean;
  to?: string;
  onClick?: () => void;
  onNavigate?: () => void;
};

const EditorialLogo: React.FC<Props> = ({ compact = false, to = '/dashboard', onClick, onNavigate }) => {
  const inner = (
    <>
      <div className="editorial-logo-mark shrink-0">
        <BookOpen className="w-5 h-5" strokeWidth={2} aria-hidden />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="editorial-logo-title font-serif text-sm sm:text-base font-bold tracking-tight">
            ILMIY JURNAL
          </p>
          <p className="editorial-logo-sub text-[10px] sm:text-[11px] font-medium uppercase tracking-wide truncate">
            O&apos;zbekiston Ilmiy Nashriyoti
          </p>
        </div>
      )}
    </>
  );

  const className = 'flex items-center gap-2.5 min-w-0 group editorial-logo-link';

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  return (
    <Link to={to} onClick={onNavigate} className={className}>
      {inner}
    </Link>
  );
};

export default EditorialLogo;
