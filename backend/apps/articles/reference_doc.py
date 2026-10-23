"""
Hujjat holati haqida ma'lumotnoma (PDF) — "Ishlarim" dagi har bir hujjat uchun. Har bir hujjat turi o'z sarlavhasi
va maydonlari bilan chiqadi:
  maqola / tezis / kitob — QABUL HAQIDA MA'LUMOTNOMA (jurnal, nashr sanasi ...);
  antiplagiat — ANTIPLAGIAT TEKSHIRUVI MA'LUMOTNOMASI (sertifikat raqami, originallik / o'xshashlik ...);
  UDK — UDK HAQIDA MA'LUMOTNOMA (UDK raqami, tavsifi ...);  DOI — DOI HAQIDA MA'LUMOTNOMA.
Fon: assets/reference_template/malumotnoma.blank.jpg (mijoz shabloni, yozuvlarsiz) — barcha yozuvlar hujjat tilida
(uz / uz-cyrl / ru / en) chiziladi. Hujjat raqami MLN-xxxxxxxx — QR orqali /verify/ sahifasida joriy holat.
"""
from __future__ import annotations

import io
from dataclasses import dataclass, field
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from config.doc_i18n import Dictionary, normalize_lang

TEMPLATE_DIR = Path(settings.BASE_DIR) / 'assets' / 'reference_template'
FONT_DIR = Path(settings.BASE_DIR) / 'assets' / 'hisobot_template' / 'fonts'
VALUE_COLOR = (0x0B, 0x3A, 0x57)
LABEL_COLOR = '#057a9b'
STATUS_LABEL_COLOR = '#0a5984'
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
    # Natija foizi va UDK raqami yuqoridagi qatorlarda bor — holatda takrorlanmaydi
    'ap_done': ('Tekshiruv yakunlandi', 'Проверка завершена', 'Check completed'),
    'pending_payment': ("To'lov kutilmoqda", 'Ожидается оплата', 'Awaiting payment'),
    'udk_submitted': ('UDK aniqlanmoqda', 'УДК определяется', 'UDC is being assigned'),
    'udk_completed': ('Yakunlangan', 'Завершено', 'Completed'),
    'rejected': ('Rad etilgan', 'Отклонено', 'Rejected'),
    'doi_submitted': ("DOI ro'yxatdan o'tkazilmoqda", 'DOI регистрируется', 'DOI is being registered'),
    'doi_completed': ('Yakunlangan — DOI berildi', 'Завершено — DOI присвоен', 'Completed — DOI assigned'),
    'title': ("Hujjat holati haqida ma'lumotnoma", 'Справка о статусе документа', 'Document status certificate'),
    # --- shablon yozuvlari (fon matnsiz: assets/reference_template/malumotnoma.blank.jpg)
    'doc_number': ('HUJJAT RAQAMI:', 'ДОКУМЕНТ №:', 'DOCUMENT NO.:'),
    'doc_date': ('HUJJAT SANASI:', 'ДАТА ВЫДАЧИ:', 'ISSUE DATE:'),
    'qr1': ('TEKSHIRISH UCHUN', 'ДЛЯ ПРОВЕРКИ', 'SCAN THE'),
    'qr2': ('QR KODDAN', 'ОТСКАНИРУЙТЕ', 'QR CODE'),
    'qr3': ('FOYDALANING', 'QR-КОД', 'TO VERIFY'),
    't_article_1': ('QABUL HAQIDA', 'СПРАВКА', 'CERTIFICATE'),
    't_article_2': ('MA’LUMOTNOMA', 'О ПРИЁМЕ', 'OF ACCEPTANCE'),
    't_antiplagiat_1': ('ANTIPLAGIAT TEKSHIRUVI', 'СПРАВКА О ПРОВЕРКЕ', 'PLAGIARISM CHECK'),
    't_antiplagiat_2': ('MA’LUMOTNOMASI', 'НА АНТИПЛАГИАТ', 'CERTIFICATE'),
    't_udk_1': ('UDK HAQIDA', 'СПРАВКА', 'UDC INDEX'),
    't_udk_2': ('MA’LUMOTNOMA', 'ОБ ИНДЕКСЕ УДК', 'CERTIFICATE'),
    't_doi_1': ('DOI HAQIDA', 'СПРАВКА', 'DOI'),
    't_doi_2': ('MA’LUMOTNOMA', 'О ПРИСВОЕНИИ DOI', 'CERTIFICATE'),
    # yorliqlar
    'l_author': ('MUALLIF', 'АВТОР', 'AUTHOR'),
    'l_authors': ('MUALLIFLAR', 'АВТОРЫ', 'AUTHORS'),
    'anon_author': ('Anonim muallif', 'Анонимный автор', 'Anonymous author'),
    'l_work_type': ('ISH TURI', 'ВИД РАБОТЫ', 'WORK TYPE'),
    'l_work_title': ('ISH NOMI', 'НАЗВАНИЕ РАБОТЫ', 'TITLE'),
    'l_journal': ('JURNAL NOMI', 'НАЗВАНИЕ ЖУРНАЛА', 'JOURNAL'),
    'l_publisher': ('NASHRIYOT', 'ИЗДАТЕЛЬСТВО', 'PUBLISHER'),
    'l_org': ('TASHKILOT NOMI', 'ОРГАНИЗАЦИЯ', 'ORGANIZATION'),
    'l_pub_date': ('NASHR ETILISH SANASI', 'ДАТА ПУБЛИКАЦИИ', 'PUBLICATION DATE'),
    'l_status': ('HOZIRGI HOLATI', 'ТЕКУЩИЙ СТАТУС', 'CURRENT STATUS'),
    'l_website': ('WEB-SAYT', 'ВЕБ-САЙТ', 'WEBSITE'),
    'l_doc_type': ('HUJJAT TURI', 'ТИП ДОКУМЕНТА', 'DOCUMENT TYPE'),
    'l_doc_title': ('HUJJAT NOMI', 'НАЗВАНИЕ ДОКУМЕНТА', 'DOCUMENT TITLE'),
    'l_cert_no': ('SERTIFIKAT RAQAMI', 'НОМЕР СЕРТИФИКАТА', 'CERTIFICATE NO.'),
    'l_result': ('NATIJA', 'РЕЗУЛЬТАТ', 'RESULT'),
    'l_check_date': ('TEKSHIRUV SANASI', 'ДАТА ПРОВЕРКИ', 'CHECK DATE'),
    'l_udk_code': ('UDK RAQAMI', 'ИНДЕКС УДК', 'UDC CODE'),
    'l_udk_desc': ('UDK TAVSIFI', 'ОПИСАНИЕ УДК', 'UDC DESCRIPTION'),
    'l_issue_date': ('BERILGAN SANASI', 'ДАТА ВЫДАЧИ', 'DATE ISSUED'),
    'l_doi': ('DOI RAQAMI', 'НОМЕР DOI', 'DOI NUMBER'),
    'l_request_date': ('SO‘ROV SANASI', 'ДАТА ЗАЯВКИ', 'REQUEST DATE'),
    'result_value': ('Originallik {orig}% · O‘xshashlik {plag}%', 'Оригинальность {orig}% · Заимствования {plag}%',
                     'Originality {orig}% · Similarity {plag}%'),
    'pending': ('Kutilmoqda', 'Ожидается', 'Pending'),
})

