"""
Admin qo'shgan jurnal muharriri «Demo Muharrir» (demo hisob) bo'lsa ham mualliflarga ko'rinadi va maqola qabul
qiladi. Faqat demo skript yaratgan namuna jurnallar (ISSN demo ro'yxatida) yashirin. Demo tozalash haqiqiy
jurnalni o'chirmaydi.
"""
import io

from django.test import TestCase
from rest_framework.test import APIClient

from apps.journals.models import Journal, JournalCategory
from apps.users.models import User
from config.demo import DEMO_EMAIL_DOMAIN, is_demo_article, is_demo_journal

SEED_ISSN = '0000-0108'  # apps/analytics/demo_content.JOURNALS


def _user(phone, role, email=None):
    return User.objects.create_user(phone=phone, password='pass12345', email=email or f'{phone}@t.uz',
                                    first_name='Ism', last_name=role, affiliation='X', role=role)


class DemoAdminJournalVisibleTests(TestCase):
    def setUp(self):
        self.super_admin = _user('998910000501', 'super_admin')
        self.demo_admin = _user('998910000503', 'journal_admin', email=f'muharrir@{DEMO_EMAIL_DOMAIN}')
        self.author = _user('998910000504', 'author')
        self.category = JournalCategory.objects.create(name='Mahalliy OAK jurnallari')
        self.api = APIClient()
        self.api.force_authenticate(self.super_admin)

    def author_journal_ids(self):
        c = APIClient()
        c.force_authenticate(self.author)
        data = c.get('/api/v1/journals/journals/').data
        data = data.get('results', data) if isinstance(data, dict) else data
        return {str(j['id']) for j in data}

    def test_admin_can_assign_demo_editor_and_journal_is_visible(self):
        res = self.api.post('/api/v1/journals/journals/', {
            'name': 'YANGI JURNAL', 'category': str(self.category.id), 'journal_admin': str(self.demo_admin.id),
            'payment_model': 'post-payment', 'pricing_type': 'fixed', 'publication_fee': '0',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertFalse(res.data['is_sample'])
        self.assertIn(str(res.data['id']), self.author_journal_ids())
        journal = Journal.objects.get(pk=res.data['id'])
        self.assertFalse(is_demo_journal(journal))

    def test_sample_journal_hidden_and_flagged(self):
        sample = Journal.objects.create(name='Namuna', issn=SEED_ISSN, description='d', category=self.category,
                                        journal_admin=self.demo_admin)
        self.assertNotIn(str(sample.id), self.author_journal_ids())
        self.assertTrue(self.api.get(f'/api/v1/journals/journals/{sample.id}/').data['is_sample'])
        self.assertTrue(is_demo_journal(sample))

    def test_real_article_in_demo_editor_journal_is_not_demo(self):
        from apps.articles.models import Article

        journal = Journal.objects.create(name='YANGI', issn='3060-4567', description='d', category=self.category,
                                         journal_admin=self.demo_admin)
        article = Article.objects.create(title='T', abstract='a', keywords=['k'], author=self.author, journal=journal)
        self.assertFalse(is_demo_article(article))  # DOI, Scholar, antiplagiat bazasi — oddiy maqola kabi


class DemoPurgeKeepsRealJournalsTests(TestCase):
    """Demo tozalash admin qo'shgan (demo muharrirga biriktirilgan) haqiqiy jurnalni o'chirmasligi kerak."""

    def setUp(self):
        self.demo_admin = _user('998910000601', 'journal_admin', email=f'muharrir@{DEMO_EMAIL_DOMAIN}')
        cat = JournalCategory.objects.create(name='Mahalliy OAK jurnallari')
        self.real = Journal.objects.create(name='YANGI JURNAL', issn='3060-4567', description='d', category=cat,
                                           journal_admin=self.demo_admin)
        self.seed = Journal.objects.create(name='Namuna', issn=SEED_ISSN, description='d', category=cat,
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
