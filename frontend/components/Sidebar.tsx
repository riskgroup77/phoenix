import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { sidebarNavByRole } from '../config/navConfig';
import { SUPPORT_EMAIL } from '../config/env';
import { Headphones, HelpCircle } from 'lucide-react';

type SidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

const Sidebar: React.FC<SidebarProps> = ({ onNavigate, className = '' }) => {
  const { user } = useAuth();
  if (!user) return null;

  const sections = sidebarNavByRole[user.role as Role];
  if (!sections) return null;

  const linkClass =
    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-colors';
  const activeClass =
    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 shadow-sm';

  const renderLink = (item: (typeof sections.primary)[0], idx: number) => (
    <NavLink
      key={`${item.to}-${item.label}-${idx}`}
      to={item.to}
      end={item.to === '/dashboard' || item.to === '/operator-dashboard'}
      isActive={(match, location) => {
        if (item.to === '/profile') {
          return location.pathname === '/profile' && item.label === 'Profil';
        }
        return Boolean(match);
      }}
      onClick={onNavigate}
      className={({ isActive }) => (isActive ? activeClass : linkClass)}
    >
      <item.icon className="w-5 h-5 shrink-0 opacity-90" strokeWidth={2} />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );

  return (
    <aside
      className={`pinm-sidebar flex flex-col h-full w-[260px] shrink-0 border-r border-slate-200/90 dark:border-slate-700/60 bg-white dark:bg-slate-900 ${className}`}
    >
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
        {sections.primary.map((item, i) => renderLink(item, i))}

        {sections.tools && sections.tools.length > 0 && (
          <>
            <div className="my-3 border-t border-slate-200/80 dark:border-slate-700/60" />
            {sections.tools.map((item, i) => renderLink(item, i + 100))}
          </>
        )}

        {sections.account && sections.account.length > 0 && (
          <>
            <div className="my-3 border-t border-slate-200/80 dark:border-slate-700/60" />
            {sections.account.map((item, i) => renderLink(item, i + 200))}
          </>
        )}

        <div className="my-3 border-t border-slate-200/80 dark:border-slate-700/60" />
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className={linkClass}
          onClick={onNavigate}
        >
          <HelpCircle className="w-5 h-5 shrink-0" strokeWidth={2} />
          <span>Yordam</span>
        </a>
      </nav>

      <div className="p-3 border-t border-slate-200/80 dark:border-slate-700/60">
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-800/50 p-3">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                Qo&apos;llab-quvvatlash
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
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
