"""
Demo (namuna) ma'lumotlar: to'ldirish, qayta to'ldirish, o'chirish va haqiqiy foydalanuvchilardan ajratish.
"""
import io
from unittest import mock

from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.articles.models import Article
from apps.journals.models import Journal
from apps.payments.models import Transaction
from apps.users.models import User
from config.demo import demo_q


def seed():
    call_command('seed_demo_data', stdout=io.StringIO())


@override_settings(DEBUG=False)
class DemoSeedTests(TestCase):
    def tearDown(self):
        call_command('seed_demo_data', '--purge', stdout=io.StringIO())

    def test_seed_fills_all_roles_and_is_repeatable(self):
        with mock.patch('apps.notifications.signals.schedule_delivery') as tg, \
                mock.patch('apps.articles.signals.notify_article_submitted') as staff:
            seed()
        tg.assert_not_called()  # haqiqiy xodimlarga Telegram ketmaydi
        staff.assert_not_called()
        self.assertEqual(Article.objects.count(), 70)
        self.assertEqual(Journal.objects.count(), 5)
        statuses = set(Article.objects.values_list('status', flat=True))
        self.assertTrue({'Published', 'QabulQilingan', 'Draft', 'Rejected', 'NashrgaYuborilgan'} <= statuses)
        author = User.objects.get(phone='998911111111')
        self.assertGreaterEqual(author.articles.count(), 10)
        self.assertTrue(User.objects.get(phone='998922222222').peer_reviews.exists())
        self.assertTrue(Article.objects.filter(status='Published').exclude(final_pdf_path='').exists())
        # Hamma yozuv demo foydalanuvchilarga tegishli
        self.assertFalse(Article.objects.exclude(demo_q('author__')).exists())
        self.assertFalse(Transaction.objects.exclude(demo_q('user__')).exists())
        seed()  # qayta ishga tushirish — ikki baravar ko'paymaydi
        self.assertEqual(Article.objects.count(), 70)

    def test_purge_keeps_real_users_and_login_accounts(self):
        real = User.objects.create_user(phone='998901234567', password='x', email='real@mail.uz',
                                        first_name='Real', last_name='User', affiliation='X')
        seed()
        call_command('seed_demo_data', '--purge', stdout=io.StringIO())
        self.assertEqual(Article.objects.count(), 0)
        self.assertEqual(Transaction.objects.count(), 0)
        self.assertTrue(User.objects.filter(pk=real.pk).exists())
        self.assertTrue(User.objects.filter(phone='998911111111').exists())
        self.assertFalse(User.objects.filter(phone__startswith='998000').exists())

    def test_demo_excluded_from_scholar_index_and_revenue(self):
        seed()
        pub = Article.objects.filter(status='Published').first()
        self.assertEqual(self.client.get(f'/p/article/{pub.pk}/').status_code, 404)
        self.assertNotIn(str(pub.pk), self.client.get('/sitemap.xml').content.decode())
        from apps.articles.antiplagiat_index import article_is_indexable

        self.assertFalse(article_is_indexable(pub))
        admin = User.objects.create_user(phone='998907777777', password='x', email='boss@mail.uz', first_name='B',
                                         last_name='A', affiliation='X', role='super_admin')
        c = APIClient()
        c.force_authenticate(admin)
        data = c.get('/api/v1/analytics/overview/').json()
        self.assertEqual(data['revenue']['total_period'], 0)
        txs = c.get('/api/v1/payments/transactions/').json()
        rows = txs.get('results', txs)
        self.assertTrue(rows and all(r['is_demo'] for r in rows))

    def test_real_author_cannot_see_or_submit_to_demo_journal(self):
        seed()
        real = User.objects.create_user(phone='998901112233', password='x', email='a@mail.uz', first_name='A',
                                        last_name='B', affiliation='X', role='author')
        c = APIClient()
        c.force_authenticate(real)
        listed = c.get('/api/v1/journals/journals/').json()
        rows = listed.get('results', listed)
        self.assertEqual(rows, [])
        journal = Journal.objects.first()
        res = c.post('/api/v1/articles/', {'title': 'Haqiqiy maqola', 'abstract': 'a', 'journal': str(journal.pk),
                                           'keywords': ['x']}, format='json')
        self.assertEqual(res.status_code, 400, res.content[:300])
        self.assertIn('demo', res.content.decode().lower())
        demo_author = User.objects.get(phone='998911111111')
        c.force_authenticate(demo_author)
        listed = c.get('/api/v1/journals/journals/').json()
        self.assertEqual(len(listed.get('results', listed)), 5)

    def test_operator_reads_all_requests_but_cannot_modify(self):
        seed()
        op = User.objects.get(phone='998955555555')
        c = APIClient()
        c.force_authenticate(op)
        self.assertEqual(len(c.get('/api/v1/udc/requests/').json()), 8)
        tx_rows = c.get('/api/v1/payments/transactions/').json()
        self.assertGreater(tx_rows.get('count', len(tx_rows)), 50)
        other_tx = Transaction.objects.exclude(user=op).first()
        self.assertEqual(c.post(f'/api/v1/payments/transactions/{other_tx.pk}/prepare_payment/').status_code, 404)
        doi = c.get('/api/v1/articles/doi/requests/').json()
        self.assertEqual(len(doi.get('results', doi)), 5)
