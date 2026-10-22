"""
Admin qo'shgan jurnal muallifga ko'rinmasdi: muharrir sifatida «Demo Muharrir» (demo hisob) tanlangan edi,
demo muharrirli jurnallar esa haqiqiy mualliflardan yashiriladi. Endi demo hisobni muharrir qilib bo'lmaydi.
"""
import io

from django.test import TestCase
from rest_framework.test import APIClient

from apps.journals.models import Journal, JournalCategory
from apps.users.models import User
from config.demo import DEMO_EMAIL_DOMAIN


def _user(phone, role, email=None):
    return User.objects.create_user(phone=phone, password='pass12345', email=email or f'{phone}@t.uz',
                                    first_name='Ism', last_name=role, affiliation='X', role=role)


class JournalDemoAdminTests(TestCase):
    def setUp(self):
        self.super_admin = _user('998910000501', 'super_admin')
        self.real_admin = _user('998910000502', 'journal_admin')
        self.demo_admin = _user('998910000503', 'journal_admin', email=f'muharrir@{DEMO_EMAIL_DOMAIN}')
        self.author = _user('998910000504', 'author')
        self.category = JournalCategory.objects.create(name='Mahalliy OAK jurnallari')
        self.api = APIClient()
        self.api.force_authenticate(self.super_admin)

    def create(self, admin):
        return self.api.post('/api/v1/journals/journals/', {
            'name': 'Yangi jurnal', 'category': str(self.category.id), 'journal_admin': str(admin.id),
            'payment_model': 'post-payment', 'pricing_type': 'fixed', 'publication_fee': '0',
        }, format='json')

    def author_journal_ids(self):
        c = APIClient()
        c.force_authenticate(self.author)
        data = c.get('/api/v1/journals/journals/').data
        data = data.get('results', data) if isinstance(data, dict) else data
        return {str(j['id']) for j in data}

    def test_demo_admin_rejected(self):
        res = self.create(self.demo_admin)
        self.assertEqual(res.status_code, 400)
        self.assertIn('journal_admin', res.data)
        self.assertFalse(Journal.objects.filter(name='Yangi jurnal').exists())

    def test_real_admin_journal_visible_to_author(self):
        res = self.create(self.real_admin)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIn(str(res.data['id']), self.author_journal_ids())
        self.assertFalse(res.data['hidden_from_authors'])

    def test_existing_demo_journal_flagged_and_fixable(self):
        journal = Journal.objects.create(name='Eski', issn='1111-6666', description='d', category=self.category,
                                         journal_admin=self.demo_admin)
        self.assertNotIn(str(journal.id), self.author_journal_ids())
        data = self.api.get(f'/api/v1/journals/journals/{journal.id}/').data
        self.assertTrue(data['hidden_from_authors'])
        res = self.api.patch(f'/api/v1/journals/journals/{journal.id}/', {'journal_admin': str(self.real_admin.id)},
                             format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIn(str(journal.id), self.author_journal_ids())


class DemoPurgeKeepsRealJournalsTests(TestCase):
    """Demo tozalash admin qo'shgan (demo muharrirga biriktirilgan) haqiqiy jurnalni o'chirmasligi kerak."""

    def setUp(self):
        self.demo_admin = _user('998910000601', 'journal_admin', email=f'muharrir@{DEMO_EMAIL_DOMAIN}')
        cat = JournalCategory.objects.create(name='Mahalliy OAK jurnallari')
        self.real = Journal.objects.create(name='YANGI JURNAL', issn='3060-4567', description='d', category=cat,
                                           journal_admin=self.demo_admin)
        self.seed = Journal.objects.create(name='Namuna', issn='0000-0108', description='d', category=cat,
                                           journal_admin=self.demo_admin)

    def test_purge_keeps_real_journal(self):
        from django.core.management import call_command

        call_command('seed_demo_data', '--purge', stdout=io.StringIO())
        self.assertTrue(Journal.objects.filter(pk=self.real.pk).exists())
        self.assertFalse(Journal.objects.filter(pk=self.seed.pk).exists())

    def test_purge_logins_refuses_while_real_journal_has_demo_admin(self):
        from django.core.management import CommandError, call_command

        with self.assertRaises(CommandError):
            call_command('seed_demo_data', '--purge', '--logins', stdout=io.StringIO())
        self.assertTrue(Journal.objects.filter(pk=self.real.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.demo_admin.pk).exists())

    def test_sample_journal_not_flagged(self):
        from apps.users.models import User as U

        admin = U.objects.create_user(phone='998910000602', password='p12345678', email='sa@t.uz', first_name='A',
                                      last_name='B', affiliation='X', role='super_admin')
        c = APIClient()
        c.force_authenticate(admin)
        data = c.get(f'/api/v1/journals/journals/{self.seed.id}/').data
        self.assertTrue(data['is_sample'])
        self.assertFalse(data['hidden_from_authors'])
        self.assertTrue(c.get(f'/api/v1/journals/journals/{self.real.id}/').data['hidden_from_authors'])
