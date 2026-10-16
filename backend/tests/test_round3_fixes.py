"""
E2E sinov (2026-10-16) — qolgan topilmalar: kitob bosqichlari, taqrizchi ko'radigan maqolalar, ichki kitob
jurnali, tahririyat antiplagiati tugaganda xabar, Click orqali qaytarish, muallifga holat nomi.
"""
from decimal import Decimal
from unittest import mock

from django.utils import timezone

from apps.articles.models import ActivityLog, Article
from apps.journals.internal import BOOK_JOURNAL_ISSN, get_book_orders_journal
from apps.journals.models import Journal
from apps.notifications.models import Notification
from apps.payments.models import Transaction
from apps.reviews.models import PeerReview

from tests.test_qa_fixes import QaBase, _docx


class BookWorkflowStepsTests(QaBase):
    def test_book_has_own_steps(self):
        book = Article.objects.create(title='[KITOB] Darslik', abstract='a', author=self.author, journal=self.journal,
                                      status='ContractProcessing', page_count=100)
        data = self.api(self.author).get(f'/api/v1/articles/{book.id}/').json()
        names = [s['name'] for s in data['workflow_steps']]
        self.assertEqual(names[1], 'Shartnoma va ISBN')
        self.assertEqual(data['workflow_stage'], 'Shartnoma va ISBN')
        self.assertNotIn('Tekshiruv', names)
        Article.objects.filter(pk=book.pk).update(status='Delivered')
        steps = self.api(self.author).get(f'/api/v1/articles/{book.id}/').json()['workflow_steps']
        self.assertTrue(all(s['done'] for s in steps))

    def test_article_status_label_present(self):
        data = self.api(self.author).get(f'/api/v1/articles/{self.article.id}/').json()
        self.assertEqual(data['status_label'], 'Yangi topshirildi')


class ReviewerVisibilityTests(QaBase):
    def test_reviewer_sees_only_assigned_articles(self):
        Article.objects.filter(pk=self.article.pk).update(status='QabulQilingan')
        book = Article.objects.create(title='[KITOB] Kitob', abstract='Telefon: 998901112233', author=self.author,
                                      journal=self.journal, status='QabulQilingan')
        rv = self.api(self.reviewer)
        ids = [a['id'] for a in rv.get('/api/v1/articles/?page_size=200').json()['results']]
        self.assertNotIn(str(self.article.id), ids)  # taqrizda, lekin tayinlanmagan
        self.assertNotIn(str(book.id), ids)
        self.assertEqual(rv.get(f'/api/v1/articles/{book.id}/').status_code, 404)
        PeerReview.objects.create(article=self.article, reviewer=self.reviewer)
        ids = [a['id'] for a in rv.get('/api/v1/articles/?page_size=200').json()['results']]
        self.assertIn(str(self.article.id), ids)


class InternalBookJournalTests(QaBase):
    def test_book_order_goes_to_internal_journal_hidden_from_catalog(self):
        res = self.api(self.author).post('/api/v1/articles/', {
            'title': '[KITOB] Yangi darslik', 'abstract': 'Kitob', 'journal': str(self.journal.id),
            'keywords': '["kitob", "nashr"]', 'page_count': '120', 'final_pdf_path': _docx(words=300),
        }, format='multipart')
        self.assertEqual(res.status_code, 201, res.content)
        book = Article.objects.get(pk=res.json()['id'])
        self.assertTrue(book.journal.is_internal)
        self.assertEqual(book.journal.issn, BOOK_JOURNAL_ISSN)
        self.assertEqual(book.status, 'Draft')  # kitob to'lovigacha
        # Birinchi jurnal muharriri buyurtmani ko'rmaydi
        self.assertEqual(self.api(self.journal_admin).get(f'/api/v1/articles/{book.id}/').status_code, 404)
        # Katalog va mualliflar ro'yxatida ichki jurnal yo'q
        names = [j['name'] for j in self.api(self.author).get('/api/v1/journals/journals/?page_size=200').json()['results']]
        self.assertNotIn(book.journal.name, names)
        names = [j['name'] for j in self.api().get('/api/v1/journals/journals/?page_size=200').json()['results']]
        self.assertNotIn(book.journal.name, names)
        self.assertIn(book.journal.name, [j['name'] for j in self.api(self.super_admin).get('/api/v1/journals/journals/?page_size=200').json()['results']])

    def test_regular_article_cannot_use_internal_journal(self):
        internal = get_book_orders_journal()
        res = self.api(self.author).post('/api/v1/articles/', {
            'title': 'Oddiy maqola', 'abstract': 'a', 'journal': str(internal.id), 'keywords': '["a", "b"]',
            'page_count': '1', 'final_pdf_path': _docx(),
        }, format='multipart')
        self.assertEqual(res.status_code, 400)

    def test_paid_book_notifies_admins_not_reviewers(self):
        from apps.articles.fulfill_book_publication import fulfill_book_publication

        Notification.objects.all().delete()
        tx = Transaction.objects.create(user=self.author, amount=Decimal('500000'), service_type='book_publication',
                                        status='completed', completed_at=timezone.now(),
                                        extra_data={'title': 'Monografiya', 'pages': 200, 'copies': 10})
        fulfill_book_publication(tx)
        tx.refresh_from_db()
        self.assertTrue(tx.article.journal.is_internal)
        self.assertFalse(Notification.objects.filter(user=self.reviewer).exists())
        self.assertTrue(Notification.objects.filter(user=self.super_admin, title='Yangi kitob nashr buyurtmasi').exists())


