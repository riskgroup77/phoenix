"""
Shaxsga doir ma'lumotlar bo'yicha foydalanuvchi huquqlari (Maxfiylik siyosati, 6-bo'lim):
  GET  /api/v1/auth/my-data/         — o'z ma'lumotlarining nusxasi (JSON fayl)
  POST /api/v1/auth/delete-request/  — hisobni o'chirish so'rovi (super adminlarga yuboriladi)

Hisob avtomatik o'chirilmaydi: moliyaviy yozuvlar (to'lovlar) qonunchilikka ko'ra saqlanishi shart,
nashr etilgan maqolalar esa jurnal arxivining bir qismi. Admin so'rovni ko'rib, qo'lda hal qiladi.
"""
import json
import logging

from django.core.cache import cache
from django.core.serializers.json import DjangoJSONEncoder
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

logger = logging.getLogger(__name__)

USER_FIELDS = (
    'id', 'phone', 'email', 'first_name', 'last_name', 'patronymic', 'role', 'orcid_id', 'affiliation',
    'telegram_username', 'telegram_notifications', 'phone_verified', 'phone_verified_at',
    'terms_accepted_at', 'terms_version', 'date_joined', 'last_login',
)


class PrivacyExportThrottle(UserRateThrottle):
    scope = 'privacy_export'
    rate = '10/hour'


def _rows(qs, fields):
    """Model maydonlarining faqat mavjudlarini olish (sxema o'zgarsa ham eksport buzilmasin)."""
    names = {f.name for f in qs.model._meta.get_fields()}
    use = [f for f in fields if f.split('__', 1)[0] in names]
    return list(qs.values(*use)) if use else []


def collect_user_data(user) -> dict:
    from apps.articles.models import Article
    from apps.notifications.models import Notification
    from apps.payments.models import Transaction

    names = {f.name for f in user._meta.get_fields()}
    data = {
        'generated_at': timezone.now(),
        'user': {f: getattr(user, f) for f in USER_FIELDS if f in names},
        'articles': _rows(
            Article.objects.filter(author=user).order_by('-submission_date'),
            ('id', 'title', 'abstract', 'keywords', 'status', 'journal__name', 'doi', 'udk_code',
             'submission_date', 'submitted_author_name', 'page_count'),
        ),
        'transactions': _rows(
            Transaction.objects.filter(user=user).order_by('-created_at'),
            ('id', 'service_type', 'amount', 'currency', 'status', 'payment_provider', 'created_at', 'completed_at'),
        ),
        'notifications_count': Notification.objects.filter(user=user).count(),
    }
    optional = (
        ('translations', 'apps.translations.models', 'TranslationRequest', 'author',
         ('id', 'title', 'source_language', 'target_language', 'status', 'word_count', 'cost', 'submission_date')),
        ('udk_requests', 'apps.udc.models', 'UdkRequest', 'user', ('id', 'status', 'udk_code', 'created_at')),
        ('doi_requests', 'apps.articles.models', 'DoiRequest', 'user', ('id', 'status', 'doi_link', 'created_at')),
        ('article_sample_requests', 'apps.articles.models', 'ArticleSampleRequest', 'user', ('id', 'status', 'created_at')),
    )
    for key, module, model_name, fk, fields in optional:
        try:
            mod = __import__(module, fromlist=[model_name])
            model = getattr(mod, model_name)
            data[key] = _rows(model.objects.filter(**{fk: user}), fields)
        except Exception:  # model yo'q / sxema farq qiladi — eksportni to'xtatmaymiz
            logger.debug('privacy export: %s skipped', key, exc_info=True)
    return data


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@throttle_classes([PrivacyExportThrottle])
def my_data_export(request):
    payload = json.dumps(collect_user_data(request.user), cls=DjangoJSONEncoder, ensure_ascii=False, indent=2)
    resp = HttpResponse(payload, content_type='application/json; charset=utf-8')
    stamp = timezone.now().strftime('%Y%m%d')
    resp['Content-Disposition'] = f'attachment; filename="phoenix-malumotlarim-{stamp}.json"'
    resp['Cache-Control'] = 'no-store'
    return resp


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def account_deletion_request(request):
    user = request.user
    reason = str(request.data.get('reason') or '').strip()[:1000]
    key = f'phoenix:delete-request:{user.pk}'
    if not cache.add(key, 1, timeout=24 * 3600):
        return Response(
            {'detail': "So'rovingiz allaqachon qabul qilingan. Administrator tez orada bog'lanadi."},
            status=status.HTTP_200_OK,
        )

    from apps.notifications.models import Notification
    from apps.users.models import User

    full_name = f'{user.last_name} {user.first_name}'.strip() or user.phone
    text = (
        f"Foydalanuvchi hisobni o'chirishni so'radi: {full_name} (+{user.phone}, id {user.pk}).\n"
        f"Sabab: {reason or 'ko‘rsatilmagan'}\n"
        "To'lov yozuvlari qonunchilikka ko'ra saqlanadi; qolgan ma'lumotlarni o'chirish/anonimlashtirish "
        "10 ish kuni ichida hal qilinishi kerak."
    )
    admins = User.objects.filter(role='super_admin', is_active=True)
    for admin in admins:
        Notification.notify(
            admin,
            "Hisobni o'chirish so'rovi",
            text,
            notification_type='system',
            link='/users',
            metadata={'kind': 'account_deletion_request', 'user_id': str(user.pk)},
        )
    try:
        from config.alert_handler import send_alert

        send_alert(f'🗑 {text}', dedup_key=f'{key}:alert')
    except Exception:
        logger.debug('delete-request alert failed', exc_info=True)
    logger.info('Account deletion requested by user %s', user.pk)
    return Response(
        {'detail': "So'rovingiz qabul qilindi. Administrator 10 ish kuni ichida ko'rib chiqadi va siz bilan bog'lanadi."},
        status=status.HTTP_202_ACCEPTED,
    )
