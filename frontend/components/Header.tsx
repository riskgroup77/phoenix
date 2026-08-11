import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import { LogOut, Bell, Menu, ChevronDown, BookOpen } from 'lucide-react';
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
    <header className="pinm-topbar flex-shrink-0 flex items-center justify-between h-16 px-4 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-700/60 sticky top-0 z-[60]">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Menyu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0 group">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
            <BookOpen className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-base sm:text-lg truncate">
            Ilmiy Faoliyat
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <ThemeToggle />

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setIsNotifOpen((p) => !p)}
            className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Bildirishnomalar"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50">
              <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Bildirishnomalar</h4>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsRead()}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Hammasini o&apos;qilgan
                  </button>
                )}
              </div>
              {notifications.length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                        !n.read ? 'bg-blue-50/80 dark:bg-blue-950/30' : ''
                      }`}
                    >
                      <p className="text-slate-700 dark:text-slate-200 leading-relaxed">{n.message}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-5 text-center text-sm text-slate-500">Yangi bildirishnomalar yo&apos;q.</p>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setIsUserOpen((p) => !p)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 flex items-center justify-center text-sm font-semibold">
                {initials}
              </div>
            )}
            <div className="hidden md:block text-left max-w-[140px]">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-500 truncate">{roleNames[user.role]}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
          </button>
          {isUserOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-[70]">
              <Link
                to="/profile"
                onClick={() => setIsUserOpen(false)}
                className="block px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Profil
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsUserOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Chiqish
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
