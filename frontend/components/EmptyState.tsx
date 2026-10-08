import React from 'react';
import { Link } from 'react-router-dom';

type Illustration = 'documents' | 'payments' | 'search' | 'inbox' | 'chart';

/** Girih uslubidagi kichik illyustratsiya (SVG) — bo'sh holatlar uchun */
const EmptyIllustration: React.FC<{ kind: Illustration }> = ({ kind }) => (
  <svg viewBox="0 0 160 120" className="w-40 h-[120px]" aria-hidden="true">
    <defs>
      <linearGradient id={`es-bg-${kind}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="var(--milliy-firuza-soft)" />
        <stop offset="1" stopColor="var(--editorial-bg-alt)" />
      </linearGradient>
    </defs>
    <circle cx="80" cy="62" r="52" fill={`url(#es-bg-${kind})`} />
    {/* sakkiz qirrali yulduz (girih) */}
    <path
      d="M80 22 l7 11 13-3 -3 13 11 7 -11 7 3 13 -13-3 -7 11 -7-11 -13 3 3-13 -11-7 11-7 -3-13 13 3z"
      fill="none"
      stroke="var(--milliy-firuza)"
      strokeOpacity="0.25"
      strokeWidth="1.5"
    />
    {kind === 'documents' && (
      <g>
        <rect x="58" y="40" width="40" height="50" rx="5" fill="var(--milliy-surface)" stroke="var(--editorial-primary)" strokeWidth="2" />
        <rect x="66" y="34" width="40" height="50" rx="5" fill="var(--milliy-surface)" stroke="var(--editorial-primary)" strokeWidth="2" />
        <path d="M74 48h24M74 56h24M74 64h16" stroke="var(--milliy-firuza)" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    )}
    {kind === 'payments' && (
      <g>
        <rect x="48" y="44" width="64" height="40" rx="6" fill="var(--milliy-surface)" stroke="var(--editorial-primary)" strokeWidth="2" />
        <rect x="48" y="52" width="64" height="8" fill="var(--editorial-primary)" fillOpacity="0.85" />
        <path d="M58 72h18" stroke="var(--milliy-firuza)" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    )}
    {kind === 'search' && (
      <g>
        <circle cx="74" cy="58" r="17" fill="var(--milliy-surface)" stroke="var(--editorial-primary)" strokeWidth="3" />
        <path d="M86 70l14 14" stroke="var(--editorial-primary)" strokeWidth="4" strokeLinecap="round" />
      </g>
    )}
    {kind === 'inbox' && (
      <g>
        <path d="M52 64l10-22h36l10 22v18H52z" fill="var(--milliy-surface)" stroke="var(--editorial-primary)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M52 64h18l4 7h12l4-7h18" fill="none" stroke="var(--milliy-firuza)" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    )}
    {kind === 'chart' && (
      <g>
        <rect x="56" y="62" width="10" height="22" rx="2" fill="var(--milliy-firuza)" />
        <rect x="72" y="48" width="10" height="36" rx="2" fill="var(--editorial-primary)" />
        <rect x="88" y="56" width="10" height="28" rx="2" fill="var(--milliy-firuza)" fillOpacity="0.6" />
        <path d="M52 86h52" stroke="var(--editorial-muted)" strokeWidth="2" strokeLinecap="round" />
      </g>
    )}
  </svg>
);

type Props = {
  title: string;
  description?: React.ReactNode;
  illustration?: Illustration;
  action?: { label: string; to?: string; onClick?: () => void; icon?: React.ElementType };
  compact?: boolean;
  className?: string;
};

/** Bo'sh ro'yxat/holat: illyustratsiya, tushuntirish va keyingi qadam tugmasi. */
const EmptyState: React.FC<Props> = ({ title, description, illustration = 'documents', action, compact = false, className = '' }) => {
  const ActionIcon = action?.icon;
  const actionInner = (
    <>
      {ActionIcon && <ActionIcon className="w-4 h-4" aria-hidden />}
      {action?.label}
    </>
  );
  return (
    <div className={`milliy-empty ${compact ? 'milliy-empty--compact' : ''} ${className}`}>
      {!compact && <EmptyIllustration kind={illustration} />}
      <p className="m-0 text-base font-bold text-[var(--editorial-text)]">{title}</p>
      {description && <p className="m-0 max-w-md text-sm leading-relaxed text-[var(--editorial-muted)]">{description}</p>}
      {action &&
        (action.to ? (
          <Link to={action.to} className="milliy-btn-primary mt-1">
            {actionInner}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="milliy-btn-primary mt-1">
            {actionInner}
          </button>
        ))}
    </div>
  );
};

export default EmptyState;
