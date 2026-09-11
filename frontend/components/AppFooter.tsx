import React from 'react';
import { Link } from 'react-router-dom';

const AppFooter: React.FC = () => (
  <footer className="editorial-footer hidden lg:block shrink-0 border-t border-[var(--editorial-border)] bg-[var(--editorial-bg)] px-6 py-4">
    <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--editorial-muted)]">
      <div className="flex flex-wrap gap-2">
        <span className="editorial-issn-badge">ISSN 2181-0325 (Print)</span>
        <span className="editorial-issn-badge">ISSN 2181-0333 (Online)</span>
      </div>
      <p className="text-center">
        © {new Date().getFullYear()} O&apos;zbekiston Ilmiy Nashriyoti. Barcha huquqlar himoyalangan.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link to="/services" className="editorial-footer-link">
          Nashr siyosati
        </Link>
        <span className="text-[var(--editorial-border)]">|</span>
        <a href="mailto:support@ilmiyfaoliyat.uz" className="editorial-footer-link">
          Aloqa
        </a>
      </div>
    </div>
  </footer>
);

export default AppFooter;
