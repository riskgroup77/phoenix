"""
Bot admin paneli (/admin) uchun ma'lumotlar: statistika, hujjatlar, foydalanuvchilar, fayl ombori, server holati.

Bu yerda faqat sinxron Django ORM kodi (admin_panel.py uni sync_to_async bilan chaqiradi) — testlash oson.
Har bir funksiya (matn, tugmalar) qaytaradi; tugma = (yozuv, callback_data). Matnlar HTML (parse_mode='HTML').
"""
from __future__ import annotations

import html
import os
import shutil
import subprocess
import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Callable

from django.conf import settings
from django.db.models import Count, Q, Sum
from django.utils import timezone

PAGE_SIZE = 8
# Bot API (cloud) orqali yuborish chegarasi
SEND_LIMIT_BYTES = 50 * 1024 * 1024

Button = tuple[str, str]


def esc(value) -> str:
    return html.escape(str(value if value is not None else ''))


def fmt_dt(value) -> str:
    if not value:
        return '—'
    return timezone.localtime(value).strftime('%d.%m.%Y %H:%M')


def fmt_size(n: int | None) -> str:
    n = int(n or 0)
    for unit in ('B', 'KB', 'MB', 'GB'):
        if n < 1024 or unit == 'GB':
            return f'{n:.0f} {unit}' if unit == 'B' else f'{n:.1f} {unit}'
        n /= 1024
    return f'{n:.1f} GB'


def fmt_money(value) -> str:
    return f'{int(value or 0):,}'.replace(',', ' ') + " so'm"


def short(text, limit: int = 40) -> str:
    text = ' '.join(str(text or '').split())
    return text if len(text) <= limit else text[: limit - 1] + '…'


def _since(days: int):
    return timezone.now() - timedelta(days=days)


def _today():
    return timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)


# ----------------------------------------------------------------------------- hujjat turlari
def _article_model():
    from apps.articles.models import Article

    return Article


_PLAG_Q = (
    Q(title__istartswith='plagiarism check')
    | Q(abstract__icontains='tekshiruv uchun yuborilgan')
    | Q(abstract__icontains='hujjat turi:')
)
_BOOK_Q = Q(title__startswith='[KITOB]')


@dataclass(frozen=True)
class Category:
    key: str
    label: str
    queryset: Callable
    owner_field: str
    date_field: str
    files: tuple[tuple[str, str], ...]  # (maydon, yorliq)
    title: Callable


def _articles():
    return _article_model().objects.exclude(_PLAG_Q).exclude(_BOOK_Q)


def _books():
    return _article_model().objects.filter(_BOOK_Q)


def _plag():
    return _article_model().objects.filter(_PLAG_Q)


def _udk():
    from apps.udc.models import UdkRequest

    return UdkRequest.objects.all()


def _udk_cert():
    from apps.udc.models import UDKCertificate

    return UDKCertificate.objects.all()


def _doi():
    from apps.articles.models import DoiRequest

    return DoiRequest.objects.all()


def _translations():
    from apps.translations.models import TranslationRequest

    return TranslationRequest.objects.all()


def _samples():
    from apps.articles.models import ArticleSampleRequest

    return ArticleSampleRequest.objects.all()


def _payments():
    from apps.payments.models import Transaction

    return Transaction.objects.all()


_ARTICLE_FILES = (
    ('final_pdf_path', 'Maqola fayli'),
    ('additional_document_path', "Qo'shimcha hujjat"),
    ('publication_certificate_path', 'Nashr sertifikati'),
    ('udk_certificate_path', 'UDK ma\'lumotnoma'),
)

