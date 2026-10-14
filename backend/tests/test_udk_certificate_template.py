"""
UDK ma'lumotnoma asl dizayn shablonida (assets/udk_template/udk_malumotnoma.jpg) chiqadi:
qiymatlar shablon ustiga yoziladi, QR gulchambar ichida, uzun ish nomi ikki qatorga bo'linadi.
"""
import shutil
import tempfile
from io import BytesIO, StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings
from PIL import Image, ImageChops
from PyPDF2 import PdfReader

from apps.udc.models import UDKCertificate
from apps.udc.pdf_generator import (
    ASSETS_DIR, _layout, certificate_document_number, generate_udk_certificate_pdf, render_udk_certificate,
)
from apps.users.models import User

LONG_TITLE = (
    "Raqamli iqtisodiyot sharoitida kichik biznes va xususiy tadbirkorlik subyektlarining moliyaviy "
    "barqarorligini ta'minlashning nazariy va amaliy jihatlari hamda xorijiy tajriba"
)
VALUES = {
    'document_number': 'UDK-000123', 'document_date': '14.10.2026', 'author': 'Valiyev Alisher',
    'title': LONG_TITLE, 'udk_code': '336.6', 'udk_description': 'Moliya',
}


def _changed_box(img, base, box):
    """Shablonga nisbatan o'zgargan piksellar (qiymat yozilgan joy) chegarasi yoki None."""
    diff = ImageChops.difference(img.crop(box).convert('L'), base.crop(box).convert('L'))
    return diff.point(lambda v: 255 if v > 60 else 0).getbbox()


class UdkCertificateTemplateTests(TestCase):
    def setUp(self):
        self.base = Image.open(ASSETS_DIR / _layout()['image']).convert('RGB')

    def test_values_drawn_next_to_labels_and_qr_inside_wreath(self):
        img = render_udk_certificate(VALUES, 'https://ilmiyfaoliyat.uz/#/udk-verify?id=123', scale=1)
        self.assertEqual(img.size, self.base.size)
        fields = _layout()['fields']
        for key in ('document_number', 'document_date', 'author', 'udk_code'):
            spec = fields[key]
            box = (spec['x'], spec['y'] - 40, spec['x'] + spec['max_width'], spec['y'] + 12)
            self.assertIsNotNone(_changed_box(img, self.base, box), key)
        # Shablonning chap (yorliqlar) ustuni o'zgarmagan
        self.assertIsNone(_changed_box(img, self.base, (60, 500, 620, 760)))
        # QR gulchambar markazida
        qr = _layout()['qr']
        half = qr['size'] // 2
        self.assertIsNotNone(_changed_box(img, self.base, (
            qr['center_x'] - half, qr['center_y'] - half, qr['center_x'] + half, qr['center_y'] + half)))

    def test_long_title_wraps_without_touching_udk_row(self):
        from PIL import ImageFont
        from apps.articles.antiplagiat_template_render import _font
        if not isinstance(_font(30), ImageFont.FreeTypeFont):
            self.skipTest('TrueType shrift topilmadi (Arial/Liberation/DejaVu)')
        img = render_udk_certificate(VALUES, scale=1)
        title = _layout()['fields']['title']
        box = _changed_box(img, self.base, (title['x'], 575, title['x'] + title['max_width'], 636))
        self.assertIsNotNone(box)
        top, bottom = 575 + box[1], 575 + box[3]
        self.assertGreater(bottom - top, 30)  # ikki qator
        self.assertLess(bottom, 635)  # UDK raqami (yuqori cheti ~637) dan oldin tugaydi

    def test_pdf_is_single_landscape_page(self):
        data = generate_udk_certificate_pdf(LONG_TITLE, 'Ali', '004.8', 'AI', 'UDK-000001', '14.10.2026',
                                            'https://ilmiyfaoliyat.uz/#/udk-verify?id=1').read()
        pages = PdfReader(BytesIO(data)).pages
        self.assertEqual(len(pages), 1)
        self.assertGreater(float(pages[0].mediabox.width), float(pages[0].mediabox.height))


class RegenerateUdkPdfsTests(TestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media, ignore_errors=True)
        user = User.objects.create_user(phone='998900000501', password='x-parol-123', email='u@udk5.uz',
                                        first_name='A', last_name='B', role='author')
        self.cert = UDKCertificate.objects.create(user=user, title='Mavzu', udk_code='004.8')

    def test_all_flag_regenerates_existing_pdf(self):
        with override_settings(MEDIA_ROOT=self.media):
            call_command('regenerate_udk_pdfs', '--apply', stdout=StringIO())
            self.cert.refresh_from_db()
            first = self.cert.certificate_path.name
            self.assertTrue(first)
            call_command('regenerate_udk_pdfs', '--apply', '--all', stdout=StringIO())
            self.cert.refresh_from_db()
            self.assertTrue(self.cert.certificate_path.storage.exists(self.cert.certificate_path.name))
            if first != self.cert.certificate_path.name:  # eski fayl o'chirilgan
                self.assertFalse(self.cert.certificate_path.storage.exists(first))

    def test_document_number_format(self):
        self.assertEqual(certificate_document_number(self.cert), f'UDK-{self.cert.id:06d}')
