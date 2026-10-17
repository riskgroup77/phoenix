"""Muallif faqat qoralamani tahrirlashi mumkin (antiplagiat sozlamalari bundan mustasno)."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.articles.models import Article
from apps.journals.models import Journal, JournalCategory
from apps.users.models import User


def _user(phone, role='author'):
    return User.objects.create_user(
        phone=phone, password='pass12345', email=f'{phone}@t.uz',
        first_name='Ism', last_name=role, affiliation='X', role=role,
    )


class DraftEditGuardTests(TestCase):
    def setUp(self):
        self.author = _user('998910000101')
        self.sadmin = _user('998910000102', role='super_admin')
        cat = JournalCategory.objects.create(name='Iqtisod')
        self.journal = Journal.objects.create(name='J', issn='1111-2222', description='d', category=cat,
            journal_admin=_user('998910000103', role='journal_admin'),
        )
        self.client = APIClient()

    def _article(self, status):
        return Article.objects.create(
            title='Eski', abstract='a', keywords=['k'], author=self.author, journal=self.journal, status=status,
        )

    def test_author_can_edit_draft(self):
        art = self._article('Draft')
        self.client.force_authenticate(self.author)
        res = self.client.patch(f'/api/v1/articles/{art.pk}/', {'title': 'Yangi'}, format='json')
        self.assertEqual(res.status_code, 200)
        art.refresh_from_db()
        self.assertEqual(art.title, 'Yangi')

    def test_author_cannot_edit_published(self):
        art = self._article('Published')
        self.client.force_authenticate(self.author)
        res = self.client.patch(f'/api/v1/articles/{art.pk}/', {'title': 'Yangi'}, format='json')
        self.assertEqual(res.status_code, 403)
        art.refresh_from_db()
        self.assertEqual(art.title, 'Eski')

    def test_author_can_save_plagiarism_config_outside_draft(self):
        art = self._article('PaymentCompleted')
        self.client.force_authenticate(self.author)
        res = self.client.patch(
            f'/api/v1/articles/{art.pk}/', {'plagiarism_report': {'document_name': 'Doc'}}, format='json',
        )
        self.assertEqual(res.status_code, 200)

    def test_super_admin_can_edit_published(self):
        art = self._article('Published')
        self.client.force_authenticate(self.sadmin)
        res = self.client.patch(f'/api/v1/articles/{art.pk}/', {'title': 'Yangi'}, format='json')
        self.assertEqual(res.status_code, 200)
