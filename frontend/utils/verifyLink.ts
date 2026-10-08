/**
 * Sertifikat va hisobotlardagi QR havolalari.
 * Ilova HashRouter'da ishlaydi — to'g'ri manzil https://ilmiyfaoliyat.uz/#/verify/<kod>.
 * (QR kodlar lokal yaratiladi — hujjat raqami tashqi QR xizmatiga yuborilmaydi.)
 */
export const PUBLIC_SITE = 'https://ilmiyfaoliyat.uz';

export const verifyUrl = (code: string | number) => `${PUBLIC_SITE}/#/verify/${encodeURIComponent(String(code))}`;

export const publicArticleUrl = (articleId: string) => `${PUBLIC_SITE}/#/public/article/${encodeURIComponent(articleId)}`;
