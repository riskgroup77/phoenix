"""
Platformani namuna (demo) ma'lumotlar bilan to'ldirish — barcha rollar uchun "jonli" ko'rinish.

    python manage.py seed_demo_data            # eski demo ma'lumotni o'chirib, qaytadan to'ldiradi
    python manage.py seed_demo_data --purge    # faqat o'chirish (demo login hisoblari qoladi)

Yaratiladi: 5 jurnal (har birida 3 son), 70 maqola (barcha holatlarda, nashr etilganlari PDF bilan),
haqiqiy antiplagiat hisobotlari, taqrizlar, to'lovlar, UDK / DOI / tarjima / namuna so'rovlari,
operator chatlari, bildirishnomalar, muallif nashrlari — sanalar oxirgi 12 oyga taqsimlangan.

Barcha yozuvlar demo foydalanuvchilarga (@demo.ilmiyfaoliyat.uz) bog'lanadi (config/demo.py):
Google Scholar / sitemap'ga chiqmaydi, antiplagiat manbasi bo'lmaydi, tushum hisobotiga qo'shilmaydi,
haqiqiy mualliflar demo jurnallarga maqola yubora olmaydi. To'ldirish paytida xodimlarga
Telegram/xabar yuborilmaydi.
"""
from __future__ import annotations

import io
import random
from datetime import timedelta
from decimal import Decimal

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.analytics import demo_content as C
from config.demo import DEMO_EMAIL_DOMAIN, demo_q, seeding

SEED_PHONE_PREFIX = '998000'  # seed foydalanuvchilari: 998000xxxxxx (haqiqiy operator kodi emas)
LOGIN_PHONES = {
    'author': '998911111111', 'reviewer': '998922222222', 'journal_admin': '998933333333', 'operator': '998955555555',
}


def _email(slug: str) -> str:
    return f'{slug}@{DEMO_EMAIL_DOMAIN}'


def _short(text: str, limit: int = 70) -> str:
    """So'z chegarasida qisqartirish."""
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(' ', 1)[0] + '…'


def _delete_file(field) -> None:
    """Faylni va (tasodifiy nomli) bo'sh qolgan papkasini o'chirish."""
    import os

    if not field:
        return
    try:
        path = field.path
    except Exception:
        path = None
    field.delete(save=False)
    if path:
        try:
            os.rmdir(os.path.dirname(path))
        except OSError:
            pass


