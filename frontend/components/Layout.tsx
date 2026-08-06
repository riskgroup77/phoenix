import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNavBar from './BottomNavBar';
import ScrollingBanner from './ScrollingBanner';
import ArticleChatDock, { MainRightInsetContext } from './ArticleChatDock';
import { X } from 'lucide-react';

const Layout: React.FC = () => {
  const [mainRightInset, setMainRightInset] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <MainRightInsetContext.Provider value={setMainRightInset}>
      <div className="pinm-app-shell flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
        <ScrollingBanner />

        <div className="flex flex-1 min-h-0">
          {/* Desktop sidebar */}
          <div className="hidden lg:flex shrink-0">
            <Sidebar />
          </div>

          {/* Mobile drawer */}
          {mobileNavOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <button
                type="button"
                className="absolute inset-0 bg-slate-900/40"
                aria-label="Menyuni yopish"
                onClick={() => setMobileNavOpen(false)}
              />
              <div className="relative h-full shadow-xl">
                <Sidebar onNavigate={() => setMobileNavOpen(false)} className="h-full" />
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="absolute top-3 right-3 p-2 rounded-lg bg-white/90 text-slate-600 shadow"
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
              className="pinm-main phoenix-main flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 pb-28 lg:pb-8 transition-[padding] duration-200"
              style={mainRightInset > 0 ? { paddingRight: mainRightInset } : undefined}
            >
              <Outlet />
            </main>
          </div>
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
