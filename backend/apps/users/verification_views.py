"""
Telefonni Telegram orqali tasdiqlash va parolni tiklash API (apps/users/phone_verification.py).
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
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
