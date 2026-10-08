import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import { LogOut, Bell, Menu, ChevronDown, MoreHorizontal, HelpCircle, Search } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import { OPEN_SEARCH_EVENT } from './CommandPalette';
import { useT } from '../i18n/LanguageContext';
import GirihPattern from './GirihPattern';
import { Notification, Role } from '../types';
import { roleNames, sidebarNavByRole, type NavItem } from '../config/navConfig';
import { SUPPORT_EMAIL } from '../config/env';
import { isNavItemActive } from '../utils/navActive';

type HeaderProps = {
  onMenuClick?: () => void;
};

/** Katta ekranda (lg) panelda ko'rinadigan asosiy havolalar soni; xl da ko'proq */
const VISIBLE_LG = 3;
const VISIBLE_XL = 4;
/** Menyu uchun taxminiy joy (px): lg (1024) va xl (1280) ekranlarda, «Boshqa» tugmasidan tashqari */
const NAV_BUDGET_LG = 420;
const NAV_BUDGET_XL = 610;

/** Uzun yorliqlar (masalan taqrizchi menyusi) «Boshqa» tugmasini siqib chiqarmasligi uchun nechta band sig'ishini hisoblaydi */
function fitCount(labels: string[], budget: number, max: number): number {
  let used = 0;
  let n = 0;
  for (const label of labels) {
    const w = 32 + label.length * 7.6;
    if (n >= max || used + w > budget) break;
    used += w;
    n += 1;
  }
  return Math.max(1, n);
}

/**
 * "Milliy zamonaviy" yuqori panel: lojuvard fon, girih naqshi, asosiy menyu,
 * qolgan bo'limlar «Boshqa» ochiluvchi menyusida. Mobil: hamburger → yon menyu.
 */
