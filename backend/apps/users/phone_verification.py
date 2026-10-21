"""
Telefon raqamini Telegram orqali tasdiqlash va parolni tiklash (bepul — SMS shart emas).

Nega ishonchli: Telegram bot "kontaktni ulashish" tugmasi orqali yuborilgan kontakt foydalanuvchining
Telegram hisobiga bog'langan (Telegram tasdiqlagan) raqami bo'ladi; contact.user_id == yuboruvchi
tekshiriladi — boshqa birovning kontaktini forward qilib bo'lmaydi.

Oqimlar:
  verify: sayt → start_verification(user) → t.me/<bot>?start=v_<kod> → bot kontakt so'raydi →
          confirm_contact(kod, telegram_id, contact_user_id, phone) → user.phone_verified = True
  reset:  sayt (Parolni unutdim) → start_password_reset(phone) → t.me/<bot>?start=r_<kod> → kontakt →
          confirm_contact → bir martalik havola ( #/reset-password/<token> ) → reset_password(token, yangi parol)
  register: sayt (Ro'yxatdan o'tish) → start_registration(ma'lumotlar) → t.me/<bot>?start=g_<kod> → kontakt →
          confirm_contact → bot 4 xonali kod yuboradi → sayt confirm_registration(kod, otp) → hisob yaratiladi
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone

from apps.users.models import PhoneChallenge, User

VERIFY_TTL = timedelta(minutes=30)
RESET_TTL = timedelta(minutes=20)
RESET_LINK_TTL = timedelta(minutes=30)
REGISTER_TTL = timedelta(minutes=15)
OTP_MAX_ATTEMPTS = 5
PREFIX = {
    PhoneChallenge.PURPOSE_VERIFY: 'v',
    PhoneChallenge.PURPOSE_RESET: 'r',
    PhoneChallenge.PURPOSE_REGISTER: 'g',
}


class VerificationError(Exception):
    """Foydalanuvchiga ko'rsatiladigan xato matni bilan."""


def normalize_phone(raw: str) -> str:
    digits = ''.join(c for c in str(raw or '') if c.isdigit())
    if len(digits) == 9:
        digits = '998' + digits
    elif len(digits) > 12:
        digits = digits[-12:]
    return digits


def bot_username() -> str:
    return (getattr(settings, 'TELEGRAM_BOT_USERNAME', '') or '').lstrip('@').strip()


def deep_link(purpose: str, code: str) -> str:
    return f'https://t.me/{bot_username()}?start={PREFIX[purpose]}_{code}'


def _new_code() -> str:
    # Telegram start parametri: [A-Za-z0-9_-], 64 belgigacha
    return secrets.token_urlsafe(18).replace('-', 'x').replace('_', 'y')[:24]


def _require_bot():
    if not bot_username():
        raise VerificationError("Telegram bot sozlanmagan (TELEGRAM_BOT_USERNAME). Administratorga murojaat qiling.")


def _cleanup() -> None:
    PhoneChallenge.objects.filter(expires_at__lt=timezone.now() - timedelta(days=1)).delete()


def start_verification(user: User) -> dict:
    _require_bot()
    _cleanup()
    if user.phone_verified:
        return {'already_verified': True}
    ch = _create_verify_challenge(user)
    return {'deep_link': deep_link(ch.purpose, ch.code), 'expires_in': int(VERIFY_TTL.total_seconds())}


def _create_verify_challenge(user: User) -> PhoneChallenge:
    PhoneChallenge.objects.filter(user=user, purpose=PhoneChallenge.PURPOSE_VERIFY, used_at__isnull=True).delete()
    return PhoneChallenge.objects.create(
        code=_new_code(), purpose=PhoneChallenge.PURPOSE_VERIFY, user=user, phone=user.phone,
        expires_at=timezone.now() + VERIFY_TTL,
    )


def start_verification_in_bot(user: User) -> str:
    """Bot ichida (sayt havolasisiz) tasdiqlashni boshlash: kod qaytaradi, bot kontakt so'raydi."""
    _cleanup()
    return _create_verify_challenge(user).code


