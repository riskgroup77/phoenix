import React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  compact?: boolean;
  to?: string;
  onClick?: () => void;
  onNavigate?: () => void;
};

const EditorialLogo: React.FC<Props> = ({ compact = false, to = '/dashboard', onClick, onNavigate }) => {
  const inner = (
    <>
      <div className="editorial-logo-mark shrink-0 font-extrabold text-lg" aria-hidden="true">
        P
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="editorial-logo-title text-base font-extrabold tracking-tight">Phoenix</p>
          <p className="editorial-logo-sub text-[11px] font-medium truncate">Ilmiy nashrlar markazi</p>
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
