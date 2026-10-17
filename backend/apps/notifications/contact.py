"""
"Yordam / Aloqa" sahifasidagi murojaat formasi.

Avval "Yordam" faqat mailto: havola edi — pochta dasturi sozlanmagan kompyuterda hech narsa bo'lmasdi.
Endi murojaat operator va bosh adminlarga bildirishnoma bo'lib boradi (alohida jadval kerak emas).
Kirmagan mehmon ham yozishi mumkin — ism va telefon/email majburiy, spamga qarshi cheklov bilan.
"""
import re

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from apps.users.models import User

from .models import Notification

TOPICS = {
    'payment': "To'lov",
    'article': 'Maqola / nashr',
    'service': 'Xizmatlar',
    'account': 'Hisob / kirish',
    'other': 'Boshqa',
}


# Alohida scope: umumiy 'anon'/'user' hisoblagichi boshqa ochiq so'rovlar bilan to'lib qolmasin
class _ContactAnonThrottle(AnonRateThrottle):
    scope = 'contact_anon'
    rate = '5/hour'


class _ContactUserThrottle(UserRateThrottle):
    scope = 'contact_user'
    rate = '20/hour'


def _clean(value, limit: int) -> str:
    return re.sub(r'\s+', ' ', str(value or '')).strip()[:limit]


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([_ContactAnonThrottle, _ContactUserThrottle])
def contact_request(request):
    data = request.data
    user = request.user if request.user.is_authenticated else None

    name = _clean(data.get('name'), 120) or (user.get_full_name() if user else '')
    phone = _clean(data.get('phone'), 40) or (getattr(user, 'phone', '') if user else '')
    email = _clean(data.get('email'), 160) or (getattr(user, 'email', '') if user else '')
    topic = data.get('topic') if data.get('topic') in TOPICS else 'other'
    message = str(data.get('message') or '').strip()[:3000]

    errors = {}
    if not name:
        errors['name'] = 'Ismingizni kiriting.'
    if not phone and not email:
        errors['phone'] = "Javob berishimiz uchun telefon yoki email kiriting."
    if email and not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        errors['email'] = "Email noto'g'ri."
    if len(message) < 10:
        errors['message'] = 'Murojaat matnini batafsilroq yozing (kamida 10 ta belgi).'
    if errors:
        return Response({'error': next(iter(errors.values())), 'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

    contact = ' · '.join(x for x in (phone, email) if x)
    who = f'{name} ({contact})' + ('' if user else ' — mehmon')
    body = f'{who}\nMavzu: {TOPICS[topic]}\n\n{message}'
    staff = User.objects.filter(role__in=('operator', 'super_admin'), is_active=True)
    for member in staff:
        Notification.notify(
            user=member,
            title=f'Yangi murojaat: {TOPICS[topic]}',
            message=body,
            notification_type='system',
            metadata={
                'kind': 'contact_request',
                'topic': topic,
                'name': name,
                'phone': phone,
                'email': email,
                'user_id': str(user.pk) if user else '',
            },
        )
    return Response({'status': 'ok', 'message': "Murojaatingiz qabul qilindi. Tez orada javob beramiz."},
                    status=status.HTTP_201_CREATED)