CATEGORIES: dict[str, Category] = {c.key: c for c in (
    Category('art', '📄 Maqolalar', _articles, 'author', 'submission_date', _ARTICLE_FILES, lambda o: o.title),
    Category('book', '📖 Kitoblar', _books, 'author', 'submission_date', _ARTICLE_FILES,
             lambda o: o.title.replace('[KITOB]', '').strip()),
    Category('plag', '🛡 Antiplagiat', _plag, 'author', 'submission_date',
             (('final_pdf_path', 'Tekshirilgan hujjat'),), lambda o: o.title),
    Category('udk', '📑 UDK so\'rovlari', _udk, 'user', 'created_at', (('file', 'Yuklangan fayl'),),
             lambda o: o.title),
    Category('udkc', '🧾 UDK ma\'lumotnomalar', _udk_cert, 'user', 'created_at',
             (('certificate_path', 'Ma\'lumotnoma'),), lambda o: o.title),
    Category('doi', '🔗 DOI', _doi, 'user', 'created_at', (('file', 'Yuklangan fayl'),),
             lambda o: f'{o.author_first_name} {o.author_last_name}'),
    Category('tr', '🌐 Tarjimalar', _translations, 'author', 'submission_date',
             (('source_file_path', 'Asl fayl'), ('translated_file_path', 'Tarjima')), lambda o: o.title),
    Category('smp', '📋 Maqola namunalari', _samples, 'user', 'created_at', (('result_file', 'Natija'),),
             lambda o: o.topic),
    Category('pay', '💳 To\'lovlar', _payments, 'user', 'created_at', (('receipt_path', 'Chek'),),
             lambda o: f'{o.get_service_type_display()} — {fmt_money(o.amount)}'),
)}


def _get_obj(cat: Category, pk: str):
    try:
        return cat.queryset().select_related(cat.owner_field).get(pk=pk)
    except Exception:
        return None


def _user_name(user) -> str:
    if user is None:
        return '—'
    return ' '.join(p for p in (user.last_name, user.first_name, getattr(user, 'patronymic', '')) if p) or str(user.phone)


def _status_text(obj) -> str:
    if hasattr(obj, 'get_status_display'):
        try:
            return obj.get_status_display()
        except Exception:
            pass
    return str(getattr(obj, 'status', '') or '—')


# ----------------------------------------------------------------------------- statistika
def stats_text() -> str:
    from apps.users.models import TelegramSession, User

    today, week, month = _today(), _since(7), _since(30)
    users = User.objects.all()
    u = users.aggregate(
        total=Count('id'),
        today=Count('id', filter=Q(date_joined__gte=today)),
        week=Count('id', filter=Q(date_joined__gte=week)),
        month=Count('id', filter=Q(date_joined__gte=month)),
        verified=Count('id', filter=Q(phone_verified=True)),
    )
    roles = dict(users.values_list('role').annotate(n=Count('id')).values_list('role', 'n'))
    role_labels = dict(User.ROLE_CHOICES)
    role_line = ', '.join(f'{role_labels.get(r, r)}: {n}' for r, n in sorted(roles.items(), key=lambda x: -x[1]))

    sessions = TelegramSession.objects.all()
    s = sessions.aggregate(
        total=Count('id'),
        week=Count('id', filter=Q(created_at__gte=week)),
        notify=Count('id', filter=Q(user__telegram_notifications=True)),
    )

    lines = [
        '📊 <b>Umumiy statistika</b>',
        '',
        '👥 <b>Foydalanuvchilar</b>',
        f'Jami: <b>{u["total"]}</b> (bugun +{u["today"]}, 7 kun +{u["week"]}, 30 kun +{u["month"]})',
        f'Telefoni tasdiqlangan: {u["verified"]}',
        f'Rollar: {esc(role_line) or "—"}',
        '',
        '🤖 <b>Bot</b>',
        f'Botga ulangan hisoblar: <b>{s["total"]}</b> (7 kun +{s["week"]}), bildirishnoma yoqilgan: {s["notify"]}',
        '',
        '📁 <b>Hujjatlar</b> (jami / bugun / 7 kun)',
    ]
    for cat in CATEGORIES.values():
        if cat.key == 'pay':
            continue
        c = cat.queryset().aggregate(
            total=Count('pk'),
            today=Count('pk', filter=Q(**{f'{cat.date_field}__gte': today})),
            week=Count('pk', filter=Q(**{f'{cat.date_field}__gte': week})),
        )
        lines.append(f'{cat.label}: <b>{c["total"]}</b> / {c["today"]} / {c["week"]}')

    Article = _article_model()
    by_status = (
        _articles().values('status').annotate(n=Count('pk')).order_by('-n')
    )
    labels = dict(Article.STATUS_CHOICES)
    status_line = ', '.join(f'{labels.get(r["status"], r["status"])}: {r["n"]}' for r in by_status[:8])
    if status_line:
        lines += ['', f'📄 <b>Maqolalar holati</b>: {esc(status_line)}']

    pay = _payments().filter(status='completed').aggregate(
        n=Count('pk'), total=Sum('amount'),
        today_n=Count('pk', filter=Q(created_at__gte=today)), today=Sum('amount', filter=Q(created_at__gte=today)),
        month_n=Count('pk', filter=Q(created_at__gte=month)), month=Sum('amount', filter=Q(created_at__gte=month)),
    )
    lines += [
        '',
        "💳 <b>To'lovlar</b> (muvaffaqiyatli)",
        f'Bugun: {pay["today_n"]} ta — {fmt_money(pay["today"])}',
        f'30 kun: {pay["month_n"]} ta — {fmt_money(pay["month"])}',
        f'Jami: {pay["n"]} ta — <b>{fmt_money(pay["total"])}</b>',
    ]
    return '\n'.join(lines)


