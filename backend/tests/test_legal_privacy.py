"""
Ommaviy oferta / maxfiylik siyosati: ro'yxatdan o'tishda rozilik majburiy va saqlanadi;
foydalanuvchi faqat o'z ma'lumotlarini eksport qiladi; hisobni o'chirish so'rovi adminlarga boradi;
brauzer xatolari endpointi (client-errors) ishlaydi.
"""
import json
from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.notifications.models import Notification
from apps.payments.models import Transaction
from apps.users.models import User


def _payload(phone='901234567', **extra):
    data = {
        'phone': phone,
        'first_name': 'Ali',
        'last_name': 'Valiyev',
        'password': 'parol123',
        'password_confirm': 'parol123',
    }
    data.update(extra)
    return data


@override_settings(LEGAL_TERMS_VERSION='2026-10-10')
class TermsAcceptanceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()

    def test_register_without_terms_rejected(self):
        r = self.api.post('/api/v1/auth/register/', _payload(), format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('terms_accepted', json.dumps(r.json()))
        self.assertFalse(User.objects.filter(phone='998901234567').exists())

    def test_register_with_terms_stores_version(self):
        r = self.api.post('/api/v1/auth/register/', _payload(terms_accepted=True, terms_version='2026-10-10'), format='json')
        self.assertIn(r.status_code, (200, 201), r.content)
        u = User.objects.get(phone='998901234567')
        self.assertIsNotNone(u.terms_accepted_at)
        self.assertEqual(u.terms_version, '2026-10-10')

    def test_missing_version_falls_back_to_setting(self):
        r = self.api.post('/api/v1/auth/register/', _payload(terms_accepted=True), format='json')
        self.assertIn(r.status_code, (200, 201), r.content)
        self.assertEqual(User.objects.get(phone='998901234567').terms_version, '2026-10-10')

    @override_settings(TERMS_ACCEPTANCE_REQUIRED=False)
    def test_can_be_disabled(self):
        r = self.api.post('/api/v1/auth/register/', _payload(), format='json')
        self.assertIn(r.status_code, (200, 201), r.content)
        self.assertIsNone(User.objects.get(phone='998901234567').terms_accepted_at)


class PrivacyRightsTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(phone='998901110000', password='x-parol-123', email='me@mail.uz',
                                             first_name='Men', last_name='Muallif', affiliation='TDU')
        self.other = User.objects.create_user(phone='998902220000', password='x-parol-123', email='other@mail.uz',
                                              first_name='Boshqa', last_name='Odam', affiliation='X')
        self.admin = User.objects.create_user(phone='998903330000', password='x-parol-123', email='adm@mail.uz',
                                              first_name='Adm', last_name='In', affiliation='X', role='super_admin')
        Transaction.objects.create(user=self.user, amount=Decimal('50000'), service_type='publication_fee')
        Transaction.objects.create(user=self.other, amount=Decimal('77777'), service_type='publication_fee')
        self.api = APIClient()

    def test_export_requires_auth(self):
        self.assertEqual(self.api.get('/api/v1/auth/my-data/').status_code, 401)

    def test_export_contains_only_own_data(self):
        self.api.force_authenticate(self.user)
        r = self.api.get('/api/v1/auth/my-data/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('attachment', r['Content-Disposition'])
        self.assertEqual(r['Cache-Control'], 'no-store')
        body = r.content.decode('utf-8')
        data = json.loads(body)
        self.assertEqual(data['user']['phone'], '998901110000')
        self.assertEqual(len(data['transactions']), 1)
        self.assertNotIn('77777', body)
        self.assertNotIn('password', body)
        self.assertNotIn('998902220000', body)

    def test_deletion_request_notifies_admins_once(self):
        self.api.force_authenticate(self.user)
        r = self.api.post('/api/v1/auth/delete-request/', {'reason': 'Kerak emas'}, format='json')
        self.assertEqual(r.status_code, 202)
        notes = Notification.objects.filter(user=self.admin, metadata__kind='account_deletion_request')
        self.assertEqual(notes.count(), 1)
        self.assertIn('Kerak emas', notes.first().message)
        # Takroriy so'rov — yangi bildirishnoma yaratilmaydi
        r2 = self.api.post('/api/v1/auth/delete-request/', {}, format='json')
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(Notification.objects.filter(metadata__kind='account_deletion_request').count(), 1)
        # Hisob o'zi o'chirilmaydi (admin qo'lda hal qiladi)
        self.assertTrue(User.objects.filter(pk=self.user.pk, is_active=True).exists())


class ClientErrorEndpointTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_accepts_report_without_auth(self):
        api = APIClient()
        with self.assertLogs('phoenix.client', level='ERROR') as logs:
            r = api.post('/api/v1/client-errors/', {'message': 'TypeError: x is undefined', 'url': '/#/dashboard'},
                         format='json')
        self.assertEqual(r.status_code, 204)
        self.assertTrue(any('x is undefined' in line for line in logs.output))
