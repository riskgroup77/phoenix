"""
2026-10 yangi imkoniyatlar: maqola tarixi, Telegram xabarlari, to'lov cheki, ORCID, qidiruv,
analitika, taqrizchi muddatlari, ochiq bosh sahifa, Google Scholar sahifasi, Crossref, antiplagiat segmentlari.
"""
import json
from datetime import timedelta
from decimal import Decimal
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.articles.models import ActivityLog, Article, ArticleStatusEvent, DoiRequest
from apps.journals.models import Journal, JournalCategory
from apps.notifications.models import Notification
from apps.payments.models import Transaction
from apps.users.models import TelegramSession, User
from apps.users.orcid import normalize_orcid


def _user(phone, role='author', **extra):
    return User.objects.create_user(
        phone=phone, password='pass12345', email=f'{phone}@t.uz',
        first_name='Ism', last_name=role.title(), affiliation='X', role=role, **extra,
    )


class Base(TestCase):
    def setUp(self):
        self.author = _user('998920000001')
        self.other = _user('998920000002')
        self.reviewer = _user('998920000003', role='reviewer')
        self.jadmin = _user('998920000004', role='journal_admin')
        self.sadmin = _user('998920000005', role='super_admin')
        self.accountant = _user('998920000006', role='accountant')
        cat = JournalCategory.objects.create(name='Iqtisod')
        self.journal = Journal.objects.create(
            name='Iqtisodiyot jurnali', issn='2222-2222', description='d', journal_admin=self.jadmin, category=cat,
            publication_fee=Decimal('150000'),
        )
        self.article = Article.objects.create(
            title='Raqamli iqtisodiyot', abstract='Annotatsiya matni', keywords=['iqtisod'],
            author=self.author, journal=self.journal, status='Yangi',
        )

    def api(self, user=None):
        c = APIClient()
        if user:
            c.force_authenticate(user)
        return c


class StatusTimelineTests(Base):
    def test_event_recorded_on_create(self):
        ev = ArticleStatusEvent.objects.filter(article=self.article)
        self.assertEqual(ev.count(), 1)
        self.assertEqual(ev.first().to_status, 'Yangi')
        self.assertEqual(ev.first().from_status, '')

    def test_status_change_records_actor_and_note(self):
        res = self.api(self.jadmin).post(
            f'/api/v1/articles/{self.article.id}/update_status/',
            {'status': 'Revision', 'reason': "Adabiyotlar ro'yxatini to'ldiring"}, format='json',
        )
        self.assertEqual(res.status_code, 200, res.content)
        last = ArticleStatusEvent.objects.filter(article=self.article).order_by('-created_at').first()
        self.assertEqual(last.from_status, 'Yangi')
        self.assertEqual(last.to_status, 'Revision')
        self.assertEqual(last.actor, self.jadmin)
        self.assertEqual(last.actor_role, 'journal_admin')
        self.assertIn('Adabiyotlar', last.note)

    def test_save_without_status_change_adds_no_event(self):
        self.article.title = 'Yangi nom'
        self.article.save()
        self.assertEqual(ArticleStatusEvent.objects.filter(article=self.article).count(), 1)

    def test_author_timeline_hides_staff_names(self):
        self.api(self.jadmin).post(
            f'/api/v1/articles/{self.article.id}/update_status/', {'status': 'WithEditor'}, format='json',
        )
        res = self.api(self.author).get(f'/api/v1/articles/{self.article.id}/')
        self.assertEqual(res.status_code, 200)
        timeline = res.json()['status_timeline']
        self.assertGreaterEqual(len(timeline), 2)
        staff_rows = [t for t in timeline if t.get('to_status') == 'WithEditor']
        self.assertEqual(staff_rows[0]['responsible'], 'Jurnal muharriri')
        self.assertTrue(staff_rows[0]['hint'])
        # eskidan yangiga tartib
        dates = [t['date'] for t in timeline]
        self.assertEqual(dates, sorted(dates))

    def test_staff_timeline_shows_name(self):
        self.api(self.jadmin).post(
            f'/api/v1/articles/{self.article.id}/update_status/', {'status': 'WithEditor'}, format='json',
        )
        res = self.api(self.sadmin).get(f'/api/v1/articles/{self.article.id}/')
        row = [t for t in res.json()['status_timeline'] if t.get('to_status') == 'WithEditor'][0]
        self.assertIn(self.jadmin.last_name, row['responsible'])

    def test_completed_payment_appears_in_timeline(self):
        Transaction.objects.create(
            user=self.author, article=self.article, amount=Decimal('150000'),
            service_type='publication_fee', status='completed', completed_at=timezone.now(),
        )
        res = self.api(self.author).get(f'/api/v1/articles/{self.article.id}/')
        kinds = [t['kind'] for t in res.json()['status_timeline']]
        self.assertIn('payment', kinds)


