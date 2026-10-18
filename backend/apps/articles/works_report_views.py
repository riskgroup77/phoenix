"""Muallif ilmiy ishlari bo'yicha ma'lumotnoma (PDF / DOCX) — works_report.py generatori ustidan API."""
import logging

from django.db.models import Q
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from config.doc_i18n import request_lang

from . import works_report
from .models import Article

logger = logging.getLogger(__name__)

CONTENT_TYPES = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def works_report_view(request):
    """
    GET /api/articles/reports/works/?fmt=pdf|docx[&lang=uz|ru|en][&article=<uuid>][&workplace=..][&position=..]
    article berilmasa — barcha ilmiy ishlar bo'yicha ma'lumotnoma, berilsa — faqat shu ish bo'yicha.
    """
    fmt = (request.GET.get('fmt') or 'pdf').lower()
    if fmt not in CONTENT_TYPES:
        return Response({'detail': "fmt: pdf yoki docx"}, status=400)
    user = request.user
    article = None
    article_id = request.GET.get('article')
    if article_id:
        article = (
            Article.objects.filter(Q(author=user) | Q(co_authors=user), pk=article_id)
            .exclude(status__in=works_report.ACCEPTANCE_EXCLUDED_STATUSES)
            .distinct()
            .first()
        )
        if article is None:
            return Response({'detail': "Ish topilmadi yoki bu holatda ma'lumotnoma berilmaydi."}, status=404)

    lang = request_lang(request)  # hujjat interfeys tilida (uz / ru / en)
    meta = works_report.build_meta(
        user,
        lang=lang,
        article=article,
        workplace=(request.GET.get('workplace') or '')[:255],
        position=(request.GET.get('position') or '')[:150],
    )
    rows = works_report.collect_rows(user, article=article, lang=lang)
    try:
        data = works_report.build_pdf(meta, rows) if fmt == 'pdf' else works_report.build_docx(meta, rows)
    except Exception:
        logger.exception('works_report: generatsiya xatosi (user=%s, article=%s)', user.pk, article_id)
        return Response({'detail': "Ma'lumotnoma yaratishda xatolik."}, status=500)

    filename = f"{'Ilmiy_ish' if article else 'Ilmiy_ishlar'}_malumotnoma_{meta.number}.{fmt}"
    resp = HttpResponse(data, content_type=CONTENT_TYPES[fmt])
    resp['Content-Disposition'] = f'attachment; filename="{filename}"'
    resp['Access-Control-Expose-Headers'] = 'Content-Disposition'
    return resp
