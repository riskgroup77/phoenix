import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/LanguageContext';

export type EditorialTabItem = {
  id: string;
  label: string;
  count?: number;
};

type Props = {
  tabs: EditorialTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
};

const EditorialTabs: React.FC<Props> = ({ tabs, activeId, onChange, className = '' }) => {
  const { t } = useT();
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Tor ekranda tablar sig'masa: chekkada soya — yana tab borligini ko'rsatadi (scrollbar yashirin)
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [updateEdges, tabs.length]);

  // Faol tab ekrandan tashqarida qolmasin — o'rtaga suriladi
  useEffect(() => {
    const el = scrollerRef.current;
    const btn = el?.querySelector<HTMLElement>('.editorial-tab--active');
    if (!el || !btn || el.scrollWidth <= el.clientWidth) return;
    el.scrollTo({ left: btn.offsetLeft - (el.clientWidth - btn.offsetWidth) / 2, behavior: 'smooth' });
  }, [activeId]);

  return (
  <div
    ref={scrollerRef}
    onScroll={updateEdges}
    data-fade-left={edges.left || undefined}
    data-fade-right={edges.right || undefined}
    className={`editorial-tabs relative mb-6 overflow-x-auto ${className}`}
  >
    <div className="editorial-tabs-inner flex min-w-max border-b border-[var(--editorial-border)]">
      {tabs.map((tab) => {
        const active = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`editorial-tab ${active ? 'editorial-tab--active' : ''}`}
          >
            <span>{t(tab.label)}</span>
            {typeof tab.count === 'number' && (
              <span className={`editorial-tab-count ${active ? 'editorial-tab-count--active' : ''}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
  );
};

export default EditorialTabs;
