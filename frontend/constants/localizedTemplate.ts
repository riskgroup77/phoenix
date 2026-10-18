import type { Lang } from '../i18n/LanguageContext';

/**
 * Yorliqlari rasmga «pishirilgan» shablonlarning til nusxasi:
 *   /antiplag-templates/sertifikat.jpg → sertifikat.ru.jpg | sertifikat.en.jpg | sertifikat.uz-cyrl.jpg
 * Nusxalar scripts/build_localized_templates.py bilan yaratiladi (backend localized_template_path bilan bir xil nom).
 * 'uz' — asl rasm.
 */
export function localizedTemplateUrl(url: string, lang: Lang): string {
  if (lang === 'uz') return url;
  const dot = url.lastIndexOf('.');
  if (dot < 0) return url;
  return `${url.slice(0, dot)}.${lang.toLowerCase()}${url.slice(dot)}`;
}
