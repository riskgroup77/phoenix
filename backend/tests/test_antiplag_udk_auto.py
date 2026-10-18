"""
Mustaqil antiplagiat: yuklash → to'lov → avtomatik tekshiruv → "Ishlarim" dagi holat; qayta to'lov bloklanadi.
UDK: kitob klassifikatori bazada, to'lovdan keyin UDK taqrizchisiz avtomatik aniqlanadi.
"""
import json
import shutil
import tempfile
from decimal import Decimal
from unittest import mock

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.articles.models import Article
from apps.journals.models import Journal, JournalCategory
from apps.payments.models import Transaction
from apps.udc.models import UdcClass, UDKCertificate, UdkRequest
from apps.users.models import User
from tests.test_qa_fixes import _docx

MEDIA = tempfile.mkdtemp(prefix='phx-antiplag-udk-')


def _sync_enqueue(article_id, user_id, force=False):
    from apps.articles.plagiarism_check_service import run_auto_plagiarism_check

    run_auto_plagiarism_check(article_id, user_id)
    return True


@override_settings(MEDIA_ROOT=MEDIA, PHONE_VERIFICATION_REQUIRED=False)
class StandaloneAntiplagiatFlowTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.author = User.objects.create_user(phone='998900007001', password='x-parol-123', email='ap@t.uz',
                                               first_name='Ali', last_name='Valiyev', role='author')
        ja = User.objects.create_user(phone='998900007002', password='x-parol-123', email='ja@t.uz',
                                      first_name='J', last_name='A', role='journal_admin')
        self.journal = Journal.objects.create(name='Antiplagiat jurnali', issn='7777-1111', description='d',
                                              journal_admin=ja, category=JournalCategory.objects.create(name='QA'),
                                              publication_fee=Decimal('0'))
        self.client = APIClient()
        self.client.force_authenticate(self.author)

    def _upload(self):
        res = self.client.post('/api/v1/articles/', {
            'title': 'Dissertatsiya bobi', 'abstract': "Hujjat turi: Dissertatsiya. Tekshiruv uchun yuborilgan.",
            'keywords': json.dumps(['plagiarism', 'check', 'Dissertatsiya']), 'journal': str(self.journal.id),
            'page_count': 1, 'main_file': _docx(words=300),
        }, format='multipart')
        self.assertIn(res.status_code, (200, 201), res.content)
        return Article.objects.get(pk=res.data['id'])

    def _mine_state(self, article):
        rows = self.client.get('/api/v1/articles/mine/').data
        rows = rows.get('results', rows) if isinstance(rows, dict) else rows
        row = next(r for r in rows if r['id'] == str(article.id))
        return row['antiplagiat_state'], row['work_type']

    def test_full_flow_payment_check_and_my_works_state(self):
        article = self._upload()
        self.assertEqual(article.status, 'Draft')
        self.assertEqual(self._mine_state(article), ('awaiting_payment', 'Antiplagiat'))

        tx = Transaction.objects.create(user=self.author, article=article, amount=Decimal('30000'),
                                        service_type='language_editing', status='completed')
        from apps.articles.fulfill_plagiarism_payment import fulfill_language_editing_payment

        with mock.patch('apps.articles.tasks.enqueue_plagiarism_check', side_effect=_sync_enqueue):
            fulfill_language_editing_payment(tx)

        article.refresh_from_db()
        self.assertIsNotNone(article.plagiarism_checked_at, article.plagiarism_report)
        self.assertNotEqual(article.plagiarism_report.get('check_status'), 'processing')
        self.assertEqual(self._mine_state(article)[0], 'done')

        # To'lov qaytgandan keyin sahifa hujjatni tranzaksiyadan topadi (Click yangi oynada ochiladi)
        status = self.client.post(f'/api/v1/payments/transactions/{tx.id}/check_status/')
        if status.status_code == 200:
            self.assertEqual(str(status.data['transaction']['article']), str(article.id))

        # Shu hujjat uchun ikkinchi to'lov — "allaqachon" (frontend buni natijaga yo'naltiradi)
        from apps.payments.pricing import _ensure_not_already_paid

        with self.assertRaises(Exception) as ctx:
            _ensure_not_already_paid('language_editing', article, None)
        self.assertIn('allaqachon', str(ctx.exception))

    def test_checking_state_survives_refresh(self):
        from django.utils import timezone

        article = self._upload()
        article.status = 'PaymentCompleted'
        article.save()
        rows = self.client.get('/api/v1/articles/mine/').data
        row = next(r for r in rows if r['id'] == str(article.id))
        # To'langan, lekin tekshiruv ketmayapti — sahifa uni "davom ettirmaydi" (yangi formaga ulanmaydi)
        self.assertFalse(row['antiplagiat_check_active'])
        article.plagiarism_report = {**article.plagiarism_report, 'check_status': 'processing',
                                     'check_updated_at': timezone.now().isoformat()}
        article.save()
        self.assertEqual(self._mine_state(article)[0], 'checking')
        rows = self.client.get('/api/v1/articles/mine/').data
        self.assertTrue(next(r for r in rows if r['id'] == str(article.id))['antiplagiat_check_active'])
        # Qotib qolgan (eski) processing — faol emas
        article.plagiarism_report = {**article.plagiarism_report, 'check_updated_at': '2026-08-07T10:00:00+05:00'}
        article.save()
        rows = self.client.get('/api/v1/articles/mine/').data
        self.assertFalse(next(r for r in rows if r['id'] == str(article.id))['antiplagiat_check_active'])


