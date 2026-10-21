"""
Taqrizchi taqrizini yakunlagach maqolani nashrgacha o'zi olib boradi — jurnal admini tasdig'i shart emas.
Taqriz yakunlanmaguncha yoki boshqa taqrizchiga bu huquq berilmaydi. Ma'lumotnomani xodimlar ham oladi.
"""
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.articles.models import Article
from apps.journals.models import Journal, JournalCategory
from apps.reviews.models import PeerReview
from apps.users.models import User

REVIEW = {'review_content': 'Yaxshi maqola, nashrga tavsiya etiladi.', 'recommendation': 'accept'}


def _user(phone, role='author'):
    return User.objects.create_user(phone=phone, password='pass12345', email=f'{phone}@t.uz',
                                    first_name='Ism', last_name=role, affiliation='X', role=role)


class ReviewerPublishFlowTests(TestCase):
    def setUp(self):
        self.author = _user('998910000301')
        self.reviewer = _user('998910000302', role='reviewer')
        self.other_reviewer = _user('998910000303', role='reviewer')
        self.journal_admin = _user('998910000304', role='journal_admin')
        journal = Journal.objects.create(name='J', issn='1111-4444', description='d',
                                         category=JournalCategory.objects.create(name='Fan'),
                                         journal_admin=self.journal_admin)
        self.article = Article.objects.create(title='Maqola', abstract='a', keywords=['k'], author=self.author,
                                              journal=journal, status='QabulQilingan')
        self.review = PeerReview.objects.create(article=self.article, reviewer=self.reviewer, status='in_progress')
        PeerReview.objects.create(article=self.article, reviewer=self.other_reviewer, status='in_progress')

    def api(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c

    def detail(self, user):
        return self.api(user).get(f'/api/v1/articles/{self.article.id}/').data

    def set_status(self, user, status, **extra):
        return self.api(user).post(f'/api/v1/articles/{self.article.id}/update_status/', {'status': status, **extra},
                                   format='json')

    def test_full_flow_without_admin(self):
        # Taqrizgacha — qaror tugmalari yo'q
        self.assertEqual(self.detail(self.reviewer)['allowed_transitions'], [])
        self.assertEqual(self.set_status(self.reviewer, 'Accepted').status_code, 403)

        res = self.api(self.reviewer).post(f'/api/v1/reviews/{self.review.id}/submit_review/', REVIEW, format='json')
        self.assertEqual(res.status_code, 200, res.content)

        data = self.detail(self.reviewer)
        self.assertEqual(data['allowed_transitions'], ['Accepted', 'Rejected', 'Revision'])
        self.assertFalse(data['can_publish'])
        self.assertEqual(self.set_status(self.reviewer, 'Accepted').status_code, 200)

        data = self.detail(self.reviewer)
        self.assertTrue(data['can_publish'])
        self.assertEqual(data['allowed_transitions'], ['Rejected', 'Revision'])  # nashr — «Nashr qilish» blokida

        cert = SimpleUploadedFile('sertifikat.pdf', b'%PDF-1.4\n', 'application/pdf')
        res = self.api(self.reviewer).post(f'/api/v1/articles/{self.article.id}/complete_publication/',
                                           {'certificate': cert}, format='multipart')
        self.assertEqual(res.status_code, 200, res.content)
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, 'Published')
        self.assertEqual(self.article.published_by, self.reviewer)

    def test_other_reviewer_without_completed_review_cannot_act(self):
        self.review.status = 'completed'
        self.review.recommendation = 'accept'
        self.review.save()
        self.assertEqual(self.detail(self.other_reviewer)['allowed_transitions'], [])
        self.assertEqual(self.set_status(self.other_reviewer, 'Accepted').status_code, 403)
        cert = SimpleUploadedFile('s.pdf', b'%PDF-1.4\n', 'application/pdf')
        self.article.status = 'Accepted'
        self.article.save()
        res = self.api(self.other_reviewer).post(f'/api/v1/articles/{self.article.id}/complete_publication/',
                                                 {'certificate': cert}, format='multipart')
        self.assertEqual(res.status_code, 403)

    def test_reviewer_cannot_use_editorial_internal_steps(self):
        self.review.status = 'completed'
        self.review.save()
        self.assertEqual(self.set_status(self.reviewer, 'WritingInProgress').status_code, 400)
        self.assertEqual(self.set_status(self.reviewer, 'Published').status_code, 400)
        # Rad etish sababsiz bo'lmaydi
        self.assertEqual(self.set_status(self.reviewer, 'Rejected').status_code, 400)
        self.assertEqual(self.set_status(self.reviewer, 'Revision', reason='Xulosani kengaytiring').status_code, 200)

    def test_reference_pdf_for_staff(self):
        url = f'/api/v1/articles/reports/reference/?kind=article&id={self.article.id}'
        for user in (self.author, self.reviewer, self.journal_admin):
            with self.subTest(role=user.role):
                res = self.api(user).get(url)
                self.assertEqual(res.status_code, 200)
                self.assertEqual(res['Content-Type'], 'application/pdf')
        outsider = _user('998910000305', role='reviewer')
        self.assertEqual(self.api(outsider).get(url).status_code, 404)

    def test_reference_hides_author_in_blind_review(self):
        from apps.articles import reference_doc

        self.assertEqual(reference_doc.for_article(self.article, 'uz', hide_author=True).author, 'Anonim muallif')
        with mock.patch('apps.articles.reference_doc.for_article', wraps=reference_doc.for_article) as spy:
            self.api(self.reviewer).get(f'/api/v1/articles/reports/reference/?kind=article&id={self.article.id}')
            self.assertTrue(spy.call_args.kwargs['hide_author'])
            self.api(self.journal_admin).get(f'/api/v1/articles/reports/reference/?kind=article&id={self.article.id}')
            self.assertFalse(spy.call_args.kwargs['hide_author'])
