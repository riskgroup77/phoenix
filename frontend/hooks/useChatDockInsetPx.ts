import { useState, useEffect } from 'react';

/** Chat paneli kengligi — ekranning aynan 15% i (viewport) */
const VIEWPORT_FRACTION = 0.15;

function measureChatPanelWidth(): number {
  if (typeof window === 'undefined') return 0;
  return Math.round(window.innerWidth * VIEWPORT_FRACTION);
}

export function useChatDockInsetPx(enabled: boolean): number {
  const [px, setPx] = useState(() => (typeof window !== 'undefined' ? measureChatPanelWidth() : 0));

  useEffect(() => {
    if (!enabled) return;
    setPx(measureChatPanelWidth());
    const onResize = () => setPx(measureChatPanelWidth());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [enabled]);

  return enabled ? px : 0;
}