def start_password_reset(phone: str) -> dict:
    """
    Har doim bir xil javob (raqam ro'yxatdan o'tganmi — oshkor qilinmaydi). Raqam topilmasa ham havola beriladi,
    lekin bot kontaktni qabul qilganda "bu raqam bilan hisob topilmadi" deydi.
    """
    _require_bot()
    _cleanup()
    phone = normalize_phone(phone)
    if len(phone) != 12:
        raise VerificationError("Telefon raqami noto'g'ri. Masalan: 901234567")
    recent = PhoneChallenge.objects.filter(
        purpose=PhoneChallenge.PURPOSE_RESET, phone=phone, created_at__gte=timezone.now() - timedelta(hours=1),
    ).count()
    if recent >= 5:
        raise VerificationError("Juda ko'p urinish. Bir soatdan keyin qayta urinib ko'ring.")
    ch = PhoneChallenge.objects.create(
        code=_new_code(), purpose=PhoneChallenge.PURPOSE_RESET, phone=phone,
        user=User.objects.filter(phone=phone, is_active=True).first(),
        expires_at=timezone.now() + RESET_TTL,
    )
    return {'deep_link': deep_link(ch.purpose, ch.code), 'expires_in': int(RESET_TTL.total_seconds())}


def parse_start_payload(payload: str) -> tuple[str, str] | None:
    """Bot /start parametri: 'v_<kod>' yoki 'r_<kod>' → (purpose, kod)."""
    payload = (payload or '').strip()
    for purpose, p in PREFIX.items():
        if payload.startswith(p + '_') and len(payload) > 3:
            return purpose, payload[len(p) + 1:]
    return None


def get_active_challenge(code: str, purpose: str) -> PhoneChallenge:
    ch = PhoneChallenge.objects.select_related('user').filter(code=code, purpose=purpose).first()
    if ch is None or ch.used_at is not None or ch.expires_at < timezone.now():
        raise VerificationError("Havola eskirgan yoki allaqachon ishlatilgan. Saytdan qaytadan boshlang.")
    return ch


@dataclass
class ContactResult:
    purpose: str
    user: User | None
    reset_link: str = ''
    otp: str = ''


def confirm_contact(code: str, purpose: str, *, telegram_id: int, contact_user_id: int | None,
                    contact_phone: str) -> ContactResult:
    """Bot kontakt olganda chaqiradi. Kontakt yuboruvchining o'ziniki bo'lishi shart."""
    if not contact_user_id or int(contact_user_id) != int(telegram_id):
        raise VerificationError("Iltimos, «📱 Raqamni ulashish» tugmasi orqali O'Z raqamingizni yuboring.")
    phone = normalize_phone(contact_phone)
    with transaction.atomic():
        ch = get_active_challenge(code, purpose)
        if purpose == PhoneChallenge.PURPOSE_REGISTER:
            if normalize_phone(ch.phone) != phone:
                raise VerificationError(
                    "Telegram'dagi raqamingiz saytda kiritilgan raqamga mos kelmadi. "
                    "Saytda to'g'ri raqam kiritilganini tekshiring."
                )
            if User.objects.filter(phone=ch.phone).exists():
                raise VerificationError("Bu raqam bilan hisob allaqachon mavjud. Saytda «Kirish» ni bosing.")
            otp = f'{secrets.randbelow(10000):04d}'
            ch.otp_hash = _otp_hash(ch.code, otp)
            ch.attempts = 0
            ch.telegram_id = telegram_id
            ch.save(update_fields=['otp_hash', 'attempts', 'telegram_id'])
            return ContactResult(purpose, None, otp=otp)

        if purpose == PhoneChallenge.PURPOSE_VERIFY:
            user = ch.user
            if user is None or normalize_phone(user.phone) != phone:
                raise VerificationError(
                    "Telegram'dagi raqamingiz saytdagi raqamingizga mos kelmadi. "
                    "Saytda to'g'ri raqam ko'rsatilganini tekshiring."
                )
            ch.used_at = timezone.now()
            ch.telegram_id = telegram_id
            ch.save(update_fields=['used_at', 'telegram_id'])
            if not user.phone_verified:
                user.phone_verified = True
                user.phone_verified_at = timezone.now()
                user.save(update_fields=['phone_verified', 'phone_verified_at'])
            return ContactResult(purpose, user)

        # Parolni tiklash
        if normalize_phone(ch.phone) != phone:
            raise VerificationError("Telegram'dagi raqamingiz saytda kiritilgan raqamga mos kelmadi.")
        user = User.objects.filter(phone=phone, is_active=True).first()
        if user is None:
            raise VerificationError("Bu raqam bilan ro'yxatdan o'tgan hisob topilmadi.")
        ch.used_at = timezone.now()
        ch.telegram_id = telegram_id
        ch.save(update_fields=['used_at', 'telegram_id'])
        link = PhoneChallenge.objects.create(
            code=secrets.token_urlsafe(32), purpose=PhoneChallenge.PURPOSE_RESET_LINK, user=user, phone=phone,
            telegram_id=telegram_id, expires_at=timezone.now() + RESET_LINK_TTL,
        )
        # Kontakt egasi isbotlandi — raqam ham tasdiqlangan hisoblanadi
        if not user.phone_verified:
            user.phone_verified = True
            user.phone_verified_at = timezone.now()
            user.save(update_fields=['phone_verified', 'phone_verified_at'])
        site = (getattr(settings, 'PUBLIC_SITE_URL', '') or getattr(settings, 'FRONTEND_BASE_URL', '')
                or 'https://ilmiyfaoliyat.uz').rstrip('/')
        return ContactResult(purpose, user, reset_link=f'{site}/#/reset-password/{link.code}')


