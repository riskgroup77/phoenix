import React, { useId } from 'react';

type Props = {
  /** Naqsh shaffofligi (0–1) */
  opacity?: number;
  className?: string;
};

/**
 * "Milliy zamonaviy" dizaynidagi yengil girih naqshi — lojuvard fon ustida dekor.
 * Ota element `position: relative; overflow: hidden` bo'lishi kerak.
 */
const GirihPattern: React.FC<Props> = ({ opacity = 0.12, className = '' }) => {
  const id = `girih-${useId().replace(/:/g, '')}`;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ opacity }}
    >
      <defs>
        <pattern id={id} width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M32 4 L40 24 L60 32 L40 40 L32 60 L24 40 L4 32 L24 24 Z" fill="none" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M32 16 L36 28 L48 32 L36 36 L32 48 L28 36 L16 32 L28 28 Z" fill="none" stroke="#ffffff" strokeWidth="1" />
          <circle cx="0" cy="0" r="6" fill="none" stroke="#ffffff" strokeWidth="1" />
          <circle cx="64" cy="64" r="6" fill="none" stroke="#ffffff" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
};

export default GirihPattern;
