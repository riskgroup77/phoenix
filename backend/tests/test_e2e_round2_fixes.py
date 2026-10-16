"""
E2E sinov (2026-10-16) topilmalari uchun regressiya testlari:
kitob buyurtmasi bosqichlari, antiplagiat chegarasi (tekshirilmagan maqola, bosh admin qarori aylanasi),
maqola namunasini yetkazish, 2-bosqich taqrizi, ikki marta to'lov, sababsiz rad etish, rad etgan taqrizchi,
muallifga ichki yozuvlar, to'lovni qaytarish, muharrirga to'lanmagan qoralamalar.
"""
from decimal import Decimal
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.articles.models import ActivityLog, Article, ArticleSampleRequest, ArticleStatusEvent
from apps.notifications.models import Notification
from apps.payments.models import Transaction
from apps.reviews.models import PeerReview

from tests.test_qa_fixes import QaBase, _docx


class BookOrderWorkflowTests(QaBase):
    def setUp(self):
        super().setUp()
        self.book = Article.objects.create(
            title='[KITOB] Darslik', abstract='Kitob nashr buyurtmasi', author=self.author, journal=self.journal,
            status='QabulQilingan', page_count=200,
        )

    def test_paid_book_has_production_stages_for_super_admin(self):
        data = self.api(self.super_admin).get(f'/api/v1/articles/{self.book.id}/').json()
        self.assertIn('ContractProcessing', data['allowed_transitions'])
        self.assertNotIn('Published', data['allowed_transitions'])
        res = self.set_status(self.super_admin, 'ContractProcessing', article=self.book)
        self.assertEqual(res.status_code, 200, res.content)
        self.book.refresh_from_db()
        self.assertEqual(self.book.status, 'ContractProcessing')
        # Keyingi bosqichlar ham ochiq
        self.assertEqual(self.set_status(self.super_admin, 'SentToPrint', article=self.book).status_code, 200)

    def test_unpaid_book_stays_locked(self):
        self.book.status = 'Draft'
        self.book.save()
        data = self.api(self.super_admin).get(f'/api/v1/articles/{self.book.id}/').json()
        self.assertEqual(data['allowed_transitions'], ['Yangi'])


class PlagiarismThresholdTests(QaBase):
    def setUp(self):
        super().setUp()
        self.journal.plagiarism_max_percent = 25
        self.journal.originality_min_percent = 75
        self.journal.save()
        self.article.final_pdf_path = _docx(words=200)
        self.article.save()

    def test_unchecked_article_starts_editorial_check_instead_of_super_admin_review(self):
        with mock.patch('apps.articles.views_publication.start_plagiarism_check') as start:
            res = self.set_status(self.journal_admin, 'Accepted')
        self.assertEqual(res.status_code, 409, res.content)
        self.assertIn("antiplagiat tekshiruvidan o'tmagan", res.json()['error'])
        start.assert_called_once()
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, 'Yangi')  # bosh admin qaroriga ketmadi

    def test_checked_article_passing_limits_is_accepted(self):
        Article.objects.filter(pk=self.article.pk).update(
            plagiarism_checked_at=timezone.now(), plagiarism_percentage=5, originality_percentage=95,
        )
        res = self.set_status(self.journal_admin, 'Accepted')
        self.assertEqual(res.json()['new_status'], 'Accepted')

    def test_super_admin_decision_is_not_overridden_on_next_step(self):
        Article.objects.filter(pk=self.article.pk).update(
            plagiarism_checked_at=timezone.now(), plagiarism_percentage=30, originality_percentage=80,
        )
        self.assertEqual(self.set_status(self.journal_admin, 'Accepted').json()['new_status'], 'PlagiarismReview')
        self.assertEqual(self.set_status(self.super_admin, 'Accepted').json()['new_status'], 'Accepted')
        # Avval shu yerda maqola yana PlagiarismReview ga qaytardi
        self.assertEqual(self.set_status(self.journal_admin, 'NashrgaYuborilgan').json()['new_status'], 'NashrgaYuborilgan')

    def test_journal_admin_can_run_editorial_check_without_payment(self):
        with mock.patch('apps.articles.views_antiplagiat.start_plagiarism_check'):
            res = self.api(self.journal_admin).post(f'/api/v1/articles/{self.article.id}/check_plagiarism/', {}, format='json')
        self.assertNotEqual(res.status_code, 402, res.content)


