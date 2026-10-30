"""
Bosh admin panelidan jurnal qo'shish: frontend (JournalManagement.tsx → apiService.journals.create) yuboradigan
aynan shu shakldagi so'rovlar — JSON (rasmsiz) va multipart (rasm bilan), mavjud rukn ID si yoki yangi nashr turi
nomi (category_name), soha (scientific_fields) bilan.
"""
import io
import json
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.journals.models import Journal, JournalCategory, ScientificField
from apps.users.models import User

MEDIA = tempfile.mkdtemp(prefix='phoenix-journal-create-')


def _png():
    from PIL import Image

    buf = io.BytesIO()
    Image.new('RGB', (8, 8), (40, 108, 129)).save(buf, format='PNG')
    return SimpleUploadedFile('muqova.png', buf.getvalue(), 'image/png')


@override_settings(MEDIA_ROOT=MEDIA)
class JournalCreateFromAdminPanelTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.admin = User.objects.create_user(phone='998900007001', password='pass12345', email='sa@qa.uz',
                                              first_name='Bosh', last_name='Admin', role='super_admin')
        self.editor = User.objects.create_user(phone='998900007002', password='pass12345', email='ja@qa.uz',
                                               first_name='Jurnal', last_name='Muharrir', role='journal_admin')
        self.category, _ = JournalCategory.objects.get_or_create(name='OAK jurnali')
        self.field, _ = ScientificField.objects.get_or_create(name='Iqtisodiyot')
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def ui_payload(self, **over):
        """JournalManagement.tsx handleSaveJournal → newJournalData (yangi jurnal)."""
        data = {
            'name': 'Yangi ilmiy jurnal',
            'issn': '2181-0001',
            'description': 'Jurnal tavsifi',
            'journal_admin': str(self.editor.id),
            'category': str(self.category.id),
            'scientific_fields': [str(self.field.id)],
            'payment_model': 'post-payment',
            'pricing_type': 'fixed',
            'publication_fee': 150000,
            'price_per_page': 0,
            'plagiarism_max_percent': None,
            'ai_content_max_percent': None,
            'originality_min_percent': None,
            'additional_document_config': {'required': False, 'label': 'Taqriz fayli', 'type': 'file'},
        }
        data.update(over)
        return data

    def multipart(self, data):
        """apiService.journals.create (rasm bilan): ro'yxat/obyekt JSON satr, null qiymatlar yuborilmaydi."""
        form = {}
        for key, value in data.items():
            if value is None:
                continue
            form[key] = json.dumps(value) if isinstance(value, (list, dict)) else str(value)
        form['image_url'] = _png()
        return form

    def assert_created(self, res):
        self.assertEqual(res.status_code, 201, res.content[:600])
        journal = Journal.objects.get(pk=res.json()['id'])
        self.assertEqual(journal.journal_admin_id, self.editor.id)
        return journal

    def test_json_with_existing_category(self):
        journal = self.assert_created(self.api.post('/api/v1/journals/journals/', self.ui_payload(), format='json'))
        self.assertEqual(list(journal.scientific_fields.all()), [self.field])

    def test_json_with_new_publication_type(self):
        payload = self.ui_payload()
        payload.pop('category')
        payload['category_name'] = 'Xalqaro jurnal'
        journal = self.assert_created(self.api.post('/api/v1/journals/journals/', payload, format='json'))
        self.assertEqual(journal.category.name, 'Xalqaro jurnal')

    def test_multipart_with_image(self):
        res = self.api.post('/api/v1/journals/journals/', self.multipart(self.ui_payload()), format='multipart')
        journal = self.assert_created(res)
        self.assertTrue(journal.image_url)
        self.assertEqual(list(journal.scientific_fields.all()), [self.field])

    def test_country_and_website(self):
        payload = self.ui_payload(country="  O'zbekiston ", website='jurnal.uz')
        journal = self.assert_created(self.api.post('/api/v1/journals/journals/', payload, format='json'))
        self.assertEqual(journal.country, "O'zbekiston")
        self.assertEqual(journal.website, 'https://jurnal.uz')

    def test_large_cover_is_shrunk(self):
        from io import BytesIO

        from PIL import Image

        buf = BytesIO()
        Image.effect_noise((2400, 3200), 64).convert('RGB').save(buf, format='JPEG', quality=95)
        big = SimpleUploadedFile('katta.jpg', buf.getvalue(), 'image/jpeg')
        data = self.multipart(self.ui_payload())
        data['image_url'] = big
        journal = self.assert_created(self.api.post('/api/v1/journals/journals/', data, format='multipart'))
        with Image.open(journal.image_url.path) as im:
            self.assertLessEqual(max(im.size), 800)

    def test_multipart_with_new_publication_type_and_no_fields(self):
        payload = self.ui_payload(scientific_fields=[])
        payload.pop('category')
        payload['category_name'] = 'Konferensiya to\'plami'
        self.assert_created(self.api.post('/api/v1/journals/journals/', self.multipart(payload), format='multipart'))

    def test_multipart_with_several_fields(self):
        other, _ = ScientificField.objects.get_or_create(name='Pedagogika')
        payload = self.ui_payload(scientific_fields=[str(self.field.id), str(other.id)])
        journal = self.assert_created(self.api.post('/api/v1/journals/journals/', self.multipart(payload), format='multipart'))
        self.assertEqual(journal.scientific_fields.count(), 2)

    def test_optional_text_fields_may_be_empty(self):
        # Formada tavsif va ISSN majburiy emas — bo'sh qoldirilsa ham jurnal yaratilishi kerak
        res = self.api.post('/api/v1/journals/journals/', self.ui_payload(description='', issn=''), format='json')
        self.assert_created(res)

    def test_two_journals_without_issn(self):
        self.assert_created(self.api.post('/api/v1/journals/journals/', self.ui_payload(issn=''), format='json'))
        self.assert_created(self.api.post('/api/v1/journals/journals/', self.ui_payload(name='Ikkinchi', issn=''), format='json'))

    def test_empty_issn_saved_as_null(self):
        journal = self.assert_created(self.api.post('/api/v1/journals/journals/', self.ui_payload(issn=''), format='json'))
        self.assertIsNone(journal.issn)
        self.assertEqual(str(journal), journal.name)

    def test_issn_format_and_duplicate_messages(self):
        res = self.api.post('/api/v1/journals/journals/', self.ui_payload(issn='12345'), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('XXXX-XXXX', res.json()['issn'][0])
        self.assert_created(self.api.post('/api/v1/journals/journals/', self.ui_payload(), format='json'))
        res = self.api.post('/api/v1/journals/journals/', self.ui_payload(name='Takror'), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('allaqachon', res.json()['issn'][0])

    def test_update_keeps_legacy_issn(self):
        legacy = Journal.objects.create(name='Eski', issn='INTERNAL-X', description='d', journal_admin=self.editor,
                                        category=self.category)
        res = self.api.patch(f'/api/v1/journals/journals/{legacy.id}/', {'issn': 'INTERNAL-X', 'name': 'Eski 2'}, format='json')
        self.assertEqual(res.status_code, 200, res.content[:300])

    def test_percent_limits(self):
        journal = self.assert_created(self.api.post('/api/v1/journals/journals/', self.ui_payload(
            plagiarism_max_percent=25, originality_min_percent=75), format='json'))
        self.assertEqual(journal.plagiarism_max_percent, 25)

    def test_only_super_admin_creates(self):
        api = APIClient()
        api.force_authenticate(self.editor)
        self.assertEqual(api.post('/api/v1/journals/journals/', self.ui_payload(), format='json').status_code, 403)
