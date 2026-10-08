import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNavBar from './BottomNavBar';
import AppFooter from './AppFooter';
import ScrollingBanner from './ScrollingBanner';
import ArticleChatDock, { MainRightInsetContext } from './ArticleChatDock';
import CommandPalette from './CommandPalette';
import { X } from 'lucide-react';

/**
 * "Milliy zamonaviy" layout: tepada lojuvard panel (asosiy menyu), kontent markazda (1200px).
 * Kichik ekranlarda to'liq menyu chap tomondan ochiladi (Sidebar) + pastki menyu.
 */
const Layout: React.FC = () => {
  const [mainRightInset, setMainRightInset] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  return (
    <MainRightInsetContext.Provider value={setMainRightInset}>
      <div className="pinm-app-shell editorial-shell flex flex-col h-screen min-h-0">
        <ScrollingBanner />
        <Header onMenuClick={() => setMobileNavOpen(true)} />

        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-[80] flex" role="dialog" aria-modal="true" aria-label="Menyu">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Menyuni yopish"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative h-full shadow-xl">
              <Sidebar onNavigate={() => setMobileNavOpen(false)} className="h-full" />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-[10px] bg-[var(--milliy-surface)] text-[var(--editorial-muted)] border border-[var(--editorial-border)]"
                aria-label="Yopish"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto flex flex-col">
          <main
            className="pinm-main phoenix-main editorial-main flex-1 w-full max-w-[1264px] mx-auto px-4 py-6 sm:px-8 sm:py-8 pb-28 lg:pb-10 transition-[padding] duration-200"
            style={mainRightInset > 0 ? { paddingRight: mainRightInset } : undefined}
          >
            <Outlet />
          </main>
          <AppFooter />
        </div>

        <ArticleChatDock />
        <CommandPalette />

        <div className="lg:hidden">
          <BottomNavBar />
        </div>
      </div>
    </MainRightInsetContext.Provider>
  );
};

export default Layout;
