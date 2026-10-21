"""
Ro'yxatdan o'tish Telegram orqali: sayt → bot havolasi → kontakt → bot 4 xonali kod → saytda kod → hisob.
"""
from unittest import mock

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.users import phone_verification as pv
from apps.users.models import PhoneChallenge, User

TG_ID = 777000111
DATA = {
    'phone': '901234567', 'first_name': 'Ali', 'last_name': 'Valiyev',
    'password': 'parol123', 'password_confirm': 'parol123', 'terms_accepted': True,
}


@override_settings(TELEGRAM_BOT_USERNAME='PhoenixTestBot', JWT_USE_HTTPONLY_COOKIES=False)
class RegisterTelegramTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def _start(self, **extra):
        r = self.api.post('/api/v1/auth/register/start/', {**DATA, **extra}, format='json')
        return r

    def _otp(self, token):
        with mock.patch('apps.users.phone_verification.secrets.randbelow', return_value=42):
            res = pv.confirm_contact(token, 'register', telegram_id=TG_ID, contact_user_id=TG_ID,
                                     contact_phone='+998901234567')
        self.assertEqual(res.otp, '0042')
        return res.otp

    def test_full_flow(self):
        r = self._start()
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertEqual(body['deep_link'], f"https://t.me/PhoenixTestBot?start=g_{body['token']}")
        self.assertFalse(User.objects.filter(phone='998901234567').exists())  # hali yaratilmagan

        # Kodsiz tasdiqlab bo'lmaydi
        r = self.api.post('/api/v1/auth/register/confirm/', {'token': body['token'], 'code': '0000'}, format='json')
        self.assertEqual(r.status_code, 400)

        otp = self._otp(body['token'])
        r = self.api.post('/api/v1/auth/register/confirm/', {'token': body['token'], 'code': otp}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertIn('access', r.json())
        user = User.objects.get(phone='998901234567')
        self.assertTrue(user.phone_verified)
        self.assertTrue(user.check_password('parol123'))
        self.assertEqual((user.first_name, user.last_name), ('Ali', 'Valiyev'))
        self.assertIsNotNone(user.terms_accepted_at)
        # Bir martalik
        r = self.api.post('/api/v1/auth/register/confirm/', {'token': body['token'], 'code': otp}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_wrong_code_attempts_limited(self):
        token = self._start().json()['token']
        self._otp(token)
        for _ in range(pv.OTP_MAX_ATTEMPTS):
            r = self.api.post('/api/v1/auth/register/confirm/', {'token': token, 'code': '9999'}, format='json')
            self.assertEqual(r.status_code, 400)
        self.assertEqual(PhoneChallenge.objects.get(code=token).attempts, pv.OTP_MAX_ATTEMPTS)
        r = self.api.post('/api/v1/auth/register/confirm/', {'token': token, 'code': '0042'}, format='json')
        self.assertEqual(r.status_code, 400)  # to'g'ri kod ham endi qabul qilinmaydi
        self.assertFalse(User.objects.filter(phone='998901234567').exists())

    def test_contact_must_match_phone_and_owner(self):
        token = self._start().json()['token']
        with self.assertRaises(pv.VerificationError):
            pv.confirm_contact(token, 'register', telegram_id=TG_ID, contact_user_id=TG_ID,
                               contact_phone='998909999999')
        with self.assertRaises(pv.VerificationError):  # birovning kontakti
            pv.confirm_contact(token, 'register', telegram_id=TG_ID, contact_user_id=123,
                               contact_phone='998901234567')

    def test_existing_phone_and_validation(self):
        User.objects.create_user(phone='998901234567', password='x' * 8, email='a@b.uz',
                                 first_name='A', last_name='B', affiliation='X')
        r = self._start()
        self.assertEqual(r.status_code, 400)
        self.assertIn('phone', r.json())
        r = self._start(phone='901112233', password_confirm='boshqa1')
        self.assertEqual(r.status_code, 400)

    @override_settings(TELEGRAM_BOT_USERNAME='')
    def test_bot_not_configured(self):
        self.assertEqual(self._start().status_code, 400)
