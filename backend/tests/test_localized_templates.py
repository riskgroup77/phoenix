"""
Yorliqlari rasmga «pishirilgan» shablonlar (antiplagiat sertifikati/hisobot muqovasi, UDK ma'lumotnoma)
foydalanuvchi interfeysi tilida chiqadi: <nom>.<lang>.jpg nusxalari (scripts/build_localized_templates.py).
"""
import shutil
import tempfile
from io import BytesIO
from pathlib import Path

from django.test import TestCase, override_settings
from PIL import Image, ImageChops
from PyPDF2 import PdfReader
from rest_framework.test import APIClient

from apps.articles.antiplagiat_template_render import (
    ASSETS_DIR as ANTIPLAG_DIR, localized_template_path, render_certificate, render_report_cover,
)
from apps.udc.models import UDKCertificate
from apps.udc.pdf_generator import ASSETS_DIR as UDK_DIR, render_udk_certificate, save_certificate_pdf
from apps.users.models import User

FRONTEND_PUBLIC = Path(__file__).resolve().parents[2] / 'frontend' / 'public'
VARIANTS = (
    (ANTIPLAG_DIR, FRONTEND_PUBLIC / 'antiplag-templates', 'sertifikat.jpg'),
    (ANTIPLAG_DIR, FRONTEND_PUBLIC / 'antiplag-templates', 'hisobot1.jpg'),
    (UDK_DIR, FRONTEND_PUBLIC / 'udk-template', 'udk_malumotnoma.jpg'),
)


def _differs(a: Image.Image, b: Image.Image, box) -> bool:
    diff = ImageChops.difference(a.crop(box).convert('L'), b.crop(box).convert('L'))
    return diff.point(lambda v: 255 if v > 60 else 0).getbbox() is not None


class LocalizedTemplateFilesTests(TestCase):
    def test_variants_exist_same_size_and_mirrored_in_frontend(self):
        for backend_dir, frontend_dir, image in VARIANTS:
            base = Image.open(backend_dir / image)
            for lang in ('ru', 'en', 'uz-cyrl'):
                path = localized_template_path(backend_dir, image, lang)
                self.assertNotEqual(path.name, image, (image, lang))
                self.assertEqual(Image.open(path).size, base.size)
                mirror = frontend_dir / path.name
                if frontend_dir.is_dir():
                    self.assertEqual(mirror.read_bytes(), path.read_bytes(), mirror)

    def test_lang_codes_resolve(self):
        self.assertEqual(localized_template_path(UDK_DIR, 'udk_malumotnoma.jpg', 'uz').name, 'udk_malumotnoma.jpg')
        self.assertEqual(localized_template_path(UDK_DIR, 'udk_malumotnoma.jpg', 'uz-Cyrl').name,
                         'udk_malumotnoma.uz-cyrl.jpg')
        self.assertEqual(localized_template_path(UDK_DIR, 'udk_malumotnoma.jpg', 'ru-RU,ru;q=0.9').name,
                         'udk_malumotnoma.ru.jpg')
        # nusxa yo'q bo'lsa — asl rasm
        self.assertEqual(localized_template_path(ANTIPLAG_DIR, 'hisobot2.jpg', 'en').name, 'hisobot2.jpg')

    def test_renderers_use_language_variant(self):
        uz = render_udk_certificate({}, scale=1)
        ru = render_udk_certificate({}, scale=1, lang='ru')
        self.assertTrue(_differs(uz, ru, (60, 500, 640, 760)))  # yorliqlar ustuni
        self.assertFalse(_differs(uz, ru, (1300, 600, 2000, 1414)))  # bezak o'zgarmagan
        self.assertTrue(_differs(render_certificate({}), render_certificate({}, lang='en'), (170, 880, 800, 1480)))
        self.assertTrue(_differs(render_report_cover({}), render_report_cover({}, lang='uz-cyrl'),
                                 (100, 1370, 1190, 1680)))


class UdkDownloadLanguageTests(TestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media, ignore_errors=True)
        self.user = User.objects.create_user(phone='998900000611', password='x-parol-123', email='u@udk6.uz',
                                             first_name='A', last_name='B', role='author')
        self.cert = UDKCertificate.objects.create(user=self.user, title='Mavzu', udk_code='004.8')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = f'/api/v1/udc/certificates/{self.cert.id}/download/'

    def test_uz_serves_stored_file_other_langs_render_on_demand(self):
        with override_settings(MEDIA_ROOT=self.media):
            save_certificate_pdf(self.cert)
            stored = Path(self.cert.certificate_path.path).read_bytes()
            r = self.client.get(self.url)
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.content, stored)
            r = self.client.get(self.url, HTTP_ACCEPT_LANGUAGE='ru')
            self.assertEqual(r.status_code, 200)
            self.assertNotEqual(r.content, stored)
            self.assertIn('_ru.pdf', r['Content-Disposition'])
            self.assertEqual(len(PdfReader(BytesIO(r.content)).pages), 1)
            r = self.client.get(self.url + '?lang=uz-Cyrl')
            self.assertIn('_uz-cyrl.pdf', r['Content-Disposition'])

    def test_missing_stored_file_is_rendered(self):
        with override_settings(MEDIA_ROOT=self.media):
            r = self.client.get(self.url)
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r['Content-Type'], 'application/pdf')
