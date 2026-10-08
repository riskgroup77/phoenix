"""
Tranzaksiya summasini SERVER tomonida hisoblash.

Mijoz yuborgan `amount` ga ishonilmaydi: aks holda nashr to'lovini 1 so'mga "to'lash" mumkin edi.
Formulalar frontend bilan bir xil (utils/submitArticleUtils.ts, pages/SubmitBook.tsx) —
ulardan birini o'zgartirsangiz, ikkinchisini ham yangilang.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers

# Umumiy /payments/transactions/ endpointi orqali yaratilishi mumkin bo'lgan xizmatlar.
# udk_request, doi_request, article_sample — o'z endpointlarida server tomonidan yaratiladi.
CLIENT_CREATABLE_SERVICE_TYPES = frozenset({
    'publication_fee',
    'language_editing',
    'book_publication',
    'translation',
    'top_up',
})

TOP_UP_MIN = Decimal('1000')
TOP_UP_MAX = Decimal('10000000')

# --- Kitob nashri (frontend/pages/SubmitBook.tsx bilan bir xil) ---
BOOK_PRINTING_PER_PAGE = {
    '1-10': {'eco': 125, 'standart': 150},
    '11-100': {'eco': 100, 'standart': 125},
    '101-300': {'eco': 80, 'standart': 100},
    '301-1000': {'eco': 75, 'standart': 80},
}
BOOK_COVER_PER_BOOK = {
    '1-10': {'soft': 15000, 'hard': 20000},
    '11-100': {'soft': 10000, 'hard': 15000},
    '101-300': {'soft': 8000, 'hard': 10000},
    '301-1000': {'soft': 6000, 'hard': 8000},
}
BOOK_BINDING_PER_BOOK = {'1-10': 300, '11-100': 300, '101-300': 250, '301-1000': 200}
BOOK_ISBN_FEE = 600000
BOOK_DESIGN_FEE = 75000
BOOK_MAX_PAGES = 5000
BOOK_MAX_COPIES = 100000


def _money(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _parse_page_count(value) -> int:
    """frontend parsePageCount bilan bir xil: 1..500."""
    try:
        n = int(value)
    except (TypeError, ValueError):
        return 1
    if n < 1:
        return 1
    return min(500, n)


def publication_fee_amount(journal, page_count) -> Decimal:
    """frontend computePublicationPaymentAmount bilan bir xil."""
    if journal is None:
        return Decimal('0')
    pub_fee = Decimal(str(journal.publication_fee or 0))
    per_page = Decimal(str(journal.price_per_page or 0))
    pages = _parse_page_count(page_count)
    if journal.pricing_type == 'per_page' and per_page > 0:
        return _money(per_page * pages)
    if pub_fee > 0:
        return _money(pub_fee)
    if per_page > 0:
        return _money(per_page * pages)
    return Decimal('0')


def plagiarism_check_amount() -> Decimal:
    from apps.udc.services import get_service_amount

    return _money(get_service_amount('plagiarism_check', 30000))


def _book_tier(copies: int) -> str | None:
    if 1 <= copies <= 10:
        return '1-10'
    if 11 <= copies <= 100:
        return '11-100'
    if 101 <= copies <= 300:
        return '101-300'
    if copies >= 301:
        return '301-1000'
    return None


def book_publication_amount(extra: dict) -> Decimal:
    try:
        pages = int(extra.get('pages'))
        copies = int(extra.get('copies'))
    except (TypeError, ValueError):
        raise serializers.ValidationError({'extra_data': 'Kitob uchun sahifa va nusxa soni noto\'g\'ri.'})
    if not (1 <= pages <= BOOK_MAX_PAGES) or not (1 <= copies <= BOOK_MAX_COPIES):
        raise serializers.ValidationError({'extra_data': 'Kitob sahifa yoki nusxa soni ruxsat etilgan chegaradan tashqarida.'})
    paper = extra.get('paper_quality')
    cover = extra.get('cover_type')
    if paper not in ('eco', 'standart') or cover not in ('soft', 'hard'):
        raise serializers.ValidationError({'extra_data': 'Qog\'oz sifati yoki muqova turi noto\'g\'ri.'})
    options = extra.get('options') if isinstance(extra.get('options'), dict) else {}
    tier = _book_tier(copies)
    total = (
        pages * copies * BOOK_PRINTING_PER_PAGE[tier][paper]
        + copies * BOOK_COVER_PER_BOOK[tier][cover]
        + copies * BOOK_BINDING_PER_BOOK[tier]
        + (BOOK_ISBN_FEE if options.get('isbn') is True else 0)
        + (BOOK_DESIGN_FEE if options.get('design') is True else 0)
    )
    return _money(total)


BOOK_EXTRA_KEYS = frozenset({
    'publication_type', 'pages', 'copies', 'paper_quality', 'cover_type', 'options', 'book_title',
    'shipping_region', 'shipping_address', 'shipping_first_name', 'shipping_last_name', 'shipping_phone',
})


def _clean_book_extra(extra: dict) -> dict:
    out = {}
    for key in BOOK_EXTRA_KEYS:
        if key not in extra:
            continue
        val = extra[key]
        if key == 'options':
            val = {'isbn': val.get('isbn') is True, 'design': val.get('design') is True} if isinstance(val, dict) else {}
        elif isinstance(val, str):
            val = val.strip()[:500]
        elif not isinstance(val, (int, float, bool)) and val is not None:
            continue
        out[key] = val
    return out


def expected_amount_for_transaction(tx) -> Decimal | None:
    """Mavjud tranzaksiya uchun hozirgi server narxi (hisoblab bo'lmasa — None)."""
    st = tx.service_type
    try:
        if st == 'publication_fee' and tx.article_id:
            return publication_fee_amount(tx.article.journal, tx.article.page_count)
        if st == 'language_editing':
            return plagiarism_check_amount()
        if st == 'translation' and tx.translation_request_id:
            return _money(tx.translation_request.cost or 0)
        if st == 'book_publication':
            return book_publication_amount(tx.extra_data or {})
    except Exception:
        return None
    return None


def is_underpriced(tx) -> bool:
    """Tranzaksiya summasi hozirgi server narxidan past bo'lsa True (eski, manipulyatsiya qilingan buyurtmalar)."""
    expected = expected_amount_for_transaction(tx)
    if expected is None or expected <= 0:
        return False
    return Decimal(str(tx.amount)) < expected - Decimal('0.01')


def resolve_transaction_price(*, user, service_type, article, translation_request, client_amount, extra_data):
    """
    Qaytaradi: (amount: Decimal, extra_data: dict).
    ValidationError — xizmat turi, egalik yoki ma'lumot noto'g'ri bo'lsa.
    """
    extra = extra_data if isinstance(extra_data, dict) else {}

    if service_type not in CLIENT_CREATABLE_SERVICE_TYPES:
        raise serializers.ValidationError({'service_type': 'Bu xizmat turi uchun to\'lov shu yerda yaratilmaydi.'})

    if article is not None and str(article.author_id) != str(user.id):
        raise serializers.ValidationError({'article': 'Maqola sizga tegishli emas.'})
    if translation_request is not None and str(translation_request.author_id) != str(user.id):
        raise serializers.ValidationError({'translation_request': 'Tarjima so\'rovi sizga tegishli emas.'})

    if service_type == 'publication_fee':
        if article is None:
            raise serializers.ValidationError({'article': 'Nashr to\'lovi uchun maqola majburiy.'})
        amount = publication_fee_amount(article.journal, article.page_count)
        clean_extra = {}
    elif service_type == 'language_editing':
        if article is None:
            raise serializers.ValidationError({'article': 'Antiplagiat to\'lovi uchun hujjat majburiy.'})
        amount = plagiarism_check_amount()
        clean_extra = {}
    elif service_type == 'book_publication':
        amount = book_publication_amount(extra)
        clean_extra = _clean_book_extra(extra)
    elif service_type == 'translation':
        if translation_request is None:
            raise serializers.ValidationError({'translation_request': 'Tarjima so\'rovi majburiy.'})
        amount = _money(translation_request.cost or 0)
        clean_extra = {}
    else:  # top_up — hech qanday xizmatni yoqmaydi, summa foydalanuvchi tanlovida
        try:
            amount = _money(client_amount)
        except Exception:
            raise serializers.ValidationError({'amount': 'Summa noto\'g\'ri.'})
        if not (TOP_UP_MIN <= amount <= TOP_UP_MAX):
            raise serializers.ValidationError({'amount': f'Summa {TOP_UP_MIN}–{TOP_UP_MAX} so\'m oralig\'ida bo\'lishi kerak.'})
        clean_extra = {}

    if amount <= 0:
        raise serializers.ValidationError({'amount': 'Bu xizmat uchun to\'lov talab qilinmaydi (narx 0).'})
    return amount, clean_extra
