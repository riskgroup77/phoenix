"""Maqola antiplagiat amali (ArticleViewSet mixin) va jurnal chegaralarini tekshirish."""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.payments.models import Transaction
from apps.journals.models import Journal
import uuid
import logging

logger = logging.getLogger(__name__)


def _check_plagiarism_thresholds(article):
    """
    Jurnal belgilangan limitlar bo'yicha tekshiruv.
    Returns: ('accept' | 'reject' | 'review', reason_message).
    - accept: barcha talablar bajarilgan, nashrga yuborish mumkin.
    - reject: uchala talab ham bajarilmagan, avtomatik rad.
    - review: 1 yoki 2 ta bajarilmagan — bosh admin qaror qiladi.
    """
    journal = article.journal
    if journal is None:
        return 'accept', ''
    pmax = getattr(journal, 'plagiarism_max_percent', None)
    amax = getattr(journal, 'ai_content_max_percent', None)
    omin = getattr(journal, 'originality_min_percent', None)
    if pmax is None and amax is None and omin is None:
        return 'accept', ''
    plag = getattr(article, 'plagiarism_percentage', 0) or 0
    ai = getattr(article, 'ai_content_percentage', 0) or 0
    orig = getattr(article, 'originality_percentage', None)
    if orig is None and article.plagiarism_checked_at:
        orig = max(0, 100 - plag)
    elif orig is None:
        orig = max(0, 100 - plag)
    pass_plag = (pmax is None or plag <= pmax)
    pass_ai = (amax is None or ai <= amax)
    pass_orig = (omin is None or orig >= omin)
    passed = sum([pass_plag, pass_ai, pass_orig])
    failed = 3 - passed
    if passed == 3:
        return 'accept', ''
    if failed == 3:
        return 'reject', (
            f'Plagiat: {plag:.1f}% (limit {pmax}%), AI: {ai:.1f}% (limit {amax}%), '
            f'Originalilik: {orig:.1f}% (min {omin}%). Uchala talab bajarilmadi.'
        )
    return 'review', (
        f'Plagiat: {plag:.1f}% (limit {pmax or "-"}), AI: {ai:.1f}% (limit {amax or "-"}), '
        f'Originalilik: {orig:.1f}% (min {omin or "-"}). Bosh administrator qarori kerak.'
    )


class ArticleAntiplagiatActionsMixin:
    """ArticleViewSet: maqolani antiplagiatga yuborish."""

    @action(detail=True, methods=['post'])
    def check_plagiarism(self, request, pk=None):
        """Check article for plagiarism. Requires a completed payment for this article (language_editing)."""
        raw_pk = pk if pk is not None else self.kwargs.get(self.lookup_field or 'pk')
        if raw_pk is None or str(raw_pk).strip() == '':
            return Response(
                {'error': 'Maqola identifikatori yo\'q yoki noto\'g\'ri.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            uuid.UUID(str(raw_pk))
        except (ValueError, TypeError, AttributeError):
            return Response(
                {'error': 'Maqola ID noto\'g\'ri formatda.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        logger.info(f"[CHECK_PLAGE] Starting plagiarism check for article {raw_pk} by user {request.user.id if request.user else 'ANON'}")
        article = self.get_object()

        # Permission: author (own), super_admin (any), journal_admin (own journal only)
        if article.author != request.user and request.user.role != 'super_admin':
            if request.user.role == 'journal_admin':
                # To'g'ridan-to'g'ri Journal qidiruvi — article.journal lazy load / FK nozik holatlarda xavfsizroq
                admin_id = None
                if getattr(article, 'journal_id', None):
                    admin_id = (
                        Journal.objects.filter(pk=article.journal_id)
                        .values_list('journal_admin_id', flat=True)
                        .first()
                    )
                if admin_id != request.user.id:
                    return Response(
                        {'error': 'Siz faqat o\'z jurnalingizdagi maqolalarni tekshirishingiz mumkin'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            else:
                return Response(
                    {'error': 'Siz bu maqolani tekshirish huquqiga egasiz'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Require completed payment for plagiarism check (language_editing service type)
        has_paid = Transaction.objects.filter(
            article=article,
            user=request.user,
            status='completed',
            service_type='language_editing'
        ).exists()
        logger.info(f"[CHECK_PLAGE] Has paid transaction: {has_paid}, role: {request.user.role}")
        if not has_paid and request.user.role not in ('super_admin',):
            return Response(
                {'error': 'Antiplagiat tekshiruvi uchun to\'lov talab qilinadi. Iltimos, avval to\'lovni amalga oshiring.'},
                status=status.HTTP_402_PAYMENT_REQUIRED
            )
        
        if not article.final_pdf_path:
            logger.warning(f"[CHECK_PLAGE] No document file for article {article.id}")
            return Response(
                {'error': 'Plagiat tekshiruvi uchun maqola fayli kerak'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            import threading

            from apps.articles.plagiarism_check_service import (
                get_plagiarism_check_status,
                mark_plagiarism_processing,
                run_plagiarism_check,
            )

            force = str(request.data.get('force', '')).lower() in ('1', 'true', 'yes')
            enabled_modules = request.data.get('enabled_modules')
            if enabled_modules is not None and not isinstance(enabled_modules, list):
                enabled_modules = None

            status_now = get_plagiarism_check_status(article)
            if status_now.get('status') == 'processing' and not force:
                return Response(
                    {
                        'status': 'processing',
                        'message': 'Antiplagiat tekshiruvi davom etmoqda. Iltimos, kuting.',
                        **status_now,
                    },
                    status=status.HTTP_202_ACCEPTED,
                )

            if (
                not force
                and article.plagiarism_checked_at
                and article.plagiarism_percentage is not None
                and status_now.get('status') != 'failed'
            ):
                report = article.plagiarism_report or {}
                return Response({
                    'status': 'completed',
                    'plagiarism': float(article.plagiarism_percentage or 0),
                    'ai_content': float(article.ai_content_percentage or 0),
                    'originality': float(article.originality_percentage or 0),
                    'checked_at': article.plagiarism_checked_at,
                    'report': report,
                    'sources': report.get('sources', []) if isinstance(report, dict) else [],
                    'cached': True,
                })

            article_pk = str(article.id)
            user_pk = str(request.user.id)
            mark_plagiarism_processing(article, enabled_modules)

            from apps.articles.tasks import enqueue_plagiarism_check

            if not enqueue_plagiarism_check(
                article_pk,
                user_pk,
                enabled_modules=enabled_modules,
                force=True,
            ):

                def _run_bg():
                    from django.contrib.auth import get_user_model

                    from apps.articles.models import Article

                    User = get_user_model()
                    try:
                        art = Article.objects.get(pk=article_pk)
                        usr = User.objects.get(pk=user_pk)
                        run_plagiarism_check(
                            art,
                            usr,
                            force=True,
                            enabled_modules=enabled_modules,
                        )
                    except Exception as bg_err:
                        logger.error('[CHECK_PLAGE] background check failed: %s', bg_err, exc_info=True)

                threading.Thread(
                    target=_run_bg,
                    daemon=True,
                    name=f'plagiarism-api-{article_pk[:8]}',
                ).start()

            return Response(
                {
                    'status': 'processing',
                    'message': (
                        'Antiplagiat tekshiruvi boshlandi. '
                        'Hujjat hajmiga qarab bir necha daqiqa davom etishi mumkin.'
                    ),
                    **get_plagiarism_check_status(article),
                },
                status=status.HTTP_202_ACCEPTED,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError as e:
            return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            logger.error(f"[CHECK_PLAGE] Error checking plagiarism: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Plagiat tekshiruvida xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
