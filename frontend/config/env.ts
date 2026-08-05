/**
 * Production / dev feature flags.
 * Payment test tools are hidden unless explicitly enabled via VITE_ENABLE_PAYMENT_TEST=true.
 */
export const isProductionBuild = import.meta.env.PROD;

export const showPaymentTestTools =
  !import.meta.env.PROD ||
  String(import.meta.env.VITE_ENABLE_PAYMENT_TEST || '').toLowerCase() === 'true';

/** Support contact shown on forgot-password and help flows */
export const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '+998 90 123 45 67';
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@ilmiyfaoliyat.uz';
export const SUPPORT_TELEGRAM = import.meta.env.VITE_SUPPORT_TELEGRAM || '';
