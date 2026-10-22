"""
"Qabuldan keyin to'lov" (post-payment) jurnali — to'liq oqim:
muallif yuboradi → taqrizchi sabab bilan qaytaradi → muallif tuzatib qayta yuboradi → taqrizchi qabul qiladi →
muallifga «To'lash» chiqadi → muallif to'laydi → taqrizchi nashr qiladi. To'lovsiz nashr qilib bo'lmaydi.
"""
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.articles.fulfill_publication_fee import fulfill_publication_fee
from apps.articles.models import Article
from apps.journals.models import Journal, JournalCategory
from apps.notifications.models import Notification
from apps.payments.models import Transaction
from apps.reviews.models import PeerReview
from apps.users.models import User


def _user(phone, role='author'):
    return User.objects.create_user(phone=phone, password='pass12345', email=f'{phone}@t.uz',
                                    first_name='Ism', last_name=role, affiliation='X', role=role)


class PostPaymentFlowTests(TestCase):
    def setUp(self):
        self.author = _user('998910000401')
        self.reviewer = _user('998910000402', role='reviewer')
        self.journal_admin = _user('998910000403', role='journal_admin')
        self.journal = Journal.objects.create(
            name='J', issn='1111-5555', description='d', category=JournalCategory.objects.create(name='Fan'),
            journal_admin=self.journal_admin, payment_model='post-payment', publication_fee=Decimal('50000'),
        )
        self.article = Article.objects.create(title='Maqola', abstract='a', keywords=['k'], author=self.author,
                                              journal=self.journal, status='QabulQilingan')
        self.review = PeerReview.objects.create(article=self.article, reviewer=self.reviewer, status='in_progress')

    def api(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c

    def detail(self, user):
        return self.api(user).get(f'/api/v1/articles/{self.article.id}/').data

    def set_status(self, user, status, reason=None):
        return self.api(user).post(f'/api/v1/articles/{self.article.id}/update_status/',
                                   {'status': status, 'reason': reason}, format='json')

    def publish(self, user):
        cert = SimpleUploadedFile('sertifikat.pdf', b'%PDF-1.4\n', 'application/pdf')
        return self.api(user).post(f'/api/v1/articles/{self.article.id}/complete_publication/',
                                   {'certificate': cert}, format='multipart')

    def submit_review(self, recommendation):
        return self.api(self.reviewer).post(f'/api/v1/reviews/{self.review.id}/submit_review/',
                                            {'review_content': 'Xulosa qismini kengaytiring.',
                                             'recommendation': recommendation}, format='json')

    def pay(self):
        tx = Transaction.objects.create(user=self.author, article=self.article, amount=Decimal('50000'),
                                        service_type='publication_fee', status='completed')
        fulfill_publication_fee(tx)
        return tx

    def test_full_flow_revision_then_accept_then_pay_then_publish(self):
        # Yuborilganda to'lov so'ralmaydi
        self.assertFalse(self.detail(self.author)['needs_publication_payment'])

        # 2b) taqrizchi sabab bilan qaytaradi
        self.assertEqual(self.submit_review('major_revision').status_code, 200)
        self.assertEqual(self.set_status(self.reviewer, 'Revision', 'Xulosa qismini kengaytiring.').status_code, 200)

        # 3) muallif tuzatib qayta yuboradi — taqrizchiga «qayta yuborildi» bildirishnomasi
        self.assertEqual(self.set_status(self.author, 'Yangi').status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.reviewer, title='Maqola qayta yuborildi').exists())
        data = self.detail(self.author)
        self.assertEqual(data['status_label'], 'Qayta yuborildi')
        self.assertEqual(data['status_timeline'][-1]['status'], 'Qayta yuborildi')

        # 4) taqrizchi qabul qiladi → muallifga to'lov
        self.assertEqual(self.set_status(self.reviewer, 'Accepted').status_code, 200)
        self.assertTrue(self.detail(self.author)['needs_publication_payment'])
        self.assertEqual(self.detail(self.author)['status_label'], "Qabul qilindi — to'lov kutilmoqda")
        self.assertTrue(Notification.objects.filter(
            user=self.author, title="Maqola qabul qilindi — nashr to'lovini qiling").exists())
        staff = self.detail(self.reviewer)
        self.assertTrue(staff['awaiting_post_payment'])
        self.assertFalse(staff['can_publish'])
        # To'lovsiz nashr qilib bo'lmaydi (taqrizchi ham, admin ham)
        self.assertEqual(self.publish(self.reviewer).status_code, 400)
        self.assertEqual(self.publish(self.journal_admin).status_code, 400)

        # 5) muallif to'laydi → taqrizchiga xabar (takroriy chaqiruvda bir marta)
        tx = self.pay()
        fulfill_publication_fee(tx)
        self.assertEqual(Notification.objects.filter(user=self.reviewer, title="Nashr to'lovi qilindi").count(), 1)
        self.assertFalse(self.detail(self.author)['needs_publication_payment'])
        self.assertTrue(self.detail(self.reviewer)['can_publish'])
        self.assertIn("Nashr to'lovi qilindi", self.detail(self.author)['status_timeline'][-1]['hint'] + str(
            [e['hint'] for e in self.detail(self.author)['status_timeline']]))

        # 6) taqrizchi nashr qiladi
        self.assertEqual(self.publish(self.reviewer).status_code, 200)
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, 'Published')

    def test_pre_payment_journal_unchanged(self):
        self.journal.payment_model = 'pre-payment'
        self.journal.save()
        self.submit_review('accept')
        self.assertEqual(self.set_status(self.reviewer, 'Accepted').status_code, 200)
        self.assertFalse(self.detail(self.author)['needs_publication_payment'])
        self.assertEqual(self.publish(self.reviewer).status_code, 200)

    def test_free_post_payment_journal_needs_no_payment(self):
        self.journal.publication_fee = 0
        self.journal.save()
        self.submit_review('accept')
        self.set_status(self.reviewer, 'Accepted')
        self.assertFalse(self.detail(self.author)['needs_publication_payment'])
        self.assertEqual(self.publish(self.reviewer).status_code, 200)

    def test_author_can_create_payment_for_accepted_article(self):
        self.submit_review('accept')
        self.set_status(self.reviewer, 'Accepted')
        res = self.api(self.author).post('/api/v1/payments/transactions/', {
            'amount': 0, 'currency': 'UZS', 'service_type': 'publication_fee', 'article': str(self.article.id),
        }, format='json')
        self.assertIn(res.status_code, (200, 201), res.content)
