"""
Lokal semantik indeksni qurish/yangilash (parafraz va tarjima plagiati uchun):

    python manage.py build_antiplag_vectors            # faqat yangi/o'zgargan hujjatlar
    python manage.py build_antiplag_vectors --rebuild  # hammasini qaytadan

ANTIPLAG_LOCAL_VECTORS_ENABLED=true va sentence-transformers o'rnatilgan bo'lishi kerak.
"""
from django.core.management.base import BaseCommand, CommandError

from apps.articles import antiplagiat_vectors as vectors


class Command(BaseCommand):
    help = "Antiplagiat lokal vektor indeksini qurish (OpenSearch'siz parafraz va tarjima plagiati)"

    def add_arguments(self, parser):
        parser.add_argument('--rebuild', action='store_true', help='Barcha hujjatlarni qaytadan vektorlash')
        parser.add_argument('--limit', type=int, default=None, help='Sinov uchun: faqat N ta hujjat')
        parser.add_argument('--batch', type=int, default=32)
        parser.add_argument('--if-enabled', action='store_true', help="O'chirilgan bo'lsa xatosiz chiqish (timer uchun)")

    def handle(self, *args, **opts):
        if not vectors.local_vectors_enabled():
            if opts['if_enabled']:
                self.stdout.write("Lokal vektorlar o'chirilgan — o'tkazib yuborildi.")
                return
            raise CommandError(
                "Lokal vektorlar o'chirilgan yoki sentence-transformers o'rnatilmagan "
                '(.env: ANTIPLAG_LOCAL_VECTORS_ENABLED=true; pip install sentence-transformers).'
            )

        def progress(done, total):
            self.stdout.write(f'   {done}/{total} hujjat vektorlandi...')

        stats = vectors.build_index(rebuild=opts['rebuild'], limit=opts['limit'], batch=opts['batch'], progress=progress)
        self.stdout.write(self.style.SUCCESS(
            f"Tayyor: {stats['documents']} hujjat, {stats['passages']} parcha "
            f"(yangi vektorlangan: {stats['embedded']}, qayta ishlatilgan: {stats['reused']})."
        ))
