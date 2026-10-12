"""
Hammuallif bilan maqola yuborish (fayl bilan — multipart, frontend aynan shunday yuboradi).
Avval: co_author_contacts JSON satr bo'lib kelgani uchun 400, telefon/email esa id=UUID qidiruvida 500 —
hammuallif qo'shilsa maqola yaratilmas va to'lovga o'tilmas edi.
"""
import io
import json
import shutil
import tempfile
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from docx import Document
from rest_framework.test import APIClient

from apps.articles.models import Article
from apps.journals.models import Journal, JournalCategory
from apps.users.models import User

MEDIA = tempfile.mkdtemp(prefix='phoenix-coauthor-test-')


def _docx():
    buf = io.BytesIO()
    d = Document()
    d.add_paragraph('Hammuallif testi uchun maqola matni. ' * 30)
    d.save(buf)
    return SimpleUploadedFile('m.docx', buf.getvalue(),
                              'application/vnd.openxmlformats-officedocument.wordprocessingml.document')


@override_settings(MEDIA_ROOT=MEDIA, PHONE_VERIFICATION_REQUIRED=False)
class CoAuthorSubmitTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        ja = User.objects.create_user(phone='998900000501', password='x-parol-123', email='ja@co.uz',
                                      first_name='J', last_name='A', role='journal_admin')
        self.author = User.objects.create_user(phone='998900000502', password='x-parol-123', email='au@co.uz',
                                               first_name='A', last_name='U', role='author')
        self.co = User.objects.create_user(phone='998900000503', password='x-parol-123', email='Co@Co.uz',
                                           first_name='C', last_name='O', role='author')
        self.journal = Journal.objects.create(
            name='Hammuallif jurnali', issn='5555-6666', description='d', journal_admin=ja,
            category=JournalCategory.objects.create(name='CO'), publication_fee=Decimal('100000'),
        )
        self.api = APIClient()
        self.api.force_authenticate(self.author)

    def _submit(self, identifier):
        return self.api.post('/api/v1/articles/', {
            'title': f'Hammuallif testi {identifier}', 'author_name': 'A U', 'journal': str(self.journal.id),
            'abstract': 'Annotatsiya matni.', 'keywords': json.dumps(['a', 'b']), 'page_count': '2',
            'awaiting_publication_payment': 'true',
            'co_author_contacts': json.dumps([{'name': 'Hammuallif', 'identifier': identifier}]),
            'final_pdf_path': _docx(),
        }, format='multipart')

    def test_coauthor_by_phone_email_and_id_is_linked(self):
        for identifier in ('900000503', '+998 90 000 05 03', 'co@co.uz', str(self.co.id)):
            r = self._submit(identifier)
            self.assertEqual(r.status_code, 201, (identifier, r.content[:300]))
            article = Article.objects.get(id=r.json()['id'])
            self.assertEqual(list(article.co_authors.all()), [self.co], identifier)

    def test_unknown_identifier_does_not_block_submission(self):
        r = self._submit('hamraqulov')
        self.assertEqual(r.status_code, 201, r.content[:300])
        self.assertEqual(Article.objects.get(id=r.json()['id']).co_authors.count(), 0)