class ArticleSampleDeliveryTests(QaBase):
    def setUp(self):
        super().setUp()
        self.sample = ArticleSampleRequest.objects.create(
            user=self.author, requirements='5 bet', pages=5, topic='AI va ta\'lim', quality_level='orta',
            author_first_name='Ism', author_last_name='Muallif', amount=Decimal('225000'),
        )
        self.url = f'/api/v1/articles/article-sample/requests/{self.sample.id}/'

    def test_reviewer_takes_and_delivers_sample_author_downloads(self):
        rv = self.api(self.reviewer)
        self.assertEqual(rv.post(self.url + 'take/').status_code, 200)
        res = rv.post(self.url + 'complete/', {'result_file': _docx(name='namuna.docx'), 'reviewer_note': 'Tayyor'},
                      format='multipart')
        self.assertEqual(res.status_code, 200, res.content)
        data = self.api(self.author).get(self.url).json()
        self.assertEqual(data['status'], 'completed')
        self.assertTrue(data['result_file_url'])
        self.assertEqual(data['reviewer_note'], 'Tayyor')
        self.assertIsNone(data['reviewer_name'])  # muallifga bajaruvchi ismi ko'rinmaydi
        self.assertTrue(Notification.objects.filter(user=self.author, title='Maqola namunasi tayyor').exists())

    def test_cannot_complete_without_taking_or_by_other_reviewer(self):
        other = self.reviewer.__class__.objects.create_user(
            phone='998900001099', password='x12345678', email='o@qa.uz', role='reviewer', first_name='B', last_name='C',
        )
        self.assertEqual(self.api(self.reviewer).post(self.url + 'complete/', {'result_file': _docx()}, format='multipart').status_code, 400)
        self.api(self.reviewer).post(self.url + 'take/')
        self.assertEqual(self.api(other).get(self.url).status_code, 404)  # boshqa taqrizchi olgan so'rovni ko'rmaydi
        self.assertEqual(self.api(self.author).post(self.url + 'take/').status_code, 403)

    def test_rejects_non_document_result(self):
        self.api(self.reviewer).post(self.url + 'take/')
        bad = SimpleUploadedFile('x.html', b'<script>alert(1)</script>', 'text/html')
        self.assertEqual(self.api(self.reviewer).post(self.url + 'complete/', {'result_file': bad}, format='multipart').status_code, 400)


class SecondReviewRoundTests(QaBase):
    def test_same_reviewer_can_review_again_after_revision(self):
        ja = self.api(self.journal_admin)
        first = ja.post('/api/v1/reviews/', {'article': str(self.article.id), 'reviewer': str(self.reviewer.id)}, format='json')
        self.assertEqual(first.status_code, 201)
        # Faol taqriz bor — takror tayinlab bo'lmaydi
        self.assertEqual(ja.post('/api/v1/reviews/', {'article': str(self.article.id), 'reviewer': str(self.reviewer.id)}, format='json').status_code, 400)
        PeerReview.objects.filter(pk=first.json()['id']).update(status='completed', completed_at=timezone.now())
        ArticleStatusEvent.objects.create(article=self.article, from_status='Revision', to_status='Yangi')
        second = ja.post('/api/v1/reviews/', {'article': str(self.article.id), 'reviewer': str(self.reviewer.id)}, format='json')
        self.assertEqual(second.status_code, 201, second.content)
        self.assertEqual(second.json()['round_number'], 2)
        specs = ja.get(f'/api/v1/reviews/find-specialists/?article={self.article.id}').json()
        me = next(s for s in specs if s['id'] == str(self.reviewer.id))
        self.assertTrue(me['already_assigned'])  # 2-bosqich taqrizi faol


