"""
Ishga tushirishdan oldingi tekshiruv (serverda):  python manage.py launch_check [--strict] [--json]

Har bir band: OK / WARN (tavsiya) / FAIL (ishga tushirishdan oldin tuzatish shart).
FAIL bo'lsa chiqish kodi 1 (--strict bilan WARN ham 1). Maxfiy qiymatlar hech qachon chop etilmaydi.
"""
import json
import os
import shutil
import subprocess
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

OK, WARN, FAIL, INFO = 'OK', 'WARN', 'FAIL', 'INFO'


class Command(BaseCommand):
    help = "Ishga tushirishdan oldingi tekshiruv: xavfsizlik, kalitlar, demo ma'lumot, zaxira, monitoring, huquqiy"

    def add_arguments(self, parser):
        parser.add_argument('--strict', action='store_true', help='WARN ham xato deb hisoblansin')
        parser.add_argument('--json', action='store_true', help='Natijani JSON ko\'rinishida chiqarish')
        parser.add_argument('--skip-celery', action='store_true', help='Celery workerlarini ping qilmaslik')

    def handle(self, *args, **opts):
        self.results = []
        self.skip_celery = opts['skip_celery']
        for check in (
            self.check_debug_and_hosts,
            self.check_secret_key,
            self.check_leaked_keys,
            self.check_https_cookies,
            self.check_database,
            self.check_demo_data,
            self.check_media,
            self.check_backups,
            self.check_services,
            self.check_celery,
            self.check_monitoring,
            self.check_phone_verification,
            self.check_payments,
            self.check_legal,
            self.check_antiplag_vectors,
            self.check_data_location,
        ):
            try:
                check()
            except Exception as exc:  # bitta tekshiruv yiqilsa qolganlari davom etsin
                self.add(WARN, check.__name__.replace('check_', ''), f'Tekshirib bo\'lmadi: {exc.__class__.__name__}: {exc}')

        if opts['json']:
            self.stdout.write(json.dumps(self.results, ensure_ascii=False, indent=2))
        else:
            self.print_table()

        fails = [r for r in self.results if r['level'] == FAIL]
        warns = [r for r in self.results if r['level'] == WARN]
        if fails or (opts['strict'] and warns):
            raise SystemExit(1)

    # ------------------------------------------------------------------ helpers
    def add(self, level, area, message, fix=''):
        self.results.append({'level': level, 'area': area, 'message': message, 'fix': fix})

    def print_table(self):
        style = {OK: self.style.SUCCESS, WARN: self.style.WARNING, FAIL: self.style.ERROR, INFO: self.style.HTTP_INFO}
        for r in self.results:
            self.stdout.write(style[r['level']](f"[{r['level']:<4}] {r['area']}: {r['message']}"))
            if r['fix'] and r['level'] in (WARN, FAIL):
                self.stdout.write(f'         → {r["fix"]}')
        counts = {lvl: sum(1 for r in self.results if r['level'] == lvl) for lvl in (OK, WARN, FAIL)}
        self.stdout.write('')
        self.stdout.write(f"Natija: {counts[OK]} OK, {counts[WARN]} WARN, {counts[FAIL]} FAIL")

    @staticmethod
    def _flag(name, default=False):
        return bool(getattr(settings, name, default))

    # ------------------------------------------------------------------ checks
    def check_debug_and_hosts(self):
        if settings.DEBUG:
            self.add(FAIL, 'DEBUG', 'DEBUG=True — xato sahifalari ichki ma\'lumotni ochadi', 'backend/.env: DEBUG=False')
        else:
            self.add(OK, 'DEBUG', 'DEBUG o\'chirilgan')
        if '*' in settings.ALLOWED_HOSTS:
            self.add(FAIL, 'ALLOWED_HOSTS', "'*' ruxsat etilgan", 'ALLOWED_HOSTS ga faqat o\'z domenlaringizni yozing')
        else:
            self.add(OK, 'ALLOWED_HOSTS', ', '.join(settings.ALLOWED_HOSTS[:6]))

    def check_secret_key(self):
        from config.leaked_secrets import is_leaked

        key = settings.SECRET_KEY or ''
        if is_leaked('SECRET_KEY', key):
            self.add(FAIL, 'SECRET_KEY', 'Ochiq git tarixidagi kalit ishlatilmoqda (sessiya/imzoli havolalarni soxtalashtirish mumkin)',
                     "Yangi kalit: python -c \"import secrets;print(secrets.token_urlsafe(64))\" → .env SECRET_KEY")
        elif key.startswith('django-insecure') or len(key) < 50 or len(set(key)) < 10:
            self.add(FAIL, 'SECRET_KEY', 'Kuchsiz yoki standart kalit', 'Kamida 50 belgili tasodifiy kalit qo\'ying')
        else:
            self.add(OK, 'SECRET_KEY', 'Kuchli, ochiq tarixda yo\'q')

    def check_leaked_keys(self):
        from config.leaked_secrets import is_leaked

        db_password = (settings.DATABASES.get('default') or {}).get('PASSWORD', '')
        candidates = {
            'CLICK_SECRET_KEY': [settings.CLICK_SECRET_KEY] + [
                getattr(settings, n, '') for n in dir(settings) if n.startswith('CLICK_SERVICE_') and n.endswith('_SECRET_KEY')
            ],
            'GEMINI_API_KEY': [getattr(settings, 'GEMINI_API_KEY', '')],
            'DB_PASSWORD': [db_password],
            'TELEGRAM_BOT_TOKEN': [getattr(settings, 'TELEGRAM_BOT_TOKEN', '')],
        }
        fixes = {
            'CLICK_SECRET_KEY': 'Click merchant kabinetida secret key ni yangilang va .env ga yozing',
            'GEMINI_API_KEY': 'Google AI Studio da eski kalitni o\'chirib, yangisini yarating',
            'DB_PASSWORD': "Postgres: ALTER USER ... PASSWORD '...'; keyin .env DB_PASSWORD",
            'TELEGRAM_BOT_TOKEN': '@BotFather → /revoke → yangi tokenni .env ga yozing',
        }
        leaked = [k for k, vals in candidates.items() if any(is_leaked(k, v) for v in vals)]
        for k in leaked:
            self.add(FAIL, 'Sizib chiqqan kalit', f'{k} — ochiq GitHub tarixidagi qiymat hali ishlatilmoqda', fixes[k])
        if not leaked:
            self.add(OK, 'Sizib chiqqan kalitlar', 'Click, Gemini, DB paroli, bot tokeni — ochiq tarixdagilardan farqli')

    def check_https_cookies(self):
        if settings.DEBUG:
            return
        missing = [n for n in ('SESSION_COOKIE_SECURE', 'CSRF_COOKIE_SECURE') if not self._flag(n)]
        if missing:
            self.add(WARN, 'HTTPS cookie', ', '.join(missing) + ' o\'chiq')
        if not self._flag('JWT_USE_HTTPONLY_COOKIES'):
            self.add(WARN, 'JWT', 'Refresh token localStorage da (XSS xavfi)', '.env: JWT_USE_HTTPONLY_COOKIES=true')
        else:
            self.add(OK, 'JWT', 'Refresh token HttpOnly cookie da')

    def check_database(self):
        engine = settings.DATABASES['default']['ENGINE']
        if 'sqlite' in engine:
            self.add(WARN, 'Ma\'lumotlar bazasi', 'SQLite — production uchun PostgreSQL tavsiya etiladi')
        else:
            from django.db import connection

            connection.ensure_connection()
            self.add(OK, 'Ma\'lumotlar bazasi', f'{engine.rsplit(".", 1)[-1]} ulanish bor')

    def check_demo_data(self):
        from apps.users.models import User
        from config.demo import demo_q

        n = User.objects.filter(demo_q()).count()
        if n:
            self.add(WARN, 'Demo ma\'lumot', f'{n} ta demo foydalanuvchi (oddiy parollar bilan) va ularning yozuvlari bor',
                     'Ishga tushirishdan oldin: python manage.py seed_demo_data --purge --logins')
        else:
            self.add(OK, 'Demo ma\'lumot', 'Demo foydalanuvchilar yo\'q')
        if getattr(settings, 'PHONIX_DEMO_ENABLED', True):
            self.add(WARN, 'Demo hisoblar', 'PHONIX_DEMO_ENABLED=true — har deployda demo hisoblar qayta yaratiladi',
                     'Rasmiy ishga tushirishda: .env PHONIX_DEMO_ENABLED=false va seed_demo_data --purge --logins')

    def check_media(self):
        if not self._flag('MEDIA_PROTECTION_ENABLED', True):
            self.add(FAIL, 'Media', 'Maqola/chek fayllari himoyasiz (havolani bilgan har kim ochadi)', '.env: MEDIA_PROTECTION_ENABLED=true')
            return
        if self._flag('MEDIA_ACCEL_REDIRECT'):
            self.add(OK, 'Media', 'Himoyalangan, nginx X-Accel-Redirect orqali beriladi')
        else:
            self.add(WARN, 'Media', 'Himoyalangan, lekin fayllarni Django o\'zi beradi (sekinroq)',
                     'API nginx konfigiga: include /etc/nginx/snippets/phoenix-media.conf; keyin deploy')

    def check_backups(self):
        root = Path(os.getenv('PHONIX_BACKUP_DIR') or (Path(settings.BASE_DIR).parent / 'backups'))
        daily = root / 'db' / 'daily'
        dumps = sorted(daily.glob('*.dump'), key=lambda p: p.stat().st_mtime) if daily.is_dir() else []
        if not dumps:
            self.add(FAIL, 'Zaxira', f'{daily} da ma\'lumotlar bazasi zaxirasi yo\'q',
                     'sudo systemctl enable --now phoenix-backup.timer && sudo systemctl start phoenix-backup.service')
            return
        age_h = (time.time() - dumps[-1].stat().st_mtime) / 3600
        if age_h > 36:
            self.add(FAIL, 'Zaxira', f'Oxirgi zaxira {age_h:.0f} soat oldin', 'journalctl -u phoenix-backup.service ni tekshiring')
        else:
            self.add(OK, 'Zaxira', f'Oxirgi zaxira {age_h:.1f} soat oldin, jami {len(dumps)} ta kunlik')
        if not os.getenv('PHONIX_BACKUP_RCLONE_REMOTE'):
            self.add(WARN, 'Zaxira (tashqi)', 'Zaxiralar faqat shu serverda — disk buzilsa hammasi yo\'qoladi',
                     'PHONIX_BACKUP_RCLONE_REMOTE ni sozlang (boshqa server / bulut)')

    def check_services(self):
        if not shutil.which('systemctl'):
            self.add(INFO, 'systemd', 'systemctl yo\'q (server emas) — o\'tkazib yuborildi')
            return
        for unit in ('phoenix-backend.service', 'phoenix-celery.service', 'phoenix-backup.timer', 'phoenix-uptime.timer'):
            state = subprocess.run(['systemctl', 'is-active', unit], capture_output=True, text=True, timeout=10).stdout.strip()
            if state == 'active':
                self.add(OK, 'systemd', f'{unit} ishlayapti')
            else:
                self.add(FAIL if 'backend' in unit or 'celery' in unit else WARN, 'systemd', f'{unit}: {state or "yo‘q"}',
                         f'sudo systemctl enable --now {unit}')

    def check_celery(self):
        if self.skip_celery:
            return
        if getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
            self.add(WARN, 'Celery', 'CELERY_TASK_ALWAYS_EAGER — vazifalar so\'rov ichida bajariladi')
            return
        try:
            from config.celery import app
        except Exception:
            self.add(WARN, 'Celery', 'Celery ilovasi topilmadi')
            return
        replies = app.control.ping(timeout=2) or []
        if replies:
            self.add(OK, 'Celery', f'{len(replies)} ta worker javob berdi')
        else:
            self.add(FAIL, 'Celery', 'Worker javob bermadi — antiplagiat va fon vazifalari to\'xtaydi',
                     'sudo systemctl status phoenix-celery')

    def check_monitoring(self):
        if getattr(settings, 'TELEGRAM_BOT_TOKEN', '') and getattr(settings, 'PHONIX_ALERT_CHAT_ID', ''):
            self.add(OK, 'Monitoring', 'Xatolar va uzilishlar Telegram chatga yuboriladi')
        else:
            self.add(WARN, 'Monitoring', 'PHONIX_ALERT_CHAT_ID yoki TELEGRAM_BOT_TOKEN yo\'q — xatolar haqida hech kim bilmaydi',
                     '.env: PHONIX_ALERT_CHAT_ID=<admin chat id>')
        if os.getenv('SENTRY_DSN'):
            self.add(OK, 'Sentry', 'SENTRY_DSN o\'rnatilgan')

    def check_phone_verification(self):
        username = getattr(settings, 'TELEGRAM_BOT_USERNAME', '')
        required = self._flag('PHONE_VERIFICATION_REQUIRED')
        if not username:
            self.add(FAIL if required else WARN, 'Telefon tasdiqlash',
                     'TELEGRAM_BOT_USERNAME yo\'q — Telegram orqali tasdiqlash va parol tiklash ishlamaydi',
                     '.env: TELEGRAM_BOT_USERNAME=<bot nomi @ siz>')
        elif not required:
            self.add(WARN, 'Telefon tasdiqlash', 'Ixtiyoriy — tasdiqlanmagan raqam bilan maqola/to\'lov mumkin',
                     'Foydalanuvchilar odatlangach: .env PHONE_VERIFICATION_REQUIRED=true')
        else:
            self.add(OK, 'Telefon tasdiqlash', f'Majburiy, bot @{username}')

    def check_payments(self):
        if not settings.CLICK_SECRET_KEY:
            self.add(FAIL, 'Click', 'CLICK_SECRET_KEY yo\'q — to\'lov callbacklari rad etiladi')
        else:
            self.add(OK, 'Click', 'Kalit o\'rnatilgan')
        if getattr(settings, 'PAYME_MERCHANT_ID', ''):
            if getattr(settings, 'PAYME_IS_TEST', False):
                self.add(WARN, 'Payme', 'PAYME_IS_TEST=True — test rejimi', '.env: PAYME_IS_TEST=False')
            elif not getattr(settings, 'PAYME_MERCHANT_KEY', ''):
                self.add(FAIL, 'Payme', 'PAYME_MERCHANT_KEY yo\'q')
            else:
                self.add(OK, 'Payme', 'Production rejimi')

    def check_legal(self):
        if not self._flag('TERMS_ACCEPTANCE_REQUIRED', True):
            self.add(WARN, 'Oferta', 'Ro\'yxatdan o\'tishda rozilik majburiy emas', '.env: TERMS_ACCEPTANCE_REQUIRED=true')
        env_file = Path(settings.BASE_DIR).parent / 'frontend' / '.env.production'
        text = env_file.read_text(encoding='utf-8', errors='ignore') if env_file.exists() else ''
        needed = ('VITE_LEGAL_NAME', 'VITE_LEGAL_INN', 'VITE_LEGAL_ADDRESS', 'VITE_LEGAL_BANK', 'VITE_LEGAL_ACCOUNT',
                  'VITE_LEGAL_MFO', 'VITE_LEGAL_DIRECTOR')
        missing = [n for n in needed if f'{n}=' not in text]
        if missing:
            self.add(WARN, 'Oferta rekvizitlari', f'frontend/.env.production da yo\'q: {", ".join(missing)}',
                     'Kompaniya rekvizitlarini kiriting va oferta matnini yuristga ko\'rsating')
        else:
            self.add(OK, 'Oferta rekvizitlari', 'Kiritilgan')

    def check_antiplag_vectors(self):
        from apps.articles.antiplagiat_vectors import local_vectors_enabled, local_vectors_ready

        if not getattr(settings, 'ANTIPLAG_LOCAL_VECTORS_ENABLED', False):
            self.add(INFO, 'Antiplagiat (semantik)', "Parafraz/tarjima qatlami o'chiq (ANTIPLAG_LOCAL_VECTORS_ENABLED)")
        elif not local_vectors_enabled():
            self.add(WARN, 'Antiplagiat (semantik)', "Yoqilgan, lekin sentence-transformers o'rnatilmagan",
                     'pip install -r requirements.txt')
        elif not local_vectors_ready():
            self.add(WARN, 'Antiplagiat (semantik)', 'Vektor indeksi hali qurilmagan',
                     'python manage.py build_antiplag_vectors')
        else:
            self.add(OK, 'Antiplagiat (semantik)', 'Parafraz va tarjima plagiati qatlami ishlayapti')

    def check_data_location(self):
        loc = os.getenv('PHONIX_DATA_LOCATION', '').strip().upper()
        if loc == 'UZ':
            self.add(OK, 'Ma\'lumotlar joylashuvi', 'O\'zbekiston hududida (PHONIX_DATA_LOCATION=UZ bilan tasdiqlangan)')
        else:
            self.add(WARN, 'Ma\'lumotlar joylashuvi',
                     "O'zbekiston fuqarolarining shaxsga doir ma'lumotlari O'zbekistondagi serverda saqlanishi shart (O'RQ-547, 27¹-modda)",
                     "Hosting joylashuvini tekshiring; UZ bo'lsa .env: PHONIX_DATA_LOCATION=UZ; "
                     "shaxsga doir ma'lumotlar bazasini davlat reyestrida ro'yxatdan o'tkazing")