const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { t } = useT();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) setIsNotifOpen(false);
      if (userRef.current && !userRef.current.contains(target)) setIsUserOpen(false);
      if (moreRef.current && !moreRef.current.contains(target)) setIsMoreOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotifOpen(false);
        setIsUserOpen(false);
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Sahifa almashganda ochiq menyular yopilsin
  useEffect(() => {
    setIsMoreOpen(false);
    setIsUserOpen(false);
    setIsNotifOpen(false);
  }, [location.pathname, location.search]);

  if (!user) return null;

  const sections = sidebarNavByRole[user.role as Role];
  const primary = sections?.primary ?? [];
  const extra: NavItem[] = [...(sections?.tools ?? []), ...(sections?.account ?? [])];
  const active = (to: string) => isNavItemActive(to, location.pathname, location.search);
  const labels = primary.map((i) => t(i.label));
  const visLg = fitCount(labels, NAV_BUDGET_LG, VISIBLE_LG);
  const visXl = Math.max(visLg, fitCount(labels, NAV_BUDGET_XL, VISIBLE_XL));

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) navigate(notification.link);
    setIsNotifOpen(false);
  };

  const initials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || 'U'}`;

  const renderMoreItem = (item: NavItem, hideFrom?: 'lg' | 'xl') => {
    const Icon = item.icon;
    // Ko'rinish o'rovchida: .editorial-dropdown-item ning display qiymati Tailwind'ni bosib ketmasin
    const visibility = hideFrom === 'xl' ? 'xl:hidden' : hideFrom === 'lg' ? 'lg:hidden' : '';
    return (
      <div key={`more-${item.to}-${item.label}`} className={visibility}>
        <Link
          to={item.to}
          className={`editorial-dropdown-item !flex items-center gap-3 ${
            active(item.to) ? 'font-bold text-[var(--editorial-primary)]' : ''
          }`}
        >
          <Icon className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
          {t(item.label)}
        </Link>
      </div>
    );
  };

  return (
    <header className="milliy-topbar sticky top-0 z-[60] shrink-0">
      <div className="milliy-topbar-pattern" aria-hidden="true">
        <GirihPattern opacity={0.1} />
      </div>
      <div className="milliy-topbar-inner">
        <div className="lg:hidden">
          <button type="button" onClick={onMenuClick} className="milliy-band-btn" aria-label={t('Menyuni ochish')}>
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <Link to={user.role === Role.Operator ? '/operator-dashboard' : '/dashboard'} className="milliy-brand">
          <span className="milliy-brand-mark" aria-hidden="true">P</span>
          <span className="hidden sm:flex flex-col min-w-0">
            <span className="milliy-brand-title">Phoenix</span>
            <span className="milliy-brand-sub">{t('Ilmiy nashrlar markazi')}</span>
          </span>
        </Link>

        <nav aria-label={t('Asosiy menyu')} className="milliy-nav hidden lg:flex">
          {primary.map((item, idx) => {
            const visibility =
              idx < visLg ? 'inline-flex' : idx < visXl ? 'hidden xl:inline-flex' : 'hidden';
            return (
              <Link
                key={`${item.to}-${item.label}`}
                to={item.to}
                aria-current={active(item.to) ? 'page' : undefined}
                className={`milliy-nav-link ${visibility} ${active(item.to) ? 'milliy-nav-link--active' : ''}`}
              >
                {t(item.label)}
              </Link>
            );
          })}

          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setIsMoreOpen((p) => !p)}
              className="milliy-nav-link inline-flex"
              aria-haspopup="menu"
              aria-expanded={isMoreOpen}
            >
              <MoreHorizontal className="w-4 h-4" aria-hidden />
              {t('Boshqa')}
              <ChevronDown className="w-4 h-4" aria-hidden />
            </button>
            {isMoreOpen && (
              <div className="editorial-dropdown absolute left-0 mt-2 w-72 max-h-[70vh] overflow-y-auto py-2 z-[70]">
                {primary.slice(visLg, visXl).map((item) => renderMoreItem(item, 'xl'))}
                {primary.slice(visXl).map((item) => renderMoreItem(item))}
                {extra.map((item) => renderMoreItem(item))}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="editorial-dropdown-item !flex items-center gap-3">
                  <HelpCircle className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
                  {t('Yordam')}
                </a>
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))}
            className="milliy-band-btn milliy-search-btn"
            aria-label={t('Qidiruv')}
            title={`${t('Qidiruv')} (Ctrl+K)`}
          >
            <Search className="w-5 h-5" aria-hidden />
            <span className="hidden 2xl:inline text-sm font-medium">{t('Qidiruv')}</span>
            <span className="hidden 2xl:inline-flex"><kbd className="milliy-kbd milliy-kbd--band">Ctrl K</kbd></span>
          </button>
          <div className="hidden sm:block">
            <LanguageSwitcher variant="band" />
          </div>
          <ThemeToggle variant="band" />

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setIsNotifOpen((p) => !p)}
              className="milliy-band-btn"
              aria-label={t('Bildirishnomalar')}
              aria-expanded={isNotifOpen}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && <span className="milliy-band-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {isNotifOpen && (
              <div className="editorial-dropdown absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto z-50">
                <div className="p-3 border-b border-[var(--editorial-border)] flex justify-between items-center">
                  <h4 className="font-bold text-[var(--editorial-text)] text-sm">{t('Bildirishnomalar')}</h4>
                  {notifications.length > 0 && (
                    <button type="button" onClick={() => markAllAsRead()} className="text-xs editorial-link">
                      {t("Hammasini o'qilgan")}
                    </button>
                  )}
                </div>
                {notifications.length > 0 ? (
                  <ul className="divide-y divide-[var(--editorial-border)]">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(n)}
                          className={`w-full text-left p-3 text-sm hover:bg-[var(--editorial-bg-alt)] ${
                            !n.read ? 'editorial-notif-unread' : ''
                          }`}
                        >
                          <span className="text-[var(--editorial-body)] leading-relaxed">{n.message}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-5 text-center text-sm text-[var(--editorial-muted)]">{t("Yangi bildirishnomalar yo'q.")}</p>
                )}
              </div>
            )}
          </div>

          <div className="relative" ref={userRef}>
            <button
              type="button"
              onClick={() => setIsUserOpen((p) => !p)}
              className="milliy-user-btn"
              aria-haspopup="menu"
              aria-expanded={isUserOpen}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="milliy-avatar" />
              ) : (
                <span className="milliy-avatar" aria-hidden="true">{initials}</span>
              )}
              <span className="hidden 2xl:flex flex-col text-left max-w-[150px] leading-tight">
                <span className="text-sm font-semibold truncate">
                  {user.firstName} {user.lastName}
                </span>
                <span className="text-xs text-[var(--milliy-band-text)] truncate">{t(roleNames[user.role])}</span>
              </span>
              <ChevronDown className="w-4 h-4 hidden 2xl:block" aria-hidden />
            </button>
            {isUserOpen && (
              <div className="editorial-dropdown absolute right-0 mt-2 w-52 py-1 z-[70]">
                <Link to="/profile?tab=profile" className="editorial-dropdown-item">
                  {t('Profil')}
                </Link>
                <Link to="/profile?tab=settings" className="editorial-dropdown-item">
                  {t('Sozlamalar')}
                </Link>
                <div className="sm:hidden px-2 py-1">
                  <LanguageSwitcher />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsUserOpen(false);
                    logout();
                  }}
                  className="editorial-dropdown-item w-full text-left text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  {t('Chiqish')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
