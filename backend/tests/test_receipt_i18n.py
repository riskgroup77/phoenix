"""To'lov cheki (CHK-) foydalanuvchining interfeys tilida: uz / uz-cyrl / ru / en."""
from decimal import Decimal
from unittest import mock

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.journals.models import Journal, JournalCategory
from apps.articles.models import Article
from apps.payments.labels import service_label
from apps.payments.models import Transaction
from apps.payments.receipt_pdf import T, build_receipt_pdf
from apps.users.models import User
from config.pdf_fonts import register_fonts


def _drawn_text(tx, lang) -> tuple[bytes, str]:
    """PDF va kanvasga chizilgan barcha matn (TTF glif kodlari PDF ichida o'qilmaydi — shuning uchun ushlab olinadi)."""
    from reportlab.pdfgen.canvas import Canvas

    texts = []
    originals = {name: getattr(Canvas, name) for name in ('drawString', 'drawRightString', 'drawCentredString')}

    def spy(name):
        def wrapper(self, x, y, text, *a, **kw):
            texts.append(str(text))
            return originals[name](self, x, y, text, *a, **kw)
        return wrapper

    with mock.patch.multiple(Canvas, **{name: spy(name) for name in originals}):
        pdf = build_receipt_pdf(tx, lang)
    return pdf, '\n'.join(texts)


class ReceiptI18nTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(
            phone='998930000001', password='pass12345', email='r@t.uz',
            first_name='Ism', last_name='Familiya', affiliation='X', role='author',
        )
        jadmin = User.objects.create_user(
            phone='998930000002', password='pass12345', email='j@t.uz',
            first_name='J', last_name='Admin', affiliation='X', role='journal_admin',
        )
        cat = JournalCategory.objects.create(name='Iqtisod')
        journal = Journal.objects.create(
            name='Iqtisodiyot jurnali', issn='3333-3333', description='d', journal_admin=jadmin, category=cat,
            publication_fee=Decimal('150000'),
        )
        article = Article.objects.create(
            title='Raqamli iqtisodiyot', abstract='a', keywords=['k'], author=self.author, journal=journal, status='Yangi',
        )
        self.tx = Transaction.objects.create(
            user=self.author, article=article, amount=Decimal('150000'), service_type='publication_fee',
            status='completed', completed_at=timezone.now(), payment_provider='click', click_trans_id='777',
        )

    def test_font_supports_cyrillic(self):
        regular, bold = register_fonts()
        self.assertNotEqual(regular, 'Helvetica', 'Kirill/rus harflari uchun TTF shrift (DejaVu) kerak')

    def test_pdf_builds_for_every_language(self):
        expected = {
            'uz': ("TO'LOV CHEKI", "Maqola nashri to'lovi", "so'm"),
            'uz-cyrl': ('ТЎЛОВ ЧЕКИ', 'Мақола нашри тўлови', 'сўм'),
            'ru': ('ПЛАТЁЖНЫЙ ЧЕК', 'Оплата публикации статьи', 'Плательщик', '150 000 сум'),
            'en': ('PAYMENT RECEIPT', 'Article publication fee', 'Payer', '150 000 UZS'),
        }
        for lang, needles in expected.items():
            pdf, text = _drawn_text(self.tx, lang)
            self.assertTrue(pdf.startswith(b'%PDF'), lang)
            for needle in needles:
                self.assertIn(needle, text, f'{lang}: {needle}')
        _, en_text = _drawn_text(self.tx, 'en')
        self.assertNotIn("To'lov", en_text)

    def test_labels_translated(self):
        self.assertEqual(T.t('heading', 'ru'), 'ПЛАТЁЖНЫЙ ЧЕК')
        self.assertEqual(T.t('heading', 'en'), 'PAYMENT RECEIPT')
        self.assertEqual(T.t('heading', 'uz-cyrl'), 'ТЎЛОВ ЧЕКИ')
        self.assertEqual(service_label('publication_fee', 'ru'), 'Оплата публикации статьи')
        self.assertEqual(service_label('publication_fee', 'en'), 'Article publication fee')
        self.assertEqual(service_label('publication_fee', 'uz-cyrl'), 'Мақола нашри тўлови')
        # API/analitika uchun standart — o'zbekcha (avvalgidek)
        self.assertEqual(service_label('publication_fee'), "Maqola nashri to'lovi")

    def test_endpoint_uses_request_language(self):
        c = APIClient()
        c.force_authenticate(self.author)
        url = f'/api/v1/payments/transactions/{self.tx.id}/receipt/'
        for header in ('ru', 'en', 'uz-Cyrl'):
            res = c.get(url, HTTP_ACCEPT_LANGUAGE=header)
            self.assertEqual(res.status_code, 200, header)
            self.assertTrue(res.content.startswith(b'%PDF'), header)
        res = c.get(url + '?lang=en')
        self.assertEqual(res.status_code, 200)
