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
"""
from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone

from apps.users.models import PhoneChallenge, User

VERIFY_TTL = timedelta(minutes=30)
RESET_TTL = timedelta(minutes=20)
RESET_LINK_TTL = timedelta(minutes=30)
PREFIX = {PhoneChallenge.PURPOSE_VERIFY: 'v', PhoneChallenge.PURPOSE_RESET: 'r'}


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
    PhoneChallenge.objects.filter(user=user, purpose=PhoneChallenge.PURPOSE_VERIFY, used_at__isnull=True).delete()
    ch = PhoneChallenge.objects.create(
        code=_new_code(), purpose=PhoneChallenge.PURPOSE_VERIFY, user=user, phone=user.phone,
        expires_at=timezone.now() + VERIFY_TTL,
    )
    return {'deep_link': deep_link(ch.purpose, ch.code), 'expires_in': int(VERIFY_TTL.total_seconds())}


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


def confirm_contact(code: str, purpose: str, *, telegram_id: int, contact_user_id: int | None,
                    contact_phone: str) -> ContactResult:
    """Bot kontakt olganda chaqiradi. Kontakt yuboruvchining o'ziniki bo'lishi shart."""
    if not contact_user_id or int(contact_user_id) != int(telegram_id):
        raise VerificationError("Iltimos, «📱 Raqamni ulashish» tugmasi orqali O'Z raqamingizni yuboring.")
    phone = normalize_phone(contact_phone)
    with transaction.atomic():
        ch = get_active_challenge(code, purpose)
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


def verification_required_message(user) -> str:
    """
    PHONE_VERIFICATION_REQUIRED=true bo'lsa — tasdiqlanmagan muallif maqola yubora/to'lay olmaydi.
    Bo'sh satr — ruxsat. Xodimlar (admin, operator, ...) va demo hisoblar cheklanmaydi.
    """
    if not getattr(settings, 'PHONE_VERIFICATION_REQUIRED', False):
        return ''
    if user is None or not getattr(user, 'is_authenticated', False) or getattr(user, 'phone_verified', False):
        return ''
    if getattr(user, 'role', 'author') != 'author':
        return ''
    from config.demo import is_demo_user

    if is_demo_user(user):
        return ''
    return ("Avval telefon raqamingizni tasdiqlang: Profil → «Telegram orqali tasdiqlash» "
            "(bir daqiqa, bepul).")


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
