"""Profil rasmi: /api/v1/auth/avatar/ — faqat haqiqiy rasm, 5 MB gacha, o'chirish ham ishlaydi."""
import io
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.users.models import User

MEDIA = tempfile.mkdtemp(prefix='phoenix-avatar-test-')


def _png(size=(64, 64)):
    buf = io.BytesIO()
    Image.new('RGB', size, (31, 63, 143)).save(buf, format='PNG')
    return buf.getvalue()


@override_settings(MEDIA_ROOT=MEDIA)
class AvatarUploadTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.user = User.objects.create_user(phone='998900000401', password='x-parol-123', email='av@t.uz',
                                             first_name='A', last_name='V', role='author')
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_upload_valid_image_then_delete(self):
        r = self.api.post('/api/v1/auth/avatar/', {'avatar': SimpleUploadedFile('me.png', _png(), 'image/png')},
                          format='multipart')
        self.assertEqual(r.status_code, 200, r.content[:200])
        self.assertTrue(r.json()['avatar_url'])
        self.user.refresh_from_db()
        self.assertTrue(self.user.avatar_url.name.startswith('avatars/'))
        self.assertTrue(self.user.avatar_url.name.endswith('.png'))  # nom serverda yaratiladi, "me.png" emas

        r = self.api.delete('/api/v1/auth/avatar/')
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar_url)

    def test_rejects_non_image_even_with_image_extension(self):
        r = self.api.post('/api/v1/auth/avatar/',
                          {'avatar': SimpleUploadedFile('evil.png', b'<?php echo 1; ?>', 'image/png')},
                          format='multipart')
        self.assertEqual(r.status_code, 400)
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar_url)

    def test_requires_authentication(self):
        r = APIClient().post('/api/v1/auth/avatar/', {'avatar': SimpleUploadedFile('a.png', _png(), 'image/png')},
                             format='multipart')
        self.assertIn(r.status_code, (401, 403))
