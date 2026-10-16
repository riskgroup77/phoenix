/**
 * Katta hujjat yuklash chegarasi: antiplagiat tekshiruvi va kitob qo'lyozmasi (dissertatsiya, kitob).
 * Backend: config/upload_validation.py LARGE_DOCUMENT_MAX_MB; nginx: snippets/phoenix-media.conf (100m).
 * Oddiy jurnal maqolasi alohida — 25 MB (SubmitArticle MAX_FILE_MB va backend DEFAULT_MAX_MB).
 */
export const MAX_UPLOAD_MB = 100;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function formatMaxUploadLabel(): string {
  return `${MAX_UPLOAD_MB}MB`;
}
