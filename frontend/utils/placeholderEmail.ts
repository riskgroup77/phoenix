/** Ro'yxatdan o'tishda email kiritilmasa server yaratadigan vaqtinchalik manzil (telefon_vaqt@temp.phoenix.uz) */
export const isPlaceholderEmail = (email?: string | null): boolean => !email || /@temp\.phoenix\.uz$/i.test(email);

/** Ko'rsatish uchun: vaqtinchalik bo'lsa bo'sh qator */
export const displayEmail = (email?: string | null): string => (isPlaceholderEmail(email) ? '' : String(email));
