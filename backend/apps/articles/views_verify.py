"""Sertifikat/chek/ma'lumotnoma haqiqiyligini QR kod bo'yicha tekshirish (ochiq endpoint)."""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.throttling import AnonRateThrottle
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import Article
from apps.users.models import User
from django.utils import timezone


class _VerifyThrottle(AnonRateThrottle):
    rate = '30/minute'


def _uuid_prefix_filter(manager, prefix: str):
    """UUID boshlang'ich 8 belgisi bo'yicha qidiruv (PostgreSQL va SQLite da bir xil ishlaydi)."""
    from django.db.models import CharField
    from django.db.models.functions import Cast, Lower

    return manager.annotate(_id_text=Lower(Cast('id', output_field=CharField()))).filter(
        _id_text__startswith=prefix.lower()
    )


def _verify_antiplagiat(code: str):
    article = (
        Article.objects.filter(plagiarism_report__certificate_number=code, plagiarism_checked_at__isnull=False)
        .order_by('-plagiarism_checked_at')
        .first()
    )
    if not article:
        return None
    report = article.plagiarism_report if isinstance(article.plagiarism_report, dict) else {}
    from .antiplagiat_utils import antiplagiat_authors

    # Formada kiritilgan muallif va hammualliflar (sertifikatdagi kabi)
    authors = antiplagiat_authors(report, fallback=article.author.get_full_name() if article.author_id else '')
    return {
        'type': 'antiplagiat',
        'type_label': 'Antiplagiat sertifikati',
        'document_number': code,
        'title': str(report.get('document_name') or article.title or ''),
        'author': ', '.join(authors),
        'authors': authors,
        'date': timezone.localtime(article.plagiarism_checked_at).strftime('%d.%m.%Y'),
        'details': {
            'plagiarism_percent': round(float(article.plagiarism_percentage or 0), 2),
            'originality_percent': round(float(article.originality_percentage or 0), 2),
            'citation_percent': report.get('citation_percent'),
            'self_citation_percent': report.get('self_citation_percent'),
            'algorithm_version': report.get('algorithm_version'),
        },
    }


def _verify_acceptance(prefix: str):
    from .works_report import ACCEPTANCE_EXCLUDED_STATUSES

    qs = _uuid_prefix_filter(Article.objects, prefix).exclude(
        status__in=ACCEPTANCE_EXCLUDED_STATUSES,
    ).select_related('author', 'journal')
    if qs.count() != 1:
        return None
    article = qs.first()
    return {
        'type': 'acceptance',
        'type_label': "Maqola qabul qilinganligi haqida ma'lumotnoma",
        'document_number': f'QBL-{prefix.upper()}',
        'title': article.title,
        'author': (article.submitted_author_name or '').strip() or article.author.get_full_name(),
        'date': timezone.localtime(article.submission_date).strftime('%d.%m.%Y') if article.submission_date else '',
        'details': {
            'journal': getattr(article.journal, 'name', '') or '',
            'status': dict(Article.STATUS_CHOICES).get(article.status, article.status),
        },
    }


def _verify_receipt(prefix: str):
    """To'lov cheki: CHK-xxxxxxxx. Ochiq sahifada to'lovchining faqat ism-familiyasi qisqartirib ko'rsatiladi."""
    from apps.payments.labels import receipt_number, service_label
    from apps.payments.models import Transaction

    qs = _uuid_prefix_filter(Transaction.objects, prefix).filter(status='completed').select_related('user')
    if qs.count() != 1:
        return None
    tx = qs.first()
    user = tx.user
    payer = ''
    if user:
        first = (user.first_name or '').strip()
        payer = f"{first[:1]}. {(user.last_name or '').strip()}".strip('. ').strip() if first else (user.last_name or '')
    return {
        'type': 'receipt',
        'type_label': "To'lov cheki",
        'document_number': receipt_number(tx),
        'title': service_label(tx.service_type),
        'author': payer,
        'date': timezone.localtime(tx.completed_at or tx.created_at).strftime('%d.%m.%Y'),
        'details': {
            'amount': f"{int(tx.amount or 0):,} so'm".replace(',', ' '),
            'status': "To'langan",
        },
    }


def _verify_udk(num: int):
    from apps.udc.models import UDKCertificate

    cert = UDKCertificate.objects.filter(pk=num).select_related('user').first()
    if not cert:
        return None
    return {
        'type': 'udk',
        'type_label': "UDK ma'lumotnoma",
        'document_number': f'UDK-{num:06d}',
        'title': cert.title,
        'author': cert.author_name or (cert.user.get_full_name() if cert.user_id else ''),
        'date': timezone.localtime(cert.created_at).strftime('%d.%m.%Y') if cert.created_at else '',
        'details': {'udk_code': cert.udk_code, 'udk_description': cert.udk_description or ''},
    }


