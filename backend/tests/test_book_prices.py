"""Kitob nashri narxlari bazada (ServicePrice, book_*): «Narxlar» sahifasida o'zgartirilsa kalkulyator ham,
server to'lov summasi ham yangi narxni oladi."""
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.payments.pricing import book_price_defaults, book_publication_amount
from apps.udc.models import ServicePrice
from apps.users.models import User

EXTRA = {'pages': 100, 'copies': 5, 'paper_quality': 'standart', 'cover_type': 'soft', 'options': {'isbn': True}}


class BookPricesTests(TestCase):
    def test_migration_seeded_all_keys(self):
        keys = {k for k, _l, _a in book_price_defaults()}
        self.assertEqual(set(ServicePrice.objects.filter(service_key__in=keys).values_list('service_key', flat=True)), keys)

    def test_default_amount(self):
        # 100*5*150 + 5*15000 + 5*300 + 600000
        self.assertEqual(book_publication_amount(EXTRA), Decimal('751500.00'))

    def test_admin_price_change_applies(self):
        ServicePrice.objects.filter(service_key='book_isbn').update(amount=500000)
        ServicePrice.objects.filter(service_key='book_print_standart_1_10').update(amount=200)
        self.assertEqual(book_publication_amount(EXTRA), Decimal('676500.00'))

        user = User.objects.create_user(phone='998900007101', password='pass12345', email='a@qa.uz',
                                        first_name='A', last_name='B', role='author')
        api = APIClient()
        api.force_authenticate(user)
        table = api.get('/api/v1/payments/book-prices/').json()
        self.assertEqual(table['isbn_fee'], 500000)
        self.assertEqual(table['printing_per_page']['1-10']['standart'], 200)
