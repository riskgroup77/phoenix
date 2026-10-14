"""
UDK ma'lumotnomalari uchun PDF yaratish.
(Oldin udk_request_complete xatosi tufayli UDK so'rovlari PDF'siz yakunlangan.)

    python manage.py regenerate_udk_pdfs                 # PDF'siz nechta ekanini ko'rsatadi
    python manage.py regenerate_udk_pdfs --apply         # PDF'siz qolganlarini yaratadi
    python manage.py regenerate_udk_pdfs --all --apply   # hammasini yangi dizaynda qayta yaratadi
"""
from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.udc.models import UDKCertificate
from apps.udc.pdf_generator import save_certificate_pdf


class Command(BaseCommand):
    help = "UDK ma'lumotnomalari uchun PDF yaratadi (standart: faqat PDF'siz qolganlar)."

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--all', action='store_true', help="Mavjud PDF'larni ham qayta yaratish (yangi shablon)")

    def handle(self, *args, **options):
        if options['all']:
            qs = UDKCertificate.objects.all()
            self.stdout.write(f"Barcha ma'lumotnomalar: {qs.count()} ta")
        else:
            qs = UDKCertificate.objects.filter(Q(certificate_path='') | Q(certificate_path__isnull=True))
            self.stdout.write(f"PDF'siz ma'lumotnomalar: {qs.count()} ta")
        if not options['apply']:
            self.stdout.write("Yaratish uchun: python manage.py regenerate_udk_pdfs [--all] --apply")
            return
        ok = failed = 0
        for cert in qs.select_related('user'):
            try:
                save_certificate_pdf(cert)
                ok += 1
            except Exception as exc:
                failed += 1
                self.stdout.write(self.style.ERROR(f'   {cert.id}: {exc}'))
        self.stdout.write(self.style.SUCCESS(f'Yaratildi: {ok}, xato: {failed}'))
