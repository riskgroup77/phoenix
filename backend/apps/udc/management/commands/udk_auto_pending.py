"""To'langan, lekin hali yakunlanmagan (submitted) UDK so'rovlarini avtomatik aniqlash (oqim uzilgan bo'lsa)."""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.udc.auto_complete import auto_complete
from apps.udc.models import UDK_REQUEST_STATUS_SUBMITTED, UdkRequest


class Command(BaseCommand):
    help = "Kutilayotgan UDK so'rovlarini avtomatik yakunlash"

    def add_arguments(self, parser):
        parser.add_argument('--min-age', type=int, default=2, help="Kamida necha daqiqa oldin to'langan")

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(minutes=options['min_age'])
        ids = list(UdkRequest.objects.filter(status=UDK_REQUEST_STATUS_SUBMITTED, created_at__lte=cutoff)
                   .exclude(auto_method='manual').values_list('pk', flat=True))
        done = sum(1 for pk in ids if auto_complete(pk))
        self.stdout.write(self.style.SUCCESS(f"{done}/{len(ids)} ta so'rov avtomatik yakunlandi"))