def _verify_publications_report(prefix: str):
    """HSB-xxxxxxxx — barcha ilmiy ishlar bo'yicha ma'lumotnoma."""
    from .works_report import collect_rows

    qs = _uuid_prefix_filter(User.objects, prefix)
    if qs.count() != 1:
        return None
    user = qs.first()
    return {
        'type': 'publications_report',
        'type_label': "Barcha ilmiy ishlar bo'yicha ma'lumotnoma",
        'document_number': f'HSB-{prefix.upper()}',
        'title': "Barcha ilmiy ishlar bo'yicha ma'lumotnoma",
        'author': user.get_full_name(),
        'date': '',
        'details': {'works_count': len(collect_rows(user))},
    }


def _verify_reference(code: str):
    """MLN-xxxxxxxx (maqola / antiplagiat / UDK so'rovi / DOI) yoki MLN-U<raqam> (UDK ma'lumotnoma) — joriy holat."""
    from apps.udc.models import UDKCertificate, UdkRequest

    from . import reference_doc
    from .models import DoiRequest

    data = None
    if code.startswith('U'):
        cert = UDKCertificate.objects.select_related('user').filter(pk=int(code[1:])).first()
        data = cert and reference_doc.for_udk_certificate(cert, 'uz')
    else:
        prefix = code.lower()
        for model, build in ((Article, reference_doc.for_article), (UdkRequest, reference_doc.for_udk_request),
                             (DoiRequest, reference_doc.for_doi)):
            qs = _uuid_prefix_filter(model.objects, prefix)
            if qs.count() == 1:
                data = build(qs.first(), 'uz')
                break
    if not data:
        return None
    return {
        'type': 'status_reference',
        'type_label': "Hujjat holati haqida ma'lumotnoma",
        'document_number': data.number,
        'title': data.title,
        'author': data.author,
        'authors': data.authors or ([data.author] if data.author else []),
        'date': timezone.localtime().strftime('%d.%m.%Y'),
        'details': {'work_type': data.work_type, 'status': data.status},
    }


def _verify_work_report(prefix: str, lang: str = 'uz'):
    """ISH-xxxxxxxx — bitta ilmiy ish bo'yicha ma'lumotnoma. Ish turi va nashr shakli so'rov tilida."""
    from .works_report import ACCEPTANCE_EXCLUDED_STATUSES, collect_rows

    qs = _uuid_prefix_filter(Article.objects, prefix).exclude(
        status__in=ACCEPTANCE_EXCLUDED_STATUSES,
    ).select_related('author', 'journal')
    if qs.count() != 1:
        return None
    article = qs.first()
    row = collect_rows(article.author, article=article, lang=lang)[0]
    return {
        'type': 'work_report',
        'type_label': "Ilmiy ish bo'yicha ma'lumotnoma",
        'document_number': f'ISH-{prefix.upper()}',
        'title': row.title,
        'author': (article.submitted_author_name or '').strip() or article.author.get_full_name(),
        'date': timezone.localtime(article.submission_date).strftime('%d.%m.%Y') if article.submission_date else '',
        'details': {
            'work_type': row.work_type,
            'publication': row.publish,
            'status': dict(Article.STATUS_CHOICES).get(article.status, article.status),
        },
    }


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([_VerifyThrottle])
def verify_document(request, code):
    """
    Sertifikatdagi QR kod orqali hujjat haqiqiyligini tekshirish (login talab qilinmaydi).
    Qiymatlar (type_label, status, ...) o'zbekcha qaytadi — frontend ularni interfeys tiliga tarjima qiladi.
    Kodlar: <raqam> (antiplagiat), QBL-xxxxxxxx (qabul), UDK-000123, HSB-xxxxxxxx (barcha ilmiy ishlar), ISH-xxxxxxxx (bitta ish).
    """
    import re as _re

    raw = (code or '').strip()
    up = raw.upper()
    result = None
    if _re.fullmatch(r'\d{6,14}', raw):
        result = _verify_antiplagiat(raw)
    elif _re.fullmatch(r'QBL-[0-9A-F]{8}', up):
        result = _verify_acceptance(up[4:].lower())
    elif _re.fullmatch(r'UDK-\d{1,9}', up):
        result = _verify_udk(int(up[4:]))
    elif _re.fullmatch(r'HSB-[0-9A-F]{8}', up):
        result = _verify_publications_report(up[4:].lower())
    elif _re.fullmatch(r'MLN-(?:[0-9A-F]{8}|U\d{1,9})', up):
        result = _verify_reference(up[4:])
    elif _re.fullmatch(r'ISH-[0-9A-F]{8}', up):
        from config.doc_i18n import request_lang

        result = _verify_work_report(up[4:].lower(), request_lang(request))
    elif _re.fullmatch(r'CHK-[0-9A-F]{8}', up):
        result = _verify_receipt(up[4:].lower())
    if not result:
        return Response({'valid': False, 'detail': 'Hujjat topilmadi yoki kod noto\'g\'ri.'}, status=status.HTTP_404_NOT_FOUND)
    return Response({'valid': True, **result})
