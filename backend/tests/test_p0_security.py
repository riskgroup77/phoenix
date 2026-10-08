"""
P0 xavfsizlik tuzatishlari uchun regressiya testlari (2026-10):
to'lov imzosi, server narxi, Payme auth, ruxsatlar, maqola maydonlari, tarjima narxi, demo parollar.
"""
import base64
import hashlib
import io
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client, TestCase, override_settings
from rest_framework.test import APIClient

from apps.articles.models import Article
from apps.journals.models import Journal, JournalCategory
from apps.payments.models import Transaction
from apps.translations.models import TranslationRequest
from apps.udc.models import ServicePrice
from apps.users.models import User

CLICK_SECRET = 'test-click-secret'
CLICK_SETTINGS = dict(
    CLICK_SECRET_KEY=CLICK_SECRET,
    CLICK_SERVICE_ID='82154',
    CLICK_MERCHANT_ID='45730',
    CLICK_MERCHANT_USER_ID='63536',
    CLICK_SERVICE_82154_SECRET_KEY='',
    CLICK_SERVICE_82155_SECRET_KEY='',
    CLICK_SERVICE_89248_SECRET_KEY='',
    CLICK_SERVICE_88045_SECRET_KEY='',
)


def _md5(*parts):
    return hashlib.md5(''.join(str(p) for p in parts).encode('utf-8')).hexdigest()


def _user(phone, role='author', **extra):
    return User.objects.create_user(
        phone=phone, password='pass12345', email=f'{phone}@t.uz',
        first_name='T', last_name=role, affiliation='X', role=role, **extra,
    )


class BaseFixture(TestCase):
    def setUp(self):
        self.author = _user('998900000001')
        self.other_author = _user('998900000002')
        self.journal_admin = _user('998900000003', role='journal_admin')
        self.super_admin = _user('998900000004', role='super_admin')
        self.operator = _user('998900000005', role='operator')
        self.category = JournalCategory.objects.create(name='Fan')
        self.journal = Journal.objects.create(
            name='Jurnal', issn='1234-5678', description='d', journal_admin=self.journal_admin,
            category=self.category, payment_model='pre-payment', pricing_type='fixed',
            publication_fee=Decimal('150000'),
        )
        self.article = Article.objects.create(
            title='Maqola sarlavhasi', abstract='a', author=self.author, journal=self.journal,
            status='Draft', page_count=5,
        )

    def api(self, user=None):
        c = APIClient()
        if user is not None:
            c.force_authenticate(user)
        return c


@override_settings(**CLICK_SETTINGS)
class ClickCallbackTests(BaseFixture):
    def setUp(self):
        super().setUp()
        self.tx = Transaction.objects.create(
            user=self.author, article=self.article, amount=Decimal('150000'), service_type='publication_fee',
        )

    def _prepare(self, **over):
        data = dict(click_trans_id='111', service_id='82154', click_paydoc_id='222',
                    merchant_trans_id=str(self.tx.id), amount='150000.00', action='0', sign_time='2026-10-07 10:00:00')
        data.update(over)
        data.setdefault('sign_string', _md5(data['click_trans_id'], data['service_id'], CLICK_SECRET,
                                            data['merchant_trans_id'], data['amount'], data['action'], data['sign_time']))
        return Client().post('/api/v1/payments/click/prepare/', data).json()

    def _complete(self, with_sign=True, **over):
        data = dict(click_trans_id='111', service_id='82154', click_paydoc_id='222',
                    merchant_trans_id=str(self.tx.id), merchant_prepare_id=str(self.tx.id),
                    amount='150000.00', action='1', error='0', sign_time='2026-10-07 10:01:00')
        data.update(over)
        if with_sign:
            data.setdefault('sign_string', _md5(data['click_trans_id'], data['service_id'], CLICK_SECRET,
                                                data['merchant_trans_id'], data['merchant_prepare_id'],
                                                data['amount'], data['action'], data['sign_time']))
        return Client().post('/api/v1/payments/click/complete/', data).json()

    def test_complete_without_signature_is_rejected(self):
        res = self._complete(with_sign=False)
        self.assertEqual(res['error'], -1)
        self.tx.refresh_from_db()
        self.assertEqual(self.tx.status, 'pending')

    def test_complete_with_wrong_signature_is_rejected(self):
        res = self._complete(sign_string='0' * 32)
        self.assertEqual(res['error'], -1)
        self.tx.refresh_from_db()
        self.assertEqual(self.tx.status, 'pending')

    def test_complete_with_wrong_amount_is_rejected(self):
        res = self._complete(amount='1.00')
        self.assertEqual(res['error'], -2)
        self.tx.refresh_from_db()
        self.assertEqual(self.tx.status, 'pending')

    def test_complete_with_wrong_prepare_id_is_rejected(self):
        res = self._complete(merchant_prepare_id='not-our-id')
        self.assertEqual(res['error'], -6)

    def test_prepare_unknown_transaction_is_not_success(self):
        res = self._prepare(merchant_trans_id='00000000-0000-0000-0000-000000000000')
        self.assertEqual(res['error'], -5)

    def test_valid_prepare_and_complete_marks_paid_and_fulfills(self):
        self.assertEqual(self._prepare()['error'], 0)
        self.assertEqual(self._complete()['error'], 0)
        self.tx.refresh_from_db()
        self.article.refresh_from_db()
        self.assertEqual(self.tx.status, 'completed')
        self.assertEqual(self.article.status, 'Yangi')
        # Takroriy complete — idempotent
        self.assertEqual(self._complete()['error'], 0)

    def test_prepare_already_paid(self):
        self.tx.status = 'completed'
        self.tx.save()
        self.assertEqual(self._prepare()['error'], -4)

    def test_prepare_rejects_legacy_underpriced_transaction(self):
        self.tx.amount = Decimal('1000')
        self.tx.save()
        self.assertEqual(self._prepare(amount='1000.00')['error'], -2)


