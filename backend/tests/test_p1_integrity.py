"""
P1 tuzatishlari uchun regressiya testlari (2026-10):
antiplagiat haqiqiyligi va maxfiyligi, taqrizlar API, UDK PDF, QR tekshiruv, Celery fallback, last_login.
"""
import time
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.articles.antiplagiat_corpus import invalidate_corpus_cache
from apps.articles.antiplagiat_engine import get_antiplagiat_engine
from apps.articles.antiplagiat_overlap import compute_verified_coverage
from apps.articles.models import Article
from apps.journals.models import Journal, JournalCategory
from apps.reviews.models import PeerReview
from apps.udc.models import UDKCertificate, UdkRequest
from apps.users.models import User

# Tarmoqqa chiqmaydigan modullar (ochiq API / web testda chaqirilmasin)
LOCAL_MODULES = ['milliy_reestr', 'phoenix_archive', 'iqtibos_keltirish', 'shablon_iboralar']

COPIED = (
    "Raqamli iqtisodiyot sharoitida kichik biznes subyektlarining moliyaviy barqarorligini "
    "ta'minlash uchun innovatsion boshqaruv mexanizmlarini joriy etish zarur hisoblanadi. "
    "Tadqiqot natijalari shuni ko'rsatadiki, elektron hisob tizimlari xarajatlarni sezilarli kamaytiradi."
)
ORIGINAL = (
    "Ushbu ishda Farg'ona vodiysidagi qishloq xo'jaligi kooperativlari faoliyati alohida tahlil qilindi. "
    "Muallif tomonidan o'tkazilgan so'rovnoma ikki yuz qirq nafar fermer ishtirokida amalga oshirildi. "
    "Olingan ma'lumotlar mintaqaviy rivojlanish dasturlarini takomillashtirish uchun tavsiyalar beradi."
)


def _user(phone, role='author'):
    return User.objects.create_user(
        phone=phone, password='pass12345', email=f'{phone}@t.uz',
        first_name='Ism', last_name=role, affiliation='X', role=role,
    )


class Fixture(TestCase):
    def setUp(self):
        invalidate_corpus_cache()
        self.author = _user('998910000001')
        self.other = _user('998910000002')
        self.reviewer = _user('998910000003', role='reviewer')
        self.jadmin = _user('998910000004', role='journal_admin')
        self.jadmin2 = _user('998910000005', role='journal_admin')
        self.sadmin = _user('998910000006', role='super_admin')
        cat = JournalCategory.objects.create(name='Iqtisod')
        self.journal = Journal.objects.create(
            name='J1', issn='1111-1111', description='d', journal_admin=self.jadmin, category=cat,
        )

    def tearDown(self):
        invalidate_corpus_cache()

    def api(self, user=None):
        c = APIClient()
        if user is not None:
            c.force_authenticate(user)
        return c

    def corpus_article(self, author, status, title='Manba maqola'):
        return Article.objects.create(
            title=title, abstract=COPIED, author=author, journal=self.journal, status=status,
        )


