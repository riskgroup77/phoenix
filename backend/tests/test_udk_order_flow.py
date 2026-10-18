"""
UDK buyurtmasi oqimi (UdkOlish sahifasi): to'lovdan qaytgan sahifa so'rovni tranzaksiya orqali topadi, so'rov
ro'yxati to'lov/ma'lumotnoma holatini beradi, to'lanmagan buyurtma qayta yuborilsa ikkinchi to'lov ochilmaydi va
"Ishlarim" (arxiv) da har bir buyurtma aniq bitta element bo'lib ko'rinadi.
"""
import shutil
import tempfile

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.payments.models import Transaction
from apps.udc.models import UDKCertificate, UdkRequest
from apps.users.models import User

MEDIA = tempfile.mkdtemp(prefix='udk-order-')

TITLE = "Oliy ta'lim muassasalarida talabalarning mustaqil ishini tashkil etish"
ABSTRACT = "Maqolada oliy ta'limda talabalarning mustaqil ta'limi tahlil qilingan."


@override_settings(MEDIA_ROOT=MEDIA, UDK_PAYMENT_ENABLED=True)
class UdkOrderFlowTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        from apps.udc import auto_classify

        auto_classify.reset_index()
        self.author = User.objects.create_user(phone='998900007301', password='x-parol-123', email='o@t.uz',
                                               first_name='Ali', last_name='Valiyev', role='author')
        self.api = APIClient()
        self.api.force_authenticate(self.author)

    def _create(self, title=TITLE, abstract=ABSTRACT):
        r = self.api.post('/api/v1/udc/request/', {
            'author_first_name': 'Ali', 'author_last_name': 'Valiyev', 'title': title, 'abstract': abstract,
        }, format='multipart')
        self.assertIn(r.status_code, (200, 201), r.data)
        return r.data

    def _pay(self, tx_id):
        from apps.udc.fulfill import fulfill_udk_request

        tx = Transaction.objects.get(pk=tx_id)
        tx.status = 'completed'
        tx.save(update_fields=['status'])
        with self.captureOnCommitCallbacks(execute=True):
            fulfill_udk_request(tx)

    def _archive(self):
        r = self.api.get('/api/v1/auth/archive/')
        self.assertEqual(r.status_code, 200)
        return r.data['items']

    def test_unpaid_order_is_reused_instead_of_second_payment(self):
        first = self._create()
        again = self._create()
        self.assertEqual(again['udk_request_id'], first['udk_request_id'])
        self.assertEqual(again['transaction_id'], first['transaction_id'])
        self.assertTrue(again.get('reused'))
        self.assertEqual(UdkRequest.objects.filter(user=self.author).count(), 1)
        self.assertEqual(Transaction.objects.filter(user=self.author, service_type='udk_request').count(), 1)

        # Boshqa ish — yangi buyurtma
        other = self._create(title='Boshqa mavzu', abstract='Boshqa annotatsiya')
        self.assertNotEqual(other['udk_request_id'], first['udk_request_id'])

        # To'langan buyurtma qayta ishlatilmaydi
        self._pay(first['transaction_id'])
        third = self._create()
        self.assertNotEqual(third['transaction_id'], first['transaction_id'])

    def test_transaction_exposes_udk_request_id(self):
        created = self._create()
        r = self.api.get(f"/api/v1/payments/transactions/{created['transaction_id']}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['udk_request_id'], created['udk_request_id'])
        self.assertEqual(r.data['article_title'], TITLE)  # to'lov oynasida "Nima uchun"

    def test_request_list_has_payment_and_certificate_state(self):
        created = self._create()
        rows = self.api.get('/api/v1/udc/requests/').data
        row = next(x for x in rows if x['id'] == created['udk_request_id'])
        self.assertEqual(row['status'], 'pending_payment')
        self.assertEqual(row['payment_status'], 'pending')
        self.assertEqual(row['transaction_id'], created['transaction_id'])
        self.assertIsNone(row['certificate_id'])

        self._pay(created['transaction_id'])
        row = next(x for x in self.api.get('/api/v1/udc/requests/').data if x['id'] == created['udk_request_id'])
        self.assertEqual(row['status'], 'completed')
        self.assertEqual(row['payment_status'], 'completed')
        self.assertTrue(row['udk_code'])
        self.assertEqual(row['udk_code'], UdkRequest.objects.get(pk=created['udk_request_id']).udk_code)
        cert = UDKCertificate.objects.get(transaction_id=created['transaction_id'])
        self.assertEqual(row['certificate_id'], cert.id)

    def test_archive_has_exactly_one_item_per_order_with_status(self):
        done = self._create()
        self._pay(done['transaction_id'])
        pending = self._create(title='Ikkinchi ish', abstract='Hali to\'lanmagan')
        manual = self._create(title='Qwzx vbnm', abstract='Plmk')
        self._pay(manual['transaction_id'])  # aniqlab bo'lmaydi — xodimga qoladi

        items = self._archive()
        udk_items = [i for i in items if i['type'] in ('udk_request_order', 'udk_standalone')]
        self.assertEqual(len(udk_items), 3, udk_items)
        by_id = {i['id']: i for i in udk_items}

        done_item = by_id[f"udkreq-{done['udk_request_id']}"]
        cert = UDKCertificate.objects.get(transaction_id=done['transaction_id'])
        self.assertEqual(done_item['extra']['status'], 'completed')
        self.assertEqual(done_item['extra']['status_label'], 'Tayyor')
        self.assertEqual(done_item['extra']['udk_code'], cert.udk_code)
        self.assertEqual(done_item['certificate_id'], cert.id)
        self.assertTrue(done_item['download_url'].endswith(f'/udc/certificates/{cert.id}/download/'))
        self.assertEqual(done_item['view_url'], f"/udk-olish?request={done['udk_request_id']}")

        pending_item = by_id[f"udkreq-{pending['udk_request_id']}"]
        self.assertEqual(pending_item['extra']['status_label'], "To'lov kutilmoqda")
        self.assertIsNone(pending_item['download_url'])

        manual_item = by_id[f"udkreq-{manual['udk_request_id']}"]
        self.assertEqual(manual_item['extra']['status'], 'submitted')
        self.assertEqual(manual_item['extra']['status_label'], "Mutaxassis ko'rib chiqmoqda")

        # Buyurtmasiz (eski) standalone ma'lumotnoma hamon alohida ko'rinadi
        legacy = UDKCertificate.objects.create(user=self.author, title='Eski', udk_code='5')
        ids = [i['id'] for i in self._archive() if i['type'] == 'udk_standalone']
        self.assertEqual(ids, [f'udk-{legacy.id}'])

    def test_failed_payment_order_label(self):
        created = self._create()
        Transaction.objects.filter(pk=created['transaction_id']).update(status='failed')
        item = next(i for i in self._archive() if i['id'] == f"udkreq-{created['udk_request_id']}")
        self.assertEqual(item['extra']['status_label'], "To'lov amalga oshmadi")
        self.assertEqual(item['extra']['payment_status'], 'failed')
        row = next(x for x in self.api.get('/api/v1/udc/requests/').data if x['id'] == created['udk_request_id'])
        self.assertEqual(row['payment_status'], 'failed')

    def test_rejected_order_still_listed(self):
        created = self._create(title='Qwzx vbnm', abstract='Plmk')
        self._pay(created['transaction_id'])
        UdkRequest.objects.filter(pk=created['udk_request_id']).update(status='rejected')
        item = next(i for i in self._archive() if i['id'] == f"udkreq-{created['udk_request_id']}")
        self.assertEqual(item['extra']['status_label'], 'Rad etilgan')
