/** Navigatsiya havolasi joriy sahifaga mos keladimi (query ?tab= ham hisobga olinadi). */
export function isNavItemActive(to: string, pathname: string, search: string): boolean {
  const [path, query] = to.split('?');
  if (path === '/profile') {
    if (pathname !== '/profile') return false;
    const currentTab = new URLSearchParams(search).get('tab') || 'profile';
    const itemTab = new URLSearchParams(query || '').get('tab') || 'profile';
    return currentTab === itemTab;
  }
  if (query) {
    return pathname === path && search.includes(query);
  }
  if (to === '/dashboard' || to === '/operator-dashboard') {
    return pathname === to;
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}
