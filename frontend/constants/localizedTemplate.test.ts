import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localizedTemplateUrl } from './localizedTemplate';
import { CERTIFICATE_TEMPLATE, REPORT_COVER_TEMPLATE } from './antiplagTemplateLayout';
import { UDK_TEMPLATE_IMAGE } from './udkTemplateLayout';

describe('Shablon rasmlarining til nusxalari', () => {
  it("nom: sertifikat.jpg → sertifikat.<lang>.jpg, 'uz' — asl rasm", () => {
    expect(localizedTemplateUrl('/a/sertifikat.jpg', 'uz')).toBe('/a/sertifikat.jpg');
    expect(localizedTemplateUrl('/a/sertifikat.jpg', 'uz-Cyrl')).toBe('/a/sertifikat.uz-cyrl.jpg');
    expect(localizedTemplateUrl('/a/sertifikat.jpg', 'ru')).toBe('/a/sertifikat.ru.jpg');
  });

  it('har bir til uchun public/ da rasm bor', () => {
    for (const url of [CERTIFICATE_TEMPLATE.image, REPORT_COVER_TEMPLATE.image, UDK_TEMPLATE_IMAGE]) {
      for (const lang of ['uz', 'uz-Cyrl', 'ru', 'en'] as const) {
        expect(existsSync(resolve(__dirname, '../public', `.${localizedTemplateUrl(url, lang)}`))).toBe(true);
      }
    }
  });
});
