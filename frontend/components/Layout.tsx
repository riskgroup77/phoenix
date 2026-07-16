import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import BottomNavBar from './BottomNavBar';
import ScrollingBanner from './ScrollingBanner';
import ArticleChatDock, { MainRightInsetContext } from './ArticleChatDock';

const Layout: React.FC = () => {
  const [mainRightInset, setMainRightInset] = useState(0);

  return (
    <MainRightInsetContext.Provider value={setMainRightInset}>
      <div className="flex flex-col h-screen bg-transparent">
        <ScrollingBanner />
        <Header />
        <main
          className="phoenix-main flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-6 md:p-8 pb-32 md:pb-8 transition-[padding] duration-200 ease-out motion-safe:animate-[phoenix-main-in_0.45s_ease-out_both]"
          style={mainRightInset > 0 ? { paddingRight: mainRightInset } : undefined}
        >
          <Outlet />
        </main>

        <ArticleChatDock />

        <div className="md:hidden">
          <BottomNavBar />
        </div>
      </div>
    </MainRightInsetContext.Provider>
  );
};

export default Layout;