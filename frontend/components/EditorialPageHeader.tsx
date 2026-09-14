import React from 'react';

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

const EditorialPageHeader: React.FC<Props> = ({ title, subtitle, actions }) => (
  <div className="editorial-page-header mb-6 sm:mb-8">
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="min-w-0">
        <h1 className="editorial-page-title">{title}</h1>
        {subtitle && <p className="editorial-page-subtitle mt-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  </div>
);

export default EditorialPageHeader;
