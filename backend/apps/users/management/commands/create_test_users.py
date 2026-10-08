from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from apps.users.models import User


class Command(BaseCommand):
    help = (
        "FAQAT LOKAL: barcha userlarni o'chirib, demo userlarni (911111111/muallif va h.k.) qayta yaratish. "
        "O'chirmasdan yaratish/yangilash uchun: python manage.py setup_demo_and_admin"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Barcha userlarni o\'chirib, qayta yaratish (default behavior)',
        )

    def handle(self, *args, **options):
        from django.conf import settings

        if not settings.DEBUG:
            raise CommandError("create_test_users productionda (DEBUG=False) bloklangan: u BARCHA userlarni o'chiradi.")
        total_deleted = User.objects.count()
        User.objects.all().delete()
        self.stdout.write(self.style.WARNING(f'{total_deleted} ta user o\'chirildi.'))
        call_command('setup_demo_and_admin', stdout=self.stdout)
