"""
Maqola holatlari o'rtasidagi ruxsat etilgan o'tishlar (update_status uchun yagona manba).

Avval jurnal admini istalgan holatni to'g'ridan-to'g'ri qo'ya olardi: to'lanmagan qoralamani "Nashr etilgan"
qilib, to'lov va antiplagiat chetlab o'tilardi. Endi:
  - "Nashr etilgan" faqat complete_publication (sertifikat bilan) orqali;
  - qoralama (to'lov kutilmoqda) faqat to'lov orqali chiqadi (bosh admin qo'lda tasdiqlashi mumkin);
  - antiplagiat chegarasi "Qabul qilish" va "Nashrga yuborish" da tekshiriladi (views_publication).
"""
from __future__ import annotations

# Jurnal maqolasi: tahririyat jarayoni
ARTICLE_TRANSITIONS: dict[str, frozenset[str]] = {
    'Yangi': frozenset({'WithEditor', 'QabulQilingan', 'Revision', 'Accepted', 'Rejected'}),
    'WithEditor': frozenset({'QabulQilingan', 'Revision', 'Accepted', 'Rejected'}),
    'QabulQilingan': frozenset({'WritingInProgress', 'Revision', 'Accepted', 'Rejected'}),
    'WritingInProgress': frozenset({'QabulQilingan', 'Revision', 'Accepted', 'Rejected'}),
    'Revision': frozenset({'Rejected'}),  # muallif qayta yuborishini kutadi (Revision → Yangi muallifniki)
    'Accepted': frozenset({'NashrgaYuborilgan', 'Revision', 'Rejected'}),
    'NashrgaYuborilgan': frozenset({'Accepted', 'Revision', 'Rejected'}),
}

# Bosh admin qo'shimcha: antiplagiat qarori, rad etilganni qayta ochish, qoralamani qo'lda tasdiqlash
SUPER_ADMIN_EXTRA: dict[str, frozenset[str]] = {
    'PlagiarismReview': frozenset({'NashrgaYuborilgan', 'Accepted', 'Rejected'}),
    'Rejected': frozenset({'Yangi'}),
    'Draft': frozenset({'Yangi'}),
}

# Kitob buyurtmasi: ishlab chiqarish bosqichlari (tartibi erkin — bosmaxona jarayoni chiziqli emas)
BOOK_STATUSES = frozenset({
    'Yangi', 'ContractProcessing', 'IsbnProcessing', 'AuthorDataVerified', 'PaymentCompleted',
    'SentToPrint', 'Printing', 'Ready', 'Packaging', 'Shipping', 'Delivered', 'ProcessPaused', 'Rejected',
})

# Antiplagiat chegarasi tekshiriladigan holatlar (bosh admin qarorisiz)
THRESHOLD_CHECKED_TARGETS = frozenset({'Accepted', 'NashrgaYuborilgan'})


def is_book_submission(article) -> bool:
    return (getattr(article, 'title', '') or '').strip().startswith('[KITOB]')


def allowed_staff_transitions(article, *, super_admin: bool) -> frozenset[str]:
    """Jurnal admini / bosh admin uchun hozirgi holatdan o'tish mumkin bo'lgan holatlar."""
    current = article.status
    if is_book_submission(article):
        # To'lanmagan kitob buyurtmasi faqat to'lov (yoki bosh admin) orqali chiqadi
        if current == 'Draft':
            return SUPER_ADMIN_EXTRA['Draft'] if super_admin else frozenset()
        # To'lovdan keyin kitob "QabulQilingan" bo'ladi (repair_book_publication) — BOOK_STATUSES da yo'q edi,
        # shuning uchun hech kimda tugma chiqmay buyurtma qotib qolardi. Ishlab chiqarish bosqichlari istalgan
        # (BOOK_STATUSES dan tashqari) holatdan ochiq.
        allowed = BOOK_STATUSES - {current, 'Yangi'}
        if super_admin and current == 'Rejected':
            allowed = allowed | {'Yangi'}
        return allowed
    allowed = ARTICLE_TRANSITIONS.get(current, frozenset())
    if super_admin:
        allowed = allowed | SUPER_ADMIN_EXTRA.get(current, frozenset())
    return allowed


def allowed_transitions_for(user, article) -> list[str]:
    """Serializer uchun: shu foydalanuvchi bosishi mumkin bo'lgan holatlar (UI tugmalari shunga qarab)."""
    role = (getattr(user, 'role', '') or '').strip().lower()
    if role == 'super_admin' or getattr(user, 'is_superuser', False):
        return sorted(allowed_staff_transitions(article, super_admin=True))
    if role == 'journal_admin':
        journal = getattr(article, 'journal', None)
        if journal is not None and journal.journal_admin_id == user.id:
            return sorted(allowed_staff_transitions(article, super_admin=False))
        return []
    if article.author_id == getattr(user, 'id', None) and article.status == 'Revision':
        return ['Yangi']
    return []