def _otp_hash(code: str, otp: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f'{code}:{otp}'.encode(), hashlib.sha256).hexdigest()


def start_registration(data) -> dict:
    """
    Ro'yxatdan o'tish ma'lumotlarini tekshiradi va saqlaydi (hisob hali yaratilmaydi), bot havolasini qaytaradi.
    Xatolar DRF ValidationError (maydonlar bo'yicha) yoki VerificationError sifatida chiqadi.
    """
    from rest_framework import serializers as drf_serializers

    from apps.users.serializers import RegisterSerializer

    _require_bot()
    _cleanup()
    ser = RegisterSerializer(data=data)
    ser.is_valid(raise_exception=True)
    v = ser.validated_data
    phone = normalize_phone(v['phone'])
    if len(phone) != 12:
        raise drf_serializers.ValidationError({'phone': ["Telefon raqam noto'g'ri formatda"]})
    if User.objects.filter(phone=phone).exists():
        raise drf_serializers.ValidationError({'phone': ["Bu telefon raqam allaqachon ro'yxatdan o'tgan"]})
    recent = PhoneChallenge.objects.filter(
        purpose=PhoneChallenge.PURPOSE_REGISTER, phone=phone, created_at__gte=timezone.now() - timedelta(hours=1),
    ).count()
    if recent >= 5:
        raise VerificationError("Juda ko'p urinish. Bir soatdan keyin qayta urinib ko'ring.")
    PhoneChallenge.objects.filter(
        purpose=PhoneChallenge.PURPOSE_REGISTER, phone=phone, used_at__isnull=True,
    ).update(expires_at=timezone.now())
    ch = PhoneChallenge.objects.create(
        code=_new_code(), purpose=PhoneChallenge.PURPOSE_REGISTER, phone=phone,
        expires_at=timezone.now() + REGISTER_TTL,
        payload={
            'first_name': v['first_name'].strip(),
            'last_name': v['last_name'].strip(),
            'password': make_password(v['password']),
            'terms_accepted': bool(v.get('terms_accepted')),
            'terms_version': (v.get('terms_version') or '').strip(),
        },
    )
    return {'deep_link': deep_link(ch.purpose, ch.code), 'token': ch.code,
            'expires_in': int(REGISTER_TTL.total_seconds())}


