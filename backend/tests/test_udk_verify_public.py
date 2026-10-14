"""
UDK ma'lumotnomasini QR orqali tekshirish (/api/v1/udc/verify/) login talab qilmaydi:
avval global IsAuthenticated sabab mehmon QR ni skanerlasa 401 olardi.
"""
from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.articles.models import Article
from apps.journals.models import Journal, JournalCategory
from apps.udc.models import UDKCertificate
from apps.users.models import User

URL = '/api/v1/udc/verify/'


class UdkVerifyPublicTests(TestCase):
    def setUp(self):
        cache.clear()  # throttle hisoblagichi testlar orasida qolmasin
        self.client = APIClient()  # login qilinmagan mehmon
        self.author = User.objects.create_user(phone='998900000401', password='x-parol-123', email='au@udk.uz',
                                               first_name='Ali', last_name='Valiyev', role='author')
        self.cert = UDKCertificate.objects.create(
            user=self.author, author_name='Valiyev A.', title='UDK test mavzusi',
            udk_code='004.8', udk_description="Sun'iy intellekt",
        )
        ja = User.objects.create_user(phone='998900000402', password='x-parol-123', email='ja@udk.uz',
                                      first_name='J', last_name='A', role='journal_admin')
        journal = Journal.objects.create(
            name='UDK jurnal', issn='5555-6666', description='d', journal_admin=ja,
            category=JournalCategory.objects.create(name='UDK'), publication_fee=Decimal('100000'),
        )
        self.article = Article.objects.create(
            title='UDK li maqola', abstract='a', journal=journal, author=self.author,
            status='Yangi', udk_code='519.6', udk_description='Hisoblash matematikasi',
        )

    def test_guest_verifies_standalone_certificate(self):
        r = self.client.get(URL, {'id': self.cert.id})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['valid'])
        self.assertEqual(r.data['udk_code'], '004.8')
        self.assertEqual(r.data['author_name'], 'Valiyev A.')

    def test_guest_verifies_article_udk(self):
        r = self.client.get(URL, {'article_id': str(self.article.id)})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['valid'])
        self.assertEqual(r.data['udk_code'], '519.6')

    def test_unknown_or_malformed_ids_return_404_not_500(self):
        for params in ({'id': 999999}, {'id': 'abc'}, {'article_id': 'not-a-uuid'},
                       {'article_id': '00000000-0000-0000-0000-000000000000'}):
            with self.subTest(params=params):
                r = self.client.get(URL, params)
                self.assertEqual(r.status_code, 404)
                self.assertFalse(r.data['valid'])

    def test_missing_params_is_400(self):
        r = self.client.get(URL)
        self.assertEqual(r.status_code, 400)

    def test_guest_requests_are_throttled(self):
        codes = [self.client.get(URL, {'id': self.cert.id}).status_code for _ in range(31)]
        self.assertEqual(codes[:30], [200] * 30)
        self.assertEqual(codes[30], 429)
