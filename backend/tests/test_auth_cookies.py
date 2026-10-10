"""
HttpOnly cookie autentifikatsiyasi (production rejimi): refresh token JSON'da qaytmaydi, cookie orqali
profil va yangilash ishlaydi, cookie bilan o'zgartiruvchi so'rovlar X-Requested-With talab qiladi (CSRF).
"""
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.users.models import User

PASSWORD = 'Kuchli#Parol2026'


@override_settings(JWT_USE_HTTPONLY_COOKIES=True, JWT_RETURN_TOKENS_IN_JSON=True)
class CookieAuthTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone='998901234500', password=PASSWORD, email='c@mail.uz', first_name='A', last_name='B', affiliation='X',
        )
        self.client = APIClient()

    def login(self):
        r = self.client.post('/api/v1/auth/login/', {'phone': '901234500', 'password': PASSWORD}, format='json')
        self.assertEqual(r.status_code, 200, r.content[:300])
        return r

    def test_login_sets_httponly_cookies_and_hides_refresh(self):
        r = self.login()
        body = r.json()
        self.assertTrue(body['cookie_auth'])
        self.assertIn('access', body)
        self.assertNotIn('refresh', body)  # refresh faqat HttpOnly cookie'da
        self.assertTrue(r.cookies['refresh']['httponly'])
        self.assertTrue(r.cookies['access']['httponly'])
        self.assertEqual(r.cookies['refresh']['samesite'], 'Lax')

    def test_profile_with_cookie_only(self):
        self.login()
        r = self.client.get('/api/v1/auth/profile/')
        self.assertEqual(r.status_code, 200, r.content[:200])

    def test_unsafe_cookie_request_requires_header(self):
        self.login()
        url = '/api/v1/notifications/mark_all_read/'
        self.assertIn(self.client.post(url).status_code, (401, 403))  # CSRF: sarlavhasiz — rad
        r = self.client.post(url, HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(r.status_code, 200, r.content[:200])

    def test_bearer_header_unaffected(self):
        access = self.login().json()['access']
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        self.assertEqual(c.post('/api/v1/notifications/mark_all_read/').status_code, 200)

    def test_refresh_via_cookie(self):
        self.login()
        r = self.client.post('/api/v1/token/refresh/', {}, format='json', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(r.status_code, 200, r.content[:200])
        self.assertIn('access', r.json())

    def test_logout_clears_cookies(self):
        self.login()
        r = self.client.post('/api/v1/auth/logout/', {}, format='json', HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertIn(r.status_code, (200, 205))
        self.assertEqual(r.cookies['refresh'].value, '')
        self.assertEqual(self.client.get('/api/v1/auth/profile/').status_code, 401)


@override_settings(JWT_USE_HTTPONLY_COOKIES=False)
class LegacyTokenModeTests(TestCase):
    def test_login_returns_both_tokens(self):
        User.objects.create_user(phone='998901234501', password=PASSWORD, email='d@mail.uz', first_name='A',
                                 last_name='B', affiliation='X')
        body = APIClient().post('/api/v1/auth/login/', {'phone': '901234501', 'password': PASSWORD},
                                format='json').json()
        self.assertFalse(body['cookie_auth'])
        self.assertIn('refresh', body)
        self.assertIn('access', body)
