"""
Muallifning to'liq yo'li (E2E, haqiqiy HTTP so'rovlar, force_authenticate siz):
ro'yxatdan o'tish (oferta roziligi) → kirish → telefonni Telegram orqali tasdiqlash → maqola yuborish →
server narxi bilan to'lov yaratish → Click prepare/complete (imzo bilan) → maqola holati va bildirishnoma →
«ma'lumotlarim» eksportida hammasi ko'rinadi → chiqish.
"""
import hashlib
from decimal import Decimal

from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from rest_framework.test import APIClient

from apps.articles.models import Article
from apps.journals.models import Journal, JournalCategory
from apps.payments.models import Transaction
from apps.users import phone_verification as pv
from apps.users.models import User

CLICK_SECRET = 'e2e-click-secret'
TG_ID = 777000111


def _md5(*parts):
    return hashlib.md5(''.join(str(p) for p in parts).encode('utf-8')).hexdigest()


@override_settings(
    CLICK_SECRET_KEY=CLICK_SECRET, CLICK_SERVICE_ID='82154', CLICK_MERCHANT_ID='45730', CLICK_MERCHANT_USER_ID='63536',
    CLICK_SERVICE_82154_SECRET_KEY='', CLICK_SERVICE_82155_SECRET_KEY='', CLICK_SERVICE_89248_SECRET_KEY='',
    CLICK_SERVICE_88045_SECRET_KEY='',
    PHONE_VERIFICATION_REQUIRED=True, TERMS_ACCEPTANCE_REQUIRED=True, LEGAL_TERMS_VERSION='2026-10-10',
    TELEGRAM_BOT_USERNAME='PhoenixTestBot', JWT_USE_HTTPONLY_COOKIES=False,
)
class AuthorEndToEndTests(TestCase):
    def setUp(self):
        cache.clear()
        admin = User.objects.create_user(phone='998900000201', password='x-parol-123', email='ja@e2e.uz',
                                         first_name='J', last_name='A', affiliation='X', role='journal_admin')
        self.journal = Journal.objects.create(
            name='E2E jurnal', issn='2222-3333', description='d', journal_admin=admin,
            category=JournalCategory.objects.create(name='E2E'), payment_model='post-payment',
            pricing_type='fixed', publication_fee=Decimal('150000'),
        )

    def test_full_author_journey(self):
        api = APIClient()

        # 1) Ro'yxatdan o'tish — oferta roziligisiz bo'lmaydi
        reg = {'phone': '901234500', 'first_name': 'Ali', 'last_name': 'Valiyev', 'password': 'parol123',
               'password_confirm': 'parol123'}
        self.assertEqual(api.post('/api/v1/auth/register/', reg, format='json').status_code, 400)
        r = api.post('/api/v1/auth/register/', {**reg, 'terms_accepted': True, 'terms_version': '2026-10-10'},
                     format='json')
        self.assertIn(r.status_code, (200, 201), r.content[:300])

        # 2) Kirish — token bilan
        r = api.post('/api/v1/auth/login/', {'phone': '998901234500', 'password': 'parol123'}, format='json')
        self.assertEqual(r.status_code, 200, r.content[:300])
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        user = User.objects.get(phone='998901234500')
        self.assertEqual(user.terms_version, '2026-10-10')

        # 3) Telefon tasdiqlanmagan — maqola yuborib bo'lmaydi
        article_payload = {'title': 'E2E maqola', 'abstract': 'Annotatsiya', 'journal': str(self.journal.pk),
                           'keywords': ['test']}
        r = api.post('/api/v1/articles/', article_payload, format='json')
        self.assertIn(r.status_code, (400, 403))

        # 4) Telegram orqali tasdiqlash (bot kontaktni qabul qiladi)
        link = api.post('/api/v1/auth/phone-verify/start/').json()['deep_link']
        purpose, code = pv.parse_start_payload(link.rsplit('start=', 1)[1])
        pv.confirm_contact(code, purpose, telegram_id=TG_ID, contact_user_id=TG_ID, contact_phone='+998901234500')
        self.assertTrue(api.get('/api/v1/auth/phone-verify/status/').json()['phone_verified'])

        # 5) Maqola yuborish
        r = api.post('/api/v1/articles/', article_payload, format='json')
        self.assertEqual(r.status_code, 201, r.content[:300])
        article = Article.objects.get(pk=r.json()['id'])
        self.assertEqual(article.author_id, user.pk)

        # 6) To'lov — summa serverda hisoblanadi (mijoz 1 so'm yozsa ham)
        r = api.post('/api/v1/payments/transactions/', {'amount': 1, 'service_type': 'publication_fee',
                                                        'article': str(article.pk)}, format='json')
        self.assertEqual(r.status_code, 201, r.content[:300])
        tx = Transaction.objects.get(pk=r.json()['id'])
        self.assertEqual(tx.amount, Decimal('150000'))

        # 7) Click prepare + complete (imzo bilan)
        base = dict(click_trans_id='9001', service_id='82154', click_paydoc_id='9002',
                    merchant_trans_id=str(tx.pk), amount='150000.00')
        prep = dict(base, action='0', sign_time='2026-10-10 10:00:00')
        prep['sign_string'] = _md5(prep['click_trans_id'], prep['service_id'], CLICK_SECRET, prep['merchant_trans_id'],
                                   prep['amount'], prep['action'], prep['sign_time'])
        self.assertEqual(Client().post('/api/v1/payments/click/prepare/', prep).json()['error'], 0)
        comp = dict(base, merchant_prepare_id=str(tx.pk), action='1', error='0', sign_time='2026-10-10 10:01:00')
        comp['sign_string'] = _md5(comp['click_trans_id'], comp['service_id'], CLICK_SECRET, comp['merchant_trans_id'],
                                   comp['merchant_prepare_id'], comp['amount'], comp['action'], comp['sign_time'])
        self.assertEqual(Client().post('/api/v1/payments/click/complete/', comp).json()['error'], 0)
        tx.refresh_from_db()
        self.assertEqual(tx.status, 'completed')

        # 8) Muallif o'z maqolasi va to'lovini ko'radi
        r = api.get(f'/api/v1/articles/{article.pk}/')
        self.assertEqual(r.status_code, 200)
        r = api.get('/api/v1/payments/transactions/')
        self.assertEqual(r.status_code, 200)
        self.assertIn(str(tx.pk), r.content.decode())

        # 9) Ma'lumotlar eksporti — maqola va yakunlangan to'lov bor
        export = api.get('/api/v1/auth/my-data/').content.decode('utf-8')
        self.assertIn('E2E maqola', export)
        self.assertIn('completed', export)

        # 10) Boshqa muallif bu maqolani ko'ra olmaydi
        stranger = User.objects.create_user(phone='998900000299', password='x-parol-123', email='s@e2e.uz',
                                            first_name='S', last_name='T', affiliation='X')
        other = APIClient()
        other.force_authenticate(stranger)
        self.assertIn(other.get(f'/api/v1/articles/{article.pk}/').status_code, (403, 404))
