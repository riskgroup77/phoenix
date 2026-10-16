"""
Kitob nashri buyurtmalari uchun ichki jurnal.

Article.journal majburiy, shuning uchun kitob buyurtmasi biror jurnalga biriktirilishi kerak. Avval u tizimdagi
"birinchi" jurnalga (yaratilgan sanasi bo'yicha) tushardi: o'sha jurnal muharriri muallifning yetkazish manzili va
telefoni bilan kitob buyurtmalarini ko'rardi, jurnal statistikasi ham buzilardi. Endi — alohida ichki jurnal
(katalogda ko'rinmaydi), egasi bosh admin.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

BOOK_JOURNAL_ISSN = 'INTERNAL-BOOKS'
BOOK_JOURNAL_NAME = 'Kitob nashri buyurtmalari (ichki)'
INTERNAL_CATEGORY_NAME = 'Ichki (tizim)'


def _owner():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return (
        User.objects.filter(role='super_admin', is_active=True).order_by('date_joined').first()
        or User.objects.filter(is_superuser=True, is_active=True).order_by('date_joined').first()
    )


def get_book_orders_journal():
    """Ichki kitob jurnalini qaytaradi (bo'lmasa yaratadi). Bosh admin bo'lmasa — None."""
    from .models import Journal, JournalCategory

    journal = Journal.objects.filter(issn=BOOK_JOURNAL_ISSN).first()
    if journal is not None:
        if not journal.is_internal:
            journal.is_internal = True
            journal.save(update_fields=['is_internal'])
        return journal
    owner = _owner()
    if owner is None:
        logger.warning('Ichki kitob jurnali yaratilmadi: faol bosh admin yo\'q')
        return None
    category, _ = JournalCategory.objects.get_or_create(
        name=INTERNAL_CATEGORY_NAME, defaults={'description': 'Tizim ichki jurnallari (katalogda ko\'rinmaydi)'}
    )
    return Journal.objects.create(
        name=BOOK_JOURNAL_NAME,
        issn=BOOK_JOURNAL_ISSN,
        description="Kitob nashri buyurtmalari uchun ichki jurnal. Mualliflarga ko'rinmaydi.",
        journal_admin=owner,
        category=category,
        payment_model='post-payment',
        publication_fee=0,
        price_per_page=0,
        is_internal=True,
    )
