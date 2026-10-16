from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction as db_transaction
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Article
from .serializers import (
    ArticleSerializer,
    ArticleListSerializer,
    CreateArticleSerializer,
    PublicArticleShareSerializer,
)
from apps.payments.models import Transaction
from apps.payments.pricing import publication_fee_amount
from apps.journals.models import Journal
from django.conf import settings
from config.throttles import PlagiarismActionThrottle
from .views_antiplagiat import ArticleAntiplagiatActionsMixin
from .views_operator_chat import ArticleOperatorChatMixin
from .views_publication import ArticlePublicationActionsMixin
import logging

logger = logging.getLogger(__name__)


class ArticleViewSet(
    ArticleAntiplagiatActionsMixin,
    ArticlePublicationActionsMixin,
    ArticleOperatorChatMixin,
    viewsets.ModelViewSet,
):
    """ViewSet for managing articles"""
    queryset = Article.objects.all()
    serializer_class = ArticleSerializer
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        if getattr(self, 'action', None) == 'check_plagiarism':
            return [PlagiarismActionThrottle()]
        return super().get_throttles()

    def list(self, request, *args, **kwargs):
        """List articles with defensive error handling to avoid 500."""
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logger.exception("Article list failed: %s", e)
            return Response(
                {'detail': str(e) if settings.DEBUG else "Maqolalar ro'yxatini yuklashda server xatoligi."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='mine')
    def mine(self, request):
        """
        Muallifning barcha maqolalari (Draft, Yangi, ...) — paginatsiyasiz, barqaror ro'yxat.
        """
        qs = (
            Article.objects.filter(
                Q(author=request.user) | Q(co_authors=request.user)
            )
            .select_related('author', 'journal')
            .distinct()
            .order_by('-submission_date')
        )
        serializer = ArticleListSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='staff')
    def staff(self, request):
        """
        Bosh admin / jurnal admin / operator: tegishli barcha maqolalar (Draft ham),
        paginatsiyasiz.
        """
        role = self._user_role()
        if role not in self._staff_list_roles() and not getattr(request.user, 'is_superuser', False):
            return Response({'detail': 'Ruxsat yo\'q.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            qs = self.get_queryset().order_by('-submission_date')
            serializer = ArticleListSerializer(qs, many=True, context=self.get_serializer_context())
            return Response(serializer.data)
        except Exception as e:
            logger.exception('Article staff list failed: %s', e)
            return Response(
                {'detail': str(e) if settings.DEBUG else "Maqolalar ro'yxatini yuklashda server xatoligi."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    
    def _user_role(self):
        role = getattr(self.request.user, 'role', None) or 'author'
        if isinstance(role, str):
            return role.strip().lower()
        return role

    def _staff_list_roles(self):
        return frozenset({'super_admin', 'journal_admin', 'operator', 'accountant'})

    def get_queryset(self):
        # Ro'yxat: og'ir prefetchsiz — ba'zi maqolalarda 500 va bo'sh ro'yxat muammosini oldini oladi.
        if getattr(self, 'action', None) in ('list', 'mine', 'staff'):
            base_queryset = Article.objects.select_related('author', 'journal', 'published_by')
        else:
            base_queryset = Article.objects.select_related(
                'author', 'journal', 'published_by'
            ).prefetch_related(
                'versions', 'activity_logs', 'peer_reviews', 'co_authors'
            )
        role = self._user_role()
        if role == 'super_admin' or getattr(self.request.user, 'is_superuser', False):
            return base_queryset.all()
        elif role == 'journal_admin':
            # Mustaqil antiplagiat hujjati jurnalga yuborilgan maqola emas — u texnik sababli biror jurnalga
            # bog'langan bo'ladi, lekin o'sha jurnal muharriri muallifning maxfiy hujjatini ko'rmasligi kerak.
            # exclude(json_key=True) SQL da NULL ni ham chiqarib tashlaydi — shuning uchun ijobiy shart bilan
            return (
                base_queryset.filter(journal__journal_admin=self.request.user)
                .filter(
                    Q(plagiarism_report__is_standalone__isnull=True)
                    | Q(plagiarism_report__is_standalone=False)
                )
                .exclude(title__istartswith='plagiarism check')
                # To'lanmagan qoralama — tahririyat ishi emas: avval muharrirning "Yangi kelganlar" ro'yxatini
                # to'ldirardi. Maqola to'lovdan keyin "Yangi" bo'lib muharrirga ko'rinadi (bildirishnoma bilan).
                .exclude(status='Draft')
            )
        elif role == 'author':
            return base_queryset.filter(
                Q(author=self.request.user) | Q(co_authors=self.request.user)
            ).distinct()
        elif role == 'reviewer':
            # Ko'rib chiqilayotgan maqolalar + o'ziga taqriz tayinlangan maqolalar (holatidan qat'i nazar):
            # avval tayinlangan maqola boshqa holatda bo'lsa, bildirishnomadagi havola 404 berardi
            # Taklifni rad etgan taqrizchi maqolani (va qo'lyozmani) boshqa ko'rmaydi — avval rad etgandan keyin
            # ham ochib, faylini yuklab olaverardi.
            from apps.reviews.models import PeerReview

            # Faqat o'ziga tayinlangan maqolalar. Avval "Taqrizda" holatidagi BARCHA jurnallar maqolalari va
            # kitob buyurtmalari (muallif manzili, telefoni bilan) hamma taqrizchilarga ochiq edi.
            engaged = PeerReview.objects.filter(reviewer=self.request.user).exclude(status='declined').values('article_id')
            return base_queryset.filter(pk__in=engaged).distinct()
        elif role == 'operator':
            return base_queryset.all()
        elif role == 'accountant':
            return base_queryset.all()
        # Noma'lum rol: kamida o'z maqolalarini ko'rsat (bo'sh ro'yxat oldini olish)
        return base_queryset.filter(
            Q(author=self.request.user) | Q(co_authors=self.request.user)
        ).distinct()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CreateArticleSerializer
        if self.action == 'list':
            return ArticleListSerializer
        return ArticleSerializer

    def _journal_has_publication_fee(self, journal) -> bool:
        if journal is None:
            return False
        try:
            pub = float(journal.publication_fee or 0)
            per = float(journal.price_per_page or 0)
            return pub > 0 or per > 0
        except (TypeError, ValueError):
            return False

    def _prepaid_publication_tx(self, request, journal, page_count):
        """
        Maqola yaratishda yuborilgan oldindan to'lov (payment_transaction_id) haqiqatan yaroqlimi.

        Avval faqat egasi, turi va holati tekshirilardi: boshqa maqolaga ishlatilgan bitta to'lov bilan
        istalgan (qimmatroq) jurnalga cheksiz maqola yuborish mumkin edi. Endi to'lov hali hech bir maqolaga
        bog'lanmagan va summasi shu jurnalning (sahifalar soni bilan) narxidan kam bo'lmasligi shart.
        """
        tx_id = request.data.get('payment_transaction_id')
        if not tx_id or journal is None:
            return None
        try:
            tx = Transaction.objects.get(
                id=tx_id, user=request.user, service_type='publication_fee', status='completed',
            )
        except (Transaction.DoesNotExist, ValueError, TypeError, DjangoValidationError):
            return None
        if tx.article_id:
            return None
        if Decimal(str(tx.amount)) + Decimal('0.01') < publication_fee_amount(journal, page_count):
            return None
        return tx

    def _resolve_awaiting_publication_payment(self, request, journal=None, page_count=None):
        """
        Oldindan to'lovli jurnalda to'lov tugamaguncha Draft yaratish.
        Frontend flag yubormasa ham (eski build) avtomatik yoqiladi.
        """
        explicit = str(request.data.get('awaiting_publication_payment', '')).lower() in (
            '1', 'true', 'yes',
        )
        if explicit:
            return True

        if journal is None:
            journal_raw = request.data.get('journal')
            if not journal_raw:
                return False
            try:
                journal = Journal.objects.get(pk=journal_raw)
            except (Journal.DoesNotExist, ValueError, TypeError, DjangoValidationError):
                return False

        if getattr(journal, 'payment_model', None) == 'pre-payment' and self._journal_has_publication_fee(journal):
            return self._prepaid_publication_tx(request, journal, page_count) is None
        return False

    def create(self, request, *args, **kwargs):
        """Oldindan to'lovli jurnal: yaroqli to'lov bo'lmasa maqola Draft (to'lov kutilmoqda) bo'lib yaratiladi."""
        # Avval tekshiruv (sahifalar soni fayldan aniqlanadi), so'ng to'lov holatiga qarab Draft/Yangi
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book_journal = None
        if (serializer.validated_data.get('title') or '').strip().upper().startswith('[KITOB]'):
            # Kitob buyurtmasi jurnal maqolasi emas: frontend ro'yxatdagi birinchi jurnalni yuborardi va o'sha
            # jurnal muharriri buyurtmani (manzil, telefon) ko'rardi. Endi ichki kitob jurnali; kitob to'lovi
            # (book_publication) tasdiqlanguncha — qoralama.
            from apps.journals.internal import get_book_orders_journal

            book_journal = get_book_orders_journal()
            if book_journal is not None:
                serializer.validated_data['journal'] = book_journal
        journal = serializer.validated_data.get('journal')
        if book_journal is None and getattr(journal, 'is_internal', False):
            return Response({'journal': ["Bu jurnalga maqola yuborib bo'lmaydi."]}, status=status.HTTP_400_BAD_REQUEST)
        page_count = serializer.validated_data.get('page_count')
        awaiting_payment = (
            True if book_journal is not None
            else self._resolve_awaiting_publication_payment(request, journal, page_count)
        )
        serializer.context['awaiting_publication_payment'] = awaiting_payment
        title_val = (serializer.validated_data.get('title') or '').strip()
        kw_list = serializer.validated_data.get('keywords') or []
        is_antiplagiat_flow = (
            title_val.lower().startswith('plagiarism check')
            or any(str(k).lower() == 'plagiarism' for k in kw_list)
        )
        prepaid_tx = None
        if journal:
            try:
                journal_obj = journal if isinstance(journal, Journal) else Journal.objects.get(pk=journal)
                has_fee = (journal_obj.publication_fee and float(journal_obj.publication_fee) > 0) or (
                    journal_obj.price_per_page and float(journal_obj.price_per_page) > 0
                )
                # Mustaqil antiplagiat: to'lov alohida (language_editing); jurnal nashr oldindan to'lovini talab qilmaymiz
                if is_antiplagiat_flow:
                    pass
                elif journal_obj.payment_model == 'pre-payment' and has_fee and not awaiting_payment:
                    prepaid_tx = self._prepaid_publication_tx(request, journal_obj, page_count)
                    if prepaid_tx is None:
                        return Response(
                            {'detail': 'Ushbu jurnal oldindan to\'lov talab qiladi. To\'lov topilmadi, '
                                       'boshqa maqolaga ishlatilgan yoki summasi yetarli emas.'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
            except Journal.DoesNotExist:
                pass
        try:
            with db_transaction.atomic():
                if prepaid_tx is not None:
                    # Bir vaqtda ikki so'rov bitta to'lovni ishlatmasin
                    locked = Transaction.objects.select_for_update().get(pk=prepaid_tx.pk)
                    if locked.article_id:
                        return Response(
                            {'detail': 'Bu to\'lov allaqachon boshqa maqolaga ishlatilgan.'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                self.perform_create(serializer)
                article = serializer.instance
                if prepaid_tx is not None:
                    locked.article = article
                    locked.save(update_fields=['article'])
            if article and awaiting_payment and article.status == 'Draft' and not is_antiplagiat_flow:
                try:
                    from .submission_notifications import notify_article_draft_pending_payment
                    notify_article_draft_pending_payment(article)
                except Exception as notify_err:
                    logger.warning('Article draft notify failed: %s', notify_err)
            if article and article.status == 'Yangi' and not is_antiplagiat_flow:
                try:
                    from .submission_notifications import notify_article_submitted
                    notify_article_submitted(article)
                except Exception as notify_err:
                    logger.warning('Article submit notify failed: %s', notify_err)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except (DRFValidationError, PermissionDenied):
            # Foydalanuvchi xatosi (400/403) — server xatosi (500) sifatida yashirilmasin
            raise
        except Exception as e:
            logger.exception('Article create failed: %s', e)
            detail = (
                str(e)
                if settings.DEBUG
                else 'Maqola yuborishda server xatoligi yuz berdi. Keyinroq qayta urinib ko‘ring yoki administrator bilan bog‘laning.'
            )
            return Response({'detail': detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _is_super_admin(self):
        return self._user_role() == 'super_admin' or getattr(self.request.user, 'is_superuser', False)

    def update(self, request, *args, **kwargs):
        """
        Umumiy tahrirlash faqat muallif (o'z maqolasi) yoki bosh admin uchun.
        Operator / buxgalter / taqrizchi maqolani ko'ra oladi, lekin o'zgartira olmaydi.
        Holat va natijalar serializer'da read-only — ular alohida amallar orqali o'zgaradi.
        """
        article = self.get_object()
        if not self._is_super_admin():
            if article.author_id != request.user.id:
                return Response({'detail': 'Maqolani tahrirlash huquqingiz yo\'q.'}, status=status.HTTP_403_FORBIDDEN)
            blocked = self._author_edit_block_reason(article, set(request.data.keys()))
            if blocked:
                return Response({'detail': blocked}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    # Muallif maqola tahririyatga o'tgach ham o'zgartira oladigan yagona maydon — antiplagiat sozlamalari
    # (u ham tekshiruv boshlanguncha; serializer.validate_plagiarism_report).
    AUTHOR_ALWAYS_EDITABLE = frozenset({'plagiarism_report'})
    # Antiplagiat to'lovi/tekshiruvidan keyin almashtirilsa, bitta to'lov bilan boshqa hujjat tekshirilardi
    CHECKED_CONTENT_FIELDS = frozenset({'final_pdf_path', 'title'})

    @staticmethod
    def _plagiarism_started(article) -> bool:
        report = article.plagiarism_report if isinstance(article.plagiarism_report, dict) else {}
        return bool(article.plagiarism_checked_at) or report.get('check_status') in ('processing', 'completed')

    def _author_edit_block_reason(self, article, keys: set[str]) -> str | None:
        """
        Muallif tahriri: qoralama (to'lovgacha) va tahrirga qaytarilgan maqola. Tahririyatdagi, qabul qilingan
        yoki nashr etilgan maqolaning fayli/sarlavhasi o'zgarmaydi (taqrizdan keyin faylni almashtirib bo'lmaydi).
        """
        if article.status == 'Revision':
            return None
        if article.status == 'Draft':
            if self._plagiarism_started(article) and keys & self.CHECKED_CONTENT_FIELDS:
                return 'Antiplagiat tekshiruvi o\'tkazilgan hujjatning fayli va nomini o\'zgartirib bo\'lmaydi.'
            return None
        if keys - self.AUTHOR_ALWAYS_EDITABLE:
            return 'Maqola tahririyatga yuborilgan — uni faqat tahrirga qaytarilganda o\'zgartirish mumkin.'
        return None

    def destroy(self, request, *args, **kwargs):
        """O'chirish: bosh admin yoki muallif — faqat to'lanmagan qoralamasini."""
        article = self.get_object()
        if not self._is_super_admin():
            if article.author_id != request.user.id or article.status != 'Draft':
                return Response(
                    {'detail': 'Faqat o\'z qoralamangizni o\'chirishingiz mumkin.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if Transaction.objects.filter(article=article, status='completed').exists():
                return Response(
                    {'detail': 'To\'lovi amalga oshirilgan maqolani o\'chirib bo\'lmaydi.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        return super().destroy(request, *args, **kwargs)

    # Maqola yaratilishi bilan avtomatik antiplagiat tekshiruvi O'CHIRILGAN:
    # bepul Gemini chaqiruqlariga yo'l qo'ymaslik va mustaqil (to'langan) tekshiruv bilan farqni saqlash.
    # Tekshiruv faqat check_plagiarism action yoki boshqa rasmiy jarayon orqali amalga oshiriladi.


@api_view(['GET'])
@permission_classes([AllowAny])
def public_article_detail(request, pk):
    """Public endpoint for shared published article details."""
    article = Article.objects.select_related('author', 'journal').filter(
        pk=pk,
        status='Published'
    ).first()

    if not article:
        return Response({'detail': 'Maqola topilmadi yoki hali nashr etilmagan.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = PublicArticleShareSerializer(article, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def article_page_count(request):
    """
    Yuklanadigan fayldagi sahifalar soni — maqola yaratishda server aynan shu qiymat bo'yicha narx oladi
    (CreateArticleSerializer.validate). Frontend to'lov summasini oldindan to'g'ri ko'rsatishi uchun.
    """
    from config.upload_validation import validate_document
    from .page_count import count_pages

    upload = request.FILES.get('file')
    if not upload:
        return Response({'detail': 'Fayl yuborilmadi.'}, status=status.HTTP_400_BAD_REQUEST)
    validate_document(upload)
    pages = count_pages(upload)
    return Response({'pages': pages, 'detected': pages is not None})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def antiplagiat_modules(request):
    """Joriy sozlamalarda haqiqatan tekshiriladigan antiplagiat modullari (UI tanlovi uchun)."""
    from .antiplagiat_available import available_modules

    mods = available_modules()
    return Response({'modules': mods, 'count': len(mods)})


# urls.py va boshqa modullar uchun (eski import yo'llari o'zgarmasin)
from .views_antiplagiat import _check_plagiarism_thresholds  # noqa: E402,F401
from .views_requests import (  # noqa: E402,F401
    ArticleSampleRequestViewSet,
    DoiRequestViewSet,
    _article_sample_price_per_page,
    article_sample_price,
    article_sample_request_create,
    doi_price,
    doi_request_create,
)
from .views_verify import verify_document  # noqa: E402,F401
