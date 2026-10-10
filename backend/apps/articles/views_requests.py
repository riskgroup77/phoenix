"""Maqola namunasi va DOI so'rovlari: narx, yaratish, ro'yxat."""
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import (
    ArticleSampleRequest,
    DoiRequest,
    ARTICLE_SAMPLE_PRICE_QUYI,
    ARTICLE_SAMPLE_PRICE_ORTA,
    ARTICLE_SAMPLE_PRICE_YUQORI,
)
from .serializers import DoiRequestSerializer, ArticleSampleRequestSerializer
from apps.notifications.models import Notification
from apps.payments.models import Transaction
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


def _article_sample_price_per_page(quality: str) -> int:
    from apps.udc.services import get_service_amount
    # 1 bet narxi (ServicePrice da boshqariladi; defaultlar yangilangan)
    if quality == 'yuqori':
        return int(get_service_amount('article_sample_yuqori', ARTICLE_SAMPLE_PRICE_YUQORI))
    if quality == 'orta':
        return int(get_service_amount('article_sample_orta', ARTICLE_SAMPLE_PRICE_ORTA))
    return int(get_service_amount('article_sample_quyi', ARTICLE_SAMPLE_PRICE_QUYI))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def article_sample_price(request):
    """1 bet narxlari: Narxlar sahifasida (ServicePrice) o'rnatiladi."""
    from apps.udc.services import get_service_amount
    quyi = int(get_service_amount('article_sample_quyi', ARTICLE_SAMPLE_PRICE_QUYI))
    orta = int(get_service_amount('article_sample_orta', ARTICLE_SAMPLE_PRICE_ORTA))
    yuqori = int(get_service_amount('article_sample_yuqori', ARTICLE_SAMPLE_PRICE_YUQORI))
    return Response({
        'quyi': quyi,
        'orta': orta,
        'yuqori': yuqori,
        'currency': 'UZS',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def article_sample_request_create(request):
    """
    Maqola namuna so'rovi: talablar, sahifalar, mavzu, daraja, ism/familya.
    Tranzaksiya yaratiladi; to'lovdan keyin so'rov taqrizchiga yuboriladi.
    """
    data = getattr(request, 'data', None) or request.POST.dict()
    requirements = (data.get('requirements') or '').strip()
    topic = (data.get('topic') or '').strip()
    quality_level = (data.get('quality_level') or 'orta').strip().lower()
    author_first_name = (data.get('first_name') or data.get('author_first_name') or '').strip()
    author_last_name = (data.get('last_name') or data.get('author_last_name') or '').strip()

    if not requirements:
        return Response({'detail': 'Talablar (requirements) majburiy.'}, status=status.HTTP_400_BAD_REQUEST)
    if not topic:
        return Response({'detail': 'Maqola mavzusi (topic) majburiy.'}, status=status.HTTP_400_BAD_REQUEST)
    if quality_level not in ('quyi', 'orta', 'yuqori'):
        return Response({'detail': "Daraja quyi, orta yoki yuqori bo'lishi kerak."}, status=status.HTTP_400_BAD_REQUEST)
    if not author_first_name or not author_last_name:
        return Response({'detail': 'Ism va familya majburiy.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        pages = max(1, min(500, int(data.get('pages', 1))))
    except (TypeError, ValueError):
        pages = 1

    price_per_page = _article_sample_price_per_page(quality_level)
    amount = pages * price_per_page

    transaction = Transaction.objects.create(
        user=request.user,
        amount=amount,
        currency='UZS',
        service_type='article_sample',
        extra_data={
            'requirements': requirements[:10000],
            'pages': pages,
            'topic': topic[:500],
            'quality_level': quality_level,
            'first_name': author_first_name[:150],
            'last_name': author_last_name[:150],
        },
    )

    return Response({
        'transaction_id': str(transaction.id),
        'amount': float(amount),
        'currency': 'UZS',
        'pages': pages,
        'quality_level': quality_level,
        'price_per_page': price_per_page,
    }, status=status.HTTP_201_CREATED)


# ---------- DOI raqami olish ----------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def doi_price(request):
    """DOI xizmati narxi: Narxlar sahifasida (ServicePrice doi_request) o'rnatiladi."""
    from apps.udc.services import get_service_amount
    amount = int(get_service_amount('doi_request', 100000))
    return Response({
        'amount': amount,
        'currency': 'UZS',
        'payment_required': amount > 0,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def doi_request_create(request):
    """
    DOI so'rovi: ism, familya, maqola fayli (doc/pdf). Fayl yuklanadi, tranzaksiya yaratiladi.
    Narx 0 bo'lsa to'lovsiz taqrizchiga yuboriladi; aks holda to'lovdan keyin.
    """
    data = getattr(request, 'data', None) or request.POST
    if hasattr(data, 'dict'):
        data = data.dict()
    else:
        data = dict(data) if data else {}
    author_first_name = (data.get('first_name') or data.get('author_first_name') or '').strip()[:150]
    author_last_name = (data.get('last_name') or data.get('author_last_name') or '').strip()[:150]
    file_obj = request.FILES.get('file')
    if not author_first_name or not author_last_name:
        return Response({'detail': 'Ism va familya majburiy.'}, status=status.HTTP_400_BAD_REQUEST)
    if not file_obj:
        return Response({'detail': 'Maqola fayli (DOC yoki PDF) yuklanishi shart.'}, status=status.HTTP_400_BAD_REQUEST)
    allowed = ('.doc', '.docx', '.pdf')
    name = (file_obj.name or '').lower()
    if not any(name.endswith(ext) for ext in allowed):
        return Response({'detail': 'Faqat DOC, DOCX yoki PDF fayllar qabul qilinadi.'}, status=status.HTTP_400_BAD_REQUEST)

    from apps.udc.services import get_service_amount
    amount = int(get_service_amount('doi_request', 100000))
    doi_req = DoiRequest.objects.create(
        user=request.user,
        author_first_name=author_first_name,
        author_last_name=author_last_name,
        file=file_obj,
        status='pending_payment',
    )
    transaction = Transaction.objects.create(
        user=request.user,
        amount=amount,
        currency='UZS',
        service_type='doi_request',
        extra_data={'doi_request_id': str(doi_req.id)},
    )
    if amount <= 0:
        transaction.status = 'completed'
        transaction.completed_at = timezone.now()
        transaction.save(update_fields=['status', 'completed_at'])
        from .fulfill_doi import fulfill_doi_request
        fulfill_doi_request(transaction)
        return Response({
            'transaction_id': str(transaction.id),
            'amount': 0,
            'currency': 'UZS',
            'fulfilled': True,
            'message': 'So\'rov taqrizchiga yuborildi. DOI link tayyor bo\'lgach bildirishnoma orqali xabar beramiz.',
        }, status=status.HTTP_201_CREATED)
    return Response({
        'transaction_id': str(transaction.id),
        'amount': float(amount),
        'currency': 'UZS',
    }, status=status.HTTP_201_CREATED)


class DoiRequestViewSet(viewsets.ModelViewSet):
    """DOI so'rovlari: muallif o'zini ko'radi, taqrizchi barcha submitted ni ko'radi va doi_link kiritadi."""
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'head', 'patch', 'options']

    def get_queryset(self):
        role = getattr(self.request.user, 'role', None) or 'author'
        if role == 'reviewer' or role == 'super_admin':
            return DoiRequest.objects.filter(status='submitted').select_related('user').order_by('-created_at')
        if role == 'operator' and self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            # Operator barcha so'rovlarni kuzatadi (faqat o'qish; DOI linkni taqrizchi kiritadi)
            return DoiRequest.objects.select_related('user').order_by('-created_at')
        return DoiRequest.objects.filter(user=self.request.user).order_by('-created_at')

    def get_serializer_class(self):
        return DoiRequestSerializer

    def partial_update(self, request, *args, **kwargs):
        """Faqat taqrizchi: doi_link yuklash, status=completed, muallifga bildirishnoma."""
        role = getattr(request.user, 'role', None)
        if role not in ('reviewer', 'super_admin'):
            return Response({'detail': 'Faqat taqrizchi DOI link kiritishi mumkin.'}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        if instance.status != 'submitted':
            return Response({'detail': 'Ushbu so\'rov allaqachon bajarilgan.'}, status=status.HTTP_400_BAD_REQUEST)
        doi_link = (request.data.get('doi_link') or '').strip()
        if not doi_link or not doi_link.startswith('http'):
            return Response({'detail': 'To\'g\'ri DOI link (URL) kiriting.'}, status=status.HTTP_400_BAD_REQUEST)
        instance.doi_link = doi_link[:500]
        instance.status = 'completed'
        instance.completed_at = timezone.now()
        instance.save(update_fields=['doi_link', 'status', 'completed_at'])
        try:
            Notification.notify(
                user=instance.user,
                title='DOI raqami tayyor',
                message=f'DOI so\'rovingiz bajarildi. Link: {instance.doi_link[:80]}...',
                notification_type='article',
                link='/arxiv',
                metadata={'doi_request_id': str(instance.id), 'doi_link': instance.doi_link},
            )
        except Exception as e:
            logger.warning("DOI notify author failed: %s", e)
        return Response(DoiRequestSerializer(instance).data)


class ArticleSampleRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """Maqola namuna so'rovlari: taqrizchi barchani ko'radi, muallif o'zini."""
    permission_classes = [IsAuthenticated]
    serializer_class = ArticleSampleRequestSerializer
    http_method_names = ['get', 'head', 'options']

    def get_queryset(self):
        role = getattr(self.request.user, 'role', None) or 'author'
        if role in ('reviewer', 'super_admin', 'operator'):  # viewset faqat o'qish uchun
            return ArticleSampleRequest.objects.select_related('user').order_by('-created_at')
        return ArticleSampleRequest.objects.filter(user=self.request.user).order_by('-created_at')