# ----------------------------------------------------------------------------- hujjatlar
def documents_menu() -> tuple[str, list[list[Button]]]:
    rows = []
    for cat in CATEGORIES.values():
        rows.append([(f'{cat.label} ({cat.queryset().count()})', f'adm:dl:{cat.key}:0')])
    return '📁 <b>Hujjatlar</b>\nTurini tanlang:', rows


def _page_rows(qs, page: int, item_cb: Callable, label: Callable, nav_prefix: str):
    total = qs.count()
    pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
    page = min(max(page, 0), pages - 1)
    items = list(qs[page * PAGE_SIZE:(page + 1) * PAGE_SIZE])
    rows = [[(label(o), item_cb(o))] for o in items]
    nav = []
    if page > 0:
        nav.append(('⬅️', f'{nav_prefix}:{page - 1}'))
    if pages > 1:
        nav.append((f'{page + 1}/{pages}', 'adm:noop'))
    if page < pages - 1:
        nav.append(('➡️', f'{nav_prefix}:{page + 1}'))
    if nav:
        rows.append(nav)
    return total, rows


def document_list(cat_key: str, page: int = 0, user_id: str | None = None) -> tuple[str, list[list[Button]]]:
    cat = CATEGORIES.get(cat_key)
    if cat is None:
        return 'Noma\'lum tur', [[('⬅️ Orqaga', 'adm:docs')]]
    qs = cat.queryset().select_related(cat.owner_field).order_by(f'-{cat.date_field}')
    if user_id:
        qs = qs.filter(**{f'{cat.owner_field}_id': user_id})
        nav_prefix = f'adm:ul:{user_id}:{cat_key}'
        back = ('⬅️ Foydalanuvchiga', f'adm:u:{user_id}')
    else:
        nav_prefix = f'adm:dl:{cat_key}'
        back = ('⬅️ Hujjatlar', 'adm:docs')

    def label(o):
        date = timezone.localtime(getattr(o, cat.date_field)).strftime('%d.%m.%y')
        return f'{date} · {short(cat.title(o), 45)}'

    total, rows = _page_rows(qs, page, lambda o: f'adm:d:{cat_key}:{o.pk}', label, nav_prefix)
    rows.append([back, ('🏠 Menyu', 'adm:menu')])
    head = f'{cat.label}: <b>{total}</b> ta'
    if user_id:
        from apps.users.models import User

        head += f'\n👤 {esc(_user_name(User.objects.filter(pk=user_id).first()))}'
    return head + ('\nOchish uchun tanlang:' if total else '\nHozircha yo\'q.'), rows


