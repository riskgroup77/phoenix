/**
 * Ommaviy oferta va maxfiylik siyosati uchun rekvizitlar.
 *
 * MUHIM: ishga tushirishdan oldin kompaniya rekvizitlarini kiriting (frontend .env.production):
 *   VITE_LEGAL_NAME="«Phoenix Ilmiy Nashrlar Markazi» MChJ"
 *   VITE_LEGAL_INN=123456789
 *   VITE_LEGAL_ADDRESS="Toshkent sh., ... ko'chasi, ..."
 *   VITE_LEGAL_BANK="... bank" ; VITE_LEGAL_ACCOUNT=2020800... ; VITE_LEGAL_MFO=00...
 *   VITE_LEGAL_DIRECTOR="F.I.Sh."
 * Matnlar O'zbekiston qonunchiligi tuzilishiga mos QORALAMA — e'lon qilishdan oldin yuristga ko'rsating.
 * Matn o'zgarsa — LEGAL_VERSION ni yangilang (foydalanuvchilar qaysi tahririga rozilik bergani saqlanadi).
 */
import { SUPPORT_EMAIL, SUPPORT_PHONE } from './env';

const env = import.meta.env;

export const LEGAL_VERSION = '2026-10-10';

export const LEGAL = {
  name: (env.VITE_LEGAL_NAME as string) || '[Tashkilot nomi]',
  inn: (env.VITE_LEGAL_INN as string) || '[STIR]',
  address: (env.VITE_LEGAL_ADDRESS as string) || '[Yuridik manzil]',
  bank: (env.VITE_LEGAL_BANK as string) || '[Bank nomi]',
  account: (env.VITE_LEGAL_ACCOUNT as string) || '[Hisob raqami]',
  mfo: (env.VITE_LEGAL_MFO as string) || '[MFO]',
  director: (env.VITE_LEGAL_DIRECTOR as string) || '[Rahbar F.I.Sh.]',
  site: 'https://ilmiyfaoliyat.uz',
  email: SUPPORT_EMAIL,
  phone: SUPPORT_PHONE,
};

/** Rekvizitlar to'ldirilmaganmi (ogohlantirish ko'rsatish uchun) */
export const legalDetailsMissing = (): boolean =>
  Object.values(LEGAL).some((v) => typeof v === 'string' && v.startsWith('['));