def confirm_registration(token: str, otp: str) -> User:
    """Saytda kiritilgan 4 xonali kod to'g'ri bo'lsa — hisob yaratiladi (telefon tasdiqlangan holda)."""
    otp = ''.join(c for c in str(otp or '') if c.isdigit())
    error = ''
    with transaction.atomic():
        ch = PhoneChallenge.objects.select_for_update().filter(
            code=str(token or ''), purpose=PhoneChallenge.PURPOSE_REGISTER,
        ).first()
        if ch is None or ch.used_at is not None or ch.expires_at < timezone.now():
            raise VerificationError("Ro'yxatdan o'tish muddati tugagan. Qaytadan boshlang.")
        if not ch.otp_hash:
            raise VerificationError("Avval Telegram botda «📱 Raqamni ulashish» tugmasini bosib, kodni oling.")
        if ch.attempts >= OTP_MAX_ATTEMPTS:
            raise VerificationError("Urinishlar soni tugadi. Ro'yxatdan o'tishni qaytadan boshlang.")
        if len(otp) != 4 or not hmac.compare_digest(ch.otp_hash, _otp_hash(ch.code, otp)):
            # Urinish hisobi saqlanishi uchun xato tranzaksiyadan keyin chiqariladi
            ch.attempts += 1
            ch.save(update_fields=['attempts'])
            left = OTP_MAX_ATTEMPTS - ch.attempts
            error = (f"Kod noto'g'ri. Yana {left} ta urinish qoldi." if left > 0
                     else "Urinishlar soni tugadi. Ro'yxatdan o'tishni qaytadan boshlang.")
        else:
            if User.objects.filter(phone=ch.phone).exists():
                raise VerificationError("Bu raqam bilan hisob allaqachon mavjud. «Kirish» sahifasidan kiring.")
            data = ch.payload or {}
            now = timezone.now()
            user = User(
                phone=ch.phone,
                email=f'{ch.phone}_{int(time.time())}@temp.phoenix.uz',
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', ''),
                affiliation='N/A',
                phone_verified=True,
                phone_verified_at=now,
            )
            user.password = data.get('password', '')
            if data.get('terms_accepted'):
                user.terms_accepted_at = now
                user.terms_version = (data.get('terms_version') or getattr(settings, 'LEGAL_TERMS_VERSION', ''))[:20]
            user.save()
            ch.used_at = now
            ch.user = user
            ch.payload = {}
            ch.save(update_fields=['used_at', 'user', 'payload'])
            return user
    raise VerificationError(error)


def verification_required_message(user) -> str:
    """
    PHONE_VERIFICATION_REQUIRED=true (standart) bo'lsa — tasdiqlanmagan muallif maqola yubora/to'lay olmaydi.
    Bo'sh satr — ruxsat. Xodimlar (admin, operator, ...) va demo hisoblar cheklanmaydi.
    """
    if not getattr(settings, 'PHONE_VERIFICATION_REQUIRED', True):
        return ''
    if user is None or not getattr(user, 'is_authenticated', False) or getattr(user, 'phone_verified', False):
        return ''
    if getattr(user, 'role', 'author') != 'author' or getattr(user, 'is_staff', False) \
            or getattr(user, 'is_superuser', False):
        return ''
    from config.demo import is_demo_user

    if is_demo_user(user):
        return ''
    return ("Maqola yuborishdan oldin telefon raqamingizni Telegram orqali tasdiqlang: "
            "Profil → «Telegram orqali tasdiqlash» (bir daqiqa, bepul).")


def reset_password(token: str, new_password: str) -> User:
    with transaction.atomic():
        ch = PhoneChallenge.objects.select_for_update().select_related('user').filter(
            code=token, purpose=PhoneChallenge.PURPOSE_RESET_LINK,
        ).first()
        if ch is None or ch.used_at is not None or ch.expires_at < timezone.now() or ch.user is None:
            raise VerificationError("Havola eskirgan yoki allaqachon ishlatilgan. Parolni tiklashni qaytadan boshlang.")
        user = ch.user
        try:
            validate_password(new_password, user=user)
        except Exception as exc:
            messages = getattr(exc, 'messages', None) or [str(exc)]
            raise VerificationError(' '.join(messages))
        user.set_password(new_password)
        user.save(update_fields=['password'])
        ch.used_at = timezone.now()
        ch.save(update_fields=['used_at'])
    _revoke_sessions(user)
    return user


def _revoke_sessions(user: User) -> None:
    """Parol tiklanganda eski sessiyalar (boshqa qurilmalar, bot) bekor qilinadi."""
    try:
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        for tok in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=tok)
    except Exception:
        pass
    from apps.users.models import TelegramSession

    TelegramSession.objects.filter(user=user).delete()
