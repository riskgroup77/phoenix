"""Hujjat holati haqida ma'lumotnoma (PDF): har qanday hujjat turi, faqat egasi, QR tekshiruvi, tillar."""
from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.articles import reference_doc
from apps.articles.models import Article, DoiRequest
from apps.journals.models import Journal, JournalCategory
from apps.udc.models import UDKCertificate, UdkRequest
from apps.users.models import User

URL = '/api/v1/articles/reports/reference/'


class ReferenceDocTests(TestCase):
    def setUp(self):
        cache.clear()
        self.author = User.objects.create_user(phone='998900009001', password='x-parol-123', email='a@ref.uz',
                                               first_name='Ali', last_name='Valiyev', role='author', affiliation='TDPU')
        ja = User.objects.create_user(phone='998900009002', password='x-parol-123', email='j@ref.uz',
                                      first_name='J', last_name='A', role='journal_admin')
        journal = Journal.objects.create(name='Ref jurnal', issn='5555-1212', description='d', journal_admin=ja,
                                         category=JournalCategory.objects.create(name='Mahalliy jurnallar'),
                                         publication_fee=Decimal('1'))
        self.article = Article.objects.create(title='Maqola', abstract='a', author=self.author, journal=journal,
                                              status='WithEditor')
        self.plag = Article.objects.create(title='Testga', abstract='a', keywords=['plagiarism', 'check'],
                                           author=self.author, journal=journal, status='PaymentCompleted')
        self.udk = UdkRequest.objects.create(user=self.author, author_first_name='Ali', author_last_name='Valiyev',
                                             title='UDK mavzu', abstract='a', status='submitted')
        self.cert = UDKCertificate.objects.create(user=self.author, title='UDK tayyor', udk_code='378')
        self.doi = DoiRequest.objects.create(user=self.author, author_first_name='Ali', author_last_name='Valiyev',
                                             file='doi_requests/x.pdf', status='submitted')
        self.client = APIClient()
        self.client.force_authenticate(self.author)

    def test_pdf_for_every_document_kind(self):
        for kind, pk in (('article', self.article.id), ('article', self.plag.id), ('udk_request', self.udk.id),
                         ('udk_certificate', self.cert.id), ('doi', self.doi.id)):
            with self.subTest(kind=kind):
                res = self.client.get(URL, {'kind': kind, 'id': str(pk), 'lang': 'ru'})
                self.assertEqual(res.status_code, 200, res.content[:200])
                self.assertTrue(res.content.startswith(b'%PDF'))

    def test_status_texts(self):
        self.assertEqual(reference_doc.for_article(self.article, 'uz').status, 'Redaktorda')
        self.assertEqual(reference_doc.for_article(self.plag, 'ru').status, 'Проверяется')
        self.assertEqual(reference_doc.for_article(self.plag, 'uz').work_type, 'Antiplagiat tekshiruvi')
        self.assertEqual(reference_doc.for_udk_certificate(self.cert, 'en').status, 'Completed — UDC: 378')

    def test_only_owner(self):
        other = APIClient()
        other.force_authenticate(User.objects.create_user(phone='998900009003', password='x-parol-123',
                                                          email='o@ref.uz', first_name='O', last_name='T'))
        self.assertEqual(other.get(URL, {'kind': 'article', 'id': str(self.article.id)}).status_code, 404)
        self.assertEqual(other.get(URL, {'kind': 'udk_certificate', 'id': str(self.cert.id)}).status_code, 404)
        self.assertEqual(self.client.get(URL, {'kind': 'article', 'id': 'yaroqsiz'}).status_code, 404)

    def test_qr_verify(self):
        code = reference_doc.for_article(self.article, 'uz').number
        res = APIClient().get(f'/api/v1/articles/verify/{code}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['details']['status'], 'Redaktorda')
        res = APIClient().get(f'/api/v1/articles/verify/MLN-U{self.cert.id}/')
        self.assertEqual(res.status_code, 200)
