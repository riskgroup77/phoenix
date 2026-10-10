"""
Telefonni Telegram orqali tasdiqlash va parolni tiklash: faqat egasi yuborgan kontakt qabul qilinadi,
raqam mos kelishi shart, havolalar bir martalik va muddatli, parol tiklanganda eski sessiyalar bekor bo'ladi.
"""
from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.users import phone_verification as pv
from apps.users.models import PhoneChallenge, TelegramSession, User

TG_ID = 555000111


def _code(link: str):
    return pv.parse_start_payload(link.rsplit('start=', 1)[1])


@override_settings(TELEGRAM_BOT_USERNAME='PhoenixTestBot', PUBLIC_SITE_URL='https://ilmiyfaoliyat.uz')
class PhoneVerificationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone='998901112233', password='Eski#Parol2026', email='v@mail.uz',
                                             first_name='A', last_name='B', affiliation='X')
        self.api = APIClient()

    def test_verify_flow(self):
        self.api.force_authenticate(self.user)
        r = self.api.post('/api/v1/auth/phone-verify/start/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()['deep_link'].startswith('https://t.me/PhoenixTestBot?start=v_'))
        purpose, code = _code(r.json()['deep_link'])
        self.assertLessEqual(len(r.json()['deep_link'].rsplit('start=', 1)[1]), 64)  # Telegram cheklovi
        pv.confirm_contact(code, purpose, telegram_id=TG_ID, contact_user_id=TG_ID, contact_phone='+998 90 111 22 33')
        self.user.refresh_from_db()
        self.assertTrue(self.user.phone_verified)
        self.assertTrue(self.api.get('/api/v1/auth/phone-verify/status/').json()['phone_verified'])
        with self.assertRaises(pv.VerificationError):  # bir martalik
            pv.confirm_contact(code, purpose, telegram_id=TG_ID, contact_user_id=TG_ID, contact_phone='998901112233')

    def test_forwarded_contact_rejected(self):
        purpose, code = _code(pv.start_verification(self.user)['deep_link'])
        with self.assertRaises(pv.VerificationError):
            pv.confirm_contact(code, purpose, telegram_id=TG_ID, contact_user_id=999, contact_phone='998901112233')
        with self.assertRaises(pv.VerificationError):
            pv.confirm_contact(code, purpose, telegram_id=TG_ID, contact_user_id=None, contact_phone='998901112233')
        self.user.refresh_from_db()
        self.assertFalse(self.user.phone_verified)

    def test_other_phone_rejected(self):
        purpose, code = _code(pv.start_verification(self.user)['deep_link'])
        with self.assertRaises(pv.VerificationError):
            pv.confirm_contact(code, purpose, telegram_id=TG_ID, contact_user_id=TG_ID, contact_phone='998907777777')

    def test_expired_code_rejected(self):
        purpose, code = _code(pv.start_verification(self.user)['deep_link'])
        PhoneChallenge.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        with self.assertRaises(pv.VerificationError):
            pv.confirm_contact(code, purpose, telegram_id=TG_ID, contact_user_id=TG_ID, contact_phone='998901112233')

    def test_password_reset_flow_revokes_sessions(self):
        TelegramSession.objects.create(telegram_id=1, user=self.user, access_token='a', refresh_token='r')
        r = self.api.post('/api/v1/auth/password-reset/start/', {'phone': '901112233'}, format='json')
        self.assertEqual(r.status_code, 200)
        purpose, code = _code(r.json()['deep_link'])
        result = pv.confirm_contact(code, purpose, telegram_id=TG_ID, contact_user_id=TG_ID, contact_phone='998901112233')
        self.assertIn('/#/reset-password/', result.reset_link)
        token = result.reset_link.rsplit('/', 1)[1]
        bad = self.api.post('/api/v1/auth/password-reset/confirm/', {'token': token, 'password': '123'}, format='json')
        self.assertEqual(bad.status_code, 400)  # zaif parol
        ok = self.api.post('/api/v1/auth/password-reset/confirm/',
                           {'token': token, 'password': 'Yangi#Parol2026', 'password_confirm': 'Yangi#Parol2026'},
                           format='json')
        self.assertEqual(ok.status_code, 200, ok.content)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Yangi#Parol2026'))
        self.assertTrue(self.user.phone_verified)
        self.assertFalse(TelegramSession.objects.filter(user=self.user).exists())
        again = self.api.post('/api/v1/auth/password-reset/confirm/',
                              {'token': token, 'password': 'Boshqa#Parol2026'}, format='json')
        self.assertEqual(again.status_code, 400)  # havola bir martalik

    def test_reset_does_not_reveal_unknown_phone(self):
        r = self.api.post('/api/v1/auth/password-reset/start/', {'phone': '907770000'}, format='json')
        self.assertEqual(r.status_code, 200)  # javob bir xil
        purpose, code = _code(r.json()['deep_link'])
        with self.assertRaises(pv.VerificationError):
            pv.confirm_contact(code, purpose, telegram_id=TG_ID, contact_user_id=TG_ID, contact_phone='998907770000')

    def test_reset_rate_limited(self):
        for _ in range(5):
            pv.start_password_reset('901112233')
        with self.assertRaises(pv.VerificationError):
            pv.start_password_reset('901112233')

    @override_settings(TELEGRAM_BOT_USERNAME='')
    def test_bot_not_configured(self):
        self.api.force_authenticate(self.user)
        self.assertEqual(self.api.post('/api/v1/auth/phone-verify/start/').status_code, 503)

    def test_profile_exposes_read_only_flag(self):
        self.api.force_authenticate(self.user)
        r = self.api.put('/api/v1/auth/update_profile/', {'phone_verified': True, 'first_name': 'Yangi'}, format='json')
        self.assertIn(r.status_code, (200, 400))
        self.user.refresh_from_db()
        self.assertFalse(self.user.phone_verified)
        self.assertIn('phone_verified', self.api.get('/api/v1/auth/profile/').json())


@override_settings(PHONE_VERIFICATION_REQUIRED=True)
class VerificationRequiredTests(TestCase):
    def test_unverified_author_blocked_verified_allowed(self):
        from apps.journals.models import Journal, JournalCategory

        admin = User.objects.create_user(phone='998900000099', password='x', email='ja@mail.uz', first_name='J',
                                         last_name='A', affiliation='X', role='journal_admin')
        journal = Journal.objects.create(name='J', issn='1234-5678', description='d', journal_admin=admin,
                                         category=JournalCategory.objects.create(name='K'))
        author = User.objects.create_user(phone='998900000098', password='x', email='au@mail.uz', first_name='A',
                                          last_name='B', affiliation='X')
        c = APIClient()
        c.force_authenticate(author)
        payload = {'title': 'Maqola', 'abstract': 'a', 'journal': str(journal.pk), 'keywords': ['k']}
        r = c.post('/api/v1/articles/', payload, format='json')
        self.assertIn(r.status_code, (400, 403, 500))
        self.assertIn('tasdiqlang', r.content.decode())
        self.assertEqual(c.post('/api/v1/payments/transactions/', {'amount': 1000, 'service_type': 'top_up'},
                                format='json').status_code, 403)
        author.phone_verified = True
        author.save()
        c.force_authenticate(User.objects.get(pk=author.pk))
        r = c.post('/api/v1/articles/', payload, format='json')
        self.assertEqual(r.status_code, 201, r.content[:300])