class AntiplagiatIntegrityTests(Fixture):
    def check(self, text, author=None):
        start = time.monotonic()
        res = get_antiplagiat_engine().check_text(
            text, exclude_author_id=str((author or self.author).id), enabled_modules=LOCAL_MODULES,
        )
        self.assertLess(time.monotonic() - start, 30, 'Tekshiruv sun\'iy cho\'zilmasligi kerak')
        return res

    def test_original_text_has_no_fabricated_sources(self):
        res = self.check(ORIGINAL)
        self.assertEqual(res['report']['sources'], [])
        self.assertEqual(res['plagiarism_percentage'], 0.0)
        self.assertEqual(res['originality'], 100.0)
        self.assertEqual(res['report']['analysis_mode'], 'verified_scan')

    def test_copied_from_published_article_is_found(self):
        self.corpus_article(self.other, 'Published', title='Ochiq nashr')
        res = self.check(COPIED + ' ' + ORIGINAL)
        self.assertGreater(res['plagiarism_percentage'], 20)
        src = res['report']['sources'][0]
        self.assertEqual(src['title'], 'Ochiq nashr')
        self.assertEqual(src['match_type'], 'verified')
        # Yangi foiz cheklanmagan (avval har manba 2.81% bilan cheklanardi)
        self.assertGreater(max(s['similarity'] for s in res['report']['sources']), 2.81)

    def test_unpublished_source_text_is_hidden(self):
        self.corpus_article(self.other, 'WithEditor', title='Maxfiy qo\'lyozma sarlavhasi')
        res = self.check(COPIED)
        self.assertGreater(res['plagiarism_percentage'], 0)
        for src in res['report']['sources']:
            self.assertNotIn('Maxfiy', src['title'])
            self.assertEqual(src.get('source_text', ''), '')
            self.assertEqual(src.get('source', ''), '')

    def test_own_previous_work_is_self_citation_not_plagiarism(self):
        self.corpus_article(self.author, 'Published', title='Oldingi ishim')
        res = self.check(COPIED)
        self.assertEqual(res['plagiarism_percentage'], 0.0)
        self.assertGreater(res['report']['self_citation_percent'], 0)

    def test_standalone_checks_and_reviews_not_in_corpus(self):
        art = self.corpus_article(self.other, 'Accepted', title='Plagiarism Check - doc.docx')
        art.keywords = ['plagiarism']
        art.save()
        Article.objects.create(
            title='Boshqa maqola', abstract='Qisqa annotatsiya matni bu yerda yozilgan.', review_content=COPIED,
            author=self.other, journal=self.journal, status='Yangi',
        )
        res = self.check(COPIED)
        self.assertEqual(res['report']['sources'], [])

    def test_report_lists_only_executed_modules(self):
        res = self.check(ORIGINAL)
        executed = set(res['report']['executed_module_ids'])
        self.assertTrue(executed <= set(LOCAL_MODULES))
        self.assertNotIn('scopus', executed)

    def test_duplicate_matches_counted_once(self):
        frag = 'bir xil gap matni shu yerda turibdi'
        hits = [
            {'match_type': 'verified', 'overlap_chars': 40, 'document_fragment': frag},
            {'match_type': 'verified', 'overlap_chars': 60, 'document_fragment': frag},
        ]
        self.assertEqual(compute_verified_coverage(hits, 1000)['verified_plagiarism_pct'], 6.0)


