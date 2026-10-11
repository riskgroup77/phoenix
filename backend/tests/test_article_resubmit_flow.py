"""
Maqola jarayonidagi QA topilmalari:
- tahrirga qaytarilgan maqola qayta yuborilganda xodimlar bildirishnoma oladi (avval jim edi);
- "Maqola yuborildi" faoliyat yozuvi signal + view ikkalasidan chaqirilsa ham bir marta yoziladi;
- Click: UUID bo'lmagan merchant_trans_id (masalan "DEMO-…") -9 o'rniga to'g'ri topiladi / -5 qaytadi.
"""
import hashlib
from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.articles.models import ActivityLog, Article
from apps.articles.submission_notifications import notify_article_submitted
from apps.journals.models import Journal, JournalCategory
from apps.notifications.models import Notification
from apps.payments.click_callbacks import _find_transaction_by_merchant_trans_id
from apps.payments.models import Transaction
from apps.users.models import User

CLICK_SECRET = 'resubmit-click-secret'


def _md5(*parts):
    return hashlib.md5(''.join(str(p) for p in parts).encode('utf-8')).hexdigest()


class ArticleResubmitFlowTests(TestCase):
    def setUp(self):
        self.ja = User.objects.create_user(phone='998900000301', password='x-parol-123', email='ja@rs.uz',
                                           first_name='J', last_name='A', role='journal_admin')
        self.author = User.objects.create_user(phone='998900000302', password='x-parol-123', email='au@rs.uz',
                                               first_name='A', last_name='U', role='author')
        self.journal = Journal.objects.create(
            name='RS jurnal', issn='3333-4444', description='d', journal_admin=self.ja,
            category=JournalCategory.objects.create(name='RS'), publication_fee=Decimal('100000'),
        )
        self.article = Article.objects.create(
            title='Qayta yuborish testi', abstract='a', journal=self.journal, author=self.author, status='Yangi',
        )

    def _set_status(self, user, new_status, reason=''):
        api = APIClient()
        api.force_authenticate(user)
        return api.post(f'/api/v1/articles/{self.article.id}/update_status/',
                        {'status': new_status, 'reason': reason}, format='json')

    def test_resubmission_notifies_journal_admin_each_round(self):
        for round_no in (1, 2):
            self.assertEqual(self._set_status(self.ja, 'Revision', 'tuzating').status_code, 200)
            self.assertEqual(self._set_status(self.author, 'Yangi').status_code, 200)
            self.assertEqual(
                Notification.objects.filter(user=self.ja, title='Maqola qayta yuborildi').count(), round_no
            )

    def test_submission_activity_logged_once(self):
        notify_article_submitted(self.article)
        notify_article_submitted(self.article)
        self.assertEqual(ActivityLog.objects.filter(article=self.article, action='Maqola yuborildi').count(), 1)


@override_settings(CLICK_SECRET_KEY=CLICK_SECRET, CLICK_SERVICE_ID='82154', CLICK_SERVICE_82154_SECRET_KEY='')
class ClickNonUuidTransactionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone='998900000303', password='x-parol-123', email='c@rs.uz',
                                             first_name='C', last_name='U', role='author')
        self.tx = Transaction.objects.create(user=self.user, amount=Decimal('350000'), status='pending',
                                             service_type='publication_fee', merchant_trans_id='DEMO-12345678')

    def test_lookup_by_non_uuid_merchant_trans_id(self):
        self.assertEqual(_find_transaction_by_merchant_trans_id('DEMO-12345678'), self.tx)
        self.assertIsNone(_find_transaction_by_merchant_trans_id('NOPE-1'))

    def test_prepare_returns_not_found_and_invalid_amount(self):
        def prepare(mtid, amount):
            data = dict(click_trans_id='1', service_id='82154', click_paydoc_id='2', merchant_trans_id=mtid,
                        amount=amount, action=0, error=0, error_note='Success', sign_time='2026-10-11 10:00:00')
            data['sign_string'] = _md5('1', '82154', CLICK_SECRET, mtid, amount, '0', data['sign_time'])
            return self.client.post('/api/v1/payments/click/prepare/', data).json()

        self.assertEqual(prepare('NOPE-1', '1000.00')['error'], -5)
        self.assertEqual(prepare('DEMO-12345678', '1000.00')['error'], -2)