class TransactionPricingTests(BaseFixture):
    def test_publication_fee_amount_is_computed_on_server(self):
        res = self.api(self.author).post('/api/v1/payments/transactions/', {
            'amount': 1, 'service_type': 'publication_fee', 'article': str(self.article.id),
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Decimal(str(res.json()['amount'])), Decimal('150000'))

    def test_per_page_pricing(self):
        self.journal.pricing_type = 'per_page'
        self.journal.price_per_page = Decimal('20000')
        self.journal.save()
        res = self.api(self.author).post('/api/v1/payments/transactions/', {
            'amount': 1, 'service_type': 'publication_fee', 'article': str(self.article.id),
        }, format='json')
        self.assertEqual(Decimal(str(res.json()['amount'])), Decimal('100000'))

    def test_cannot_pay_for_someone_elses_article(self):
        res = self.api(self.other_author).post('/api/v1/payments/transactions/', {
            'amount': 150000, 'service_type': 'publication_fee', 'article': str(self.article.id),
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_server_only_service_types_rejected(self):
        for st in ('udk_request', 'doi_request', 'article_sample', 'fast-track'):
            res = self.api(self.author).post('/api/v1/payments/transactions/', {
                'amount': 1, 'service_type': st, 'article': str(self.article.id),
                'extra_data': {'udk_code': '000'},
            }, format='json')
            self.assertEqual(res.status_code, 400, st)

    def test_plagiarism_price_from_service_price(self):
        ServicePrice.objects.update_or_create(service_key='plagiarism_check', defaults={'amount': Decimal('30000')})
        res = self.api(self.author).post('/api/v1/payments/transactions/', {
            'amount': 1, 'service_type': 'language_editing', 'article': str(self.article.id),
        }, format='json')
        self.assertEqual(Decimal(str(res.json()['amount'])), Decimal('30000'))

    def test_book_price_matches_frontend_formula(self):
        # 150 bet × 50 nusxa (11-100 tier): 150*50*125 + 50*10000 + 50*300 + ISBN 600000 = 2052500
        res = self.api(self.author).post('/api/v1/payments/transactions/', {
            'amount': 1, 'service_type': 'book_publication', 'article': str(self.article.id),
            'extra_data': {'pages': 150, 'copies': 50, 'paper_quality': 'standart', 'cover_type': 'soft',
                           'options': {'isbn': True, 'design': False}, 'publication_type': 'bosma',
                           'evil': 'x'},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        self.assertEqual(Decimal(str(body['amount'])), Decimal('2052500'))
        self.assertNotIn('evil', body['extra_data'])

    def test_process_payment_refuses_completed_and_underpriced(self):
        tx = Transaction.objects.create(user=self.author, article=self.article, amount=Decimal('1000'),
                                        service_type='publication_fee')
        res = self.api(self.author).post(f'/api/v1/payments/transactions/{tx.id}/process_payment/')
        self.assertEqual(res.status_code, 400)
        tx.amount = Decimal('150000')
        tx.status = 'completed'
        tx.save()
        res = self.api(self.author).post(f'/api/v1/payments/transactions/{tx.id}/process_payment/')
        self.assertEqual(res.status_code, 400)


@override_settings(PAYME_MERCHANT_ID='', PAYME_MERCHANT_KEY='', PAYME_TEST_KEY='', PAYME_IS_TEST=True)
class PaymeAuthTests(BaseFixture):
    def test_empty_credentials_never_authorize(self):
        tx = Transaction.objects.create(user=self.author, article=self.article, amount=Decimal('150000'),
                                        service_type='publication_fee')
        auth = 'Basic ' + base64.b64encode(b':').decode()
        res = Client().post('/api/v1/payments/payme/', data={
            'jsonrpc': '2.0', 'id': 1, 'method': 'CreateTransaction',
            'params': {'id': 'p1', 'time': 1, 'amount': 15000000, 'account': {'transaction_id': str(tx.id)}},
        }, content_type='application/json', HTTP_AUTHORIZATION=auth).json()
        self.assertEqual(res['error']['code'], -32504)

    @override_settings(PAYME_MERCHANT_ID='m1', PAYME_TEST_KEY='k1')
    def test_valid_paycom_credentials_authorize(self):
        auth = 'Basic ' + base64.b64encode(b'Paycom:k1').decode()
        res = Client().post('/api/v1/payments/payme/', data={
            'jsonrpc': '2.0', 'id': 1, 'method': 'CheckTransaction', 'params': {'id': 'nope'},
        }, content_type='application/json', HTTP_AUTHORIZATION=auth).json()
        self.assertEqual(res['error']['code'], -31050)  # auth o'tdi, tranzaksiya topilmadi


class PermissionTests(BaseFixture):
    def test_service_prices_only_super_admin_can_write(self):
        sp, _ = ServicePrice.objects.update_or_create(service_key='doi_request', defaults={'amount': Decimal('100000')})
        self.assertEqual(self.api(self.author).get('/api/v1/udc/service-prices/').status_code, 200)
        res = self.api(self.author).patch(f'/api/v1/udc/service-prices/{sp.id}/', {'amount': 0}, format='json')
        self.assertEqual(res.status_code, 403)
        sp.refresh_from_db()
        self.assertEqual(sp.amount, Decimal('100000'))
        res = self.api(self.super_admin).patch(f'/api/v1/udc/service-prices/{sp.id}/', {'amount': 90000}, format='json')
        self.assertEqual(res.status_code, 200)

    def test_anonymous_cannot_delete_category(self):
        res = self.api().delete(f'/api/v1/journals/categories/{self.category.id}/')
        self.assertIn(res.status_code, (401, 403))
        self.assertTrue(JournalCategory.objects.filter(pk=self.category.pk).exists())
        self.assertEqual(self.api().get('/api/v1/journals/categories/').status_code, 200)

    def test_author_cannot_create_category(self):
        res = self.api(self.author).post('/api/v1/journals/categories/', {'name': 'Yangi'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_anonymous_journal_write_is_401_not_500(self):
        res = self.api().patch(f'/api/v1/journals/journals/{self.journal.id}/', {'name': 'x'}, format='json')
        self.assertIn(res.status_code, (401, 403))


class ArticleProtectionTests(BaseFixture):
    def test_author_cannot_patch_results_or_status(self):
        res = self.api(self.author).patch(f'/api/v1/articles/{self.article.id}/', {
            'plagiarism_percentage': 0, 'originality_percentage': 100, 'status': 'Published',
            'author': str(self.other_author.id),
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, 'Draft')
        self.assertEqual(self.article.originality_percentage, 0)
        self.assertEqual(self.article.author_id, self.author.id)

    def test_plagiarism_config_is_merged_not_replaced(self):
        self.article.plagiarism_report = {'is_standalone': True}
        self.article.save()
        res = self.api(self.author).patch(f'/api/v1/articles/{self.article.id}/', {
            'plagiarism_report': {'document_name': 'Hujjat', 'pending_enabled_modules': ['crossref'],
                                  'sources': [{'fake': 1}], 'check_status': 'completed'},
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.article.refresh_from_db()
        rep = self.article.plagiarism_report
        self.assertTrue(rep['is_standalone'])
        self.assertEqual(rep['document_name'], 'Hujjat')
        self.assertNotIn('sources', rep)
        self.assertNotIn('check_status', rep)

    def test_operator_cannot_edit_or_delete(self):
        self.assertEqual(self.api(self.operator).patch(
            f'/api/v1/articles/{self.article.id}/', {'title': 'Buzildi'}, format='json').status_code, 403)
        self.assertEqual(self.api(self.operator).delete(f'/api/v1/articles/{self.article.id}/').status_code, 403)
        self.assertTrue(Article.objects.filter(pk=self.article.pk).exists())

    def test_author_cannot_self_publish(self):
        res = self.api(self.author).post(f'/api/v1/articles/{self.article.id}/update_status/',
                                         {'status': 'Published'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, 'Draft')

    def test_author_can_resubmit_after_revision(self):
        self.article.status = 'Revision'
        self.article.save()
        res = self.api(self.author).post(f'/api/v1/articles/{self.article.id}/update_status/',
                                         {'status': 'Yangi'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)

    def test_journal_admin_still_can_change_status(self):
        res = self.api(self.journal_admin).post(f'/api/v1/articles/{self.article.id}/update_status/',
                                                {'status': 'Accepted'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, 'Accepted')


class TranslationPricingTests(BaseFixture):
    def test_word_count_and_cost_computed_from_file(self):
        ServicePrice.objects.update_or_create(service_key='translation_per_word', defaults={'amount': Decimal('100')})
        upload = SimpleUploadedFile('matn.txt', ('so\'z ' * 250).encode('utf-8'), content_type='text/plain')
        res = self.api(self.author).post('/api/v1/translations/', {
            'title': 'Tarjima', 'source_language': 'uz', 'target_language': 'en',
            'source_file_path': upload, 'word_count': 1, 'cost': 1, 'status': 'Bajarildi',
        }, format='multipart')
        self.assertEqual(res.status_code, 201, res.content)
        tr = TranslationRequest.objects.get(pk=res.json()['id'])
        self.assertEqual(tr.word_count, 250)
        self.assertEqual(tr.cost, Decimal('25000'))
        self.assertEqual(tr.status, 'Yangi')

    def test_author_cannot_change_translation_after_create(self):
        tr = TranslationRequest.objects.create(
            author=self.author, title='t', source_language='uz', target_language='en',
            source_file_path='translations/source/x.txt', word_count=250, cost=Decimal('25000'),
        )
        res = self.api(self.author).patch(f'/api/v1/translations/{tr.id}/', {'status': 'Bajarildi'}, format='json')
        self.assertEqual(res.status_code, 403)


class DemoAccountTests(TestCase):
    @override_settings(DEBUG=False)
    def test_production_creates_only_non_admin_demo_accounts(self):
        call_command('setup_demo_and_admin', stdout=io.StringIO())
        roles = set(User.objects.values_list('role', flat=True))
        self.assertEqual(roles, {'author', 'reviewer', 'journal_admin', 'operator'})
        self.assertFalse(User.objects.filter(is_superuser=True).exists())
        self.assertFalse(User.objects.filter(is_staff=True).exists())
        self.assertFalse(User.objects.filter(phone__in=['998966666666', '998944444444', '998907863888']).exists())
        self.assertTrue(User.objects.get(phone='998911111111').check_password('muallif'))

    def test_local_creates_all_and_login_with_short_phone(self):
        with override_settings(DEBUG=True):
            call_command('setup_demo_and_admin', stdout=io.StringIO())
        self.assertTrue(User.objects.get(phone='998966666666').is_superuser)
        res = APIClient().post('/api/v1/auth/login/', {'phone': '911111111', 'password': 'muallif'}, format='json')
        self.assertEqual(res.status_code, 200, res.content[:300])

    @override_settings(DEBUG=False)
    def test_real_user_with_same_phone_untouched(self):
        real = _user('998911111111', role='author')
        real.set_password('MeningParolim#2026')
        real.save()
        call_command('setup_demo_and_admin', stdout=io.StringIO())
        call_command('rotate_demo_passwords', '--apply', stdout=io.StringIO())
        real.refresh_from_db()
        self.assertTrue(real.check_password('MeningParolim#2026'))
        self.assertNotEqual(real.email, 'author@demo.ilmiyfaoliyat.uz')

    def test_rotate_demo_passwords(self):
        u = _user('998901001001', role='super_admin')
        u.set_password('Demo@admin1')
        u.save()
        call_command('rotate_demo_passwords', '--apply', stdout=io.StringIO())
        u.refresh_from_db()
        self.assertFalse(u.check_password('Demo@admin1'))
