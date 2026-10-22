"""Taqrizchi: faqat tayinlangan maqolalar, yopiq taqrizda muallif yashirin, to'lanmagan tarjimalar ko'rinmaydi."""
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.articles.models import Article
from apps.journals.models import Journal, JournalCategory
from apps.payments.models import Transaction
from apps.reviews.models import PeerReview
from apps.translations.models import TranslationRequest
from apps.users.models import User


def _user(phone, role='author'):
    return User.objects.create_user(
        phone=phone, password='pass12345', email=f'{phone}@t.uz',
        first_name='Ism', last_name=role, affiliation='X', role=role,
    )


def _ids(res):
    data = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
    return {str(x['id']) for x in data}


class ReviewerScopeTests(TestCase):
    def setUp(self):
        self.author = _user('998910000201')
        self.reviewer = _user('998910000202', role='reviewer')
        self.other_reviewer = _user('998910000203', role='reviewer')
        cat = JournalCategory.objects.create(name='Iqtisod')
        journal = Journal.objects.create(
            name='J', issn='1111-3333', description='d', category=cat,
            journal_admin=_user('998910000204', role='journal_admin'),
        )
        mk = lambda t: Article.objects.create(
            title=t, abstract='a', keywords=['k'], author=self.author, journal=journal, status='QabulQilingan',
        )
        self.assigned = mk('Tayinlangan')
        self.unassigned = mk('Tayinlanmagan')
        self.declined = mk('Voz kechilgan')
        self.open_art = mk('Ochiq taqriz')
        PeerReview.objects.create(article=self.assigned, reviewer=self.reviewer, status='in_progress')
        PeerReview.objects.create(article=self.unassigned, reviewer=self.other_reviewer, status='pending')
        PeerReview.objects.create(article=self.declined, reviewer=self.reviewer, status='declined')
        PeerReview.objects.create(article=self.open_art, reviewer=self.reviewer, status='pending', review_type='open')
        self.client = APIClient()
        self.client.force_authenticate(self.reviewer)

    def test_list_only_assigned(self):
        ids = _ids(self.client.get('/api/v1/articles/'))
        self.assertIn(str(self.assigned.pk), ids)
        self.assertIn(str(self.open_art.pk), ids)
        self.assertNotIn(str(self.unassigned.pk), ids)
        self.assertNotIn(str(self.declined.pk), ids)

    def test_book_orders_hidden(self):
        # Kitob buyurtmalari (muallif manzili, telefoni bilan) taqrizchilarga emas, bosh admin/operatorga boradi
        book = Article.objects.create(
            title='[KITOB] Darslik', abstract='a', keywords=['k'], author=self.author,
            journal=self.assigned.journal, status='QabulQilingan',
        )
        self.assertNotIn(str(book.pk), _ids(self.client.get('/api/v1/articles/')))

    def test_unassigned_detail_404(self):
        self.assertEqual(self.client.get(f'/api/v1/articles/{self.unassigned.pk}/').status_code, 404)

    def test_author_hidden_in_blind_review(self):
        data = self.client.get(f'/api/v1/articles/{self.assigned.pk}/').data
        self.assertEqual(data['author_name'], 'Anonim muallif')
        self.assertIsNone(data['author'])

    def test_author_visible_in_open_review(self):
        data = self.client.get(f'/api/v1/articles/{self.open_art.pk}/').data
        self.assertNotEqual(data['author_name'], 'Anonim muallif')

    def test_unpaid_translations_hidden(self):
        # Tarjimani endi tarjimon (translator) bajaradi; to'lanmagan buyurtma unga ham ko'rinmaydi.
        # Taqrizchiga faqat o'zi olgan eski buyurtmalar ko'rinadi (tests/test_translation_ai.py).
        self.client.force_authenticate(_user('998910000205', role='translator'))
        mk = lambda t, cost: TranslationRequest.objects.create(
            author=self.author, title=t, source_language='uz', target_language='en',
            source_file_path='translations/source/x.docx', cost=Decimal(cost),
        )
        paid, unpaid, free = mk('Paid', '1000'), mk('Unpaid', '1000'), mk('Free', '0')
        Transaction.objects.create(
            user=self.author, translation_request=paid, amount=Decimal('1000'),
            service_type='translation', status='completed',
        )
        ids = _ids(self.client.get('/api/v1/translations/'))
        self.assertIn(str(paid.pk), ids)
        self.assertIn(str(free.pk), ids)
        self.assertNotIn(str(unpaid.pk), ids)