DONE_STATUSES = {'Published', 'Accepted', 'Delivered', 'Ready'}
BAD_STATUSES = {'Rejected', 'ProcessPaused'}


@dataclass
class RefData:
    kind: str  # article | antiplagiat | udk | doi — sarlavha va maydonlar shunga qarab
    number: str
    author: str
    work_type: str
    title: str
    status: str
    tone: str  # done | progress | bad
    rows: list = field(default_factory=list)  # [(yorliq kaliti, qiymat)] — 6 ta (holat va web-sayt alohida)
    lang: str = 'uz'
    authors: list = field(default_factory=list)  # antiplagiat: muallif va hammualliflar (QR tekshiruvi uchun)

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


def _org(user) -> str:
    return (getattr(user, 'affiliation', '') or '').strip() or '—'


# ---------------------------------------------------------------- ma'lumot

def for_article(article, lang: str, *, hide_author: bool = False) -> RefData:
    """hide_author — yopiq taqrizdagi taqrizchi uchun: muallif kimligi oshkor qilinmaydi."""
    from .antiplagiat_utils import (
        antiplagiat_authors,
        looks_like_standalone_antiplagiat,
        standalone_antiplagiat_state,
    )
    from .works_report import is_book_title, work_type_label

    lang = normalize_lang(lang)
    if hide_author:
        author = T.t('anon_author', lang)
    else:
        author = (article.submitted_author_name or '').strip() or _person(article.author)
    if looks_like_standalone_antiplagiat(article):
        report = article.plagiarism_report if isinstance(article.plagiarism_report, dict) else {}
        # Antiplagiat formasida kiritilgan muallif (boshqa shaxsning ishi ham tekshirilishi mumkin) — sertifikat va
        # QR tekshiruvi bilan bir xil. Avval bu yerda doim yuklagan foydalanuvchining ismi chiqardi.
        # Hammualliflar qo'shilgan bo'lsa — barchasi, yorliq «MUALLIFLAR».
        authors = [author] if hide_author else antiplagiat_authors(report, fallback=author)
        author = ', '.join(authors)
        state = standalone_antiplagiat_state(article) or 'checking'
        plag = round(float(article.plagiarism_percentage or 0), 2)
        orig = round(float(article.originality_percentage or 0), 2) if article.originality_percentage else round(
            max(0.0, 100 - plag), 2)
        done = state == 'done'
        title = str(report.get('document_name') or article.title or '')
        return RefData(
            kind='antiplagiat', number=f'MLN-{_code(article.pk)}', author=author,
            work_type=T.t('Antiplagiat', lang), title=title,
            status=T.t(f'ap_{state}', lang, pct=plag), tone={'done': 'done', 'failed': 'bad'}.get(state, 'progress'),
            rows=[
                ('l_authors' if len(authors) > 1 else 'l_author', author),
                ('l_doc_type', str(report.get('document_type') or '') or T.t('Maqola', lang)),
                ('l_doc_title', title),
                ('l_cert_no', str(report.get('certificate_number') or '') if done else T.t('pending', lang)),
                ('l_result', T.t('result_value', lang, orig=orig, plag=plag) if done else T.t('pending', lang)),
                ('l_check_date', _date(article.plagiarism_checked_at) or T.t('pending', lang)),
            ],
            lang=lang,
            authors=authors,
        )
    cat = getattr(getattr(article.journal, 'category', None), 'name', '') if article.journal_id else ''
    book = is_book_title(article.title)
    pub = ''
    if article.status == 'Published':
        pub = _date(article.issue.publication_date if article.issue_id and article.issue else None) or _date(
            article.submission_date)
    title = article.title or ''
    if book and title.upper().startswith('[KITOB]'):
        title = title.split(']', 1)[-1].strip()
    work_type = T.t(work_type_label(cat, book), lang)
    return RefData(
        kind='article', number=f'MLN-{_code(article.pk)}', author=author, work_type=work_type, title=title,
        status=T.t(article.status, lang) if article.status in T.entries else article.status,
        tone='done' if article.status in DONE_STATUSES else 'bad' if article.status in BAD_STATUSES else 'progress',
        rows=[
            ('l_author', author),
            ('l_work_type', work_type),
            ('l_work_title', title),
            ('l_publisher', 'Phoenix') if book else ('l_journal', article.journal.name if article.journal_id else '—'),
            ('l_org', _org(article.author)),
            ('l_pub_date', pub or T.t('not_published', lang)),
        ],
        lang=lang,
    )