def document_detail(cat_key: str, pk: str) -> tuple[str, list[list[Button]]]:
    cat = CATEGORIES.get(cat_key)
    obj = _get_obj(cat, pk) if cat else None
    if obj is None:
        return 'Hujjat topilmadi', [[('⬅️ Hujjatlar', 'adm:docs')]]
    owner = getattr(obj, cat.owner_field, None)
    lines = [
        f'{cat.label}',
        f'<b>{esc(cat.title(obj))}</b>',
        '',
        f'👤 {esc(_user_name(owner))}' + (f' · {esc(owner.phone)}' if owner else ''),
        f'📅 {fmt_dt(getattr(obj, cat.date_field))}',
        f'📌 Holat: {esc(_status_text(obj))}',
        f'🆔 <code>{esc(obj.pk)}</code>',
    ]
    if cat.owner_field == 'author' and cat_key in ('art', 'book', 'plag'):
        if cat_key == 'plag' or obj.plagiarism_percentage or obj.originality_percentage:
            lines.append(f'🛡 O\'xshashlik: {obj.plagiarism_percentage:.1f}% · original: {obj.originality_percentage:.1f}%')
        journal = getattr(obj, 'journal', None)
        if journal is not None and cat_key != 'plag':
            lines.append(f'📚 Jurnal: {esc(short(journal.name if hasattr(journal, "name") else journal, 60))}')
        if getattr(obj, 'udk_code', ''):
            lines.append(f'📑 UDK: {esc(obj.udk_code)}')
        if getattr(obj, 'doi', ''):
            lines.append(f'🔗 DOI: {esc(obj.doi)}')
    if cat_key == 'udk' and obj.udk_code:
        lines.append(f'📑 UDK: {esc(obj.udk_code)}')
    if cat_key == 'udkc':
        lines.append(f'📑 UDK: {esc(obj.udk_code)}')
    if cat_key == 'doi' and obj.doi_link:
        lines.append(f'🔗 {esc(obj.doi_link)}')
    if cat_key == 'tr':
        lines.append(f'🌐 {esc(obj.source_language)} → {esc(obj.target_language)} · {esc(obj.get_quality_display())}')
    if cat_key == 'pay':
        lines.append(f'💳 {esc(obj.payment_provider or "—")} · {fmt_money(obj.amount)}')

    rows: list[list[Button]] = []
    files = document_files(cat_key, obj)
    if files:
        lines += ['', '📎 <b>Fayllar</b>:']
        for idx, (label, name, size) in files:
            lines.append(f'• {esc(label)}: {esc(os.path.basename(name))} ({fmt_size(size) if size else "hajmi noma`lum"})')
            rows.append([(f'📥 {label}', f'adm:f:{cat_key}:{obj.pk}:{idx}')])
    else:
        lines += ['', '📎 Fayl biriktirilmagan']
    if owner is not None:
        rows.append([('👤 Foydalanuvchi', f'adm:u:{owner.pk}')])
    rows.append([('⬅️ Ro\'yxat', f'adm:dl:{cat_key}:0'), ('🏠 Menyu', 'adm:menu')])
    return '\n'.join(lines), rows


def _field_size(field) -> int:
    try:
        return int(field.size)
    except Exception:
        return 0


def document_files(cat_key: str, obj) -> list[tuple[int, tuple[str, str, int]]]:
    """[(indeks, (yorliq, fayl nomi, hajm))] — faqat biriktirilgan fayllar."""
    out = []
    for idx, (field_name, label) in enumerate(CATEGORIES[cat_key].files):
        field = getattr(obj, field_name, None)
        if field and getattr(field, 'name', ''):
            out.append((idx, (label, field.name, _field_size(field))))
    return out


def resolve_file(cat_key: str, pk: str, idx: int) -> dict | None:
    """Yuborish uchun fayl: diskda bo'lmasa Telegram omboridan qaytariladi (storage.path)."""
    cat = CATEGORIES.get(cat_key)
    obj = _get_obj(cat, pk) if cat else None
    if obj is None or not (0 <= idx < len(cat.files)):
        return None
    field_name, label = cat.files[idx]
    field = getattr(obj, field_name, None)
    if not field or not field.name:
        return None
    owner = getattr(obj, cat.owner_field, None)
    result = {
        'label': label,
        'name': field.name,
        'filename': os.path.basename(field.name),
        'caption': f'{label} — {short(cat.title(obj), 120)}\n👤 {_user_name(owner)}',
        'path': None,
        'size': 0,
    }
    try:
        path = field.path
    except Exception:
        return result
    if os.path.isfile(path):
        result['path'] = path
        result['size'] = os.path.getsize(path)
    return result


def user_files(user_id: str) -> list[tuple[str, str, int]]:
    """Foydalanuvchining barcha fayllari: [(kategoriya, pk, maydon indeksi)]."""
    out = []
    for cat in CATEGORIES.values():
        qs = cat.queryset().filter(**{f'{cat.owner_field}_id': user_id}).order_by(f'-{cat.date_field}')
        for obj in qs:
            for idx, _info in document_files(cat.key, obj):
                out.append((cat.key, str(obj.pk), idx))
    return out


