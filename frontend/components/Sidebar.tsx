import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { sidebarNavByRole } from '../config/navConfig';
import { SUPPORT_EMAIL } from '../config/env';
import { Headphones, HelpCircle } from 'lucide-react';
import EditorialLogo from './EditorialLogo';
import { isNavItemActive } from '../utils/navActive';
import { useT } from '../i18n/LanguageContext';

type SidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

const Sidebar: React.FC<SidebarProps> = ({ onNavigate, className = '' }) => {
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useT();
  if (!user) return null;

  const sections = sidebarNavByRole[user.role as Role];
  if (!sections) return null;

  const linkClass = 'editorial-nav-link flex items-center gap-3 mx-3 px-3 min-h-[2.75rem] text-sm font-medium transition-colors';
  const activeClass = `${linkClass} editorial-nav-link--active`;

  const isItemActive = (to: string): boolean => isNavItemActive(to, location.pathname, location.search);

  const renderLink = (item: (typeof sections.primary)[0], idx: number) => (
    <NavLink
      key={`${item.to}-${item.label}-${idx}`}
      to={item.to}
      end={item.to === '/dashboard' || item.to === '/operator-dashboard'}
      onClick={onNavigate}
      // React Router v7 da NavLink `isActive` propini qo'llamaydi — query (?tab=) hisobga olinishi uchun o'zimiz hisoblaymiz
      className={isItemActive(item.to) ? activeClass : linkClass}
    >
      <item.icon className="editorial-nav-icon w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
      <span className="truncate">{t(item.label)}</span>
    </NavLink>
  );

  const SectionLabel = ({ children, first = false }: { children: React.ReactNode; first?: boolean }) => (
    <p className={`editorial-sidebar-label px-4 ${first ? 'pt-2 pb-1.5' : 'pt-6 pb-1.5'}`}>{children}</p>
  );

  return (
    <aside
      className={`editorial-sidebar flex flex-col h-full w-[248px] shrink-0 border-r border-[var(--editorial-sidebar-border)] bg-[var(--editorial-sidebar-bg)] ${className}`}
    >
      <div className="editorial-sidebar-brand px-5 py-5 border-b border-[var(--editorial-sidebar-border)] shrink-0">
        <EditorialLogo onNavigate={onNavigate} />
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <SectionLabel first>{t('Asosiy')}</SectionLabel>
        {sections.primary.map((item, i) => renderLink(item, i))}

        {sections.tools && sections.tools.length > 0 && (
          <>
            <SectionLabel>{t('Vositalar')}</SectionLabel>
            {sections.tools.map((item, i) => renderLink(item, i + 100))}
          </>
        )}

        {sections.account && sections.account.length > 0 && (
          <>
            <SectionLabel>{t('Hisob')}</SectionLabel>
            {sections.account.map((item, i) => renderLink(item, i + 200))}
          </>
        )}

        <SectionLabel>{t('Yordam')}</SectionLabel>
        <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass} onClick={onNavigate}>
          <HelpCircle className="editorial-nav-icon w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          <span>{t('Yordam')}</span>
        </a>
      </nav>

      <div className="p-4 shrink-0 border-t border-[var(--editorial-sidebar-border)]">
        <div className="editorial-support-card p-3.5">
          <div className="flex items-start gap-3">
            <div className="editorial-support-icon flex items-center justify-center w-8 h-8 shrink-0">
              <Headphones className="w-4 h-4" strokeWidth={2} />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs font-bold text-[var(--editorial-text)] leading-tight">
                {t("Qo'llab-quvvatlash")}
              </p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[11px] editorial-link break-all leading-snug mt-0.5 inline-block">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