def _udk_rows(author, title, code, desc, org, issued, lang):
    return [
        ('l_author', author),
        ('l_work_title', title),
        ('l_udk_code', code or T.t('pending', lang)),
        ('l_udk_desc', desc or '—'),
        ('l_org', org),
        ('l_issue_date', issued or T.t('pending', lang)),
    ]


def for_udk_request(req, lang: str) -> RefData:
    lang = normalize_lang(lang)
    status_map = {'pending_payment': ('pending_payment', 'progress'), 'submitted': ('udk_submitted', 'progress'),
                  'completed': ('udk_completed', 'done'), 'rejected': ('rejected', 'bad')}
    key, tone = status_map.get(req.status, ('udk_submitted', 'progress'))
    author = ' '.join(x for x in (req.author_last_name, req.author_first_name, req.author_middle_name) if x).strip()
    author = author or _person(req.user)
    done = req.status == 'completed'
    return RefData(
        kind='udk', number=f'MLN-{_code(req.pk)}', author=author, work_type=T.t('UDK', lang), title=req.title,
        status=T.t(key, lang, code=req.udk_code or '—'), tone=tone,
        rows=_udk_rows(author, req.title, req.udk_code if done else '', req.udk_description if done else '',
                       _org(req.user), _date(req.completed_at), lang),
        lang=lang,
    )


