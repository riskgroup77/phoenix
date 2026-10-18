"""
Jurnal boshqaruvi: rasm saqlanishi, rukn (nashr turi) va soha alohida, arxivlash, to'liq ro'yxatlar.
"""
import io
import json
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.articles.models import Article
from apps.journals.models import Journal, JournalCategory, ScientificField
from apps.users.models import User

MEDIA = tempfile.mkdtemp(prefix='phx-journal-admin-')
URL = '/api/v1/journals/journals/'


def _png():
    buf = io.BytesIO()
    Image.new('RGB', (40, 40), 'teal').save(buf, format='PNG')
    return SimpleUploadedFile('muqova.png', buf.getvalue(), 'image/png')


@override_settings(MEDIA_ROOT=MEDIA, PHONE_VERIFICATION_REQUIRED=False)
class JournalAdminTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.admin = User.objects.create_user(phone='998900008001', password='x-parol-123', email='sa@j.uz',
                                              first_name='S', last_name='A', role='super_admin')
        self.author = User.objects.create_user(phone='998900008002', password='x-parol-123', email='au@j.uz',
                                               first_name='A', last_name='U', role='author')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def _create(self, **extra):
        econ = ScientificField.objects.get(name='Iqtisodiyot')
        it = ScientificField.objects.get(name='Axborot texnologiyalari (IT)')
        data = {
            'name': 'Iqtisodiyot va IT', 'issn': '2181-9999', 'description': 'd',
            'journal_admin': str(self.admin.id), 'category_name': 'Mahalliy OAK jurnallari',
            'scientific_fields': json.dumps([str(econ.id), str(it.id)]),
            'additional_document_config': json.dumps({'required': True, 'label': 'Taqriz', 'type': 'file'}),
            'image_url': _png(), **extra,
        }
        return self.client.post(URL, data, format='multipart')

    def test_create_with_image_category_and_fields(self):
        res = self._create()
        self.assertEqual(res.status_code, 201, res.content)
        journal = Journal.objects.get(pk=res.data['id'])
        self.assertTrue(journal.image_url, 'rasm saqlanmadi')
        self.assertEqual(journal.category.name, 'Mahalliy OAK jurnallari')
        self.assertEqual(sorted(res.data['scientific_field_names']), ['Axborot texnologiyalari (IT)', 'Iqtisodiyot'])
        self.assertTrue(journal.additional_doc_required)
        self.assertEqual(journal.additional_doc_label, 'Taqriz')
        detail = self.client.get(f'{URL}{journal.id}/').data
        self.assertTrue(str(detail['image_url']).startswith('http'))

    def test_update_replaces_and_removes_image(self):
        journal = Journal.objects.get(pk=self._create().data['id'])
        res = self.client.patch(f'{URL}{journal.id}/', {'image_url': _png()}, format='multipart')
        self.assertEqual(res.status_code, 200, res.content)
        res = self.client.patch(f'{URL}{journal.id}/', {'remove_image': 'true'}, format='multipart')
        journal.refresh_from_db()
        self.assertFalse(journal.image_url)

    def test_full_category_and_field_lists(self):
        for i in range(25):
            JournalCategory.objects.create(name=f'Rukn {i:02d}')
        cats = self.client.get('/api/v1/journals/categories/').data
        self.assertIsInstance(cats, list)
        self.assertGreaterEqual(len(cats), 25)
        fields = APIClient().get('/api/v1/journals/scientific-fields/').data
        self.assertGreaterEqual(len(fields), 30)

    def test_archived_journal_hidden_from_authors_and_rejects_articles(self):
        journal = Journal.objects.get(pk=self._create().data['id'])
        Article.objects.create(title='Maqola', abstract='a', author=self.author, journal=journal, status='Yangi')
        self.assertTrue(self.client.delete(f'{URL}{journal.id}/').data['archived'])
        author = APIClient()
        author.force_authenticate(self.author)
        rows = author.get(URL).data
        rows = rows.get('results', rows) if isinstance(rows, dict) else rows
        self.assertNotIn(str(journal.id), {r['id'] for r in rows})
        res = author.post('/api/v1/articles/', {'title': 'Yangi', 'abstract': 'a', 'keywords': ['x'],
                                                'journal': str(journal.id), 'page_count': 1}, format='json')
        self.assertEqual(res.status_code, 400)
