/**
 * To'lovdan keyin qayerga qaytish va qanday xabar ko'rsatish (Click return_url → #/payment/return).
 * Oraliq "Click To'lov" sahifasi ko'rsatilmaydi: foydalanuvchi to'g'ridan-to'g'ri o'z xizmati sahifasiga
 * qaytadi va natija alert (toast) bilan chiqadi.
 */

/** Holatni tekshirish oralig'i — avval 3000 ms edi (2 barobar tezroq) */
export const PAYMENT_POLL_INTERVAL_MS = 1500;
/** Click callback kechiksa shuncha kutamiz, keyin "kutilmoqda" xabari bilan qaytamiz */
export const PAYMENT_RETURN_MAX_WAIT_MS = 30_000;

export type ReturnTx = {
  id: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  service_type?: string;
  article?: string | null;
  error_note?: string;
};

const SERVICE_SUCCESS: Record<string, string> = {
  publication_fee: "To'lov muvaffaqiyatli! Maqolangiz tahririyatga yuborildi.",
  language_editing: "To'lov muvaffaqiyatli! Antiplagiat tekshiruvi boshlanmoqda.",
  book_publication: "To'lov muvaffaqiyatli! Kitob buyurtmangiz qabul qilindi.",
  translation: "To'lov muvaffaqiyatli! Tarjima buyurtmangiz ishga tushdi.",
  udk_request: "To'lov muvaffaqiyatli! UDK so'rovingiz taqrizchiga yuborildi.",
  doi_request: "To'lov muvaffaqiyatli! DOI so'rovingiz qabul qilindi.",
  article_sample: "To'lov muvaffaqiyatli! Buyurtmangiz qabul qilindi.",
};

/** To'lovdan keyin ochiladigan sahifa (xizmat turiga qarab) */
export function paymentDestination(tx: Pick<ReturnTx, 'id' | 'service_type' | 'article'> | null): string {
  switch (tx?.service_type) {
    case 'publication_fee':
    case 'book_publication':
      return '/articles';
    case 'language_editing':
      // Antiplagiat sahifasi to'lovdan keyin tekshiruvni o'zi davom ettiradi
      return `/plagiarism-check?payment_return=1&transaction_id=${encodeURIComponent(tx.id)}`;
    case 'translation':
      return '/my-translations';
    case 'udk_request':
      return '/udk-olish';
    case 'doi_request':
      return '/doi-olish';
    case 'article_sample':
      return '/maqola-namuna-olish';
    default:
      return '/payments';
  }
}

export function paymentSuccessMessage(serviceType?: string): string {
  return (serviceType && SERVICE_SUCCESS[serviceType]) || "To'lov muvaffaqiyatli amalga oshirildi!";
}