def for_udk_certificate(cert, lang: str) -> RefData:
    lang = normalize_lang(lang)
    author = cert.author_name or _person(cert.user)
    return RefData(
        kind='udk', number=f'MLN-U{cert.pk}', author=author, work_type=T.t('UDK', lang), title=cert.title,
        status=T.t('udk_completed', lang, code=cert.udk_code), tone='done',
        rows=_udk_rows(author, cert.title, cert.udk_code, cert.udk_description, _org(cert.user),
                       _date(cert.created_at), lang),
        lang=lang,
    )


def for_doi(dr, lang: str) -> RefData:
    lang = normalize_lang(lang)
    status_map = {'pending_payment': ('pending_payment', 'progress'), 'submitted': ('doi_submitted', 'progress'),
                  'completed': ('doi_completed', 'done')}
    key, tone = status_map.get(dr.status, ('doi_submitted', 'progress'))
    author = f'{dr.author_last_name} {dr.author_first_name}'.strip() or _person(dr.user)
    file_name = Path(str(dr.file.name or '')).name if dr.file else ''
    return RefData(
        kind='doi', number=f'MLN-{_code(dr.pk)}', author=author, work_type=T.t('DOI', lang),
        title=(dr.doi_link or '').strip() or file_name or T.t('DOI', lang),
        status=T.t(key, lang), tone=tone,
        rows=[
            ('l_author', author),
            ('l_doc_title', file_name or '—'),
            ('l_doi', (dr.doi_link or '').strip() or T.t('pending', lang)),
            ('l_org', _org(dr.user)),
            ('l_request_date', _date(dr.created_at)),
            ('l_issue_date', _date(dr.completed_at) or T.t('pending', lang)),
        ],
        lang=lang,
    )


# ---------------------------------------------------------------- chizish

def _is_cyr(text: str) -> bool:
    return any('\u0400' <= ch <= '\u04ff' for ch in text)


def _sans(text: str, size: int):
    from PIL import ImageFont

    name = 'DejaVuSans-Bold.ttf' if _is_cyr(text) else 'Lexend-Bold.ttf'
    return ImageFont.truetype(str(FONT_DIR / name), size)


def _serif(size: int):
    from PIL import ImageFont

    return ImageFont.truetype(str(FONT_DIR / 'NotoSerif-Bold.ttf'), size)


def _size_for_cap(text: str, cap: int, serif: bool = False) -> int:
    """Bosh harf balandligi `cap` px bo'ladigan shrift o'lchami."""
    font = _serif(100) if serif else _sans(text, 100)
    box = font.getbbox('H')
    return max(8, int(round(cap * 100 / max(1, box[3] - box[1]))))


def _tracked_width(draw, text, font, tracking):
    return sum(draw.textlength(ch, font=font) for ch in text) + tracking * max(0, len(text) - 1)


def _draw_tracked(draw, center_x, baseline, text, font, tracking, color):
    x = center_x - _tracked_width(draw, text, font, tracking) / 2
    for ch in text:
        draw.text((x, baseline), ch, font=font, fill=color, anchor='ls')
        x += draw.textlength(ch, font=font) + tracking


