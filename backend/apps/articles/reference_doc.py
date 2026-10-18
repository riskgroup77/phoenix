"""
Hujjat holati haqida ma'lumotnoma (PDF) — "Ishlarim" dagi har bir hujjat uchun (maqola, tezis, kitob, antiplagiat,
UDK, DOI): muallif, ish turi, nomi, jurnal, tashkilot, nashr sanasi va HOZIRGI HOLATI (tugagan / tekshirilmoqda ...).

Dizayn: assets/reference_template/malumotnoma.jpg (mijoz shabloni); ru / en / uz-cyrl nusxalari
scripts/build_localized_templates.py bilan yaratilgan. Hujjat interfeys tilida (config/doc_i18n.py).
Hujjat raqami MLN-xxxxxxxx — QR orqali /verify/ sahifasida joriy holat tekshiriladi.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from config.doc_i18n import Dictionary, normalize_lang

TEMPLATE_DIR = Path(settings.BASE_DIR) / 'assets' / 'reference_template'
VALUE_COLOR = (0x0B, 0x3A, 0x57)
STATUS_COLORS = {'done': (0x0F, 0x7A, 0x3E), 'progress': (0xB4, 0x6A, 0x00), 'bad': (0xB4, 0x23, 0x18)}

T = Dictionary({
    # ish turlari
    'Maqola': ('Ilmiy maqola', 'Научная статья', 'Research article'),
    'Tezis': ('Tezis', 'Тезисы', 'Conference abstract'),
    'Kitob': ('Kitob', 'Книга', 'Book'),
    'Antiplagiat': ('Antiplagiat tekshiruvi', 'Проверка на антиплагиат', 'Plagiarism check'),
    'UDK': ("UDK ma'lumotnoma", 'Справка УДК', 'UDC certificate'),
    'DOI': ('DOI raqami', 'Номер DOI', 'DOI number'),
    'not_published': ('Nashr etilmagan', 'Не опубликовано', 'Not published yet'),
    'no_journal': ('—', '—', '—'),
    'service_antiplagiat': ('Phoenix antiplagiat tizimi', 'Система антиплагиата Phoenix', 'Phoenix plagiarism checker'),
    'service_udk': ('UDK klassifikatori (Phoenix)', 'Классификатор УДК (Phoenix)', 'UDC classifier (Phoenix)'),
    'service_doi': ('Crossref DOI (Phoenix)', 'Crossref DOI (Phoenix)', 'Crossref DOI (Phoenix)'),
    'udk_code': ('UDK: {code}', 'УДК: {code}', 'UDC: {code}'),
    # holatlar (Article.STATUS_CHOICES)
    'Draft': ("Qoralama (to'lov kutilmoqda)", 'Черновик (ожидается оплата)', 'Draft (awaiting payment)'),
    'Yangi': ('Jurnalga yuborilgan', 'Отправлено в журнал', 'Submitted to the journal'),
    'WithEditor': ('Redaktorda', 'У редактора', 'With the editor'),
    'QabulQilingan': ('Taqrizda', 'На рецензии', 'Under review'),
    'WritingInProgress': ('Yozilmoqda', 'Пишется', 'Being written'),
    'NashrgaYuborilgan': ('Nashrga yuborilgan', 'Отправлено в печать', 'Sent for publication'),
    'PlagiarismReview': ("Antiplagiat ko'rib chiqilmoqda", 'Рассмотрение антиплагиата', 'Plagiarism review'),
    'Revision': ('Tahrirga qaytarilgan', 'Возвращено на доработку', 'Returned for revision'),
    'Accepted': ('Qabul qilingan', 'Принято', 'Accepted'),
    'Rejected': ('Rad etilgan', 'Отклонено', 'Rejected'),
    'Published': ('Nashr etilgan', 'Опубликовано', 'Published'),
    'ContractProcessing': ('Shartnoma rasmiylashtirilmoqda', 'Оформление договора', 'Contract in progress'),
    'IsbnProcessing': ('ISBN olinmoqda', 'Получение ISBN', 'ISBN in progress'),
    'AuthorDataVerified': ("Muallif ma'lumotlari tasdiqlandi", 'Данные автора подтверждены', 'Author data verified'),
    'PaymentCompleted': ("To'lov qilingan", 'Оплачено', 'Paid'),
    'SentToPrint': ('Bosmaga berildi', 'Передано в печать', 'Sent to print'),
    'Printing': ('Chop etilmoqda', 'Печатается', 'Printing'),
    'Ready': ('Tayyor', 'Готово', 'Ready'),
    'Packaging': ('Qadoqlanmoqda', 'Упаковывается', 'Packaging'),
    'Shipping': ('Yuborilmoqda (pochta)', 'Отправляется (почта)', 'Shipping'),
    'Delivered': ('Yetkazildi', 'Доставлено', 'Delivered'),
    'ProcessPaused': ("Jarayon to'xtatildi", 'Процесс приостановлен', 'Process paused'),
    # antiplagiat / UDK / DOI holatlari
    'ap_awaiting_payment': ("To'lov kutilmoqda", 'Ожидается оплата', 'Awaiting payment'),
    'ap_checking': ('Tekshirilmoqda', 'Проверяется', 'Checking in progress'),
    'ap_failed': ('Tekshiruvda xatolik', 'Ошибка проверки', 'Check failed'),
    'ap_done': ('Tekshiruv yakunlandi ({pct}% o‘xshashlik)', 'Проверка завершена (заимствования {pct}%)',
                'Check completed ({pct}% similarity)'),
    'pending_payment': ("To'lov kutilmoqda", 'Ожидается оплата', 'Awaiting payment'),
    'udk_submitted': ('UDK aniqlanmoqda', 'УДК определяется', 'UDC is being assigned'),
    'udk_completed': ('Yakunlangan — UDK: {code}', 'Завершено — УДК: {code}', 'Completed — UDC: {code}'),
    'rejected': ('Rad etilgan', 'Отклонено', 'Rejected'),
    'doi_submitted': ("DOI ro'yxatdan o'tkazilmoqda", 'DOI регистрируется', 'DOI is being registered'),
    'doi_completed': ('Yakunlangan — DOI berildi', 'Завершено — DOI присвоен', 'Completed — DOI assigned'),
    'title': ("Hujjat holati haqida ma'lumotnoma", 'Справка о статусе документа', 'Document status certificate'),
})

DONE_STATUSES = {'Published', 'Accepted', 'Delivered', 'Ready'}
BAD_STATUSES = {'Rejected', 'ProcessPaused'}


@dataclass
class RefData:
    number: str
    author: str
    work_type: str
    title: str
    journal: str
    org: str
    pub_date: str
    status: str
    tone: str  # done | progress | bad
    lang: str = 'uz'

    @property
    def verify_url(self) -> str:
        return f"{settings.PUBLIC_SITE_URL}/#/verify/{self.number}"


def _date(d) -> str:
    if not d:
        return ''
    if getattr(d, 'hour', None) is not None and timezone.is_aware(d):
        d = timezone.localtime(d)
    return d.strftime('%d.%m.%Y')


def _code(pk) -> str:
    return str(pk).replace('-', '')[:8].upper()


def _person(u) -> str:
    parts = [u.last_name, u.first_name, getattr(u, 'patronymic', '')]
    return ' '.join(p.strip() for p in parts if p and p.strip()) or u.email


# ---------------------------------------------------------------- ma'lumot

def for_article(article, lang: str) -> RefData:
    from .antiplagiat_utils import looks_like_standalone_antiplagiat, standalone_antiplagiat_state
    from .works_report import is_book_title, work_type_label

    lang = normalize_lang(lang)
    author = (article.submitted_author_name or '').strip() or _person(article.author)
    org = (getattr(article.author, 'affiliation', '') or '').strip() or '—'
    if looks_like_standalone_antiplagiat(article):
        report = article.plagiarism_report if isinstance(article.plagiarism_report, dict) else {}
        state = standalone_antiplagiat_state(article) or 'checking'
        status = T.t(f'ap_{state}', lang, pct=round(float(article.plagiarism_percentage or 0), 1))
        tone = {'done': 'done', 'failed': 'bad'}.get(state, 'progress')
        return RefData(
            number=f'MLN-{_code(article.pk)}', author=author, work_type=T.t('Antiplagiat', lang),
            title=str(report.get('document_name') or article.title or ''), journal=T.t('service_antiplagiat', lang),
            org=org, pub_date=_date(article.plagiarism_checked_at) or T.t('not_published', lang),
            status=status, tone=tone, lang=lang,
        )
    cat = getattr(getattr(article.journal, 'category', None), 'name', '') if article.journal_id else ''
    book = is_book_title(article.title)
    pub = ''
    if article.status == 'Published':
        pub = _date(article.issue.publication_date if article.issue_id and article.issue else None) or _date(
            article.submission_date)
    title = article.title or ''
    if book:
        title = title.split(']', 1)[-1].strip() if title.upper().startswith('[KITOB]') else title
    return RefData(
        number=f'MLN-{_code(article.pk)}', author=author, work_type=T.t(work_type_label(cat, book), lang),
        title=title, journal=(article.journal.name if article.journal_id and not book else T.t('no_journal', lang)),
        org=org, pub_date=pub or T.t('not_published', lang),
        status=T.t(article.status, lang) if article.status in T.entries else article.status,
        tone='done' if article.status in DONE_STATUSES else 'bad' if article.status in BAD_STATUSES else 'progress',
        lang=lang,
    )


def for_udk_request(req, lang: str) -> RefData:
    lang = normalize_lang(lang)
    status_map = {'pending_payment': ('pending_payment', 'progress'), 'submitted': ('udk_submitted', 'progress'),
                  'completed': ('udk_completed', 'done'), 'rejected': ('rejected', 'bad')}
    key, tone = status_map.get(req.status, ('udk_submitted', 'progress'))
    author = ' '.join(x for x in (req.author_last_name, req.author_first_name, req.author_middle_name) if x).strip()
    return RefData(
        number=f'MLN-{_code(req.pk)}', author=author or _person(req.user), work_type=T.t('UDK', lang),
        title=req.title, journal=T.t('service_udk', lang),
        org=(getattr(req.user, 'affiliation', '') or '').strip() or '—',
        pub_date=_date(req.completed_at) or T.t('not_published', lang),
        status=T.t(key, lang, code=req.udk_code or '—'), tone=tone, lang=lang,
    )


def for_udk_certificate(cert, lang: str) -> RefData:
    lang = normalize_lang(lang)
    return RefData(
        number=f'MLN-U{cert.pk}', author=cert.author_name or _person(cert.user), work_type=T.t('UDK', lang),
        title=cert.title, journal=T.t('service_udk', lang),
        org=(getattr(cert.user, 'affiliation', '') or '').strip() or '—',
        pub_date=_date(cert.created_at), status=T.t('udk_completed', lang, code=cert.udk_code), tone='done', lang=lang,
    )


def for_doi(dr, lang: str) -> RefData:
    lang = normalize_lang(lang)
    status_map = {'pending_payment': ('pending_payment', 'progress'), 'submitted': ('doi_submitted', 'progress'),
                  'completed': ('doi_completed', 'done')}
    key, tone = status_map.get(dr.status, ('doi_submitted', 'progress'))
    author = f'{dr.author_last_name} {dr.author_first_name}'.strip()
    return RefData(
        number=f'MLN-{_code(dr.pk)}', author=author or _person(dr.user), work_type=T.t('DOI', lang),
        title=(dr.doi_link or '').strip() or T.t('DOI', lang), journal=T.t('service_doi', lang),
        org=(getattr(dr.user, 'affiliation', '') or '').strip() or '—',
        pub_date=_date(dr.completed_at) or T.t('not_published', lang),
        status=T.t(key, lang), tone=tone, lang=lang,
    )


# ---------------------------------------------------------------- chizish

def template_path(lang: str) -> Path:
    lang = normalize_lang(lang)
    if lang != 'uz':
        p = TEMPLATE_DIR / f'malumotnoma.{lang}.jpg'
        if p.is_file():
            return p
    return TEMPLATE_DIR / 'malumotnoma.jpg'


def render_image(data: RefData):
    import qrcode
    from PIL import Image, ImageDraw

    from .works_report import _font_for

    img = Image.open(template_path(data.lang)).convert('RGB')
    d = ImageDraw.Draw(img)

    def put(x, baseline, text, size, max_w, color=VALUE_COLOR, bold=False, min_size=23):
        text = str(text or '—')
        s = size
        while s > min_size and d.textlength(text, font=_font_for(text, s, bold=bold)) > max_w:
            s -= 1
        f = _font_for(text, s, bold=bold)
        while d.textlength(text, font=f) > max_w and len(text) > 4:
            text = text[:-2].rstrip() + '…'
        d.text((x, baseline), text, font=f, fill=color, anchor='ls')

    from datetime import date

    put(405, 83, data.number, 30, 300, bold=True)
    put(1060, 83, date.today().strftime('%d.%m.%Y'), 30, 260, bold=True)
    rows = (data.author, data.work_type, data.title, data.journal, data.org, data.pub_date)
    for i, value in enumerate(rows):
        put(700, 486 + 50 * i, value, 30, 680)
    put(700, 786, data.status, 30, 680, color=STATUS_COLORS.get(data.tone, VALUE_COLOR), bold=True)

    qr = qrcode.QRCode(border=1, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(data.verify_url)
    qr.make(fit=True)
    q = qr.make_image(fill_color='#0b3a57', back_color='white').convert('RGB').resize((210, 210), Image.NEAREST)
    img.paste(q, (551 - 105, 1110 - 105))
    return img


def build_pdf(data: RefData) -> bytes:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    img = render_image(data)
    buf_img = io.BytesIO()
    img.save(buf_img, format='JPEG', quality=92)
    buf_img.seek(0)
    out = io.BytesIO()
    pw, ph = landscape(A4)
    c = canvas.Canvas(out, pagesize=(pw, ph))
    c.setTitle(T.t('title', data.lang))
    c.setAuthor('Phoenix')
    c.drawImage(ImageReader(buf_img), 0, 0, pw, ph)
    c.showPage()
    c.save()
    return out.getvalue()
