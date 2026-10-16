"""
QA topilmalari (2026-10-15) uchun regressiya testlari:
to'lovni qayta ishlatish, fayl turi (XSS), holat o'tishlari, antiplagiat qayta tekshiruvi, UDK holati va
bildirishnomalari, yopiq taqriz, demo belgisi, profil, xodim huquqlari, foydalanuvchini arxivlash,
Telegram bot sessiyasi, sahifalar soni, taqriz jarayoni, son tarkibi.
"""
import io
import json
import shutil
import tempfile
import zipfile
from decimal import Decimal

from asgiref.sync import async_to_sync
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.articles.models import Article
from apps.journals.models import Issue, Journal, JournalCategory
from apps.notifications.models import Notification
from apps.payments.models import Transaction
from apps.reviews.models import PeerReview
from apps.udc.models import UdkRequest
from apps.users.models import TelegramSession, User

MEDIA = tempfile.mkdtemp(prefix='phoenix-qa-fixes-')
DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'


def _docx(pages=None, words=50, name='maqola.docx'):
    """Minimal DOCX (zip): Word saqlagan sahifalar soni docProps/app.xml da."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        body = ''.join(f'<w:p><w:r><w:t>soz{i}</w:t></w:r></w:p>' for i in range(words))
        zf.writestr('word/document.xml', f'<w:document><w:body>{body}</w:body></w:document>')
        if pages is not None:
            zf.writestr('docProps/app.xml', f'<Properties><Pages>{pages}</Pages></Properties>')
    return SimpleUploadedFile(name, buf.getvalue(), DOCX_MIME)


def _user(phone, role='author', **extra):
    return User.objects.create_user(
        phone=phone, password='pass12345', email=f'{phone}@qa.uz',
        first_name='Ism', last_name=role, affiliation='OTM', role=role, **extra,
    )


@override_settings(MEDIA_ROOT=MEDIA, PHONE_VERIFICATION_REQUIRED=False)
class QaBase(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.author = _user('998900001001')
        self.journal_admin = _user('998900001002', role='journal_admin')
        self.super_admin = _user('998900001003', role='super_admin')
        self.reviewer = _user('998900001004', role='reviewer')
        self.accountant = _user('998900001005', role='accountant')
        self.outsider = _user('998900001006')  # boshqa jurnal muallifi
        cat = JournalCategory.objects.create(name='QA')
        self.journal = Journal.objects.create(
            name='QA jurnali', issn='1111-2222', description='d', journal_admin=self.journal_admin,
            category=cat, payment_model='pre-payment', pricing_type='per_page', price_per_page=Decimal('10000'),
        )
        self.other_journal = Journal.objects.create(
            name='Boshqa jurnal', issn='3333-4444', description='d', journal_admin=self.super_admin,
            category=cat, payment_model='post-payment', publication_fee=Decimal('0'),
        )
        self.article = Article.objects.create(
            title='Tahririyatdagi maqola', abstract='a', author=self.author, journal=self.journal,
            status='Yangi', page_count=5,
        )
        Article.objects.create(title='Begona', abstract='a', author=self.outsider, journal=self.other_journal,
                               status='Yangi')

    def api(self, user=None):
        client = APIClient()
        if user is not None:
            client.force_authenticate(user)
        return client

    def set_status(self, user, status, article=None, reason=''):
        art = article or self.article
        return self.api(user).post(f'/api/v1/articles/{art.id}/update_status/',
                                   {'status': status, 'reason': reason}, format='json')


class PaymentReuseAndPageCountTests(QaBase):
    def _create(self, tx=None, page_count='1', file=None):
        data = {'title': 'Yangi maqola sarlavhasi', 'abstract': 'a', 'journal': str(self.journal.id),
                'keywords': json.dumps(['qa']), 'page_count': page_count,
                'final_pdf_path': file or _docx(pages=3)}
        if tx is not None:
            data['payment_transaction_id'] = str(tx.id)
        return self.api(self.author).post('/api/v1/articles/', data, format='multipart')

    def test_used_transaction_cannot_pay_for_new_article(self):
        used = Transaction.objects.create(user=self.author, article=self.article, amount=Decimal('500000'),
                                          service_type='publication_fee', status='completed')
        res = self._create(tx=used)
        self.assertEqual(res.status_code, 201, res.content)
        created = Article.objects.get(title='Yangi maqola sarlavhasi')
        self.assertEqual(created.status, 'Draft')  # to'lov kutilmoqda, tahririyatga o'tmadi
        used.refresh_from_db()
        self.assertEqual(used.article_id, self.article.id)

    def test_unused_sufficient_prepayment_is_linked_once(self):
        tx = Transaction.objects.create(user=self.author, amount=Decimal('30000'),
                                        service_type='publication_fee', status='completed')
        self.assertEqual(self._create(tx=tx).status_code, 201)
        created = Article.objects.get(title='Yangi maqola sarlavhasi')
        self.assertEqual(created.status, 'Yangi')
        tx.refresh_from_db()
        self.assertEqual(tx.article_id, created.id)

    def test_underpaid_prepayment_leaves_draft(self):
        tx = Transaction.objects.create(user=self.author, amount=Decimal('1000'),
                                        service_type='publication_fee', status='completed')
        self._create(tx=tx)
        self.assertEqual(Article.objects.get(title='Yangi maqola sarlavhasi').status, 'Draft')

    def test_page_count_comes_from_file_not_author(self):
        self.assertEqual(self._create(page_count='1', file=_docx(pages=12)).status_code, 201)
        self.assertEqual(Article.objects.get(title='Yangi maqola sarlavhasi').page_count, 12)

    def test_stale_word_metadata_does_not_undercharge(self):
        # Dastur yaratgan DOCX: <Pages>1</Pages>, lekin matn ~10 bet (3000 so'z)
        self._create(page_count='1', file=_docx(pages=1, words=3000))
        self.assertEqual(Article.objects.get(title='Yangi maqola sarlavhasi').page_count, 10)

    def test_page_count_endpoint(self):
        res = self.api(self.author).post('/api/v1/articles/page-count/', {'file': _docx(words=900)}, format='multipart')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {'pages': 3, 'detected': True})


class UploadValidationTests(QaBase):
    def _upload(self, name, content, mime):
        return self.api(self.author).post('/api/v1/articles/', {
            'title': 'Fayl turi testi', 'abstract': 'a', 'journal': str(self.other_journal.id),
            'final_pdf_path': SimpleUploadedFile(name, content, mime),
        }, format='multipart')

    def test_html_manuscript_rejected(self):
        res = self._upload('qolyozma.html', b'<script>alert(1)</script>', 'text/html')
        self.assertEqual(res.status_code, 400)
        self.assertIn('final_pdf_path', res.data)

    def test_html_renamed_to_pdf_rejected(self):
        res = self._upload('qolyozma.pdf', b'<html><script>alert(1)</script></html>', 'application/pdf')
        self.assertEqual(res.status_code, 400)

    def test_real_pdf_accepted(self):
        self.assertEqual(self._upload('maqola.pdf', b'%PDF-1.4\n%test\n', 'application/pdf').status_code, 201)

    def test_existing_html_media_served_as_download(self):
        import os

        from django.conf import settings
        from config.media_protection import sign

        name = 'articles/pdfs/abc/eski.html'
        path = os.path.join(settings.MEDIA_ROOT, name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as fh:
            fh.write(b'<script>alert(1)</script>')
        expires, sig = sign(name)
        res = self.client.get(f'/media/{name}?e={expires}&s={sig}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'application/octet-stream')
        self.assertTrue(res['Content-Disposition'].startswith('attachment'))
        self.assertEqual(res['Content-Security-Policy'], 'sandbox')


class StatusTransitionTests(QaBase):
    def test_draft_cannot_be_moved_by_journal_admin(self):
        self.article.status = 'Draft'
        self.article.save()
        for target in ('Accepted', 'Published', 'Yangi'):
            with self.subTest(target=target):
                # To'lanmagan qoralama muharrirga umuman ko'rinmaydi (404) — holatini ham o'zgartira olmaydi
                self.assertIn(self.set_status(self.journal_admin, target).status_code, (400, 404))
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, 'Draft')

    def test_published_only_via_complete_publication(self):
        res = self.set_status(self.journal_admin, 'Published')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Nashrni yakunlash', res.data['error'])

    def test_normal_editorial_path(self):
        for target in ('WithEditor', 'QabulQilingan', 'Accepted', 'NashrgaYuborilgan'):
            with self.subTest(target=target):
                self.assertEqual(self.set_status(self.journal_admin, target).status_code, 200)
        cert = SimpleUploadedFile('sertifikat.pdf', b'%PDF-1.4\n', 'application/pdf')
        res = self.api(self.journal_admin).post(f'/api/v1/articles/{self.article.id}/complete_publication/',
                                                {'certificate': cert}, format='multipart')
        self.assertEqual(res.status_code, 200, res.content)
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, 'Published')

    def test_accept_checks_plagiarism_thresholds(self):
        self.journal.plagiarism_max_percent = 10
        self.journal.ai_content_max_percent = 10
        self.journal.originality_min_percent = 90
        self.journal.save()
        self.article.plagiarism_percentage = 60
        self.article.ai_content_percentage = 50
        self.article.originality_percentage = 40
        self.article.plagiarism_checked_at = timezone.now()
        self.article.save()
        res = self.set_status(self.journal_admin, 'Accepted')
        self.assertEqual(res.data['new_status'], 'Rejected')

    def test_serializer_exposes_allowed_transitions(self):
        data = self.api(self.journal_admin).get(f'/api/v1/articles/{self.article.id}/').data
        self.assertIn('Accepted', data['allowed_transitions'])
        self.assertNotIn('Published', data['allowed_transitions'])
        self.assertEqual(self.api(self.author).get(f'/api/v1/articles/{self.article.id}/').data['allowed_transitions'], [])


class AuthorEditAndAntiplagiatTests(QaBase):
    def test_author_cannot_replace_file_after_submission(self):
        res = self.api(self.author).patch(f'/api/v1/articles/{self.article.id}/',
                                          {'final_pdf_path': _docx()}, format='multipart')
        self.assertEqual(res.status_code, 403)

    def test_author_can_replace_file_in_revision(self):
        self.article.status = 'Revision'
        self.article.save()
        res = self.api(self.author).patch(f'/api/v1/articles/{self.article.id}/',
                                          {'final_pdf_path': _docx()}, format='multipart')
        self.assertEqual(res.status_code, 200, res.content)

    def test_checked_document_file_locked(self):
        self.article.status = 'Draft'
        self.article.plagiarism_checked_at = timezone.now()
        self.article.save()
        res = self.api(self.author).patch(f'/api/v1/articles/{self.article.id}/',
                                          {'final_pdf_path': _docx()}, format='multipart')
        self.assertEqual(res.status_code, 403)

    def test_paid_check_not_rerun_by_author(self):
        self.article.status = 'PaymentCompleted'
        self.article.final_pdf_path = _docx()
        self.article.plagiarism_checked_at = timezone.now()
        self.article.plagiarism_percentage = 12
        self.article.plagiarism_report = {'check_status': 'completed'}
        self.article.save()
        Transaction.objects.create(user=self.author, article=self.article, amount=Decimal('30000'),
                                   service_type='language_editing', status='completed')
        res = self.api(self.author).post(f'/api/v1/articles/{self.article.id}/check_plagiarism/',
                                         {'force': True}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(res.data['cached'])

    def test_standalone_antiplagiat_hidden_from_journal_admin(self):
        doc = Article.objects.create(title='Plagiarism check: dissertatsiya', abstract='a', author=self.author,
                                     journal=self.journal, status='Draft', plagiarism_report={'is_standalone': True})
        ids = {a['id'] for a in self.api(self.journal_admin).get('/api/v1/articles/staff/').data}
        self.assertNotIn(str(doc.id), ids)
        self.assertIn(str(self.article.id), ids)
        self.assertEqual(self.api(self.journal_admin).get(f'/api/v1/articles/{doc.id}/').status_code, 404)


class UdkFixesTests(QaBase):
    def _request(self, status):
        return UdkRequest.objects.create(user=self.author, author_first_name='A', author_last_name='B',
                                         title='UDK mavzu', abstract='a', status=status)

    def test_unpaid_request_cannot_be_completed(self):
        req = self._request('pending_payment')
        res = self.api(self.reviewer).patch(f'/api/v1/udc/requests/{req.id}/complete/', {'udk_code': '004'},
                                            format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn("to'lanmagan", res.data['detail'])

    def test_completion_notifies_author(self):
        req = self._request('submitted')
        res = self.api(self.reviewer).patch(f'/api/v1/udc/requests/{req.id}/complete/',
                                            {'udk_code': '004.8', 'udk_description': 'AI'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(Notification.objects.filter(user=self.author, title="UDK ma'lumotnoma tayyor").exists())

    def test_rejected_request_cannot_be_rejected_again(self):
        req = self._request('rejected')
        res = self.api(self.reviewer).patch(f'/api/v1/udc/requests/{req.id}/reject/', {}, format='json')
        self.assertEqual(res.status_code, 400)

    @override_settings(UDK_PAYMENT_ENABLED=False)
    def test_new_free_request_notifies_reviewers(self):
        res = self.api(self.author).post('/api/v1/udc/request/', {
            'author_first_name': 'A', 'author_last_name': 'B', 'title': 'Mavzu', 'abstract': 'Annotatsiya',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(Notification.objects.filter(user=self.reviewer, title="Yangi UDK so'rovi").exists())


class BlindReviewTests(QaBase):
    def test_reviewer_does_not_see_author(self):
        PeerReview.objects.create(article=self.article, reviewer=self.reviewer, review_type='double_blind')
        data = self.api(self.reviewer).get(f'/api/v1/articles/{self.article.id}/').data
        self.assertIsNone(data['author'])
        self.assertEqual(data['author_name'], 'Anonim muallif')
        listed = self.api(self.reviewer).get('/api/v1/articles/').data
        rows = listed['results'] if isinstance(listed, dict) else listed
        self.assertTrue(all(r['author_name'] == 'Anonim muallif' for r in rows))

    def test_open_review_shows_author(self):
        PeerReview.objects.create(article=self.article, reviewer=self.reviewer, review_type='open')
        data = self.api(self.reviewer).get(f'/api/v1/articles/{self.article.id}/').data
        self.assertEqual(str(data['author']), str(self.author.id))

    def test_editor_still_sees_author(self):
        data = self.api(self.journal_admin).get(f'/api/v1/articles/{self.article.id}/').data
        self.assertEqual(str(data['author']), str(self.author.id))


class ProfileAndDemoTests(QaBase):
    def test_cannot_self_mark_as_demo(self):
        res = self.api(self.author).patch('/api/v1/auth/update_profile/', {'email': 'x@demo.ilmiyfaoliyat.uz'},
                                          format='json')
        self.assertEqual(res.status_code, 400)
        res = self.api().post('/api/v1/auth/register/', {
            'phone': '901112233', 'password': 'parol123', 'password_confirm': 'parol123',
            'first_name': 'A', 'last_name': 'B', 'email': 'y@demo.ilmiyfaoliyat.uz',
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_phone_change_resets_verification_and_normalizes(self):
        self.author.phone_verified = True
        self.author.save()
        res = self.api(self.author).patch('/api/v1/auth/update_profile/', {'phone': '93 555 44 33'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.author.refresh_from_db()
        self.assertEqual(self.author.phone, '998935554433')
        self.assertFalse(self.author.phone_verified)

    def test_password_change_requires_current_password(self):
        res = self.api(self.author).patch('/api/v1/auth/update_profile/', {'password': 'yangi-parol'}, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.api(self.author).patch('/api/v1/auth/update_profile/',
                                          {'password': 'yangi-parol', 'current_password': 'pass12345'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.author.refresh_from_db()
        self.assertTrue(self.author.check_password('yangi-parol'))

    def test_reviewer_cannot_inflate_own_stats(self):
        self.api(self.reviewer).patch('/api/v1/auth/update_profile/', {'reviews_completed': 999}, format='json')
        self.reviewer.refresh_from_db()
        self.assertEqual(self.reviewer.reviews_completed, 0)


class StaffScopeTests(QaBase):
    def _rows(self, data):
        return data['results'] if isinstance(data, dict) else data

    def test_journal_admin_sees_only_own_authors_without_contacts(self):
        rows = self._rows(self.api(self.journal_admin).get('/api/v1/auth/').data)
        ids = {r['id'] for r in rows}
        self.assertIn(str(self.author.id), ids)
        self.assertNotIn(str(self.outsider.id), ids)
        self.assertTrue(all('phone' not in r and 'email' not in r for r in rows))

    def test_accountant_directory_has_no_contacts(self):
        rows = self._rows(self.api(self.accountant).get('/api/v1/auth/').data)
        self.assertTrue(rows)
        self.assertTrue(all('phone' not in r for r in rows))

    def test_journal_admin_cannot_create_journal_or_change_price(self):
        res = self.api(self.journal_admin).post('/api/v1/journals/journals/', {'name': 'Yangi', 'issn': '9999-0000'},
                                                format='json')
        self.assertEqual(res.status_code, 403)
        res = self.api(self.journal_admin).patch(f'/api/v1/journals/journals/{self.journal.id}/',
                                                 {'price_per_page': '1'}, format='json')
        self.assertEqual(res.status_code, 403)
        res = self.api(self.journal_admin).patch(f'/api/v1/journals/journals/{self.journal.id}/',
                                                 {'description': 'Yangilangan tavsif'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)

    def test_issue_cannot_move_to_other_journal_and_keeps_articles(self):
        issue = Issue.objects.create(journal=self.journal, issue_number='1', publication_date='2026-10-01')
        self.article.status = 'Published'
        self.article.issue = issue
        self.article.save()
        res = self.api(self.journal_admin).patch(f'/api/v1/journals/issues/{issue.id}/',
                                                 {'journal': str(self.other_journal.id)}, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.api(self.journal_admin).patch(f'/api/v1/journals/issues/{issue.id}/',
                                                 {'issue_number': '2'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.article.refresh_from_db()
        self.assertEqual(self.article.issue_id, issue.id)  # ro'yxat yuborilmagan — maqola sondan chiqmadi


class UserArchiveTests(QaBase):
    def test_delete_archives_and_keeps_payments(self):
        tx = Transaction.objects.create(user=self.author, article=self.article, amount=Decimal('50000'),
                                        service_type='publication_fee', status='completed')
        url = f'/api/v1/auth/{self.author.id}/'
        self.assertEqual(self.api(self.super_admin).delete(url, {'password': 'xato'}, format='json').status_code, 403)
        res = self.api(self.super_admin).delete(url, {'password': 'pass12345'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.author.refresh_from_db()
        self.assertFalse(self.author.is_active)
        self.assertTrue(Transaction.objects.filter(pk=tx.pk).exists())
        self.assertTrue(Article.objects.filter(pk=self.article.pk).exists())

    def test_journal_deletion_keeps_transactions(self):
        from django.db.models import ProtectedError

        tx = Transaction.objects.create(user=self.author, article=self.article, amount=Decimal('50000'),
                                        service_type='publication_fee', status='completed')
        # Maqolasi bor jurnal umuman o'chirilmaydi (Article.journal PROTECT) — maqola ham, to'lov bog'lanishi ham saqlanadi
        with self.assertRaises(ProtectedError):
            self.journal.delete()
        tx.refresh_from_db()
        self.assertEqual(tx.article_id, self.article.id)


class TelegramBotSessionTests(QaBase):
    def test_login_without_refresh_in_body_still_persists(self):
        from bot.session import persist_login

        class Ctx:
            user_data = {}

        async_to_sync(persist_login)(Ctx(), 777, {'user': {'id': str(self.author.id)}, 'access': 'x'}, 'qa')
        row = TelegramSession.objects.get(telegram_id=777)
        self.assertEqual(row.user, self.author)
        self.assertTrue(row.refresh_token and row.access_token)


class ReviewWorkflowTests(QaBase):
    def test_editor_assigns_reviewer_who_opens_article_and_submits(self):
        res = self.api(self.journal_admin).post('/api/v1/reviews/', {
            'article': str(self.article.id), 'reviewer': str(self.reviewer.id), 'review_type': 'double_blind',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        review_id = res.data['id']
        self.assertIsNotNone(PeerReview.objects.get(pk=review_id).deadline)
        # Maqola "Yangi" holatda — taqrizchi baribir ochadi (avval 404)
        self.assertEqual(self.api(self.reviewer).get(f'/api/v1/articles/{self.article.id}/').status_code, 200)
        api = self.api(self.reviewer)
        self.assertEqual(api.post(f'/api/v1/reviews/{review_id}/accept_review/').status_code, 200)
        res = api.post(f'/api/v1/reviews/{review_id}/submit_review/', {
            'recommendation': 'minor_revision', 'review_content': 'Yaxshi maqola', 'originality_score': 8,
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        listed = self.api(self.journal_admin).get(f'/api/v1/reviews/?article={self.article.id}').data
        rows = listed['results'] if isinstance(listed, dict) else listed
        self.assertEqual(rows[0]['status'], 'completed')

    def test_editor_cannot_forge_review_results(self):
        review = PeerReview.objects.create(article=self.article, reviewer=self.reviewer)
        self.api(self.journal_admin).patch(f'/api/v1/reviews/{review.id}/',
                                           {'status': 'completed', 'recommendation': 'accept'}, format='json')
        review.refresh_from_db()
        self.assertEqual(review.status, 'pending')
        self.assertEqual(review.recommendation, '')

    def test_find_specialists_lists_reviewers_without_contacts(self):
        res = self.api(self.journal_admin).get(f'/api/v1/reviews/find-specialists/?article={self.article.id}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual([r['id'] for r in res.data], [str(self.reviewer.id)])
        self.assertNotIn('phone', res.data[0])

    def test_decline_twice_rejected(self):
        review = PeerReview.objects.create(article=self.article, reviewer=self.reviewer)
        api = self.api(self.reviewer)
        self.assertEqual(api.post(f'/api/v1/reviews/{review.id}/decline_review/', {'reason': 'band'},
                                  format='json').status_code, 200)
        self.assertEqual(api.post(f'/api/v1/reviews/{review.id}/decline_review/').status_code, 400)


class NotificationApiTests(QaBase):
    def test_manual_create_is_405_not_500(self):
        res = self.api(self.author).post('/api/v1/notifications/', {'title': 'x', 'message': 'y'}, format='json')
        self.assertEqual(res.status_code, 405)


class UserReactivateTests(QaBase):
    def test_super_admin_can_reactivate(self):
        self.author.is_active = False
        self.author.save()
        res = self.api(self.super_admin).patch(f'/api/v1/auth/{self.author.id}/', {'is_active': True}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.author.refresh_from_db()
        self.assertTrue(self.author.is_active)

    def test_user_cannot_reactivate_self_via_profile(self):
        res = self.api(self.author).patch('/api/v1/auth/update_profile/', {'is_active': False}, format='json')
        self.assertEqual(res.status_code, 400)


class RetryPublicationPaymentTests(QaBase):
    """To'lov bekor qilinsa / Click xato bersa — muallif yangi to'lov boshlay oladi (avval qoralama qotib qolardi)."""

    def setUp(self):
        super().setUp()
        self.article.status = 'Draft'
        self.article.save()
        Transaction.objects.create(user=self.author, article=self.article, amount=Decimal('50000'),
                                   service_type='publication_fee', status='failed')

    def _flag(self, user):
        rows = self.api(user).get('/api/v1/articles/mine/').data
        return next(r for r in rows if r['id'] == str(self.article.id))['needs_publication_payment']

    def test_flag_set_after_failed_payment_and_new_payment_possible(self):
        self.assertTrue(self._flag(self.author))
        res = self.api(self.author).post('/api/v1/payments/transactions/', {
            'service_type': 'publication_fee', 'article': str(self.article.id), 'amount': 1,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Decimal(str(res.data['amount'])), Decimal('50000'))  # 5 bet × 10 000 — server narxi

    def test_flag_cleared_after_completed_payment(self):
        Transaction.objects.create(user=self.author, article=self.article, amount=Decimal('50000'),
                                   service_type='publication_fee', status='completed')
        self.assertFalse(self._flag(self.author))


class PaymentReturnAndUploadLimitTests(QaBase):
    def test_click_returns_straight_to_app_handler(self):
        from apps.payments.click_checkout import _build_click_return_url

        for service in ('publication_fee', 'language_editing', 'udk_request'):
            tx = Transaction(id='11111111-1111-1111-1111-111111111111', service_type=service, amount=Decimal('1'))
            with self.subTest(service=service):
                url = _build_click_return_url(tx)
                self.assertIn('/#/payment/return?transaction_id=11111111-1111-1111-1111-111111111111', url)

    def test_large_flows_detected(self):
        from apps.articles.serializers import is_large_document_flow

        self.assertTrue(is_large_document_flow('[KITOB] Darslik', []))
        self.assertTrue(is_large_document_flow('Dissertatsiya', ['plagiarism', 'check']))
        self.assertTrue(is_large_document_flow('Plagiarism Check - fayl.docx', []))
        self.assertFalse(is_large_document_flow('Oddiy maqola', ['iqtisodiyot']))

    def test_size_limits(self):
        from rest_framework import serializers as drf

        from apps.articles.serializers import enforce_regular_size_limit
        from config.upload_validation import LARGE_DOCUMENT_MAX_MB, validate_upload

        big = _docx(pages=2)
        big.size = 60 * 1024 * 1024
        validate_upload(big, max_mb=LARGE_DOCUMENT_MAX_MB)          # 60 MB — antiplagiat/kitob uchun joiz
        enforce_regular_size_limit(big, large_flow=True)
        with self.assertRaises(drf.ValidationError):
            enforce_regular_size_limit(big, large_flow=False)      # oddiy jurnal maqolasi — 25 MB
        big.size = 101 * 1024 * 1024
        with self.assertRaises(drf.ValidationError):
            validate_upload(big, max_mb=LARGE_DOCUMENT_MAX_MB)     # 100 MB dan katta — hech qaysi oqimda

    def test_regular_article_over_25mb_rejected_book_accepted(self):
        payload = b'%PDF-1.4\n' + b'0' * (26 * 1024 * 1024)
        res = self.api(self.author).post('/api/v1/articles/', {
            'title': 'Oddiy maqola', 'abstract': 'a', 'journal': str(self.other_journal.id),
            'final_pdf_path': SimpleUploadedFile('m.pdf', payload, 'application/pdf'),
        }, format='multipart')
        self.assertEqual(res.status_code, 400)
        res = self.api(self.author).post('/api/v1/articles/', {
            'title': '[KITOB] Katta darslik', 'abstract': 'a', 'journal': str(self.other_journal.id),
            'keywords': json.dumps(['kitob']), 'page_count': '320',
            'final_pdf_path': SimpleUploadedFile('kitob.pdf', payload, 'application/pdf'),
        }, format='multipart')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Article.objects.get(title='[KITOB] Katta darslik').page_count, 320)
