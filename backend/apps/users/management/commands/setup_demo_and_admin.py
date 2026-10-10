"""
Demo (sinov) foydalanuvchilarni yaratish/yangilash — oddiy, eslab qolish oson login va parollar.

    python manage.py setup_demo_and_admin

Login: telefon (9 xonali, 998 siz ham bo'ladi) / parol — rol nomi:
    Muallif        911111111 / muallif
    Taqrizchi      922222222 / taqrizchi
    Jurnal admini  933333333 / muharrir
    Operator       955555555 / operator
    Buxgalter      944444444 / buxgalter   (faqat lokal, DEBUG=True)
    Bosh admin     966666666 / admin       (faqat lokal, DEBUG=True)

Xavfsizlik:
- Serverda (DEBUG=False) bosh admin va buxgalter demo hisoblari HECH QACHON yaratilmaydi — oddiy parolli
  admin butun platformani (to'lovlar, foydalanuvchilar) ochib qo'yadi. Django admin hisobi ham faqat lokalda.
- Demo hisoblar maxsus email (@demo.ilmiyfaoliyat.uz) bilan belgilanadi. Shu telefon raqami bilan HAQIQIY
  foydalanuvchi ro'yxatdan o'tgan bo'lsa — uning hisobiga tegilmaydi (paroli almashtirilmaydi).
- Hech kim o'chirilmaydi.
"""
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.users.models import User
from config.demo import DEMO_EMAIL_DOMAIN

DEMO_USERS = [
    {
        'phone': '998911111111', 'password': 'muallif', 'role': 'author', 'production': True,
        'first_name': 'Muallif', 'last_name': 'Demo', 'patronymic': '',
        'affiliation': 'Demo universitet',
    },
    {
        'phone': '998922222222', 'password': 'taqrizchi', 'role': 'reviewer', 'production': True,
        'first_name': 'Taqrizchi', 'last_name': 'Demo', 'patronymic': '',
        'affiliation': 'Demo universitet',
    },
    {
        'phone': '998933333333', 'password': 'muharrir', 'role': 'journal_admin', 'production': True,
        'first_name': 'Muharrir', 'last_name': 'Demo', 'patronymic': '',
        'affiliation': 'Phoenix Ilmiy Nashrlar Markazi',
    },
    {
        'phone': '998955555555', 'password': 'operator', 'role': 'operator', 'production': True,
        'first_name': 'Operator', 'last_name': 'Demo', 'patronymic': '',
        'affiliation': 'Phoenix Ilmiy Nashrlar Markazi',
    },
    {
        'phone': '998944444444', 'password': 'buxgalter', 'role': 'accountant', 'production': False,
        'first_name': 'Buxgalter', 'last_name': 'Demo', 'patronymic': '',
        'affiliation': 'Phoenix Ilmiy Nashrlar Markazi',
    },
    {
        'phone': '998966666666', 'password': 'admin', 'role': 'super_admin', 'production': False,
        'first_name': 'Admin', 'last_name': 'Demo', 'patronymic': '',
        'affiliation': 'Phoenix Ilmiy Nashrlar Markazi', 'is_superuser': True, 'is_staff': True,
    },
]

# Eski demo hisoblar (parollari avval repoda ochiq yozilgan) — rotate_demo_passwords ularni ham qamraydi
LEGACY_DEMO_PHONES = [
    '998901001001', '998901001002', '998901001003', '998901001004', '998901001005', '998901001007',
]
DJANGO_ADMIN_PHONE = '998907863888'


def demo_email(role: str) -> str:
    return f'{role}@{DEMO_EMAIL_DOMAIN}'


def is_demo_account(user: User) -> bool:
    return (user.email or '').lower().endswith('@' + DEMO_EMAIL_DOMAIN)


class Command(BaseCommand):
    help = "Demo foydalanuvchilar (911111111/muallif va h.k.) yaratadi yoki parollarini tiklaydi. Hech kimni o'chirmaydi."

    def add_arguments(self, parser):
        parser.add_argument('--no-admin', action='store_true', help='Eski nom bilan moslik uchun (endi ta\'sirsiz)')

    def handle(self, *args, **options):
        local = bool(settings.DEBUG)
        if not local and not getattr(settings, 'PHONIX_DEMO_ENABLED', True):
            self.stdout.write('Demo hisoblar o\'chirilgan (PHONIX_DEMO_ENABLED=false) — hech narsa yaratilmadi.')
            return
        rows = []
        with transaction.atomic():
            for spec in DEMO_USERS:
                if not local and not spec['production']:
                    rows.append((spec, "o'tkazildi (faqat lokal)"))
                    continue
                rows.append((spec, self._upsert(spec)))

        self.stdout.write('')
        self.stdout.write('DEMO LOGIN (telefon 998 siz ham kiritiladi):')
        self.stdout.write('   Telefon     | Parol      | Rol            | Holat')
        self.stdout.write('   ' + '-' * 62)
        for spec, status in rows:
            self.stdout.write(f"   {spec['phone'][3:]:<11} | {spec['password']:<10} | {spec['role']:<14} | {status}")
        self.stdout.write('')

        legacy = User.objects.filter(phone__in=LEGACY_DEMO_PHONES + [DJANGO_ADMIN_PHONE], is_active=True).count()
        if legacy:
            self.stdout.write(self.style.WARNING(
                f'Eski demo hisoblar ({legacy} ta, parollari avval repoda ochiq bo\'lgan) hali faol. '
                'Ularni xavfsiz qilish: python manage.py rotate_demo_passwords --apply'
            ))

    def _upsert(self, spec: dict) -> str:
        phone = spec['phone']
        fields = {
            'email': demo_email(spec['role']),
            'first_name': spec['first_name'],
            'last_name': spec['last_name'],
            'patronymic': spec['patronymic'],
            'affiliation': spec['affiliation'],
            'role': spec['role'],
            'is_staff': bool(spec.get('is_staff')),
            'is_superuser': bool(spec.get('is_superuser')),
            'is_active': True,
        }
        user = User.objects.filter(phone=phone).first()
        if user is not None and not is_demo_account(user):
            # Shu raqam bilan haqiqiy foydalanuvchi ro'yxatdan o'tgan — uning hisobiga tegilmaydi
            self.stdout.write(self.style.ERROR(
                f'[!] {phone}: bu raqam haqiqiy foydalanuvchiga tegishli — demo hisob yaratilmadi.'
            ))
            return 'O\'TKAZILDI: raqam band'
        created = user is None
        if created:
            user = User(phone=phone)
        for k, v in fields.items():
            setattr(user, k, v)
        user.set_password(spec['password'])
        user.save()
        return 'yaratildi' if created else 'yangilandi'