class Command(BaseCommand):
    help = "Platformani barcha rollar uchun namuna (demo) ma'lumotlar bilan to'ldiradi (--purge — o'chiradi)."

    def add_arguments(self, parser):
        parser.add_argument('--purge', action='store_true', help="Faqat demo ma'lumotlarni o'chirish")
        parser.add_argument('--seed', type=int, default=2026, help='Tasodifiylik urug\'i (bir xil natija uchun)')
        parser.add_argument(
            '--logins', action='store_true',
            help='--purge bilan: demo login hisoblarini (911111111/muallif ...) ham o\'chirish (ishga tushirishdan oldin)',
        )

    def handle(self, *args, **opts):
        from django.conf import settings
        from django.core.management.base import CommandError

        if not opts['purge'] and not settings.DEBUG and not getattr(settings, 'PHONIX_DEMO_ENABLED', True):
            raise CommandError('PHONIX_DEMO_ENABLED=false — demo ma\'lumot yaratish o\'chirilgan.')
        with seeding():
            removed = self.purge()
            self.stdout.write(f"O'chirildi: {removed}")
            if opts['purge']:
                if opts['logins']:
                    self.stdout.write(f"Demo login hisoblari o'chirildi: {self.purge_logins()}")
                    if getattr(settings, 'PHONIX_DEMO_ENABLED', True):
                        self.stdout.write(self.style.WARNING(
                            'Keyingi deploy ularni qayta yaratmasligi uchun backend/.env ga PHONIX_DEMO_ENABLED=false yozing.'
                        ))
                return
            call_command('setup_demo_and_admin', stdout=io.StringIO())
            self.rng = random.Random(opts['seed'])
            self.now = timezone.now()
            with transaction.atomic():
                stats = self.seed()
        self.stdout.write(self.style.SUCCESS('Demo ma\'lumotlar yaratildi:'))
        for k, v in stats.items():
            if not k.startswith('  '):
                self.stdout.write(f'   {k:<28} {v}')
            if k == 'maqolalar':
                for sk, sv in stats.items():
                    if sk.startswith('  '):
                        self.stdout.write(f'   {sk:<28} {sv}')
        self.stdout.write('\nKirish: 911111111/muallif, 922222222/taqrizchi, 933333333/muharrir, 955555555/operator')

    # ------------------------------------------------------------------ o'chirish

    def purge(self) -> dict:
        from apps.articles.models import Article, ArticleSampleRequest, DoiRequest
        from apps.journals.models import AuthorPublication, Journal, JournalCategory, ScientificField
        from apps.notifications.models import Notification
        from apps.payments.models import Transaction
        from apps.reviews.models import PeerReview
        from apps.translations.models import TranslationRequest
        from apps.udc.models import UDKCertificate, UdkRequest
        from apps.users.models import User

        out = {}
        with transaction.atomic():
            arts = Article.objects.filter(demo_q('author__') | demo_q('journal__journal_admin__'))
            for a in arts.exclude(final_pdf_path='').exclude(final_pdf_path__isnull=True):
                _delete_file(a.final_pdf_path)
            out['maqolalar'] = arts.count()
            arts.delete()
            for obj in DoiRequest.objects.filter(demo_q('user__')):
                _delete_file(obj.file)
            for tr in TranslationRequest.objects.filter(demo_q('author__')):
                _delete_file(tr.source_file_path)
                _delete_file(tr.translated_file_path)
            simple = [
                ('to\'lovlar', Transaction, 'user__'), ('UDK so\'rovlari', UdkRequest, 'user__'),
                ('UDK ma\'lumotnomalar', UDKCertificate, 'user__'), ('DOI so\'rovlari', DoiRequest, 'user__'),
                ('tarjimalar', TranslationRequest, 'author__'), ('namuna so\'rovlari', ArticleSampleRequest, 'user__'),
                ('bildirishnomalar', Notification, 'user__'), ('nashrlar', AuthorPublication, 'author__'),
                ('taqrizlar', PeerReview, 'reviewer__'),
            ]
            for label, model, path in simple:
                qs = model.objects.filter(demo_q(path))
                out[label] = qs.count()
                qs.delete()
            journals = Journal.objects.filter(demo_q('journal_admin__'))
            out['jurnallar'] = journals.count()
            journals.delete()
            seeded_users = User.objects.filter(demo_q(), phone__startswith=SEED_PHONE_PREFIX)
            out['seed foydalanuvchilar'] = seeded_users.count()
            seeded_users.delete()
            # Seed yaratgan va endi bo'sh qolgan kategoriya / soha (haqiqiy jurnallari borlariga tegilmaydi)
            names = {j['category'] for j in C.JOURNALS}
            JournalCategory.objects.filter(name__in=names, journals__isnull=True, conference__isnull=True).delete()
            ScientificField.objects.filter(
                name__in=names, authorpublication__isnull=True, conference__isnull=True,
            ).delete()
        return {k: v for k, v in out.items() if v}

    def purge_logins(self) -> int:
        """Demo login hisoblari (faqat @demo... email bilan belgilanganlari) va ularning qolgan yozuvlari."""
        from apps.users.models import User

        qs = User.objects.filter(demo_q())
        n = qs.count()
        with transaction.atomic():
            qs.delete()
        return n

    # ------------------------------------------------------------------ yordamchilar

    def ago(self, days: float, hours: float = 0):
        return self.now - timedelta(days=days, hours=hours)

    def past(self, when):
        """Kelajakdagi sanani hozirgidan biroz oldinga keltirish."""
        limit = self.now - timedelta(hours=self.rng.uniform(1, 10))
        return min(when, limit)

    @staticmethod
    def backdate(obj, **fields):
        type(obj).objects.filter(pk=obj.pk).update(**fields)
        for k, v in fields.items():
            setattr(obj, k, v)

    def user(self, phone: str, slug: str, first: str, last: str, role: str, affiliation: str, **extra):
        from apps.users.models import User

        return User.objects.create_user(
            phone=phone, password=None, email=_email(slug), first_name=first, last_name=last,
            role=role, affiliation=affiliation, **extra,
        )

    def tx(self, user, service_type: str, amount, *, status='completed', when=None, article=None,
           translation_request=None, extra=None):
        from apps.payments.models import Transaction

        when = when or self.ago(self.rng.randint(1, 300))
        t = Transaction.objects.create(
            user=user, article=article, translation_request=translation_request, amount=Decimal(str(amount)),
            service_type=service_type, status=status, payment_provider='demo',
            merchant_trans_id=f'DEMO-{self.rng.randint(10**7, 10**8 - 1)}', extra_data=extra or {'demo': True},
            completed_at=when + timedelta(minutes=3) if status == 'completed' else None,
            error_note='Karta balansida mablag\' yetarli emas' if status == 'failed' else '',
        )
        self.backdate(t, created_at=when)
        self.stats['to\'lovlar'] += 1
        return t

    def notify(self, user, title, message, ntype='system', link='', read=None, days=None):
        from apps.notifications.models import Notification

        n = Notification.objects.create(
            user=user, title=title, message=message, notification_type=ntype, link=link,
            read=self.rng.random() < 0.5 if read is None else read,
        )
        self.backdate(n, created_at=self.ago(days if days is not None else self.rng.uniform(0, 40)))
        self.stats['bildirishnomalar'] += 1

    # ------------------------------------------------------------------ to'ldirish

    def seed(self) -> dict:
        from collections import Counter

        from apps.users.models import User

        from django.core.management.base import CommandError

        from config.demo import is_demo_user

        self.stats = Counter()
        login = {role: User.objects.filter(phone=phone).first() for role, phone in LOGIN_PHONES.items()}
        # Raqam haqiqiy foydalanuvchiga tegishli bo'lsa — demo ma'lumot unga bog'lanib qolmasin
        bad = [phone for role, phone in LOGIN_PHONES.items() if not is_demo_user(login[role])]
        if bad:
            raise CommandError(
                'Quyidagi demo raqamlar haqiqiy foydalanuvchilarga tegishli yoki demo hisob emas: '
                + ', '.join(bad) + '. Namuna ma\'lumotlar yaratilmadi.'
            )
        self.login = login

        # --- foydalanuvchilar
        authors = [login['author']]
        for i, (first, last, patr, aff) in enumerate(C.AUTHORS, 1):
            u = self.user(f'{SEED_PHONE_PREFIX}001{i:03d}', f'author{i}', first, last, 'author', aff,
                          patronymic=patr, gamification_points=self.rng.randint(40, 900))
            authors.append(u)
        reviewers = [login['reviewer']]
        for i, (first, last, degree, specs) in enumerate(C.REVIEWERS, 1):
            reviewers.append(self.user(
                f'{SEED_PHONE_PREFIX}002{i:03d}', f'reviewer{i}', first, last, 'reviewer', degree,
                specializations=specs, reviews_completed=self.rng.randint(8, 60),
                average_review_time=round(self.rng.uniform(4, 12), 1), acceptance_rate=round(self.rng.uniform(55, 85), 1),
            ))
        login['reviewer'].specializations = ['Iqtisodiyot', 'Pedagogika', 'Axborot texnologiyalari']
        login['reviewer'].reviews_completed = 24
        login['reviewer'].average_review_time = 6.5
        login['reviewer'].acceptance_rate = 71.0
        login['reviewer'].save()
        jadmins = [
            self.user(f'{SEED_PHONE_PREFIX}003{i:03d}', f'editor{i}', first, last, 'journal_admin', title)
            for i, (first, last, title) in enumerate(C.JOURNAL_ADMINS, 1)
        ]
        self.stats['foydalanuvchilar'] = len(authors) + len(reviewers) + len(jadmins)

        # --- jurnallar, sonlar, maqolalar
        all_articles = []
        for jspec in C.JOURNALS:
            journal, issues = self.make_journal(jspec, login['journal_admin'] if jspec['admin'] == 'login'
                                                else jadmins[jspec['admin']])
            for idx, title in enumerate(jspec['titles']):
                status = C.STATUS_PLAN[idx]
                # Muallif demo hisobi har jurnalda 2 ta maqolaga ega (turli holatlarda)
                author = login['author'] if idx in (0, 8) or (jspec['key'] == 'econ' and idx in (11, 13)) \
                    else authors[1 + (idx + len(all_articles)) % (len(authors) - 1)]
                art = self.make_article(jspec, journal, issues, title, status, author, reviewers, idx)
                all_articles.append(art)

        self.make_services(authors, reviewers)
        self.make_operator_chats(all_articles)
        self.make_notifications(all_articles)
        self.make_publications(authors)
        return dict(self.stats)

    def make_journal(self, spec, admin):
        from apps.journals.models import Issue, Journal, JournalCategory

        cat, _ = JournalCategory.objects.get_or_create(
            name=spec['category'], defaults={'description': f"{spec['category']} sohasidagi ilmiy nashrlar"},
        )
        journal = Journal.objects.create(
            name=spec['name'], issn=spec['issn'], journal_admin=admin, category=cat,
            description=(f"{spec['category']} sohasidagi nazariy va amaliy tadqiqotlar. "
                         "Namuna (demo) jurnal — platforma imkoniyatlarini ko'rsatish uchun."),
            rules="Maqola hajmi 6–15 bet, Times New Roman 14, annotatsiya va kalit so'zlar uch tilda.",
            publication_fee=Decimal(spec['fee']), pricing_type='fixed', payment_model='pre-payment',
            plagiarism_max_percent=25, originality_min_percent=75,
        )
        issues = []
        for n, days in ((1, 250), (2, 160), (3, 70)):
            issue = Issue.objects.create(journal=journal, issue_number=f'2026/{n}',
                                         publication_date=(self.now - timedelta(days=days)).date())
            issues.append(issue)
        self.stats['jurnallar'] += 1
        self.stats['jurnal sonlari'] += len(issues)
        return journal, issues

    def abstract(self, spec, title):
        r = self.rng
        return (
            f"Ushbu maqolada «{title}» mavzusi {r.choice(spec['context'])} tahlil qilingan. "
            f"Tadqiqotda {r.choice(spec['method'])} usuli qo'llanilib, {r.choice(spec['object'])} misolida "
            f"ma'lumotlar o'rganildi. Olingan natijalar {r.choice(spec['result'])} ko'rsatdi. "
            f"Muallif {r.choice(spec['proposal'])} bo'yicha amaliy tavsiyalar ishlab chiqqan."
        )

    def make_article(self, spec, journal, issues, title, status, author, reviewers, idx):
        from apps.articles.models import ActivityLog, Article, ArticleStatusEvent

        r = self.rng
        chain = C.STATUS_CHAINS[status]
        # Nashr etilganlar eskiroq, yangi yuborilganlar yaqinda
        # Real oqim: nashr etilganlar eski, ko'rib chiqilayotganlar yaqinda yuborilgan (muddatlar "yashil" ko'rinsin)
        start_days = {
            'Published': r.randint(90, 330), 'NashrgaYuborilgan': r.randint(25, 45), 'Accepted': r.randint(15, 30),
            'Rejected': r.randint(15, 60), 'Revision': r.randint(10, 25), 'QabulQilingan': r.uniform(2, 6),
            'WithEditor': r.uniform(1, 3), 'Yangi': r.uniform(0.2, 1.5), 'Draft': r.uniform(0.5, 5),
        }[status]
        submitted = self.ago(start_days, r.uniform(0, 12))
        keywords = r.sample(spec['keywords'], 4)
        abstract = self.abstract(spec, title)
        art = Article.objects.create(
            title=title, abstract=abstract, keywords=keywords, status=status, author=author, journal=journal,
            page_count=r.randint(6, 14), submitted_author_name=author.get_full_name(),
            udk_code=spec['udk'][0], udk_description=spec['udk'][1], fast_track=(idx == 7),
        )
        self.stats['maqolalar'] += 1
        self.stats[f'  — {status}'] += 1

        # Holat tarixi (o'tgan sanalar bilan)
        # Holatlar orasidagi kunlar: yuborilgandan hozirgacha bo'lgan oraliqqa sig'diriladi (kelajak sana bo'lmasin)
        gaps = [r.uniform(2, 9) if st != 'Accepted' else r.uniform(15, 25) for st in chain[:-1]]
        span = (self.now - submitted).total_seconds() / 86400 * 0.85
        scale = min(1.0, span / sum(gaps)) if gaps else 1.0
        gaps = [g * scale for g in gaps] + [0]
        when = submitted
        prev = ''
        admin = journal.journal_admin
        for st, gap in zip(chain, gaps):
            actor = author if st in ('Draft', 'Yangi') else admin
            ev = ArticleStatusEvent.objects.create(
                article=art, from_status=prev, to_status=st, actor=actor, actor_role=actor.role,
                note=C.STATUS_NOTES.get(st, ''),
            )
            self.backdate(ev, created_at=when)
            log = ActivityLog.objects.create(article=art, user=actor, action=f'Holat: {st}',
                                             details=C.STATUS_NOTES.get(st, ''))
            self.backdate(log, timestamp=when)
            prev = st
            when = when + timedelta(days=gap)
        self.backdate(art, submission_date=submitted)

        # Antiplagiat (haqiqiy dvigatel, ichki manbalarsiz) — qoralamadan boshqa hammasi
        if status != 'Draft':
            self.plagiarism(art, author, submitted + timedelta(hours=r.uniform(1, 30)))

        # Taqrizlar: QabulQilingan bosqichidan boshlab
        if status in ('QabulQilingan', 'Revision', 'Accepted', 'NashrgaYuborilgan', 'Published', 'Rejected'):
            self.reviews(art, status, reviewers, submitted)

        # To'lov (oldindan to'lov modeli): yuborishdan oldin; qoralama — to'lov kutilmoqda
        paid_at = submitted - timedelta(minutes=r.randint(5, 50))
        if status == 'Draft':
            self.tx(author, 'publication_fee', journal.publication_fee, when=submitted, article=art, status='pending')
        else:
            self.tx(author, 'publication_fee', journal.publication_fee, when=paid_at, article=art)
            if art.fast_track:
                self.tx(author, 'fast-track', 150000, when=paid_at, article=art)

        if status == 'Published':
            issue = issues[min(2, int((330 - start_days) / 110))] if start_days <= 330 else issues[0]
            Article.objects.filter(pk=art.pk).update(
                issue=issue, published_by=admin,
                views_count=r.randint(60, 1400), downloads_count=r.randint(10, 320), citations_count=r.randint(0, 14),
            )
            art.issue = issue
            self.attach_pdf(art, spec, journal, issue)
        return art

    def plagiarism(self, art, author, when):
        from apps.articles.antiplagiat_engine import get_antiplagiat_engine
        from apps.articles.models import Article
        from apps.articles.plagiarism_check_service import _new_certificate_number

        text = f'{art.title}\n{art.abstract}'
        res = get_antiplagiat_engine().check_text(
            text, enabled_modules=['shablon_iboralar', 'iqtibos_keltirish'],
        )
        report = dict(res['report'])
        report.update({
            'check_status': 'completed', 'progress_percent': 100, 'check_phase': 'done', 'archive_ready': True,
            'certificate_number': _new_certificate_number(), 'check_completed_at': when.isoformat(),
            'document_name': f'{art.title[:60]}.docx', 'author_first_name': author.first_name,
            'author_last_name': author.last_name, 'demo': True,
        })
        Article.objects.filter(pk=art.pk).update(
            plagiarism_percentage=res['plagiarism_percentage'], ai_content_percentage=res['ai_content_percentage'],
            originality_percentage=res['originality'], plagiarism_checked_at=when, plagiarism_report=report,
        )
        self.stats['antiplagiat hisobotlari'] += 1

    def reviews(self, art, status, reviewers, submitted):
        from apps.reviews.models import PeerReview

        r = self.rng
        # Taqrizchi demo hisobiga ko'proq ish tushsin (paneli bo'sh turmasin)
        reviewer = self.login['reviewer'] if r.random() < 0.45 else r.choice(reviewers[1:])
        assigned = self.past(submitted + timedelta(days=r.uniform(0.5, 3)))
        rec = {'Revision': 'major_revision', 'Rejected': 'reject'}.get(status, r.choice(['accept', 'minor_revision']))
        if status == 'QabulQilingan':
            state = r.choice(['pending', 'accepted', 'in_progress'])
            pr = PeerReview.objects.create(
                article=art, reviewer=reviewer, status=state,
                # Odatda 14 kun; bittasi kechikkan, bittasi 24 soatda tugaydi — panel real ko'rinsin
                deadline=self.review_deadline(assigned),
            )
        else:
            scores = [r.randint(5, 10) for _ in range(5)] if rec != 'reject' else [r.randint(2, 5) for _ in range(5)]
            pr = PeerReview.objects.create(
                article=art, reviewer=reviewer, status='completed', recommendation=rec,
                rating=round(sum(scores) / 10), originality_score=scores[0], methodology_score=scores[1],
                clarity_score=scores[2], significance_score=scores[3], references_score=scores[4],
                strengths=' '.join(r.sample(C.STRENGTHS, 2)), weaknesses=' '.join(r.sample(C.WEAKNESSES, 2)),
                comments_to_author=C.COMMENTS_TO_AUTHOR[rec],
                comments_to_editor='Maqola taqrizdan o\'tdi, xulosam yuqorida keltirilgan.',
                review_content=C.COMMENTS_TO_AUTHOR[rec],
                deadline=assigned + timedelta(days=14), completed_at=self.past(assigned + timedelta(days=r.uniform(3, 11))),
            )
        self.backdate(pr, assigned_at=assigned)
        self.stats['taqrizlar'] += 1

    def review_deadline(self, assigned):
        self.open_reviews = getattr(self, 'open_reviews', 0) + 1
        if self.open_reviews == 2:
            return self.now - timedelta(days=1, hours=5)
        if self.open_reviews == 4:
            return self.now + timedelta(hours=20)
        return assigned + timedelta(days=14)

    def recent_or_old(self, open_state: bool, overdue: bool = False):
        """Ochiq so'rov — yaqinda (SLA ichida); yakunlangan — eskiroq; overdue=True — bitta kechikkan namuna."""
        if overdue:
            return self.ago(self.rng.uniform(4, 6))
        return self.ago(self.rng.uniform(0.1, 1.2)) if open_state else self.ago(self.rng.uniform(5, 80))

    def attach_pdf(self, art, spec, journal, issue):
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.utils import simpleSplit
        from reportlab.pdfgen import canvas

        from config.pdf_fonts import pdf_text, register_fonts

        regular, bold = register_fonts()
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        w, h = A4
        y = h - 60

        def lines(text, font, size, width=w - 120):
            return simpleSplit(pdf_text(text), font, size, width)

        c.setFont(regular, 9)
        c.drawString(60, y, pdf_text(f"{journal.name} · ISSN {journal.issn} · {issue.issue_number}"))
        y -= 34
        for ln in lines(art.title, bold, 15):
            c.setFont(bold, 15)
            c.drawString(60, y, ln)
            y -= 20
        c.setFont(regular, 11)
        y -= 4
        c.drawString(60, y, pdf_text(art.author.get_full_name()))
        y -= 14
        c.setFont(regular, 9)
        c.drawString(60, y, pdf_text(art.author.affiliation))
        y -= 28
        sections = [
            ('Annotatsiya', art.abstract),
            ("Kalit so'zlar", ', '.join(art.keywords)),
            ('Kirish', f"{spec['category']} sohasida «{art.title}» masalasi dolzarb bo'lib, "
                       f"{self.rng.choice(spec['context'])} uni chuqur o'rganish zarurati mavjud."),
            ('Natijalar', f"Tadqiqot natijalari {self.rng.choice(spec['result'])} ko'rsatdi."),
            ('Xulosa', f"Olingan natijalar asosida {self.rng.choice(spec['proposal'])} tavsiya etiladi."),
        ]
        for head, body in sections:
            c.setFont(bold, 11)
            c.drawString(60, y, pdf_text(head))
            y -= 16
            c.setFont(regular, 10.5)
            for ln in lines(body, regular, 10.5):
                c.drawString(60, y, ln)
                y -= 14
            y -= 10
        c.setFont(regular, 8)
        c.drawString(60, 40, pdf_text("Namuna (demo) maqola — ilmiyfaoliyat.uz platformasi imkoniyatlarini ko'rsatish uchun."))
        c.showPage()
        c.save()
        art.final_pdf_path.save(f'demo-{str(art.pk)[:8]}.pdf', ContentFile(buf.getvalue()), save=False)
        type(art).objects.filter(pk=art.pk).update(final_pdf_path=art.final_pdf_path.name)
        self.stats['PDF fayllar'] += 1

    def make_services(self, authors, reviewers):
        from apps.articles.models import ArticleSampleRequest, DoiRequest
        from apps.translations.models import TranslationRequest
        from apps.udc.models import UdkRequest
        from apps.udc.services import get_service_amount

        r = self.rng
        udk_price = get_service_amount('udk_request', 50000) or 50000
        doi_price = get_service_amount('doi_request', 100000) or 100000

        # UDK so'rovlari
        udk_states = ['completed', 'completed', 'completed', 'submitted', 'submitted', 'submitted', 'pending_payment',
                      'rejected']
        for i, ((topic, code, desc), state) in enumerate(zip(C.UDK_TOPICS, udk_states)):
            user = authors[0] if i in (0, 3, 6) else authors[1 + i]
            when = self.recent_or_old(state in ('submitted', 'pending_payment'), overdue=(i == 5))
            tx = None if state == 'pending_payment' else self.tx(user, 'udk_request', udk_price, when=when)
            req = UdkRequest.objects.create(
                user=user, transaction=tx, author_first_name=user.first_name, author_last_name=user.last_name,
                title=topic, abstract=f"«{topic}» mavzusidagi ilmiy ish uchun UDK raqami so'ralmoqda.",
                status=state, udk_code=code if state == 'completed' else '',
                udk_description=desc if state == 'completed' else '',
                reject_reason='Ish mavzusi va annotatsiyasi to\'liq emas.' if state == 'rejected' else '',
                completed_at=when + timedelta(days=2) if state == 'completed' else None,
            )
            self.backdate(req, created_at=when)
            self.stats['UDK so\'rovlari'] += 1

        # DOI so'rovlari
        pdf_stub = b'%PDF-1.4\n% demo\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'
        for i, state in enumerate(['completed', 'completed', 'submitted', 'submitted', 'pending_payment']):
            user = authors[0] if i in (0, 2) else authors[2 + i]
            when = self.recent_or_old(state != 'completed')
            tx = None if state == 'pending_payment' else self.tx(user, 'doi_request', doi_price, when=when)
            req = DoiRequest(
                user=user, transaction=tx, author_first_name=user.first_name, author_last_name=user.last_name,
                status=state, doi_link=f'https://doi.org/10.0000/demo.{2026}.{i + 1:03d}' if state == 'completed' else '',
                completed_at=when + timedelta(days=3) if state == 'completed' else None,
            )
            req.file.save(f'demo-doi-{i + 1}.pdf', ContentFile(pdf_stub), save=False)
            req.save()
            self.backdate(req, created_at=when)
            self.stats['DOI so\'rovlari'] += 1

        # Tarjimalar
        for i, ((title, src, dst, words), state) in enumerate(zip(
                C.TRANSLATIONS, ['Bajarildi', 'Bajarildi', 'Jarayonda', 'Jarayonda', 'Yangi', 'Yangi'])):
            user = authors[0] if i in (0, 2, 4) else authors[3 + i]
            when = self.recent_or_old(state != 'Bajarildi')
            cost = Decimal(words * 120)
            tr = TranslationRequest(
                author=user, reviewer=None if state == 'Yangi' else r.choice(reviewers), title=title,
                source_language=src, target_language=dst, status=state, word_count=words, cost=cost,
                completion_date=when + timedelta(days=4) if state == 'Bajarildi' else None,
            )
            tr.source_file_path.save(f'demo-manba-{i + 1}.txt', ContentFile(f'{title}\n(namuna matn)'.encode()), save=False)
            if state == 'Bajarildi':
                tr.translated_file_path.save(f'demo-tarjima-{i + 1}.txt',
                                             ContentFile(f'{title}\n(tarjima qilingan namuna matn)'.encode()), save=False)
            tr.save()
            self.backdate(tr, submission_date=when)
            if state != 'Yangi':
                self.tx(user, 'translation', cost, when=when, translation_request=tr)
            self.stats['tarjima so\'rovlari'] += 1

        # Maqola namunasi so'rovlari
        prices = {'quyi': 25000, 'orta': 45000, 'yuqori': 75000}
        for i, ((topic, quality, pages), state) in enumerate(zip(
                C.SAMPLE_REQUESTS, ['completed', 'in_progress', 'submitted', 'submitted'])):
            user = authors[0] if i == 1 else authors[5 + i]
            when = self.recent_or_old(state != 'completed')
            amount = prices[quality] * pages
            tx = self.tx(user, 'article_sample', amount, when=when)
            req = ArticleSampleRequest.objects.create(
                user=user, transaction=tx, topic=topic, quality_level=quality, pages=pages, amount=amount,
                requirements=f"«{topic}» mavzusida {pages} betlik maqola namunasi, adabiyotlar ro'yxati bilan.",
                author_first_name=user.first_name, author_last_name=user.last_name, status=state,
            )
            self.backdate(req, created_at=when)
            self.stats['namuna so\'rovlari'] += 1

        # Kitob nashri, muvaffaqiyatsiz va bekor qilingan to'lovlar (hisobotlar to'liq ko'rinsin)
        self.tx(authors[0], 'book_publication', 2450000, when=self.ago(45),
                extra={'demo': True, 'title': 'Raqamli iqtisodiyot asoslari (o\'quv qo\'llanma)', 'pages': 180, 'copies': 100})
        self.tx(authors[4], 'book_publication', 1380000, status='pending', when=self.ago(3),
                extra={'demo': True, 'title': 'Pedagogik texnologiyalar', 'pages': 120, 'copies': 50})
        for k in range(4):
            self.tx(r.choice(authors), 'publication_fee', 350000, status=r.choice(['failed', 'cancelled']),
                    when=self.ago(r.randint(5, 200)))

    def make_operator_chats(self, articles):
        from apps.articles.models import ArticleOperatorMessage

        op = self.login['operator']
        candidates = [a for a in articles if a.status in ('Yangi', 'WithEditor', 'Accepted', 'Published')]
        for (question, answer), art in zip(C.OPERATOR_THREADS, self.rng.sample(candidates, len(C.OPERATOR_THREADS))):
            when = self.ago(self.rng.uniform(1, 30))
            m1 = ArticleOperatorMessage.objects.create(article=art, sender=art.author, body=question)
            m2 = ArticleOperatorMessage.objects.create(article=art, sender=op, body=answer)
            self.backdate(m1, created_at=when)
            self.backdate(m2, created_at=when + timedelta(minutes=self.rng.randint(5, 90)))
            self.stats['operator chati xabarlari'] += 2

    def make_notifications(self, articles):
        author, reviewer = self.login['author'], self.login['reviewer']
        jadmin, op = self.login['journal_admin'], self.login['operator']
        mine = [a for a in articles if a.author_id == author.id]
        for a in mine:
            label = dict(a._meta.get_field('status').choices).get(a.status, a.status)
            self.notify(author, 'Maqola holati o\'zgardi', f"«{_short(a.title)}» — yangi holat: {label}.",
                        'status_change', f'/articles/{a.pk}')
        self.notify(author, 'To\'lov qabul qilindi', 'Nashr to\'lovi muvaffaqiyatli amalga oshirildi.', 'payment',
                    '/payments', read=True, days=20)
        self.notify(author, 'Antiplagiat tekshiruvi yakunlandi', 'Maqolangiz originalligi 90% dan yuqori.',
                    'plagiarism', read=False, days=0.2)
        for a in [a for a in articles if a.peer_reviews.filter(reviewer=reviewer).exists()][:6]:
            self.notify(reviewer, 'Yangi taqriz topshirig\'i', f"«{_short(a.title)}» maqolasi sizga taqriz uchun yuborildi.",
                        'review_assigned', '/reviews')
        self.notify(reviewer, 'Taqriz muddati yaqinlashmoqda', 'Bitta taqrizning muddati 2 kundan keyin tugaydi.',
                    'review_assigned', '/reviews', read=False, days=0.5)
        for a in [a for a in articles if a.journal.journal_admin_id == jadmin.id and a.status in ('Yangi', 'WithEditor')]:
            self.notify(jadmin, 'Yangi maqola', f"«{_short(a.title)}» jurnalingizga yuborildi.", 'article',
                        f'/articles/{a.pk}')
        for text in ('Muallif maqola holati haqida savol yubordi.', 'To\'lov bo\'yicha murojaat keldi.'):
            self.notify(op, 'Yangi murojaat', text, 'system', '/articles', read=False)
        self.notify(op, 'Kunlik hisobot', 'Bugun 12 ta murojaat ko\'rib chiqildi.', 'system', read=True, days=1)

    def make_publications(self, authors):
        from apps.journals.models import AuthorPublication, Journal, ScientificField

        journals = list(Journal.objects.filter(demo_q('journal_admin__')))
        for i, author in enumerate(authors[:7]):
            for k in range(5 if i == 0 else 2):
                j = journals[(i + k) % len(journals)]
                field, _ = ScientificField.objects.get_or_create(name=j.category.name)
                AuthorPublication.objects.create(
                    author=author, title=self.rng.choice(C.JOURNALS[(i + k) % len(C.JOURNALS)]['titles']),
                    publication_type=C.PUBLICATION_TYPES[(i + k) % len(C.PUBLICATION_TYPES)], journal=j,
                    scientific_field=field, publication_date=(self.now - timedelta(days=60 + 90 * k)).date(),
                    pages=f'{10 + 7 * k}-{16 + 7 * k}', is_verified=k % 2 == 0,
                )
                self.stats['muallif nashrlari'] += 1