class ReviewsApiTests(Fixture):
    def setUp(self):
        super().setUp()
        self.article = Article.objects.create(
            title='Taqriz maqola', abstract='a', author=self.author, journal=self.journal, status='QabulQilingan',
        )
        self.review = PeerReview.objects.create(
            article=self.article, reviewer=self.reviewer, status='completed',
            review_content='Yaxshi', comments_to_editor='Faqat tahririyatga', recommendation='accept',
            completed_at=timezone.now(),
        )

    def test_list_works_for_all_roles(self):
        for u in (self.reviewer, self.author, self.jadmin, self.sadmin):
            res = self.api(u).get('/api/v1/reviews/')
            self.assertEqual(res.status_code, 200, (u.role, res.content[:200]))

    def test_other_journal_admin_does_not_see(self):
        res = self.api(self.jadmin2).get('/api/v1/reviews/')
        self.assertEqual(res.json().get('count', len(res.json())), 0)

    def test_author_cannot_edit_review(self):
        res = self.api(self.author).patch(f'/api/v1/reviews/{self.review.id}/', {'recommendation': 'reject'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_blind_review_hides_reviewer_from_author(self):
        res = self.api(self.author).get(f'/api/v1/reviews/{self.review.id}/')
        body = res.json()
        self.assertEqual(body['reviewer_name'], 'Anonim taqrizchi')
        self.assertNotIn('comments_to_editor', body)
        doc = self.api(self.author).get(f'/api/v1/reviews/{self.review.id}/review-document/')
        self.assertEqual(doc.status_code, 200)
        self.assertIn('Anonim taqrizchi', doc.content.decode('utf-8'))

    def test_only_admin_assigns_reviewer(self):
        a2 = Article.objects.create(title='Ikkinchi', abstract='a', author=self.author, journal=self.journal)
        payload = {'article': str(a2.id), 'reviewer': str(self.reviewer.id)}
        self.assertEqual(self.api(self.author).post('/api/v1/reviews/', payload, format='json').status_code, 403)
        self.assertEqual(self.api(self.jadmin2).post('/api/v1/reviews/', payload, format='json').status_code, 403)
        self.assertEqual(self.api(self.jadmin).post('/api/v1/reviews/', payload, format='json').status_code, 201)

    def test_reviewer_accept_and_submit(self):
        r = PeerReview.objects.create(article=self.article, reviewer=self.reviewer, status='pending')
        self.assertEqual(self.api(self.reviewer).post(f'/api/v1/reviews/{r.id}/accept_review/').status_code, 200)
        res = self.api(self.reviewer).post(f'/api/v1/reviews/{r.id}/submit_review/', {
            'review_content': 'Matn', 'recommendation': 'minor_revision', 'originality_score': 'abc',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)


class UdkPdfTests(Fixture):
    def test_completing_udk_request_generates_pdf(self):
        req = UdkRequest.objects.create(
            user=self.author, author_first_name='Ali', author_last_name='Valiyev', title='Mavzu', status='submitted',
        )
        res = self.api(self.reviewer).patch(f'/api/v1/udc/requests/{req.id}/complete/', {
            'udk_code': '330.1', 'udk_description': 'Iqtisodiyot nazariyasi',
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        cert = UDKCertificate.objects.get(pk=res.json()['certificate_id'])
        self.assertTrue(cert.certificate_path.name.endswith('.pdf'))


class VerifyEndpointTests(Fixture):
    def test_antiplagiat_certificate(self):
        art = Article.objects.create(
            title='t', abstract='a', author=self.author, journal=self.journal, status='Accepted',
            plagiarism_checked_at=timezone.now(), plagiarism_percentage=12.5, originality_percentage=80,
            plagiarism_report={'certificate_number': '4829173650', 'document_name': 'Dissertatsiya'},
        )
        res = self.api().get('/api/v1/articles/verify/4829173650/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['title'], 'Dissertatsiya')
        self.assertEqual(self.api().get('/api/v1/articles/verify/1111111111/').status_code, 404)
        self.assertTrue(art.pk)

    def test_acceptance_and_udk_codes(self):
        art = Article.objects.create(title='Qabul', abstract='a', author=self.author, journal=self.journal, status='Accepted')
        code = 'QBL-' + str(art.id).replace('-', '')[:8].upper()
        self.assertEqual(self.api().get(f'/api/v1/articles/verify/{code}/').status_code, 200)
        cert = UDKCertificate.objects.create(user=self.author, title='U', udk_code='1')
        self.assertEqual(self.api().get(f'/api/v1/articles/verify/UDK-{cert.id:06d}/').status_code, 200)
        self.assertEqual(self.api().get('/api/v1/articles/verify/random-text/').status_code, 404)


class CeleryFallbackTests(Fixture):
    @override_settings(ANTIPLAG_USE_CELERY=True)
    def test_no_worker_means_thread_fallback(self):
        from apps.articles import tasks

        with mock.patch.object(tasks, 'celery_workers_available', return_value=False), \
                mock.patch.object(tasks.run_plagiarism_check_task, 'delay') as delay:
            self.assertFalse(tasks.enqueue_plagiarism_check('a', 'b'))
            delay.assert_not_called()

    def test_stale_processing_detected(self):
        from apps.articles.plagiarism_check_service import get_plagiarism_check_status

        old = (timezone.now() - timedelta(hours=2)).isoformat()
        art = Article.objects.create(
            title='t', abstract='a', author=self.author, journal=self.journal,
            plagiarism_report={'check_status': 'processing', 'check_updated_at': old},
        )
        self.assertEqual(get_plagiarism_check_status(art)['status'], 'stalled')
        art.plagiarism_report = {'check_status': 'processing', 'check_updated_at': timezone.now().isoformat()}
        self.assertEqual(get_plagiarism_check_status(art)['status'], 'processing')


class LastLoginTests(TestCase):
    def test_save_does_not_touch_last_login(self):
        u = _user('998910000099')
        self.assertIsNone(User.objects.get(pk=u.pk).last_login)
        u.first_name = 'Yangi'
        u.save()
        self.assertIsNone(User.objects.get(pk=u.pk).last_login)
