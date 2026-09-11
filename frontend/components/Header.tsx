import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import { LogOut, Bell, Menu, ChevronDown } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { Notification } from '../types';
import { roleNames } from '../config/navConfig';

type HeaderProps = {
  onMenuClick?: () => void;
};

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);
  const navigate = useNavigate();
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setIsUserOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) navigate(notification.link);
    setIsNotifOpen(false);
  };

  const initials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || 'U'}`;

  return (
    <header className="editorial-header sticky top-0 z-[60] shrink-0">
      <div className="editorial-header-top flex items-center justify-between gap-3 px-4 sm:px-6 h-14 border-b border-[var(--editorial-border)] bg-[var(--editorial-bg)]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden editorial-icon-btn"
            aria-label="Menyu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          <ThemeToggle />

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setIsNotifOpen((p) => !p)}
              className="editorial-icon-btn relative"
              aria-label="Bildirishnomalar"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--editorial-primary)] text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {isNotifOpen && (
              <div className="editorial-dropdown absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto z-50">
                <div className="p-3 border-b border-[var(--editorial-border)] flex justify-between items-center">
                  <h4 className="font-serif font-semibold text-[var(--editorial-text)] text-sm">
                    Bildirishnomalar
                  </h4>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllAsRead()}
                      className="text-xs editorial-link"
                    >
                      Hammasini o&apos;qilgan
                    </button>
                  )}
                </div>
                {notifications.length > 0 ? (
                  <ul className="divide-y divide-[var(--editorial-border)]">
                    {notifications.map((n) => (
                      <li
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 text-sm cursor-pointer hover:bg-[var(--editorial-bg-alt)] ${
                          !n.read ? 'editorial-notif-unread' : ''
                        }`}
                      >
                        <p className="text-[var(--editorial-body)] leading-relaxed">{n.message}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-5 text-center text-sm text-[var(--editorial-muted)]">
                    Yangi bildirishnomalar yo&apos;q.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="relative" ref={userRef}>
            <button
              type="button"
              onClick={() => setIsUserOpen((p) => !p)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-[var(--editorial-bg-alt)] transition-colors"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover border border-[var(--editorial-border)]"
                />
              ) : (
                <div className="h-9 w-9 rounded-full editorial-avatar flex items-center justify-center text-sm font-semibold">
                  {initials}
                </div>
              )}
              <div className="hidden md:block text-left max-w-[140px]">
                <p className="text-sm font-semibold text-[var(--editorial-text)] truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-[var(--editorial-muted)] truncate">{roleNames[user.role]}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-[var(--editorial-muted)] hidden md:block" />
            </button>
            {isUserOpen && (
              <div className="editorial-dropdown absolute right-0 mt-2 w-48 py-1 z-[70]">
                <Link
                  to="/profile?tab=profile"
                  onClick={() => setIsUserOpen(false)}
                  className="editorial-dropdown-item"
                >
                  Profil
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsUserOpen(false);
                    logout();
                  }}
                  className="editorial-dropdown-item w-full text-left text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Chiqish
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