@override_settings(TELEGRAM_BOT_TOKEN='123:test', TELEGRAM_NOTIFY_SYNC=True, FRONTEND_BASE_URL='https://ilmiyfaoliyat.uz')
class TelegramNotifyTests(Base):
    def setUp(self):
        super().setUp()
        TelegramSession.objects.create(telegram_id=555001, user=self.author, access_token='a', refresh_token='r')

    def _notify(self):
        with self.captureOnCommitCallbacks(execute=True):
            Notification.notify(self.author, 'Maqola holati yangilandi', '"X" <b>holati</b>', 'status_change', '/articles/1')

    def test_sent_to_bot_session(self):
        with mock.patch('apps.notifications.telegram.send_telegram_message', return_value=True) as send:
            self._notify()
        send.assert_called_once()
        chat_id, text, url = send.call_args[0]
        self.assertEqual(chat_id, 555001)
        self.assertIn('<b>Maqola holati yangilandi</b>', text)
        self.assertIn('&lt;b&gt;holati&lt;/b&gt;', text)  # foydalanuvchi matni HTML-ekranlangan
        self.assertEqual(url, 'https://ilmiyfaoliyat.uz/#/articles/1')

    def test_respects_user_setting(self):
        self.author.telegram_notifications = False
        self.author.save(update_fields=['telegram_notifications'])
        with mock.patch('apps.notifications.telegram.send_telegram_message', return_value=True) as send:
            self._notify()
        send.assert_not_called()

    @override_settings(TELEGRAM_BOT_TOKEN='')
    def test_disabled_without_token(self):
        with mock.patch('apps.notifications.telegram.send_telegram_message', return_value=True) as send:
            self._notify()
        send.assert_not_called()

    def test_profile_exposes_connection(self):
        res = self.api(self.author).get('/api/v1/auth/profile/')
        self.assertTrue(res.json()['telegram_connected'])
        res = self.api(self.author).patch('/api/v1/auth/update_profile/', {'telegram_notifications': False}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.author.refresh_from_db()
        self.assertFalse(self.author.telegram_notifications)


class OrcidTests(Base):
    def test_normalize_valid(self):
        self.assertEqual(normalize_orcid('https://orcid.org/0000-0002-1825-0097'), '0000-0002-1825-0097')
        self.assertEqual(normalize_orcid('0000000218250097'), '0000-0002-1825-0097')
        self.assertEqual(normalize_orcid('0000-0002-1694-233x'), '0000-0002-1694-233X')

    def test_bad_checksum_rejected(self):
        with self.assertRaises(ValueError):
            normalize_orcid('0000-0002-1825-0098')

    def test_profile_update_validates(self):
        res = self.api(self.author).patch('/api/v1/auth/update_profile/', {'orcid_id': '1234'}, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.api(self.author).patch(
            '/api/v1/auth/update_profile/', {'orcid_id': 'orcid.org/0000-0002-1825-0097'}, format='json',
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['orcid_url'], 'https://orcid.org/0000-0002-1825-0097')


class ReceiptTests(Base):
    def setUp(self):
        super().setUp()
        self.tx = Transaction.objects.create(
            user=self.author, article=self.article, amount=Decimal('150000'), service_type='publication_fee',
            status='completed', completed_at=timezone.now(), payment_provider='click', click_trans_id='777',
        )

    def test_owner_downloads_pdf(self):
        res = self.api(self.author).get(f'/api/v1/payments/transactions/{self.tx.id}/receipt/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'application/pdf')
        self.assertTrue(res.content.startswith(b'%PDF'))

    def test_pending_rejected_and_foreign_hidden(self):
        pending = Transaction.objects.create(
            user=self.author, amount=Decimal('1000'), service_type='doi_request', status='pending',
        )
        self.assertEqual(self.api(self.author).get(f'/api/v1/payments/transactions/{pending.id}/receipt/').status_code, 400)
        self.assertEqual(self.api(self.other).get(f'/api/v1/payments/transactions/{self.tx.id}/receipt/').status_code, 404)
        self.assertEqual(self.api(self.accountant).get(f'/api/v1/payments/transactions/{self.tx.id}/receipt/').status_code, 200)

    def test_summary_and_verify(self):
        res = self.api(self.author).get('/api/v1/payments/transactions/summary/')
        self.assertEqual(res.json()['total_paid'], 150000.0)
        self.assertEqual(res.json()['by_service'][0]['label'], "Maqola nashri to'lovi")
        code = self.api(self.author).get(f'/api/v1/payments/transactions/{self.tx.id}/').json()['receipt_number']
        self.assertTrue(code.startswith('CHK-'))
        res = APIClient().get(f'/api/v1/articles/verify/{code}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['type'], 'receipt')
        self.assertNotIn(self.author.phone, json.dumps(res.json()))


class SearchTests(Base):
    def test_author_sees_only_own(self):
        Article.objects.create(title='Raqamli boshqaruv', abstract='a', author=self.other, journal=self.journal, status='Yangi')
        res = self.api(self.author).get('/api/v1/search/', {'q': 'raqamli'})
        titles = [a['title'] for a in res.json()['articles']]
        self.assertEqual(titles, ['Raqamli iqtisodiyot'])
        self.assertEqual(res.json()['users'], [])

    def test_admin_finds_users_and_journals(self):
        res = self.api(self.sadmin).get('/api/v1/search/', {'q': 'iqtisod'})
        self.assertEqual(len(res.json()['journals']), 1)
        res = self.api(self.sadmin).get('/api/v1/search/', {'q': 'Reviewer'})
        self.assertTrue(any(u['role'] == 'reviewer' for u in res.json()['users']))

    def test_short_query(self):
        res = self.api(self.author).get('/api/v1/search/', {'q': 'r'})
        self.assertEqual(res.json()['articles'], [])


class AnalyticsTests(Base):
    def setUp(self):
        super().setUp()
        Transaction.objects.create(
            user=self.author, article=self.article, amount=Decimal('150000'), service_type='publication_fee',
            status='completed', completed_at=timezone.now(),
        )
        self.article.status = 'Published'
        self.article.save()

    def test_permissions(self):
        self.assertEqual(self.api(self.author).get('/api/v1/analytics/overview/').status_code, 403)
        self.assertEqual(self.api(self.reviewer).get('/api/v1/analytics/overview/').status_code, 403)

    def test_super_admin_full(self):
        data = self.api(self.sadmin).get('/api/v1/analytics/overview/').json()
        self.assertEqual(len(data['months']), 12)
        self.assertEqual(data['revenue']['this_month'], 150000.0)
        self.assertEqual(data['articles']['published_period'], 1)
        self.assertEqual(data['articles']['journals'][0]['name'], 'Iqtisodiyot jurnali')
        self.assertIn('users', data)

    def test_accountant_finance_only(self):
        data = self.api(self.accountant).get('/api/v1/analytics/overview/').json()
        self.assertIn('revenue', data)
        self.assertNotIn('articles', data)

    def test_journal_admin_scoped(self):
        data = self.api(self.jadmin).get('/api/v1/analytics/overview/').json()
        self.assertNotIn('revenue', data)
        self.assertEqual(data['articles']['published_period'], 1)


class WorkloadTests(Base):
    def setUp(self):
        super().setUp()
        self.article.status = 'QabulQilingan'
        self.article.save()
        ArticleStatusEvent.objects.filter(article=self.article, to_status='QabulQilingan').update(
            created_at=timezone.now() - timedelta(days=10)
        )

    def test_reviewer_sees_overdue(self):
        res = self.api(self.reviewer).get('/api/v1/analytics/workload/')
        self.assertEqual(res.status_code, 200)
        item = res.json()['items'][0]
        self.assertEqual(item['kind'], 'article')
        self.assertTrue(item['overdue'])
        self.assertEqual(res.json()['counts']['overdue'], 1)
        self.assertNotIn('reviewers', res.json())

    def test_admin_gets_reviewer_table_author_forbidden(self):
        res = self.api(self.sadmin).get('/api/v1/analytics/workload/')
        self.assertIn('reviewers', res.json())
        self.assertEqual(self.api(self.author).get('/api/v1/analytics/workload/').status_code, 403)

    def test_reminder_digest_once_per_day(self):
        out = StringIO()
        call_command('send_deadline_reminders', stdout=out)
        call_command('send_deadline_reminders', stdout=out)
        self.assertEqual(Notification.objects.filter(user=self.reviewer, metadata__digest_kind='sla_digest').count(), 1)
        self.assertEqual(Notification.objects.filter(user=self.sadmin, metadata__digest_kind='sla_digest').count(), 1)


class PublicPagesTests(Base):
    def setUp(self):
        super().setUp()
        self.article.status = 'Published'
        self.article.doi = '10.5555/phx.2026.1'
        self.article.submitted_author_name = 'Karimov Alisher, Sobirova Dilnoza'
        self.article.save()

    def test_public_overview_anonymous(self):
        from django.core.cache import cache
        cache.clear()
        res = APIClient().get('/api/v1/analytics/public/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['stats']['published_articles'], 1)
        self.assertEqual(res.json()['recent_articles'][0]['title'], 'Raqamli iqtisodiyot')

    def test_scholar_page_meta(self):
        res = self.client.get(f'/p/article/{self.article.id}/')
        self.assertEqual(res.status_code, 200)
        html = res.content.decode('utf-8')
        self.assertIn('<meta name="citation_title" content="Raqamli iqtisodiyot">', html)
        self.assertIn('<meta name="citation_author" content="Sobirova Dilnoza">', html)
        self.assertIn('citation_doi', html)
        self.assertIn('application/ld+json', html)

    def test_unpublished_hidden_and_sitemap(self):
        draft = Article.objects.create(title='Yashirin', abstract='a', author=self.author, journal=self.journal, status='Yangi')
        self.assertEqual(self.client.get(f'/p/article/{draft.id}/').status_code, 404)
        sitemap = self.client.get('/sitemap.xml').content.decode()
        self.assertIn(str(self.article.id), sitemap)
        self.assertNotIn(str(draft.id), sitemap)
        self.assertIn('Sitemap:', self.client.get('/robots.txt').content.decode())


@override_settings(CROSSREF_DOI_PREFIX='10.5555')
class CrossrefTests(Base):
    def setUp(self):
        super().setUp()
        self.article.status = 'Published'
        self.article.save()

    def test_xml_for_admin(self):
        res = self.api(self.jadmin).get(f'/api/v1/articles/{self.article.id}/crossref/')
        self.assertEqual(res.status_code, 200)
        xml = res.content.decode('utf-8')
        self.assertIn('<doi>10.5555/phx.', xml)
        self.assertIn('<title>Raqamli iqtisodiyot</title>', xml)
        self.assertIn('/p/article/', xml)

    def test_forbidden_and_not_configured(self):
        self.assertEqual(self.api(self.author).get(f'/api/v1/articles/{self.article.id}/crossref/').status_code, 403)
        res = self.api(self.sadmin).post(f'/api/v1/articles/{self.article.id}/crossref/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Crossref', res.json()['detail'])


class AnnotatedSegmentsTests(TestCase):
    def test_segments_assign_best_source(self):
        from apps.articles.antiplagiat_engine import _generate_annotated_document

        text = (
            "Raqamli iqtisodiyot sharoitida kichik biznes moliyaviy barqarorligi muhim. "
            "Bu gap esa butunlay original va boshqa joyda uchramaydi."
        )
        sources = [{'document_fragment': 'Raqamli iqtisodiyot sharoitida kichik biznes moliyaviy barqarorligi muhim.'}]
        doc = _generate_annotated_document(text, sources)
        segs = doc[0]['segments']
        self.assertEqual(segs[0]['source'], 1)
        self.assertIsNone(segs[-1]['source'])
