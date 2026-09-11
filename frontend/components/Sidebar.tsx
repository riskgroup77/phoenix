import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { sidebarNavByRole } from '../config/navConfig';
import { SUPPORT_EMAIL } from '../config/env';
import { Headphones, HelpCircle } from 'lucide-react';
import EditorialLogo from './EditorialLogo';

type SidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

const Sidebar: React.FC<SidebarProps> = ({ onNavigate, className = '' }) => {
  const { user } = useAuth();
  if (!user) return null;

  const sections = sidebarNavByRole[user.role as Role];
  if (!sections) return null;

  const linkClass = 'editorial-nav-link flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors';
  const activeClass = 'editorial-nav-link editorial-nav-link--active';

  const profileTabFromTo = (to: string): string => {
    const query = to.includes('?') ? to.split('?')[1] : '';
    return new URLSearchParams(query).get('tab') || 'profile';
  };

  const renderLink = (item: (typeof sections.primary)[0], idx: number) => (
    <NavLink
      key={`${item.to}-${item.label}-${idx}`}
      to={item.to}
      end={item.to === '/dashboard' || item.to === '/operator-dashboard'}
      isActive={(_, location) => {
        const [path] = item.to.split('?');
        if (path === '/profile') {
          if (location.pathname !== '/profile') return false;
          const currentTab = new URLSearchParams(location.search).get('tab') || 'profile';
          return currentTab === profileTabFromTo(item.to);
        }
        if (item.to.includes('?')) {
          return location.pathname === path && location.search.includes(item.to.split('?')[1] || '');
        }
        return location.pathname === item.to;
      }}
      onClick={onNavigate}
      className={({ isActive }) => (isActive ? activeClass : linkClass)}
    >
      <item.icon className="editorial-nav-icon w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
      <span className="truncate">{item.label}</span>
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
        <SectionLabel first>Asosiy</SectionLabel>
        {sections.primary.map((item, i) => renderLink(item, i))}

        {sections.tools && sections.tools.length > 0 && (
          <>
            <SectionLabel>Vositalar</SectionLabel>
            {sections.tools.map((item, i) => renderLink(item, i + 100))}
          </>
        )}

        {sections.account && sections.account.length > 0 && (
          <>
            <SectionLabel>Hisob</SectionLabel>
            {sections.account.map((item, i) => renderLink(item, i + 200))}
          </>
        )}

        <SectionLabel>Yordam</SectionLabel>
        <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass} onClick={onNavigate}>
          <HelpCircle className="editorial-nav-icon w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
          <span>Yordam</span>
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
                Qo&apos;llab-quvvatlash
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
