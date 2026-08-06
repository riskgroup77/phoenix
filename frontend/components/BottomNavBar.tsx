

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { bottomNavByRole } from '../config/navConfig';

const BottomNavBar: React.FC = () => {
    const { user } = useAuth();

    if (!user) return null;

    const navLinks =
        bottomNavByRole[user.role as Role] ||
        bottomNavByRole[Role.Author] ||
        [];

    const linkBaseClass =
        'flex min-w-[3.75rem] max-w-[5.5rem] shrink-0 flex-col items-center justify-center text-center text-slate-500 hover:text-blue-600 transition-colors h-full px-1 py-1';
    const activeClass = 'text-blue-600 font-semibold';

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 min-h-[4.25rem] pb-[max(0.25rem,env(safe-area-inset-bottom))] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
            <div
                className="flex h-full w-full flex-nowrap items-stretch justify-start gap-0 overflow-x-auto overflow-y-hidden px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {navLinks.map((link) => (
                    <NavLink
                        key={link.to + link.label}
                        to={link.to}
                        className={({ isActive }) => `${linkBaseClass} ${isActive ? activeClass : ''}`}
                    >
                        <link.icon className="w-6 h-6 mb-0.5 shrink-0" strokeWidth={2} />
                        <span className="text-[10px] sm:text-xs font-medium leading-tight line-clamp-2">
                            {link.label}
                        </span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export default BottomNavBar;
