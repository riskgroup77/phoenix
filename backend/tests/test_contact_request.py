"""Yordam sahifasidagi murojaat formasi: operator va bosh adminlarga bildirishnoma."""
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.notifications.models import Notification
from apps.users.models import User


def _user(phone, role):
    return User.objects.create_user(
        phone=phone, password='pass12345', email=f'{phone}@t.uz', first_name='Ism', last_name=role,
        affiliation='X', role=role,
    )


class ContactRequestTests(TestCase):
    def setUp(self):
        cache.clear()
        self.operator = _user('998910000601', 'operator')
        self.admin = _user('998910000602', 'super_admin')
        self.author = _user('998910000603', 'author')
        self.client = APIClient()

    def test_guest_message_reaches_staff(self):
        res = self.client.post('/api/v1/notifications/contact/', {
            'name': 'Ali Valiyev', 'phone': '+998901234567', 'topic': 'payment',
            'message': "To'lov o'tdi, lekin maqola holati o'zgarmadi.",
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        for staff in (self.operator, self.admin):
            n = Notification.objects.get(user=staff)
            self.assertIn('Ali Valiyev', n.message)
            self.assertEqual(n.metadata['kind'], 'contact_request')
        self.assertFalse(Notification.objects.filter(user=self.author).exists())

    def test_validation(self):
        res = self.client.post('/api/v1/notifications/contact/', {'name': 'A', 'message': 'qisqa'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Notification.objects.count(), 0)

    def test_logged_in_user_details_used(self):
        self.client.force_authenticate(self.author)
        res = self.client.post('/api/v1/notifications/contact/', {'message': 'Profilimni tahrirlay olmayapman.'}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIn(self.author.phone, Notification.objects.get(user=self.operator).message)

    def test_guest_throttled_after_limit(self):
        payload = {'name': 'Ali', 'phone': '+998901234567', 'message': 'Spam tekshiruvi uchun xabar matni.'}
        codes = [self.client.post('/api/v1/notifications/contact/', payload, format='json').status_code for _ in range(6)]
        self.assertEqual(codes[:5], [201] * 5)
        self.assertEqual(codes[5], 429)