class DoublePaymentTests(QaBase):
    def setUp(self):
        super().setUp()
        self.article.status = 'Draft'
        self.article.save()

    def create_tx(self):
        return self.api(self.author).post('/api/v1/payments/transactions/', {
            'service_type': 'publication_fee', 'article': str(self.article.id), 'amount': 1,
        }, format='json')

    def test_pending_is_reused_and_paid_article_cannot_be_charged_again(self):
        first = self.create_tx()
        self.assertEqual(first.status_code, 201)
        again = self.create_tx()
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.json()['id'], first.json()['id'])
        self.assertEqual(Transaction.objects.filter(article=self.article, status='pending').count(), 1)
        Transaction.objects.filter(pk=first.json()['id']).update(status='completed')
        third = self.create_tx()
        self.assertEqual(third.status_code, 400)
        self.assertIn('allaqachon', str(third.json()))

    def test_stale_pending_with_old_amount_is_cancelled(self):
        first = self.create_tx()
        Article.objects.filter(pk=self.article.pk).update(page_count=9)
        second = self.create_tx()
        self.assertEqual(second.status_code, 201)
        self.assertEqual(Transaction.objects.get(pk=first.json()['id']).status, 'cancelled')


class ReasonRequiredTests(QaBase):
    def test_reject_and_revision_need_reason(self):
        for status in ('Rejected', 'Revision'):
            with self.subTest(status=status):
                res = self.set_status(self.journal_admin, status)
                self.assertEqual(res.status_code, 400)
                self.assertTrue(res.json().get('reason_required'))
        res = self.set_status(self.journal_admin, 'Rejected', reason='Mavzu jurnalga mos emas')
        self.assertEqual(res.status_code, 200)
        note = Notification.objects.filter(user=self.author, title='Maqola rad etildi').latest('created_at')
        self.assertIn('Mavzu jurnalga mos emas', note.message)


class DeclinedReviewerTests(QaBase):
    def test_declined_reviewer_loses_access(self):
        review = PeerReview.objects.create(article=self.article, reviewer=self.reviewer)
        self.assertEqual(self.api(self.reviewer).get(f'/api/v1/articles/{self.article.id}/').status_code, 200)
        self.api(self.reviewer).post(f'/api/v1/reviews/{review.id}/decline_review/', {'reason': 'Mutaxassisligim emas'}, format='json')
        self.assertEqual(self.api(self.reviewer).get(f'/api/v1/articles/{self.article.id}/').status_code, 404)
        # Taqrizga yuborilgan (umumiy navbat) bo'lsa ham rad etgan taqrizchiga ko'rinmaydi
        Article.objects.filter(pk=self.article.pk).update(status='QabulQilingan')
        self.assertEqual(self.api(self.reviewer).get(f'/api/v1/articles/{self.article.id}/').status_code, 404)

    def test_reviewer_does_not_see_payment_amount(self):
        PeerReview.objects.create(article=self.article, reviewer=self.reviewer, status='accepted')
        Transaction.objects.create(user=self.author, article=self.article, amount=Decimal('350000'),
                                   service_type='publication_fee', status='completed', completed_at=timezone.now())
        timeline = self.api(self.reviewer).get(f'/api/v1/articles/{self.article.id}/').json()['status_timeline']
        payment = [t for t in timeline if t['kind'] == 'payment']
        self.assertTrue(payment)
        self.assertEqual(payment[0]['comment'], '')
        author_timeline = self.api(self.author).get(f'/api/v1/articles/{self.article.id}/').json()['status_timeline']
        self.assertIn("so'm", [t for t in author_timeline if t['kind'] == 'payment'][0]['comment'])