# ----------------------------------------------------------------------------- foydalanuvchilar
def users_menu(page: int = 0) -> tuple[str, list[list[Button]]]:
    from apps.users.models import User

    qs = User.objects.order_by('-date_joined')
    total, rows = _page_rows(
        qs, page, lambda u: f'adm:u:{u.pk}',
        lambda u: f'{short(_user_name(u), 30)} · {u.phone}', 'adm:ulist',
    )
    rows.insert(0, [('🔎 Qidirish (telefon / ism / ID)', 'adm:us')])
    rows.append([('🏠 Menyu', 'adm:menu')])
    return (f'👥 <b>Foydalanuvchilar</b>: {total} ta\n'
            'Qidirish: tugmani bosing yoki <code>/user 901234567</code>, <code>/user Aliyev Vali</code>.\n'
            'Oxirgi ro\'yxatdan o\'tganlar:'), rows


def search_users(query: str, limit: int = 10):
    from apps.users.models import User

    q = (query or '').strip()
    if not q:
        return []
    qs = User.objects.all()
    compact = q.replace('-', '')
    digits = ''.join(c for c in q if c.isdigit())
    if len(compact) == 32 or len(q) == 36:
        try:
            return list(qs.filter(pk=uuid.UUID(q)))
        except ValueError:
            pass
    conds = Q()
    if len(digits) >= 4 and len(digits) >= len(q.replace(' ', '').replace('+', '')) - 1:
        conds |= Q(phone__contains=digits[-9:])
    if len(compact) >= 6 and all(c in '0123456789abcdefABCDEF' for c in compact):
        conds |= Q(id__istartswith=q.lower())
    words = [w for w in q.replace(',', ' ').split() if w]
    if words and not digits:
        name_q = Q()
        for w in words:
            name_q &= (Q(first_name__icontains=w) | Q(last_name__icontains=w) | Q(patronymic__icontains=w))
        conds |= name_q
        conds |= Q(email__icontains=q) | Q(telegram_username__icontains=q.lstrip('@'))
    if not conds:
        return []
    return list(qs.filter(conds).order_by('-date_joined')[:limit])


def search_results(query: str) -> tuple[str, list[list[Button]]]:
    users = search_users(query)
    rows = [[(f'{short(_user_name(u), 30)} · {u.phone}', f'adm:u:{u.pk}')] for u in users]
    rows.append([('🔎 Yana qidirish', 'adm:us'), ('🏠 Menyu', 'adm:menu')])
    if not users:
        return f'«{esc(query)}» bo\'yicha hech kim topilmadi.', rows
    more = ' (ko\'pi bilan 10 tasi)' if len(users) >= 10 else ''
    return f'🔎 «{esc(query)}»: {len(users)} ta{more}', rows


def user_detail(user_id: str) -> tuple[str, list[list[Button]]]:
    from apps.users.models import TelegramSession, User

    user = User.objects.filter(pk=user_id).first()
    if user is None:
        return 'Foydalanuvchi topilmadi', [[('👥 Foydalanuvchilar', 'adm:users:0')]]
    tg = TelegramSession.objects.filter(user=user).order_by('-updated_at').first()
    paid = _payments().filter(user=user, status='completed').aggregate(n=Count('pk'), total=Sum('amount'))
    lines = [
        f'👤 <b>{esc(_user_name(user))}</b>',
        f'📞 {esc(user.phone)}' + (' ✅' if user.phone_verified else ''),
        f'✉️ {esc(user.email or "—")}',
        f'🎓 Rol: {esc(user.get_role_display())}' + ('' if user.is_active else ' · ⛔ bloklangan'),
        f'🏢 {esc(short(user.affiliation, 80) or "—")}',
        f'📅 Ro\'yxatdan: {fmt_dt(user.date_joined)} · oxirgi kirish: {fmt_dt(user.last_login)}',
        f'🤖 Bot: ' + (f'ulangan (ID <code>{tg.telegram_id}</code>'
                     + (f', @{esc(tg.telegram_username)}' if tg.telegram_username else '') + ')' if tg else 'ulanmagan'),
        f'💳 To\'lovlar: {paid["n"]} ta — {fmt_money(paid["total"])}',
        f'🆔 <code>{user.pk}</code>',
        '',
        '📁 <b>Hujjatlari</b>:',
    ]
    rows: list[list[Button]] = []
    for cat in CATEGORIES.values():
        n = cat.queryset().filter(**{f'{cat.owner_field}_id': user.pk}).count()
        if n:
            lines.append(f'{cat.label}: {n}')
            rows.append([(f'{cat.label} ({n})', f'adm:ul:{user.pk}:{cat.key}:0')])
    total_files = len(user_files(str(user.pk)))
    if not rows:
        lines.append('Hozircha yo\'q')
    if total_files:
        rows.append([(f'📦 Barcha fayllarni yuborish ({total_files})', f'adm:ua:{user.pk}')])
    rows.append([('🔎 Qidirish', 'adm:us'), ('🏠 Menyu', 'adm:menu')])
    return '\n'.join(lines), rows