class EditorialCheckNotifyTests(QaBase):
    def test_editor_notified_when_check_finishes(self):
        from apps.articles.plagiarism_check_service import _notify_editor_check_done

        _notify_editor_check_done(self.article, self.journal_admin, 12.5, 3.0, 87.5)
        note = Notification.objects.get(user=self.journal_admin, title='Antiplagiat natijasi tayyor')
        self.assertIn('originallik 87.5%', note.message)
        # Muallif o'zi tekshirtirganda — muharrirga xabar emas
        _notify_editor_check_done(self.article, self.author, 1, 1, 99)
        self.assertFalse(Notification.objects.filter(user=self.author, title='Antiplagiat natijasi tayyor').exists())

    def test_plagiarism_log_shown_in_uzbek(self):
        ActivityLog.objects.create(article=self.article, user=self.journal_admin, action='Plagiarism check completed',
                                   details='Plagiarism: 12.5%, Originality: 87.5% (deep module scan, 4 sources)')
        logs = self.api(self.author).get(f'/api/v1/articles/{self.article.id}/').json()['activity_logs']
        log = next(l for l in logs if 'Antiplagiat' in l['action'])
        self.assertEqual(log['action'], 'Antiplagiat tekshiruvi yakunlandi')
        self.assertEqual(log['details'], 'Plagiat: 12.5%, originallik: 87.5% (4 ta manba)')


class _FakeResponse:
    def __init__(self, data):
        self._data = data

    def json(self):
        return self._data


class ClickRefundTests(QaBase):
    def setUp(self):
        super().setUp()
        Article.objects.filter(pk=self.article.pk).update(status='Rejected')
        self.tx = Transaction.objects.create(
            user=self.author, article=self.article, amount=Decimal('50000'), service_type='publication_fee',
            status='completed', completed_at=timezone.now(), payment_provider='click', click_service_id='82154',
            click_trans_id='111', click_paydoc_id='222', refund_requested_at=timezone.now(),
        )
        self.url = f'/api/v1/payments/transactions/{self.tx.id}/mark_refunded/'

    def test_click_reversal_success(self):
        calls = []

        def fake_request(method, url, headers=None, timeout=None):
            calls.append((method, url, headers['Auth']))
            if 'status_by_mti' in url:
                return _FakeResponse({'error_code': 0, 'payment_id': 987654})
            return _FakeResponse({'error_code': 0, 'error_note': 'Success', 'payment_id': 987654})

        with self.settings(CLICK_SERVICE_82154_SECRET_KEY='s3cret', CLICK_SERVICE_82154_MERCHANT_USER_ID='777'), \
                mock.patch('apps.payments.refunds.requests.request', side_effect=fake_request):
            res = self.api(self.accountant).post(self.url, {'via_click': True}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(calls[-1][0], 'DELETE')
        self.assertTrue(calls[-1][1].endswith('/payment/reversal/82154/987654'))
        user_id, digest, ts = calls[-1][2].split(':')
        import hashlib
        self.assertEqual(user_id, '777')
        self.assertEqual(digest, hashlib.sha1((ts + 's3cret').encode()).hexdigest())
        self.tx.refresh_from_db()
        self.assertEqual(self.tx.status, 'refunded')
        self.assertIn('Click orqali avtomatik qaytarildi', self.tx.refund_note)

    def test_click_rejection_keeps_payment(self):
        with self.settings(CLICK_SERVICE_82154_SECRET_KEY='s3cret'), \
                mock.patch('apps.payments.refunds.requests.request',
                           return_value=_FakeResponse({'error_code': -5017, 'error_note': 'Reversal not allowed'})):
            res = self.api(self.accountant).post(self.url, {'via_click': True}, format='json')
        self.assertEqual(res.status_code, 502)
        self.assertIn('Reversal not allowed', res.json()['detail'])
        self.tx.refresh_from_db()
        self.assertEqual(self.tx.status, 'completed')


class AuthorStatusLabelTests(QaBase):
    def test_author_sees_neutral_plagiarism_review_label(self):
        from apps.articles.serializers import status_change_text

        Article.objects.filter(pk=self.article.pk).update(status='PlagiarismReview')
        ActivityLog.objects.create(article=self.article, user=self.super_admin,
                                   action=status_change_text('PlagiarismReview', 'Accepted'))
        data = self.api(self.author).get(f'/api/v1/articles/{self.article.id}/').json()
        self.assertEqual(data['status_label'], "Antiplagiat natijasi ko'rib chiqilmoqda")
        self.assertNotIn('bosh admin', str(data['activity_logs']))
        staff = self.api(self.journal_admin).get(f'/api/v1/articles/{self.article.id}/').json()
        self.assertIn('bosh admin', staff['status_label'])