class EditorAssignTests(TestCase):
    def setUp(self):
        self.author = _user('998910000301')
        self.reviewer = _user('998910000302', role='reviewer')
        self.jadmin = _user('998910000303', role='journal_admin')
        self.other_admin = _user('998910000304', role='journal_admin')
        cat = JournalCategory.objects.create(name='Iqtisod')
        journal = Journal.objects.create(name='J', issn='1111-4444', description='d', category=cat, journal_admin=self.jadmin)
        self.article = Article.objects.create(
            title='T', abstract='a', keywords=['k'], author=self.author, journal=journal, status='WithEditor',
        )
        self.client = APIClient()

    def test_assign_moves_article_to_review(self):
        self.client.force_authenticate(self.jadmin)
        res = self.client.post('/api/v1/reviews/', {'article': str(self.article.pk), 'reviewer': str(self.reviewer.pk)}, format='json')
        self.assertEqual(res.status_code, 201)
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, 'QabulQilingan')
        self.client.force_authenticate(self.reviewer)
        self.assertEqual(self.client.get(f'/api/v1/articles/{self.article.pk}/').status_code, 200)

    def test_other_journal_admin_cannot_assign(self):
        self.client.force_authenticate(self.other_admin)
        res = self.client.post('/api/v1/reviews/', {'article': str(self.article.pk), 'reviewer': str(self.reviewer.pk)}, format='json')
        self.assertEqual(res.status_code, 403)


class AcceptRequiresReviewTests(TestCase):
    def setUp(self):
        self.author = _user('998910000401')
        self.reviewer = _user('998910000402', role='reviewer')
        self.jadmin = _user('998910000403', role='journal_admin')
        self.sadmin = _user('998910000404', role='super_admin')
        cat = JournalCategory.objects.create(name='Iqtisod')
        self.journal = Journal.objects.create(name='J', issn='1111-5555', description='d', category=cat, journal_admin=self.jadmin)
        self.article = Article.objects.create(
            title='T', abstract='a', keywords=['k'], author=self.author, journal=self.journal, status='QabulQilingan',
        )
        self.client = APIClient()

    def _accept(self, user, article=None):
        self.client.force_authenticate(user)
        art = article or self.article
        return self.client.post(f'/api/v1/articles/{art.pk}/update_status/', {'status': 'Accepted'}, format='json')

    def test_editor_cannot_accept_without_review(self):
        self.assertEqual(self._accept(self.jadmin).status_code, 400)
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, 'QabulQilingan')

    def test_editor_can_accept_after_completed_review(self):
        PeerReview.objects.create(article=self.article, reviewer=self.reviewer, status='completed', recommendation='accept')
        self.assertEqual(self._accept(self.jadmin).status_code, 200)

    def test_super_admin_exempt(self):
        self.assertEqual(self._accept(self.sadmin).status_code, 200)

    def test_serializer_hides_accept_until_review(self):
        self.client.force_authenticate(self.jadmin)
        data = self.client.get(f'/api/v1/articles/{self.article.pk}/').data
        self.assertNotIn('Accepted', data['allowed_transitions'])
        self.assertFalse(data['has_completed_review'])


class AccountantArticlesClosedTests(TestCase):
    def test_accountant_sees_no_articles(self):
        author = _user('998910000501')
        acc = _user('998910000502', role='accountant')
        cat = JournalCategory.objects.create(name='Iqtisod')
        journal = Journal.objects.create(name='J', issn='1111-6666', description='d', category=cat,
                                         journal_admin=_user('998910000503', role='journal_admin'))
        art = Article.objects.create(title='T', abstract='a', keywords=['k'], author=author, journal=journal, status='Published')
        client = APIClient()
        client.force_authenticate(acc)
        self.assertEqual(_ids(client.get('/api/v1/articles/')), set())
        self.assertEqual(client.get(f'/api/v1/articles/{art.pk}/').status_code, 404)
        self.assertEqual(client.get('/api/v1/payments/transactions/').status_code, 200)
