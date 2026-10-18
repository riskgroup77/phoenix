"""
PDF dan (UDK kitobi o'zbekchasi) asosiy jadvallardagi UDK kodlari va tavsiflarini o'qib data/udk_ozbek.json ga
yozadi (kirill + lotin). Bazaga yuklash: python manage.py load_udk_classes
Ishlatish: python manage.py parse_udk_book "/yo'l/UDK kitobi o'zbekchasi.pdf"
"""
import json
import os

from django.core.management.base import BaseCommand, CommandError

from apps.udc.udk_book import parse_main_tables, pdf_layout_text


class Command(BaseCommand):
    help = "UDK kitobi o'zbekchasi PDF dan kodlarni o'qib udk_ozbek.json ga yozadi"

    def add_arguments(self, parser):
        parser.add_argument('pdf_path', type=str, help="PDF fayl yo'li")
        parser.add_argument('--first-page', type=int, default=78, help='Asosiy jadvallar boshlanadigan bet')
        parser.add_argument('--last-page', type=int, default=282)

    def handle(self, *args, **options):
        pdf_path = options['pdf_path'].strip().strip('"')
        if not os.path.isfile(pdf_path):
            raise CommandError(f'Fayl topilmadi: {pdf_path}')
        try:
            text = pdf_layout_text(pdf_path, options['first_page'], options['last_page'])
        except Exception as e:
            raise CommandError(f"PDF o'qishda xatolik: {e}")
        items = parse_main_tables(text)
        if not items:
            raise CommandError('PDF da UDK jadvali topilmadi.')

        out_path = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'udk_ozbek.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=1)
        import apps.udc.services as svc
        svc._UDK_OZBEK_CACHE = None
        self.stdout.write(self.style.SUCCESS(f'{len(items)} ta UDK kodi yozildi: {os.path.normpath(out_path)}'))
