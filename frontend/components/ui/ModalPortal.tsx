import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  open: boolean;
  children: React.ReactNode;
  /** Backdrop klassi (default: qorong'u overlay) */
  backdropClassName?: string;
  zIndexClass?: string;
  /**
   * 'top' — oyna ekran tepasiga yaqin joylashadi va uzun kontentda overlay ichida aylantiriladi
   * (mobil/past ekranda tugmalar ko'rinmay qolmasligi uchun). Default 'center' — avvalgidek.
   */
  align?: 'center' | 'top';
  /** Ekran o'quvchilar uchun sarlavha elementi ID si */
  labelledBy?: string;
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
  align = 'center',
  labelledBy,
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

  const content =
    align === 'top' ? (
      <div
        className={`fixed inset-0 ${zIndexClass} overflow-y-auto overscroll-contain ${backdropClassName}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div className="flex min-h-full items-start justify-center px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-[8vh]">
          {children}
        </div>
      </div>
    ) : (
      <div
        className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4 ${backdropClassName}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    );

  return createPortal(
    content,
    // #root ichiga: tema o'zgaruvchilari (--editorial-primary va h.k.) #root da e'lon qilingan — body ga
    // chiqarilganda tugmalar rangsiz qolardi. #root o'zi stacking context yaratmaydi, z-index ishlaydi.
    document.getElementById('root') || document.body
  );
};

export default ModalPortal;
