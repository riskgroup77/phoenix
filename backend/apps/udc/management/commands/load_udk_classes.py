"""data/udk_ozbek.json dagi UDK klassifikatorini bazaga (UdcClass) yuklaydi/yangilaydi."""
from django.core.management.base import BaseCommand

from apps.udc.catalog import load_catalog
from apps.udc.models import UdcClass


class Command(BaseCommand):
    help = "UDK klassifikatorini (kitob asosida) bazaga yuklash"

    def handle(self, *args, **options):
        n = load_catalog(UdcClass)
        self.stdout.write(self.style.SUCCESS(f"{n} ta yozuv qo'shildi/yangilandi. Jami: {UdcClass.objects.count()}"))
