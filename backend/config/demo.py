"""
Demo (namuna) ma'lumotlar belgisi.

Demo foydalanuvchilar maxsus email domeni bilan ajratiladi (@demo.ilmiyfaoliyat.uz). Ularning maqolalari,
to'lovlari va boshqa yozuvlari ham "demo" hisoblanadi:
  - Google Scholar sahifalari va sitemap'ga chiqmaydi (soxta ilmiy yozuv indekslanmasin);
  - haqiqiy foydalanuvchilarning antiplagiat tekshiruvida manba bo'lmaydi;
  - demo to'lovlar tushum (daromad) hisobotlariga qo'shilmaydi;
  - demo jurnallarga haqiqiy muallif maqola yubora olmaydi.
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


def is_demo_article(article) -> bool:
    author = getattr(article, 'author', None)
    journal = getattr(article, 'journal', None)
    return is_demo_user(author) or is_demo_user(getattr(journal, 'journal_admin', None) if journal else None)


def is_demo_journal(journal) -> bool:
    return is_demo_user(getattr(journal, 'journal_admin', None))


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
