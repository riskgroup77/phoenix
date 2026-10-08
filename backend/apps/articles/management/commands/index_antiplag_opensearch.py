"""
Platforma korpusini OpenSearch ga indekslash (matn + ixtiyoriy E5 vektor).

  python manage.py index_antiplag_opensearch
  python manage.py index_antiplag_opensearch --with-embeddings
"""
from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from apps.articles.antiplagiat_index_builder import build_fragment_documents
from apps.articles.antiplagiat_opensearch import bulk_index_fragments, opensearch_enabled


class Command(BaseCommand):
    help = 'Antiplagiat fragmentlarini OpenSearch ga yuklash'

    def add_arguments(self, parser):
        parser.add_argument(
            '--with-embeddings',
            action='store_true',
            help='Har fragment uchun multilingual-e5 vektor (sekin, aniqroq parafraz)',
        )
        parser.add_argument(
            '--recreate',
            action='store_true',
            help="Indeksni o'chirib qayta yaratish (eski, endi korpusga kirmaydigan fragmentlar tozalanadi)",
        )

    def handle(self, *args, **options):
        if not opensearch_enabled():
            raise CommandError(
                'ANTIPLAG_OPENSEARCH_ENABLED=true va ANTIPLAG_OPENSEARCH_URL sozlang.',
            )

        if options['recreate']:
            from apps.articles.antiplagiat_opensearch import _client, index_name

            client = _client()
            if client is not None and client.indices.exists(index=index_name()):
                client.indices.delete(index=index_name())
                self.stdout.write(self.style.WARNING(f"Eski indeks o'chirildi: {index_name()}"))

        docs = build_fragment_documents()
        if not docs:
            self.stdout.write(self.style.WARNING('Indekslash uchun fragment topilmadi.'))
            return

        count = bulk_index_fragments(docs, with_embeddings=options['with_embeddings'])
        self.stdout.write(
            self.style.SUCCESS(
                f'OpenSearch: {count} fragment yuklandi (jami tayyor fragment: {len(docs)}).',
            ),
        )
