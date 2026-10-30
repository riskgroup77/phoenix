from django.core.management.base import BaseCommand

from apps.journals.images import shrink_cover
from apps.journals.models import Journal


class Command(BaseCommand):
    help = "Mavjud jurnal muqovalarini kartochka uchun kichraytiradi (fayl nomi va URL o'zgarmaydi)."

    def handle(self, *args, **options):
        changed = 0
        for j in Journal.objects.exclude(image_url='').exclude(image_url__isnull=True):
            if shrink_cover(j.image_url.path):
                changed += 1
                self.stdout.write(f'  siqildi: {j.image_url.name}')
        self.stdout.write(self.style.SUCCESS(f'Tayyor: {changed} ta muqova kichraytirildi.'))
