"""
Demo (namuna) ma'lumotlar belgisi.

Demo foydalanuvchilar maxsus email domeni bilan ajratiladi (@demo.ilmiyfaoliyat.uz). Ularning maqolalari,
to'lovlari va boshqa yozuvlari ham "demo" hisoblanadi:
  - Google Scholar sahifalari va sitemap'ga chiqmaydi (soxta ilmiy yozuv indekslanmasin);
  - haqiqiy foydalanuvchilarning antiplagiat tekshiruvida manba bo'lmaydi;
  - demo to'lovlar tushum (daromad) hisobotlariga qo'shilmaydi;
  - namuna (demo skript yaratgan) jurnallarga haqiqiy muallif maqola yubora olmaydi.
Namuna jurnal = muharriri demo hisob VA ISSN demo skript ro'yxatida. Admin qo'shgan haqiqiy jurnalga «Demo Muharrir»
biriktirilgan bo'lsa ham u oddiy jurnal: mualliflarga ko'rinadi va maqola qabul qiladi.
To'ldirish/o'chirish: python manage.py seed_demo_data [--purge].
"""
from __future__ import annotations

import threading
from contextlib import contextmanager

from django.db.models import Q

DEMO_EMAIL_DOMAIN = 'demo.ilmiyfaoliyat.uz'
_local = threading.local()


def demo_q(user_path: str = '') -> Q:
    """Demo foydalanuvchiga tegishli yozuvlar: demo_q('author__') → Q(author__email__iendswith=...)."""
    return Q(**{f'{user_path}email__iendswith': '@' + DEMO_EMAIL_DOMAIN})


def is_demo_user(user) -> bool:
    return bool(user is not None and (getattr(user, 'email', '') or '').lower().endswith('@' + DEMO_EMAIL_DOMAIN))


def _seed_journal_issns() -> frozenset:
    from apps.analytics.demo_content import SEED_JOURNAL_ISSNS

    return SEED_JOURNAL_ISSNS


def demo_journal_q(journal_path: str = '') -> Q:
    """Namuna jurnallar: demo_journal_q() — Journal uchun, demo_journal_q('journal__') — Article uchun."""
    return demo_q(f'{journal_path}journal_admin__') & Q(**{f'{journal_path}issn__in': _seed_journal_issns()})


def is_demo_journal(journal) -> bool:
    return bool(
        journal is not None
        and is_demo_user(getattr(journal, 'journal_admin', None))
        and getattr(journal, 'issn', None) in _seed_journal_issns()
    )


def is_demo_article(article) -> bool:
    return is_demo_user(getattr(article, 'author', None)) or is_demo_journal(getattr(article, 'journal', None))


@contextmanager
def seeding():
    """Demo ma'lumot yozilayotganda yon ta'sirlar (xodimlarga xabar, Telegram, indeks) o'chiriladi."""
    prev = getattr(_local, 'seeding', False)
    _local.seeding = True
    try:
        yield
    finally:
        _local.seeding = prev


def is_seeding() -> bool:
    return bool(getattr(_local, 'seeding', False))
