import React from 'react';

/** Phoenix logosi (oltin feniks) — favicon bilan bir xil. Avval barcha joyda "P" harfi turardi. */
const BrandMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`milliy-brand-mark ${className}`} aria-hidden="true">
    <img src="/icons/logo-96.png" alt="" width={48} height={48} decoding="async" />
  </span>
);

export default BrandMark;
