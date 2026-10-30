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

/**
 * Brauzer PDF'ni <iframe> ichida ko'rsata oladimi. Android Chrome umuman ko'rsatmaydi (bo'sh oyna),
 * iOS Safari faqat birinchi sahifani — telefonda PDF yangi oynada ochiladi.
 */
export function canPreviewPdfInline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