class AuthorInternalNotesTests(QaBase):
    def test_author_does_not_see_super_admin_review_internals(self):
        ArticleStatusEvent.objects.create(article=self.article, from_status='Yangi', to_status='PlagiarismReview',
                                          note='Plagiat: 30% ... Bosh administrator qarori kerak.')
        ActivityLog.objects.create(article=self.article, user=self.journal_admin,
                                   action="Status: Antiplagiat ko'rib chiqish (bosh admin qarori kutilmoqda)",
                                   details='Bosh administrator qarori kerak.')
        ActivityLog.objects.create(article=self.article, user=self.journal_admin,
                                   action='Status changed from Yangi to QabulQilingan')
        data = self.api(self.author).get(f'/api/v1/articles/{self.article.id}/').json()
        flat = str(data['status_timeline']) + str(data['activity_logs'])
        self.assertNotIn('Bosh administrator qarori kerak', flat)
        self.assertNotIn('Status changed from', flat)
        self.assertIn('Holat: "Yangi" → "Qabul Qilingan"', flat)
        self.assertNotIn(self.journal_admin.get_full_name(), str(data['activity_logs']))
        staff = self.api(self.journal_admin).get(f'/api/v1/articles/{self.article.id}/').json()
        self.assertIn('Bosh administrator qarori kerak', str(staff['activity_logs']))


class RefundTests(QaBase):
    def setUp(self):
        super().setUp()
        self.tx = Transaction.objects.create(user=self.author, article=self.article, amount=Decimal('50000'),
                                             service_type='publication_fee', status='completed', completed_at=timezone.now())

    def test_refund_request_and_mark_refunded(self):
        url = f'/api/v1/payments/transactions/{self.tx.id}/'
        # Rad etilmagan maqola uchun so'rab bo'lmaydi
        self.assertEqual(self.api(self.author).post(url + 'request_refund/', {}, format='json').status_code, 400)
        self.set_status(self.journal_admin, 'Rejected', reason='Talablarga mos emas')
        self.assertIn("qaytarishni", Notification.objects.filter(user=self.author, title='Maqola rad etildi').latest('created_at').message)
        payment = self.api(self.author).get(f'/api/v1/articles/{self.article.id}/').json()['publication_payment']
        self.assertEqual(payment['transaction_id'], str(self.tx.id))
        self.assertEqual(self.api(self.author).post(url + 'request_refund/', {'reason': 'Karta'}, format='json').status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.accountant, title="To'lovni qaytarish so'rovi").exists())
        self.assertEqual(self.api(self.author).post(url + 'mark_refunded/', {'note': 'Qaytarildi 16.10'}, format='json').status_code, 403)
        res = self.api(self.accountant).post(url + 'mark_refunded/', {'note': 'Click kabinetida qaytarildi'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.tx.refresh_from_db()
        self.assertEqual(self.tx.status, 'refunded')
        self.assertTrue(Notification.objects.filter(user=self.author, title="To'lov qaytarildi").exists())
        # Qaytarilgan to'lov tushumga kirmaydi va chek berilmaydi
        self.assertEqual(self.api(self.author).get(url + 'receipt/').status_code, 400)


class JournalAdminDraftTests(QaBase):
    def test_unpaid_draft_hidden_from_journal_admin_and_not_notified(self):
        Notification.objects.all().delete()
        draft = Article.objects.create(title='To\'lanmagan', abstract='a', author=self.author, journal=self.journal,
                                       status='Draft', page_count=3)
        from apps.articles.submission_notifications import notify_article_draft_pending_payment

        notify_article_draft_pending_payment(draft)
        self.assertFalse(Notification.objects.filter(user=self.journal_admin).exists())
        self.assertTrue(Notification.objects.filter(user=self.super_admin).exists())
        ids = [a['id'] for a in self.api(self.journal_admin).get('/api/v1/articles/?page_size=200').json()['results']]
        self.assertNotIn(str(draft.id), ids)
        self.assertIn(str(self.article.id), ids)
