"""
Antiplagiat: formada kiritilgan "Ism / Familiya" (boshqa shaxs ishi ham tekshirilishi mumkin) sertifikat,
ma'lumotnoma (PDF) va QR tekshiruvida chiqishi kerak — yuklagan foydalanuvchining profil ismi emas.
"""
import io
import shutil
import tempfile
import zipfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.articles import reference_doc
from apps.articles.models import Article
from apps.users.models import User

MEDIA = tempfile.mkdtemp(prefix='phoenix-antiplag-author-')


def _docx():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        body = ''.join(f'<w:p><w:r><w:t>matn{i}</w:t></w:r></w:p>' for i in range(60))
        zf.writestr('word/document.xml', f'<w:document><w:body>{body}</w:body></w:document>')
    return SimpleUploadedFile(
        'ish.docx', buf.getvalue(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')


@override_settings(MEDIA_ROOT=MEDIA, PHONE_VERIFICATION_REQUIRED=False)
class AntiplagiatDocBase(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        User.objects.create_user(phone='998900008000', password='pass12345', email='sa@qa.uz',
                                 first_name='Bosh', last_name='Admin', role='super_admin')
        self.user = User.objects.create_user(phone='998900008001', password='pass12345', email='m@qa.uz',
                                             first_name='Profil', last_name='Egasi', role='author')
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def upload_and_configure(self, first='Test', last='Testov', co_authors=None, file=None):
        """PlagiarismCheck.tsx: hujjat yaratiladi, so'ng savePlagiarismConfig (PATCH plagiarism_report)."""
        res = self.api.post('/api/v1/articles/', {
            'title': 'Plagiarism Check - ish.docx', 'abstract': 'Hujjat turi: Dissertatsiya.',
            'keywords': '["plagiarism", "check", "Dissertatsiya"]', 'page_count': '1',
            'final_pdf_path': file or _docx(),
        }, format='multipart')
        self.assertEqual(res.status_code, 201, res.content[:400])
        art_id = res.json()['id']
        res = self.api.patch(f'/api/v1/articles/{art_id}/', {'plagiarism_report': {
            'pending_enabled_modules': [], 'document_type': 'Dissertatsiya', 'document_name': 'Mening ishim',
            'author_first_name': first, 'author_last_name': last, 'co_authors': co_authors or [],
        }}, format='json')
        self.assertEqual(res.status_code, 200, res.content[:400])
        return art_id

    def create_doc(self, first='Test', last='Testov', co_authors=None):
        art_id = self.upload_and_configure(first, last, co_authors)
        article = Article.objects.get(pk=art_id)
        # Tekshiruv yakunlandi (plagiarism_check_service: forma maydonlari natija hisobotiga ko'chiriladi)
        report = dict(article.plagiarism_report or {})
        report.update({'certificate_number': '2026101234', 'check_status': 'completed'})
        Article.objects.filter(pk=article.pk).update(
            plagiarism_report=report, plagiarism_checked_at=timezone.now(),
            plagiarism_percentage=4.0, originality_percentage=96.0)
        return Article.objects.select_related('author').get(pk=art_id)


class AntiplagiatAuthorNameTests(AntiplagiatDocBase):
    def test_form_name_saved(self):
        article = self.create_doc()
        report = self.api.get(f'/api/v1/articles/{article.id}/').json()['plagiarism_report']
        self.assertEqual((report['author_last_name'], report['author_first_name']), ('Testov', 'Test'))

    def test_reference_doc_uses_form_name(self):
        article = self.create_doc()
        data = reference_doc.for_article(article, 'uz')
        self.assertEqual(data.author, 'Testov Test')
        self.assertIn(('l_author', 'Testov Test'), data.rows)

    def test_qr_verification_uses_form_name(self):
        article = self.create_doc()
        cert = self.api.get('/api/v1/articles/verify/2026101234/').json()
        self.assertEqual(cert['author'], 'Testov Test')
        ref = self.api.get(f'/api/v1/articles/verify/MLN-{reference_doc._code(article.pk)}/').json()
        self.assertEqual(ref['author'], 'Testov Test')

    def test_empty_form_falls_back_to_profile(self):
        article = self.create_doc(first='', last='')
        self.assertEqual(reference_doc.for_article(article, 'uz').author, self.user.get_full_name())


CO = [{'first_name': 'Ali', 'last_name': 'Valiyev'}, {'first_name': 'Vali', 'last_name': 'Aliyev'}]


class AntiplagiatCoAuthorsTests(AntiplagiatDocBase):
    """Hammualliflar: formada «+» bilan qo'shiladi — sertifikat, ma'lumotnoma va QR tekshiruvida barchasi chiqadi."""

    def test_co_authors_saved_and_cleaned(self):
        art_id = self.upload_and_configure(co_authors=[
            {'first_name': '  Ali ', 'last_name': 'Valiyev  '},
            {'first_name': '', 'last_name': ''},  # bo'sh qator (ortiqcha «+») — saqlanmaydi
            'xato', {'first_name': 'Vali', 'last_name': 'Aliyev'},
        ] + [{'first_name': f'I{i}', 'last_name': f'F{i}'} for i in range(12)])
        report = self.api.get(f'/api/v1/articles/{art_id}/').json()['plagiarism_report']
        self.assertEqual(report['co_authors'][:2], CO)
        self.assertEqual(len(report['co_authors']), 9)  # asosiy muallif + 9 = 10 ta

    def test_co_authors_removed_by_user(self):
        """Ortiqcha qo'shilgan hammuallif o'chirilsa — keyingi saqlashda serverdan ham o'chadi."""
        art_id = self.upload_and_configure(co_authors=CO)
        res = self.api.patch(f'/api/v1/articles/{art_id}/', {'plagiarism_report': {
            'author_first_name': 'Test', 'author_last_name': 'Testov', 'co_authors': CO[:1],
        }}, format='json')
        self.assertEqual(res.status_code, 200, res.content[:300])
        self.assertEqual(Article.objects.get(pk=art_id).plagiarism_report['co_authors'], CO[:1])

    def test_co_authors_locked_after_check(self):
        article = self.create_doc(co_authors=CO)
        res = self.api.patch(f'/api/v1/articles/{article.id}/', {'plagiarism_report': {'co_authors': []}},
                             format='json')
        self.assertEqual(res.status_code, 400)
        article.refresh_from_db()
        self.assertEqual(article.plagiarism_report['co_authors'], CO)

    def test_check_result_keeps_co_authors(self):
        """Tekshiruv natijasi hisobotni almashtiradi — forma maydonlari (hammualliflar ham) saqlanib qoladi."""
        from apps.articles.plagiarism_check_service import run_auto_plagiarism_check

        ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as zf:
            body = ''.join(f'<w:p><w:r><w:t>Ilmiy tadqiqot matni {i} natijalar tahlili</w:t></w:r></w:p>'
                           for i in range(80))
            zf.writestr('word/document.xml', f'<w:document xmlns:w="{ns}"><w:body>{body}</w:body></w:document>')
        file = SimpleUploadedFile(
            'ish.docx', buf.getvalue(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        art_id = self.upload_and_configure(co_authors=CO, file=file)
        run_auto_plagiarism_check(art_id, self.user.id)
        article = Article.objects.get(pk=art_id)
        article.refresh_from_db()
        self.assertEqual(article.plagiarism_report.get('check_status'), 'completed', article.plagiarism_report)
        self.assertEqual(article.plagiarism_report['co_authors'], CO)
        self.assertTrue(article.plagiarism_report.get('certificate_number'))

    def test_reference_doc_lists_all_authors(self):
        article = self.create_doc(co_authors=CO)
        data = reference_doc.for_article(article, 'uz')
        self.assertEqual(data.author, 'Testov Test, Valiyev Ali, Aliyev Vali')
        self.assertEqual(data.rows[0], ('l_authors', 'Testov Test, Valiyev Ali, Aliyev Vali'))
        self.assertEqual(reference_doc.T.t('l_authors', 'uz'), 'MUALLIFLAR')
        self.assertEqual(reference_doc.T.t('l_authors', 'ru'), 'АВТОРЫ')
        self.assertEqual(reference_doc.T.t('l_authors', 'en'), 'AUTHORS')
        # Hujjat chiziladi (uzun ro'yxat mualliflar orasidan ikki qatorga bo'linadi)
        many = self.create_doc(co_authors=[{'first_name': f'Ismjon{i}', 'last_name': f'Familiyaov{i}'} for i in range(9)])
        for lang in ('uz', 'ru', 'en', 'uz-cyrl'):
            img = reference_doc.render_image(reference_doc.for_article(many, lang))
            self.assertEqual(img.size[0] > 0, True)

    def test_single_author_keeps_singular_label(self):
        article = self.create_doc()
        self.assertEqual(reference_doc.for_article(article, 'uz').rows[0][0], 'l_author')

    def test_qr_verification_lists_all_authors(self):
        article = self.create_doc(co_authors=CO)
        cert = self.api.get('/api/v1/articles/verify/2026101234/').json()
        self.assertEqual(cert['author'], 'Testov Test, Valiyev Ali, Aliyev Vali')
        self.assertEqual(cert['authors'], ['Testov Test', 'Valiyev Ali', 'Aliyev Vali'])
        ref = self.api.get(f'/api/v1/articles/verify/MLN-{reference_doc._code(article.pk)}/').json()
        self.assertEqual(ref['authors'], ['Testov Test', 'Valiyev Ali', 'Aliyev Vali'])

    def test_main_author_empty_falls_back_to_profile_first(self):
        article = self.create_doc(first='', last='', co_authors=CO[:1])
        self.assertEqual(reference_doc.for_article(article, 'uz').author, 'Egasi Profil, Valiyev Ali')