@override_settings(MEDIA_ROOT=MEDIA)
class UdkAutoClassifyTests(TestCase):
    def setUp(self):
        from apps.udc import auto_classify

        auto_classify.reset_index()
        self.author = User.objects.create_user(phone='998900007101', password='x-parol-123', email='u@t.uz',
                                               first_name='Ali', last_name='Valiyev', role='author')

    def _paid_request(self, title, abstract):
        req = UdkRequest.objects.create(user=self.author, author_first_name='Ali', author_last_name='Valiyev',
                                        title=title, abstract=abstract, status='pending_payment')
        tx = Transaction.objects.create(user=self.author, amount=Decimal('10000'), service_type='udk_request',
                                        status='completed', extra_data={'udk_request_id': str(req.id)})
        req.transaction = tx
        req.save(update_fields=['transaction'])
        from apps.udc.fulfill import fulfill_udk_request

        with self.captureOnCommitCallbacks(execute=True):
            fulfill_udk_request(tx)
        req.refresh_from_db()
        return req

    def test_book_catalog_loaded_by_migration(self):
        self.assertGreater(UdcClass.objects.count(), 3500)
        cls = UdcClass.objects.get(code='811.512.133')
        self.assertEqual(cls.title_latin, 'O‘zbek tili')
        self.assertTrue(cls.parent_code.startswith('811.512'))

    def test_paid_request_completed_automatically_without_reviewer(self):
        req = self._paid_request("Oliy ta'lim muassasalarida talabalarning mustaqil ishini tashkil etish",
                                 "Maqolada oliy ta'limda talabalarning mustaqil ta'limi tahlil qilingan.")
        self.assertEqual(req.status, 'completed')
        self.assertEqual(req.udk_code, '378')
        self.assertEqual(req.auto_method, 'lexical')
        self.assertTrue(UDKCertificate.objects.filter(user=self.author, udk_code='378').exists())

    def test_ai_choice_is_used_but_only_from_candidates(self):
        replies = iter([{'terms': []}, {'code': '811.512.133', 'description_uz': "O'zbek tili"}])
        with mock.patch('apps.udc.auto_classify._ai_json', side_effect=lambda prompt: next(replies)):
            req = self._paid_request("O'zbek tilida qo'shma gaplarning sintaktik xususiyatlari", 'Sintaksis')
        self.assertEqual((req.udk_code, req.auto_method), ('811.512.133', 'ai'))

        replies = iter([{'terms': []}, {'code': '999.999', 'description_uz': 'uydirma'}])
        with mock.patch('apps.udc.auto_classify._ai_json', side_effect=lambda prompt: next(replies)):
            req = self._paid_request("O'zbek tilida qo'shma gaplarning sintaktik xususiyatlari", 'Sintaksis')
        self.assertNotEqual(req.udk_code, '999.999')
        self.assertEqual(req.auto_method, 'lexical')

    def test_unclassifiable_request_stays_for_staff(self):
        req = self._paid_request('Qwzx vbnm', 'Plmk')
        self.assertEqual(req.status, 'submitted')
        self.assertEqual(req.auto_method, 'manual')


@override_settings(MEDIA_ROOT=MEDIA)
class UdkCompoundCodeTests(TestCase):
    def setUp(self):
        from apps.udc import auto_classify

        auto_classify.reset_index()

    def test_ai_compound_code_only_from_candidates(self):
        from apps.udc import auto_classify

        replies = iter([{'terms': []}, {'code': '37.013.2', 'related': ['004.8', '999.1', '37'],
                                        'description_uz': "Ta'lim nazariyasi"}])
        with mock.patch('apps.udc.auto_classify._ai_json', side_effect=lambda prompt: next(replies)):
            res = auto_classify.classify("Ta'limda sun'iy intellektdan foydalanish pedagogika",
                                         "Sun'iy intellekt va pedagogika", ["sun'iy intellekt", 'pedagogika'])
        self.assertEqual(res.method, 'ai')
        self.assertEqual(res.code, '37.013.2:004.8')  # uydirma (999.1) va ota-klass (37) qo'shilmaydi

    def test_lexical_compound_requires_keyword(self):
        from apps.udc import auto_classify

        res = auto_classify.classify("Oliy ta'limda sun'iy intellekt texnologiyalaridan foydalanish",
                                     "Maqolada talabalarni o'qitishda sun'iy intellekt vositalarini qo'llash tahlil "
                                     "qilingan", ["sun'iy intellekt", "ta'lim", 'pedagogika'])
        self.assertIn(':', res.code)
        res = auto_classify.classify("Oliy ta'lim muassasalarida talabalarning mustaqil ishi", '', [])
        self.assertNotIn(':', res.code)