def render_image(data: RefData):
    import qrcode
    from PIL import Image, ImageDraw

    from .works_report import _font_for

    img = Image.open(TEMPLATE_DIR / 'malumotnoma.blank.jpg').convert('RGB')
    d = ImageDraw.Draw(img)
    lang = data.lang

    def fit_line(text, size, max_w, bold):
        f = _font_for(text, size, bold=bold)
        while d.textlength(text, font=f) > max_w and len(text) > 4:
            text = text[:-2].rstrip() + '…'
        return text, f

    def put(x, baseline, text, size, max_w, color=VALUE_COLOR, bold=False, min_size=23, wrap=True, sep=' '):
        text = str(text or '—')
        s = size
        while s > min_size and d.textlength(text, font=_font_for(text, s, bold=bold)) > max_w:
            s -= 1
        if sep not in text:
            sep = ' '
        if wrap and d.textlength(text, font=_font_for(text, s, bold=bold)) > max_w and sep in text:
            # Uzun qiymat (masalan hujjat nomi) — qator oralig'iga sig'adigan ikki qatorga bo'linadi.
            # Mualliflar ro'yxati (sep=', ') ism o'rtasidan emas, mualliflar orasidan bo'linadi.
            words = text.split(sep)
            best = min(range(1, len(words)), key=lambda i: abs(len(sep.join(words[:i])) - len(sep.join(words[i:]))))
            lines = [sep.join(words[:best]) + sep.rstrip(), sep.join(words[best:])]
            s2 = 22
            while s2 > 17 and max(d.textlength(t, font=_font_for(t, s2, bold=bold)) for t in lines) > max_w:
                s2 -= 1
            for line, dy in zip(lines, (-12, 11)):
                line, f = fit_line(line, s2, max_w, bold)
                d.text((x, baseline + dy), line, font=f, fill=color, anchor='ls')
            return
        text, f = fit_line(text, s, max_w, bold)
        d.text((x, baseline), text, font=f, fill=color, anchor='ls')

    # Yuqori qator: hujjat raqami va sanasi
    from datetime import date

    for x, key, value, right in ((72, 'doc_number', data.number, 700), (739, 'doc_date', date.today().strftime('%d.%m.%Y'), 1340)):
        label = T.t(key, lang)
        f = _sans(label, _size_for_cap(label, 29))
        d.text((x, 83), label, font=f, fill='#0c5984', anchor='ls')
        put(x + d.textlength(label, font=f) + 14, 83, value, 30, right - x - d.textlength(label, font=f) - 14,
            bold=True)

    # Sarlavha (hujjat turiga qarab), ikki qator, markazda
    for key, cap, baseline, cx, max_w, color in (
            (f't_{data.kind}_1', 51, 184, 681, 960, '#047a9b'), (f't_{data.kind}_2', 68, 282, 690, 1060, '#085885')):
        text = T.t(key, lang)
        size = _size_for_cap(text, cap, serif=True)
        font = _serif(size)
        while size > 20 and _tracked_width(d, text, font, size * 0.14) > max_w:
            size -= 2
            font = _serif(size)
        _draw_tracked(d, cx, baseline, text, font, size * 0.14, color)

    # Yorliqlar (bir xil o'lchamda — eng uzuni 545 px ga sig'adi) va qiymatlar
    keys = [k for k, _ in data.rows] + ['l_status', 'l_website']
    labels = [T.t(k, lang) for k in keys]
    size = min(_size_for_cap(t, 33) for t in labels)
    while size > 16 and max(d.textlength(t, font=_sans(t, size)) for t in labels) > 545:
        size -= 1
    for i, (key, label) in enumerate(zip(keys, labels)):
        color = STATUS_LABEL_COLOR if key == 'l_status' else LABEL_COLOR
        d.text((87, 486 + 50 * i), label, font=_sans(label, size), fill=color, anchor='ls')
    for i, (key, value) in enumerate(data.rows):
        put(700, 486 + 50 * i, value, 30, 680, sep=', ' if key == 'l_authors' else ' ')
    put(700, 486 + 50 * len(data.rows), data.status, 30, 680, color=STATUS_COLORS.get(data.tone, VALUE_COLOR),
        bold=True)
    # web-sayt qiymati fonda bor (www.ilmiyfaoliyat.uz)

    # QR va izoh (gulchambar ichida / ostida)
    qr = qrcode.QRCode(border=1, box_size=10, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(data.verify_url)
    qr.make(fit=True)
    q = qr.make_image(fill_color='#0b3a57', back_color='white').convert('RGB').resize((210, 210), Image.NEAREST)
    img.paste(q, (551 - 105, 1110 - 105))
    cap_lines = [T.t(k, lang) for k in ('qr1', 'qr2', 'qr3')]
    qsize = min(_size_for_cap(t, 21) for t in cap_lines)
    while qsize > 10 and max(d.textlength(t, font=_sans(t, qsize)) for t in cap_lines) > 290:
        qsize -= 1
    for line, baseline in zip(cap_lines, (1309, 1342, 1376)):
        f = _sans(line, qsize)
        d.text((551 - d.textlength(line, font=f) / 2, baseline), line, font=f, fill='#0e7a98', anchor='ls')
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