# ----------------------------------------------------------------------------- reklama tarixi
def broadcasts_text() -> tuple[str, list[list[Button]]]:
    from apps.notifications.models import BroadcastLog

    logs = list(BroadcastLog.objects.select_related('created_by').order_by('-created_at')[:7])
    lines = ['📢 <b>Reklama</b>', 'Yangi xabar yuborish: tugma yoki /reklama', '']
    if not logs:
        lines.append('Hali reklama yuborilmagan.')
    icons = {'running': '⏳', 'done': '✅', 'failed': '❌'}
    for log in logs:
        lines.append(
            f'{icons.get(log.status, "•")} {fmt_dt(log.created_at)} — {log.sent_count}/{log.total} yetdi'
            + (f', {log.failed_count} xato' if log.failed_count else '')
            + f'\n   «{esc(short(log.text_preview or log.content_type, 60))}»'
        )
    return '\n'.join(lines), [[('📣 Yangi reklama', 'adm:bc')], [('🏠 Menyu', 'adm:menu')]]


# ----------------------------------------------------------------------------- fayl ombori va zaxiralar
def _backup_dir() -> str:
    return os.getenv('PHONIX_BACKUP_DIR') or os.path.join(str(settings.BASE_DIR.parent), 'backups')


def storage_text() -> str:
    from apps.tgstorage import backup, client, services

    lines = ['🗄 <b>Fayl ombori va zaxiralar</b>', '']
    try:
        usage = shutil.disk_usage(str(settings.MEDIA_ROOT))
        lines.append(f'💽 Disk: {fmt_size(usage.used)} / {fmt_size(usage.total)} band '
                     f'({usage.used * 100 // max(usage.total, 1)}%), bo\'sh {fmt_size(usage.free)}')
    except OSError:
        pass
    if client.is_configured():
        st = services.status()
        lines += [
            f'☁️ Telegram ombori: {"yoqilgan" if services.media_enabled() else "media o`chiq"}',
            f'Telegram\'da: <b>{st["telegram_files"]}</b> ta fayl · faqat Telegram\'da: {st["only_in_telegram"]}',
            f'Diskda: {st["local_files"]} ta ({fmt_size(st["local_bytes"])}) · yuborilmagan: {st["pending_upload"]}',
        ]
    else:
        lines.append('☁️ Telegram ombori sozlanmagan (TG_STORAGE_*)')

    lines += ['', '💾 <b>Baza zaxiralari</b>']
    daily = os.path.join(_backup_dir(), 'db', 'daily')
    try:
        dumps = sorted((os.path.join(daily, f) for f in os.listdir(daily) if f.endswith('.dump')),
                       key=os.path.getmtime, reverse=True)
    except OSError:
        dumps = []
    if dumps:
        latest = dumps[0]
        age_h = (timezone.now().timestamp() - os.path.getmtime(latest)) / 3600
        warn = ' ⚠️' if age_h > 36 else ''
        lines.append(f'Serverda: {len(dumps)} ta, oxirgisi {age_h:.0f} soat oldin '
                     f'({fmt_size(os.path.getsize(latest))}){warn}')
    else:
        lines.append('Serverda kunlik zaxira topilmadi ⚠️')
    if client.is_configured():
        rows = backup.list_backups()
        lines.append(f'Telegram\'da: {len(rows)} ta')
        for row in rows[:5]:
            mark = '' if row['parts'] == row['parts_total'] else f' ⚠️ chala {row["parts"]}/{row["parts_total"]}'
            lines.append(f'• {fmt_dt(row["created_at"])} — {fmt_size(row["size"])} — {esc(row["name"])}{mark}')
    return '\n'.join(lines)


