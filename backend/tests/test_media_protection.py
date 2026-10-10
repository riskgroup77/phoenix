"""
Media himoyasi: maxfiy fayllar faqat imzoli, muddatli havola bilan; ochiq papkalar va nashr etilgan PDF — ochiq.
"""
import os
import time
from urllib.parse import parse_qs, urlparse

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import TestCase, override_settings

from config.media_protection import is_public, sign, verify
from tests.test_p1_integrity import Fixture


class SigningTests(TestCase):
    def test_public_prefixes(self):
        self.assertTrue(is_public('journals/a.png'))
        self.assertTrue(is_public('articles/publication_certificates/c.pdf'))
        self.assertFalse(is_public('articles/pdfs/abc/x.pdf'))
        self.assertFalse(is_public('receipts/x.pdf'))

    def test_sign_and_verify(self):
        exp, sig = sign('receipts/a.pdf')
        self.assertTrue(verify('receipts/a.pdf', str(exp), sig))
        self.assertFalse(verify('receipts/b.pdf', str(exp), sig))  # boshqa fayl
        self.assertFalse(verify('receipts/a.pdf', str(exp + 1), sig))  # muddat o'zgartirilgan
        self.assertFalse(verify('receipts/a.pdf', str(exp), None))
        past_exp, past_sig = sign('receipts/a.pdf', now=time.time() - 10 * 24 * 3600)
        self.assertFalse(verify('receipts/a.pdf', str(past_exp), past_sig))  # eskirgan

    def test_storage_url_signs_only_private(self):
        self.assertNotIn('?', default_storage.url('journals/logo.png'))
        url = default_storage.url('doi_requests/abc/file.pdf')
        q = parse_qs(urlparse(url).query)
        self.assertIn('e', q)
        self.assertIn('s', q)


class ProtectedViewTests(Fixture):
    def setUp(self):
        super().setUp()
        self.private = default_storage.save('receipts/test/chek.pdf', ContentFile(b'%PDF-1.4 secret'))
        self.public = default_storage.save('journals/test/logo.png', ContentFile(b'PNG'))

    def tearDown(self):
        for name in (self.private, self.public):
            default_storage.delete(name)
        super().tearDown()

    def get(self, url):
        # Javob o'qib yopiladi (Windows'da ochiq fayl o'chirilmaydi)
        r = self.client.get(url)
        r.body = b''.join(r.streaming_content) if getattr(r, 'streaming', False) else r.content
        r.close()
        return r

    def test_private_without_signature_forbidden(self):
        r = self.get(f'/media/{self.private}')
        self.assertEqual(r.status_code, 403)
        self.assertIn('muddati', r.content.decode())

    def test_private_with_api_url_ok(self):
        r = self.get(default_storage.url(self.private))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.body, b'%PDF-1.4 secret')
        self.assertIn('private', r['Cache-Control'])

    def test_tampered_signature_forbidden(self):
        url = default_storage.url(self.private)
        self.assertEqual(self.get(url[:-3] + 'abc').status_code, 403)

    def test_public_folder_open(self):
        self.assertEqual(self.get(f'/media/{self.public}').status_code, 200)

    def test_path_traversal_404(self):
        self.assertEqual(self.get('/media/../config/settings.py').status_code, 404)
        self.assertEqual(self.get('/media/receipts/../../manage.py').status_code, 404)

    def test_published_pdf_open_unpublished_private(self):
        from apps.articles.models import Article

        art = Article.objects.create(title='T', abstract='a', author=self.author, journal=self.journal, status='WithEditor')
        art.final_pdf_path.save('maqola.pdf', ContentFile(b'%PDF manuscript'), save=True)
        name = art.final_pdf_path.name
        self.assertEqual(self.get(f'/media/{name}').status_code, 403)
        Article.objects.filter(pk=art.pk).update(status='Published')
        self.assertEqual(self.get(f'/media/{name}').status_code, 200)
        art.final_pdf_path.delete(save=False)

    @override_settings(MEDIA_ACCEL_REDIRECT=True)
    def test_accel_redirect_for_nginx(self):
        r = self.get(default_storage.url(self.private))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r['X-Accel-Redirect'], f'/_protected_media/{self.private}')

    @override_settings(MEDIA_PROTECTION_ENABLED=False)
    def test_can_be_disabled(self):
        self.assertEqual(self.get(f'/media/{self.private}').status_code, 200)
        self.assertNotIn('?', default_storage.url(self.private))

    def test_api_returns_signed_file_url(self):
        from rest_framework.test import APIClient

        from apps.articles.models import Article

        art = Article.objects.create(title='T', abstract='a', author=self.author, journal=self.journal, status='WithEditor')
        art.final_pdf_path.save('m.pdf', ContentFile(b'%PDF x'), save=True)
        c = APIClient()
        c.force_authenticate(self.author)
        body = c.get(f'/api/v1/articles/{art.pk}/').json()
        urls = [v for v in body.values() if isinstance(v, str) and art.final_pdf_path.name.split('/')[-1] in v]
        self.assertTrue(urls, body.keys())
        self.assertIn('s=', urls[0])
        self.assertEqual(self.get(urlparse(urls[0]).path + '?' + urlparse(urls[0]).query).status_code, 200)
        art.final_pdf_path.delete(save=False)
        self.assertFalse(os.path.exists(os.path.join(settings.MEDIA_ROOT, art.final_pdf_path.name or 'x')))
