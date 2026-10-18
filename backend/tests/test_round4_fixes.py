"""
2-to'liq sinov (2026-10-17) topilmalari: jurnal o'chirish himoyasi, "To'lovlarim" filtri, demo hisob,
taqrizchi taqriz holati, kitob buyurtmasi cheklovlari, analitika, Crossref (demo), maqola yuborish rollari.
"""
from decimal import Decimal

from django.utils import timezone

from apps.articles.models import Article
from apps.journals.internal import get_book_orders_journal
from apps.journals.models import Journal, JournalCategory
from apps.payments.models import Transaction
from apps.reviews.models import PeerReview

from tests.test_qa_fixes import QaBase, _docx


class JournalDeleteProtectionTests(QaBase):
    def test_journal_with_articles_is_archived_not_deleted(self):
        # Maqolasi bor jurnal butunlay o'chmaydi — arxivlanadi (maqolalar va to'lovlar saqlanadi)
        res = self.api(self.super_admin).delete(f'/api/v1/journals/journals/{self.journal.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['archived'])
        self.assertEqual(res.json()['articles_count'], 1)
        self.assertTrue(Article.objects.filter(pk=self.article.pk).exists())
        data = self.api(self.super_admin).get(f'/api/v1/journals/journals/{self.journal.id}/').json()
        self.assertTrue(data['is_archived'])
        self.assertEqual(data['articles_count'], 1)
        # Bosh admin qayta tiklay oladi
        res = self.api(self.super_admin).post(f'/api/v1/journals/journals/{self.journal.id}/restore/')
        self.assertFalse(res.json()['is_archived'])

    def test_empty_journal_can_be_deleted_internal_cannot(self):
        empty = Journal.objects.create(name='Bo\'sh', issn='9999-0000', description='d', journal_admin=self.super_admin,
                                       category=self.journal.category)
        self.assertEqual(self.api(self.super_admin).delete(f'/api/v1/journals/journals/{empty.id}/').status_code, 204)
        internal = get_book_orders_journal()
        self.assertEqual(self.api(self.super_admin).delete(f'/api/v1/journals/journals/{internal.id}/').status_code, 400)

    def test_category_with_journals_cannot_be_deleted(self):
        res = self.api(self.super_admin).delete(f'/api/v1/journals/categories/{self.journal.category_id}/')
        self.assertEqual(res.status_code, 409)
        self.assertTrue(Journal.objects.filter(pk=self.journal.pk).exists())


class MyPaymentsTests(QaBase):
    def test_mine_filter_for_staff(self):
        Transaction.objects.create(user=self.author, amount=Decimal('1000'), service_type='top_up', status='pending')
        own = Transaction.objects.create(user=self.accountant, amount=Decimal('2000'), service_type='top_up', status='completed')
        all_ids = [t['id'] for t in self.api(self.accountant).get('/api/v1/payments/transactions/?page_size=100').json()['results']]
        self.assertEqual(len(all_ids), 2)  # Moliya sahifasi — hammasi
        mine = [t['id'] for t in self.api(self.accountant).get('/api/v1/payments/transactions/?mine=1&page_size=100').json()['results']]
        self.assertEqual(mine, [str(own.id)])


class DemoAccountLockTests(QaBase):
    def test_demo_user_cannot_change_email_phone_password(self):
        from config.demo import DEMO_EMAIL_DOMAIN

        self.author.email = f'author@{DEMO_EMAIL_DOMAIN}'
        self.author.save(update_fields=['email'])
        api = self.api(self.author)
        res = api.put('/api/v1/auth/update_profile/', {'email': 'real@example.com'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('email', res.json())
        res = api.put('/api/v1/auth/update_profile/', {'password': 'Yangi12345!', 'current_password': 'pass12345'}, format='json')
        self.assertEqual(res.status_code, 400)
        # Boshqa maydonlar o'zgaradi
        self.assertEqual(api.put('/api/v1/auth/update_profile/', {'affiliation': 'TDIU'}, format='json').status_code, 200)
        self.author.refresh_from_db()
        self.assertTrue(self.author.email.endswith(DEMO_EMAIL_DOMAIN))
        self.assertTrue(self.author.check_password('pass12345'))

    def test_regular_user_can_change_email(self):
        res = self.api(self.author).put('/api/v1/auth/update_profile/', {'email': 'new@example.com'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)


class ReviewerStatusTests(QaBase):
    def test_list_has_my_review_status(self):
        done = Article.objects.create(title='Eski', abstract='a', author=self.author, journal=self.journal, status='Published')
        PeerReview.objects.create(article=self.article, reviewer=self.reviewer, status='accepted')
        PeerReview.objects.create(article=done, reviewer=self.reviewer, status='completed', completed_at=timezone.now())
        rows = {a['id']: a['my_review_status'] for a in
                self.api(self.reviewer).get('/api/v1/articles/?page_size=50').json()['results']}
        self.assertEqual(rows[str(self.article.id)], 'accepted')
        self.assertEqual(rows[str(done.id)], 'completed')
        self.assertNotIn('my_review_status', self.api(self.author).get('/api/v1/articles/mine/').json()[0])


class BookRestrictionTests(QaBase):
    def test_delivered_is_final_and_no_reviewers(self):
        book = Article.objects.create(title='[KITOB] K', abstract='a', author=self.author, journal=self.journal, status='Delivered')
        data = self.api(self.super_admin).get(f'/api/v1/articles/{book.id}/').json()
        self.assertEqual(data['allowed_transitions'], [])
        Article.objects.filter(pk=book.pk).update(status='Printing')
        res = self.api(self.super_admin).post('/api/v1/reviews/', {'article': str(book.id), 'reviewer': str(self.reviewer.id)}, format='json')
        self.assertEqual(res.status_code, 400)


class AnalyticsBooksTests(QaBase):
    def test_internal_journal_excluded(self):
        internal = get_book_orders_journal()
        Article.objects.create(title='[KITOB] K', abstract='a', author=self.author, journal=internal, status='Printing')
        data = self.api(self.super_admin).get('/api/v1/analytics/overview/').json()
        names = [j.get('name') for j in (data.get('articles') or {}).get('journals', [])]
        self.assertIn(self.journal.name, names)  # ro'yxat bo'sh emas
        self.assertNotIn(internal.name, names)


class CrossrefDemoTests(QaBase):
    def test_demo_info_is_not_an_error(self):
        from config.demo import DEMO_EMAIL_DOMAIN

        self.author.email = f'a@{DEMO_EMAIL_DOMAIN}'
        self.author.save(update_fields=['email'])
        Article.objects.filter(pk=self.article.pk).update(status='Published')
        res = self.api(self.super_admin).get(f'/api/v1/articles/{self.article.id}/crossref/?info=1')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()['available'])


class SubmitterRoleTests(QaBase):
    def payload(self, title='Xizmat maqolasi'):
        return {'title': title, 'abstract': 'a', 'journal': str(self.other_journal.id), 'keywords': '["a", "b"]',
                'page_count': '1', 'final_pdf_path': _docx()}

    def test_service_roles_cannot_submit(self):
        for user in (self.journal_admin, self.accountant):
            with self.subTest(role=user.role):
                self.assertEqual(self.api(user).post('/api/v1/articles/', self.payload(), format='multipart').status_code, 403)

    def test_reviewer_can_submit(self):
        res = self.api(self.reviewer).post('/api/v1/articles/', self.payload('Taqrizchining maqolasi'), format='multipart')
        self.assertEqual(res.status_code, 201, res.content)