# ----------------------------------------------------------------------------- server holati
def _meminfo() -> dict:
    out = {}
    try:
        with open('/proc/meminfo') as fh:
            for line in fh:
                key, val = line.split(':', 1)
                out[key] = int(val.split()[0]) * 1024
    except (OSError, ValueError):
        pass
    return out


def _service_state(unit: str) -> str | None:
    """systemd holati; unit o'rnatilmagan yoki systemd yo'q bo'lsa — None (ko'rsatilmaydi)."""
    try:
        res = subprocess.run(['systemctl', 'show', '-p', 'LoadState,ActiveState', '--value', unit],
                             capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.SubprocessError):
        return None
    parts = res.stdout.split()
    if res.returncode != 0 or len(parts) < 2 or parts[0] != 'loaded':
        return None
    return parts[1]


def server_text() -> str:
    from django.core.cache import cache
    from django.db import connection

    lines = ['🩺 <b>Server holati</b>', '']
    try:
        with open('/proc/uptime') as fh:
            up = float(fh.read().split()[0])
        lines.append(f'⏱ Ishlash vaqti: {int(up // 86400)} kun {int(up % 86400 // 3600)} soat')
    except OSError:
        pass
    try:
        l1, l5, _l15 = os.getloadavg()
        lines.append(f'⚙️ Yuklama: {l1:.2f} / {l5:.2f} ({os.cpu_count()} CPU)')
    except OSError:
        pass
    mem = _meminfo()
    if mem.get('MemTotal'):
        used = mem['MemTotal'] - mem.get('MemAvailable', 0)
        lines.append(f'🧠 RAM: {fmt_size(used)} / {fmt_size(mem["MemTotal"])} ({used * 100 // mem["MemTotal"]}%)')
        if mem.get('SwapTotal'):
            swap_used = mem['SwapTotal'] - mem.get('SwapFree', 0)
            lines.append(f'🔁 Swap: {fmt_size(swap_used)} / {fmt_size(mem["SwapTotal"])}')
        else:
            lines.append('🔁 Swap: yo\'q')
    try:
        usage = shutil.disk_usage(str(settings.BASE_DIR))
        lines.append(f'💽 Disk: {usage.used * 100 // max(usage.total, 1)}% band, bo\'sh {fmt_size(usage.free)}')
    except OSError:
        pass

    lines.append('')
    try:
        connection.ensure_connection()
        lines.append('✅ PostgreSQL')
    except Exception:
        lines.append('❌ PostgreSQL ulanmadi')
    try:
        cache.set('phoenix:bot-admin:ping', 1, 10)
        lines.append('✅ Redis' if cache.get('phoenix:bot-admin:ping') == 1 else '⚠️ Redis javob bermadi')
    except Exception:
        lines.append('❌ Redis ulanmadi')
    for unit, label in (('phoenix-backend', 'Backend'), ('phoenix-celery', 'Celery'),
                        ('phoenix-telegram-bot', 'Telegram bot'), ('phoenix-backup.timer', 'Zaxira taymeri'),
                        ('phoenix-tg-storage.timer', 'Telegram ombori taymeri')):
        state = _service_state(unit)
        if state is None:
            continue
        if state in ('active', 'activating'):
            lines.append(f'✅ {label}')
        elif state is not None:
            lines.append(f'❌ {label} ({esc(state)})')
    from apps.tgstorage import client

    if client.is_configured():
        try:
            import requests

            requests.get(str(getattr(settings, 'TG_BOT_API_URL', '')), timeout=3)
            lines.append('✅ Local Bot API')
        except Exception:
            lines.append('❌ Local Bot API javob bermadi')
    return '\n'.join(lines)


def main_menu() -> tuple[str, list[list[Button]]]:
    return (
        '🛠 <b>Admin panel</b>\nBo\'limni tanlang:',
        [
            [('📊 Statistika', 'adm:stats'), ('📁 Hujjatlar', 'adm:docs')],
            [('👥 Foydalanuvchilar', 'adm:users:0'), ('📢 Reklama', 'adm:bcl')],
            [('🗄 Ombor va zaxira', 'adm:storage'), ('🩺 Server', 'adm:server')],
        ],
    )
