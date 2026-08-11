import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  open: boolean;
  children: React.ReactNode;
  /** Backdrop klassi (default: qorong'u overlay) */
  backdropClassName?: string;
  zIndexClass?: string;
}

/**
 * Modalni document.body ga portal qiladi — scroll qilingan sahifada ham viewport markazida ko'rinadi.
 * (.pinm-main transform animatsiyasi fixed pozitsiyani buzmasligi uchun.)
 */
const ModalPortal: React.FC<ModalPortalProps> = ({
  open,
  children,
  backdropClassName = 'bg-black/70 backdrop-blur-sm',
  zIndexClass = 'z-[100]',
}) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4 ${backdropClassName}`}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>,
    document.body
  );
};

export default ModalPortal;
