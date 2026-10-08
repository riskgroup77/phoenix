import React, { useEffect, useRef, useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { LANGUAGES, useT } from '../i18n/LanguageContext';

/** Til tanlash: O‘zbekcha (lotin/kirill), Русский, English. variant="band" — lojuvard panel ustida. */
const LanguageSwitcher: React.FC<{ variant?: 'default' | 'band' }> = ({ variant = 'default' }) => {
  const { lang, setLang, t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`${variant === 'band' ? 'milliy-band-btn' : 'editorial-icon-btn'} !w-auto px-2.5 gap-1.5 text-sm font-semibold`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('Tilni tanlash')}
        title={t('Tilni tanlash')}
      >
        <Globe size={18} aria-hidden />
        <span>{current.short}</span>
      </button>
      {open && (
        <div role="menu" className="editorial-dropdown absolute right-0 mt-2 w-44 py-1 z-[80]">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === lang}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className="editorial-dropdown-item w-full !flex items-center justify-between gap-2 text-left"
            >
              <span lang={l.htmlLang}>{l.label}</span>
              {l.code === lang && <Check className="w-4 h-4 text-[var(--editorial-primary)]" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
