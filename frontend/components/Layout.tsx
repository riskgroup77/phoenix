import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNavBar from './BottomNavBar';
import AppFooter from './AppFooter';
import ScrollingBanner from './ScrollingBanner';
import ArticleChatDock, { MainRightInsetContext } from './ArticleChatDock';
import { X } from 'lucide-react';

const Layout: React.FC = () => {
  const [mainRightInset, setMainRightInset] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <MainRightInsetContext.Provider value={setMainRightInset}>
      <div className="pinm-app-shell editorial-shell flex h-screen min-h-0">
        <ScrollingBanner />

        {/* Desktop: sidebar yuqoridan pastgacha — rasmdagi kabi */}
        <div className="hidden lg:flex shrink-0 h-full min-h-0">
          <Sidebar />
        </div>

        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <button
              type="button"
              className="absolute inset-0 bg-black/30"
              aria-label="Menyuni yopish"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="relative h-full shadow-xl">
              <Sidebar onNavigate={() => setMobileNavOpen(false)} className="h-full" />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="absolute top-3 right-3 p-2 rounded-md bg-white text-[var(--editorial-muted)] border border-[var(--editorial-border)]"
                aria-label="Yopish"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <Header onMenuClick={() => setMobileNavOpen(true)} />
          <main
            className="pinm-main phoenix-main editorial-main flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 pb-28 lg:pb-8 transition-[padding] duration-200"
            style={mainRightInset > 0 ? { paddingRight: mainRightInset } : undefined}
          >
            <Outlet />
          </main>
          <AppFooter />
        </div>

        <ArticleChatDock />

        <div className="lg:hidden">
          <BottomNavBar />
        </div>
      </div>
    </MainRightInsetContext.Provider>
  );
};

export default Layout;
