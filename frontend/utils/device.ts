/**
 * Narrow viewport yoki mobil UA — Click to'lov sahifasida QR o'rniga to'g'ridan-to'g'ri yo'naltirish.
 */
export function shouldAutoOpenClickPayment(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(max-width: 768px)').matches) return true;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}
