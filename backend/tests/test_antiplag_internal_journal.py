"""
Antiplagiat tekshiruvi muallifga ko'rinadigan jurnalga bog'liq emas: hujjat ichki jurnalga bog'lanadi.
Avval yagona ochiq jurnal demo muharrirda bo'lganda muallif 0 ta jurnal ko'rardi va to'lov oynasi
"Jurnal aniqlanmadi..." xatosi bilan ochilardi (prod log: GET /journals/journals/ → bo'sh ro'yxat).
"""
import json
import shutil
from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.articles.models import Article
from apps.journals.internal import ANTIPLAG_JOURNAL_ISSN
from apps.journals.models import Journal, JournalCategory
from apps.users.models import User
from config.demo import DEMO_EMAIL_DOMAIN
from tests.test_antiplag_udk_auto import MEDIA, _docx


@override_settings(MEDIA_ROOT=MEDIA, PHONE_VERIFICATION_REQUIRED=False)
class AntiplagInternalJournalTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        User.objects.create_user(phone='998900007101', password='x-parol-123', email='sa@t.uz',
                                 first_name='S', last_name='A', role='super_admin')
        self.author = User.objects.create_user(phone='998900007102', password='x-parol-123', email='ap@t.uz',
                                               first_name='Ali', last_name='Valiyev', role='author')
        demo = User.objects.create_user(phone='998900007103', password='x-parol-123',
                                        email=f'm@{DEMO_EMAIL_DOMAIN}', first_name='D', last_name='M',
                                        role='journal_admin')
        # Yagona jurnal demo muharrirda — muallifga ko'rinmaydi (prod holati)
        self.hidden = Journal.objects.create(name='YANGI', issn='3060-0001', description='d', journal_admin=demo,
                                             category=JournalCategory.objects.create(name='OAK'),
                                             publication_fee=Decimal('0'))
        self.client = APIClient()
        self.client.force_authenticate(self.author)

    def upload(self, **extra):
        return self.client.post('/api/v1/articles/', {
            'title': 'Sinov hujjati', 'abstract': 'Hujjat turi: Maqola.',
            'keywords': json.dumps(['plagiarism', 'check', 'Maqola']), 'page_count': 1,
            'main_file': _docx(words=300), **extra,
        }, format='multipart')

    def test_author_sees_no_journals_but_antiplagiat_works(self):
        rows = self.client.get('/api/v1/journals/journals/').data
        rows = rows.get('results', rows) if isinstance(rows, dict) else rows
        self.assertEqual(len(rows), 0)

        res = self.upload()  # jurnal yuborilmaydi
        self.assertEqual(res.status_code, 201, res.content)
        article = Article.objects.select_related('journal').get(pk=res.data['id'])
        self.assertEqual(article.journal.issn, ANTIPLAG_JOURNAL_ISSN)
        self.assertTrue(article.journal.is_internal)
        self.assertEqual(article.status, 'Draft')  # antiplagiat to'lovi kutilmoqda

        res = self.client.post('/api/v1/payments/transactions/', {
            'amount': 0, 'currency': 'UZS', 'service_type': 'language_editing', 'article': str(article.id),
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.content)

    def test_given_journal_is_replaced_by_internal(self):
        # Eski frontend jurnal yuborsa ham — hujjat haqiqiy jurnalga tushmaydi (muharrir muallif hujjatini ko'rmasin)
        res = self.upload(journal=str(self.hidden.id))
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Article.objects.get(pk=res.data['id']).journal.issn, ANTIPLAG_JOURNAL_ISSN)

    def test_internal_journal_hidden_from_catalog(self):
        self.upload()
        rows = self.client.get('/api/v1/journals/journals/').data
        rows = rows.get('results', rows) if isinstance(rows, dict) else rows
        self.assertNotIn(ANTIPLAG_JOURNAL_ISSN, [r['issn'] for r in rows])

    def test_regular_article_still_requires_journal(self):
        res = self.client.post('/api/v1/articles/', {
            'title': 'Oddiy maqola', 'abstract': 'a', 'keywords': json.dumps(['fan']), 'page_count': 1,
            'main_file': _docx(words=300),
        }, format='multipart')
        self.assertEqual(res.status_code, 400)
        self.assertIn('journal', res.data)
