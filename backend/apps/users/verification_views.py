"""
Telefonni Telegram orqali tasdiqlash va parolni tiklash API (apps/users/phone_verification.py).
"""
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from . import phone_verification as pv


class _AuthThrottle(ScopedRateThrottle):
    scope = 'auth'


def _error(exc: Exception, code=status.HTTP_400_BAD_REQUEST):
    return Response({'detail': str(exc)}, status=code)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([_AuthThrottle])
def phone_verify_start(request):
    """Telegram bot havolasi: botda «Raqamni ulashish» bosilganda raqam tasdiqlanadi."""
    try:
        return Response(pv.start_verification(request.user))
    except pv.VerificationError as exc:
        return _error(exc, status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def phone_verify_status(request):
    u = request.user
    return Response({'phone_verified': u.phone_verified, 'phone_verified_at': u.phone_verified_at})


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([_AuthThrottle])
def password_reset_start(request):
    try:
        return Response(pv.start_password_reset(request.data.get('phone', '')))
    except pv.VerificationError as exc:
        return _error(exc)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([_AuthThrottle])
def password_reset_confirm(request):
    token = str(request.data.get('token') or '')
    password = str(request.data.get('password') or '')
    if password != str(request.data.get('password_confirm') or password):
        return _error(ValueError("Parollar bir xil emas."))
    try:
        pv.reset_password(token, password)
    except pv.VerificationError as exc:
        return _error(exc)
    return Response({'detail': "Parol yangilandi. Endi yangi parol bilan kiring."})


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([_AuthThrottle])
def register_start(request):
    """Ro'yxatdan o'tish 1-qadam: ma'lumotlar tekshiriladi, Telegram bot havolasi qaytadi (bot 4 xonali kod beradi)."""
    try:
        return Response(pv.start_registration(request.data))
    except pv.VerificationError as exc:
        return _error(exc)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([_AuthThrottle])
def register_confirm(request):
    """Ro'yxatdan o'tish 2-qadam: botdan olingan kod to'g'ri bo'lsa hisob yaratiladi va foydalanuvchi kiritiladi."""
    from django.conf import settings
    from rest_framework_simplejwt.tokens import RefreshToken

    from config.jwt_cookies import attach_jwt_cookies, auth_body

    from .serializers import UserSerializer

    try:
        user = pv.confirm_registration(request.data.get('token', ''), request.data.get('code', ''))
    except pv.VerificationError as exc:
        return _error(exc)
    refresh = RefreshToken.for_user(user)
    resp = Response(auth_body(UserSerializer(user, context={'request': request}).data, refresh),
                    status=status.HTTP_201_CREATED)
    if getattr(settings, 'JWT_USE_HTTPONLY_COOKIES', False):
        attach_jwt_cookies(resp, str(refresh.access_token), str(refresh))
    return resp
