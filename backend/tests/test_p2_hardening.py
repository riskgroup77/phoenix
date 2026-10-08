"""P2 (2026-10): haqiqiy modullar ro'yxati, eski hisobotlar, ishonchli IP, yuklama yo'llari."""
import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import RequestFactory, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.articles.antiplagiat_available import available_module_ids
from apps.articles.models import Article
from apps.journals.models import Journal, JournalCategory
from apps.users.models import User
from config.middleware import client_ip


def _user(phone, role='author'):
    return User.objects.create_user(
        phone=phone, password='pass12345', email=f'{phone}@t.uz',
        first_name='Ism', last_name=role, affiliation='X', role=role,
    )


class Base(TestCase):
    def setUp(self):
        self.author = _user('998920000001')
        cat = JournalCategory.objects.create(name='Fan')
        self.journal = Journal.objects.create(
            name='J', issn='2222-2222', description='d', journal_admin=_user('998920000002', 'journal_admin'),
            category=cat,
        )

    def api(self, user=None):
        c = APIClient()
        if user is not None:
            c.force_authenticate(user)
        return c


class AvailableModulesTests(Base):
    def test_endpoint_lists_only_real_modules(self):
        res = self.api(self.author).get('/api/v1/articles/antiplagiat-modules/')
        self.assertEqual(res.status_code, 200)
        ids = {m['id'] for m in res.json()['modules']}
        self.assertIn('milliy_reestr', ids)
        self.assertIn('openalex', ids)
        for fake in ('scopus', 'elibrary_ru', 'wos', 'cyberleninka', 'chatgpt_ai'):
            self.assertNotIn(fake, ids)
        # Sozlanmagan xizmatlar ko'rsatilmaydi (testda OpenSearch, web qidiruv, CORE kaliti yo'q)
        for unconfigured in ('semantic_paraphrase', 'internet_uz', 'core_ac'):
            self.assertNotIn(unconfigured, ids)

    def test_endpoint_requires_login(self):
        self.assertIn(self.api().get('/api/v1/articles/antiplagiat-modules/').status_code, (401, 403))

    @override_settings(ANTIPLAG_CORE_API_KEY='k', GOOGLE_CSE_API_KEY='k', GOOGLE_CSE_CX='cx')
    def test_configured_services_appear(self):
        ids = set(available_module_ids())
        self.assertIn('core_ac', ids)
        self.assertIn('internet_uz', ids)


class LegacyReportsCommandTests(Base):
    def test_lists_only_old_algorithm_reports(self):
        Article.objects.create(
            title='Eski', abstract='a', author=self.author, journal=self.journal, status='Rejected',
            plagiarism_checked_at=timezone.now(), plagiarism_percentage=40,
            plagiarism_report={'algorithm_version': '3.2', 'certificate_number': '1'},
        )
        Article.objects.create(
            title='Yangi', abstract='a', author=self.author, journal=self.journal,
            plagiarism_checked_at=timezone.now(), plagiarism_report={'algorithm_version': '4.0'},
        )
        out = io.StringIO()
        call_command('list_legacy_antiplag_reports', stdout=out)
        text = out.getvalue()
        self.assertIn(': 1 ta', text)
        self.assertIn('Eski', text)
        self.assertNotIn('Yangi', text)


class ClientIpTests(TestCase):
    def test_spoofed_first_forwarded_value_is_ignored(self):
        req = RequestFactory().get('/', HTTP_X_FORWARDED_FOR='1.2.3.4, 203.0.113.9', REMOTE_ADDR='127.0.0.1')
        self.assertEqual(client_ip(req), '203.0.113.9')

    def test_without_proxy_header_uses_remote_addr(self):
        req = RequestFactory().get('/', REMOTE_ADDR='198.51.100.7')
        self.assertEqual(client_ip(req), '198.51.100.7')


class UploadPathTests(Base):
    def test_manuscript_path_is_unguessable_and_fits_db(self):
        long_name = ('juda_uzun_maqola_nomi_' * 8) + '.pdf'
        art = Article.objects.create(
            title='Fayl', abstract='a', author=self.author, journal=self.journal,
            final_pdf_path=SimpleUploadedFile(long_name, b'%PDF-1.4 test', content_type='application/pdf'),
        )
        name = art.final_pdf_path.name
        parts = name.split('/')
        self.assertEqual(parts[0], 'articles')
        self.assertEqual(parts[1], 'pdfs')
        self.assertEqual(len(parts[2]), 32)  # tasodifiy papka
        self.assertTrue(name.endswith('.pdf'))
        self.assertLessEqual(len(name), 100)
