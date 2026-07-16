import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, NavLink } from 'react-router-dom';
import { useAuth, useNotifications } from '../contexts/AuthContext';
import { LogOut, Bell, LayoutDashboard, FileText, Upload, Users, Library, BookMarked, CheckCircle, Sparkles, DollarSign, Archive, Languages, FolderArchive, MessageSquare, Bot, FilePlus } from 'lucide-react';
import { Role, Notification } from '../types';

const roleNames: Record<Role, string> = {
    [Role.Author]: 'Muallif',
    [Role.Reviewer]: 'Taqrizchi',
    [Role.JournalAdmin]: 'Jurnal administratori',
    [Role.SuperAdmin]: 'Bosh administrator',
    [Role.Accountant]: 'Moliyachi',
    [Role.Operator]: 'Operator',
};

type NavLinkItem = {
    to: string;
    icon: React.ElementType;
    label: string;
};

const mainNavLinks: Record<Role, NavLinkItem[]> = {
    [Role.Author]: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Boshqaruv paneli' },
        { to: '/articles', icon: FileText, label: 'Maqolalarim' },
        { to: '/submit', icon: Upload, label: 'Maqola yuborish' },
        { to: '/my-collections', icon: Archive, label: 'To\'plamlarim' },
        { to: '/my-translations', icon: Languages, label: 'Tarjimalarim' },
        { to: '/services', icon: Sparkles, label: 'Xizmatlar' },
        { to: '/arxiv', icon: FolderArchive, label: 'Arxiv hujjatlar' },
    ],
    [Role.Reviewer]: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Ishchi stol' },
        { to: '/articles', icon: FileText, label: 'Taqrizga kelganlar' },
    ],
    [Role.JournalAdmin]: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Boshqaruv paneli' },
        { to: '/articles', icon: FileText, label: 'Maqolalar' },
        { to: '/published-articles', icon: CheckCircle, label: 'Nashr etilganlar' },
    ],
    [Role.SuperAdmin]: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Boshqaruv paneli' },
        { to: '/users', icon: Users, label: 'Foydalanuvchilar' },
        { to: '/articles', icon: FileText, label: 'Barcha maqolalar' },
        { to: '/journal-management', icon: BookMarked, label: 'Jurnallar' },
        { to: '/prices', icon: DollarSign, label: 'Narxlar' },
    ],
    [Role.Accountant]: [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Boshqaruv paneli' },
        { to: '/financials', icon: DollarSign, label: 'Moliya' },
    ],
    [Role.Operator]: [
        { to: '/operator-dashboard', icon: LayoutDashboard, label: 'Operator paneli' },
        { to: '/articles', icon: MessageSquare, label: 'Maqolalar va chat' },
        { to: '/all-requests', icon: FileText, label: 'Barcha so\'rovlar' },
        { to: '/doi-requests', icon: Bot, label: 'DOI so\'rovlari' },
        { to: '/udk-requests', icon: Library, label: 'UDK so\'rovlari' },
        { to: '/article-sample-requests', icon: FilePlus, label: 'Maqola namuna' },
    ],
};


const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isDropdownOpen, setIsDropdownOpen] =
useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const links = user ? mainNavLinks[user.role] || [] : [];
  const linkClass =
    'flex items-center px-3 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-gradient-to-r hover:from-white/90 hover:to-indigo-50/80 hover:text-slate-900 hover:shadow-sm hover:ring-1 hover:ring-indigo-100/80 transition-all duration-300';
  const activeLinkClass =
    'flex items-center px-3 py-2 text-sm font-semibold text-indigo-900 bg-gradient-to-r from-blue-100/90 via-indigo-50/95 to-cyan-50/80 rounded-xl ring-1 ring-indigo-200/70 shadow-sm';


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsDropdownOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  if (!user) {
    return null;
  }
  
  const handleNotificationClick = (notification: Notification) => {
      markAsRead(notification.id);
      if(notification.link) {
          navigate(notification.link);
      }
      setIsDropdownOpen(false);
  }

  return (
    <>
      <header className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 h-20 bg-gradient-to-r from-white/85 via-indigo-50/40 to-cyan-50/35 backdrop-blur-xl border-b border-indigo-100/50 shadow-[0_4px_30px_-12px_rgba(79,70,229,0.12)] sticky top-0 z-30">
        <div className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="text-2xl font-extrabold tracking-tight flex items-center gap-3 group/logo"
            >
                <div className="phoenix-logo-glow w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-lg font-black text-white shadow-lg ring-2 ring-white/60 transition-transform duration-300 group-hover/logo:scale-105">
                    P
                </div>
                <span className="hidden lg:block phoenix-gradient-title">PINM</span>
            </Link>
            <nav className="hidden md:flex items-center gap-2">
                {links.map(link => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) => isActive ? activeLinkClass : linkClass}
                    >
                        <link.icon className="w-5 h-5 mr-2" />
                        <span>{link.label}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative">
                 <button 
                    onClick={() => setIsDropdownOpen(prev => !prev)}
                    className="text-slate-600 hover:text-slate-900 focus:outline-none transition-colors p-2 rounded-full hover:bg-slate-100/90"
                    aria-label="Bildirishnomalar"
                >
                    <Bell size={22} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                    )}
                </button>
                {isDropdownOpen && (
                    <div ref={dropdownRef} className="absolute right-0 mt-3 w-80 max-h-96 overflow-y-auto bg-white/92 backdrop-blur-2xl border border-slate-200/80 rounded-2xl shadow-[0_24px_80px_-20px_rgba(15,23,42,0.18)] z-50">
                        <div className="p-4 border-b border-slate-200/90 flex justify-between items-center">
                            <h4 className="font-semibold text-slate-900">Bildirishnomalar</h4>
                            {notifications.length > 0 && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        markAllAsRead();
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                    Hammasini o'qilgan deb belgilash
                                </button>
                            )}
                        </div>
                        {notifications.length > 0 ? (
                            <ul className="divide-y divide-slate-200/80">
                                {notifications.map(n => (
                                    <li key={n.id} onClick={() => handleNotificationClick(n)} className={`p-4 text-sm cursor-pointer hover:bg-slate-100/70 transition-colors ${!n.read ? 'bg-blue-500/10' : ''}`}>
                                        <p className="text-slate-700 leading-relaxed">{n.message}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="p-6 text-center text-sm text-slate-500">Yangi bildirishnomalar yo'q.</p>
                        )}
                    </div>
                )}
            </div>
            <Link to="/profile" className="flex items-center p-1.5 rounded-full hover:bg-slate-100/90 transition-colors">
                {user.avatarUrl ? (
                    <img 
                        className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover border-2 border-slate-300/80" 
                        src={user.avatarUrl} 
                        alt={`${user.firstName} ${user.lastName}`} 
                    />
                ) : (
                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-blue-500/20 border-2 border-slate-300/80 flex items-center justify-center text-blue-900 font-semibold">
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0) || 'U'}
                    </div>
                )}
                <div className="mx-2 sm:mx-4 text-right hidden md:block">
                    <p className="text-sm font-semibold text-slate-900">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-slate-500">{roleNames[user.role]}</p>
                </div>
            </Link>
            <button onClick={logout} className="text-slate-600 hover:text-red-600 focus:outline-none transition-colors p-2.5 rounded-full hover:bg-red-50/90" aria-label="Chiqish">
                <LogOut size={20} />
            </button>
        </div>
    </header>
    </>
  );
};

export default Header;