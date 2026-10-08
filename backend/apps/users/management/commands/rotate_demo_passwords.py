"""
Repoda ochiq yozilgan demo / Django admin hisoblarining parollarini tasodifiy parollarga almashtirish
va ularning barcha refresh tokenlarini bekor qilish.

Ishlatish (serverda):
    python manage.py rotate_demo_passwords            # nima o'zgarishini ko'rsatadi
    python manage.py rotate_demo_passwords --apply    # parollarni almashtiradi va ekranga bir marta chiqaradi

Eslatma: allaqachon berilgan access tokenlar JWT_ACCESS_MINUTES tugaguncha amal qiladi.
Hammasini darhol bekor qilish uchun SECRET_KEY ni almashtiring (barcha foydalanuvchilar qayta kiradi).
"""
import secrets
import string

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.users.models import User

from .setup_demo_and_admin import DEMO_USERS, DJANGO_ADMIN_PHONE, LEGACY_DEMO_PHONES, is_demo_account

_ALPHABET = string.ascii_letters + string.digits + '@#%+=-'


def _random_password(length: int = 20) -> str:
    return ''.join(secrets.choice(_ALPHABET) for _ in range(length))


def _phone_variants(phone: str) -> list[str]:
    digits = ''.join(ch for ch in phone if ch.isdigit())
    return [digits, f'+{digits}']


class Command(BaseCommand):
    help = "Ochiq demo / Django admin hisoblari parollarini tasodifiy qiymatga almashtiradi va tokenlarini bekor qiladi."

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help="O'zgarishlarni haqiqatan saqlash")

    def handle(self, *args, **options):
        legacy = [v for p in LEGACY_DEMO_PHONES + [DJANGO_ADMIN_PHONE] for v in _phone_variants(p)]
        current = [v for u in DEMO_USERS for v in _phone_variants(u['phone'])]
        users = list(User.objects.filter(phone__in=legacy))
        # Yangi demo raqamlar — faqat haqiqatan demo hisob bo'lsa (shu raqamli haqiqiy foydalanuvchiga tegilmaydi)
        users += [u for u in User.objects.filter(phone__in=current) if is_demo_account(u)]
        users.sort(key=lambda u: u.phone)

        if not users:
            self.stdout.write(self.style.SUCCESS('Ochiq demo hisoblar topilmadi — hech narsa qilish shart emas.'))
            return

        if not options['apply']:
            self.stdout.write('Quyidagi hisoblar parollari repoda ochiq (README.md / DEMO_LOGIN.md):')
            for u in users:
                self.stdout.write(f'   {u.phone} | rol={u.role} | faol={u.is_active} | superuser={u.is_superuser}')
            self.stdout.write(self.style.WARNING('\nAlmashtirish uchun: python manage.py rotate_demo_passwords --apply'))
            return

        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        rows = []
        with transaction.atomic():
            for u in users:
                new_password = _random_password()
                u.set_password(new_password)
                u.save(update_fields=['password'])
                for tok in OutstandingToken.objects.filter(user=u):
                    BlacklistedToken.objects.get_or_create(token=tok)
                rows.append((u.phone, u.role, new_password))

        self.stdout.write(self.style.SUCCESS('Parollar almashtirildi. Ularni HOZIR xavfsiz joyga saqlang — qayta ko\'rsatilmaydi:'))
        for phone, role, pwd in rows:
            self.stdout.write(f'   {phone} | {role} | {pwd}')
