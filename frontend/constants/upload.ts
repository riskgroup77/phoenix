/** Backend MAX_UPLOAD_MB bilan mos kelishi kerak (default 25). */
export const MAX_UPLOAD_MB = 25;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function formatMaxUploadLabel(): string {
  return `${MAX_UPLOAD_MB}MB`;
}
