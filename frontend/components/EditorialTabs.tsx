import React from 'react';

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

const EditorialTabs: React.FC<Props> = ({ tabs, activeId, onChange, className = '' }) => (
  <div className={`editorial-tabs mb-6 overflow-x-auto ${className}`}>
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
            <span>{tab.label}</span>
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

export default EditorialTabs;
