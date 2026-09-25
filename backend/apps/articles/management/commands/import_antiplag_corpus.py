"""
Milliy arxiv / tashqi korpus import (JSON).

Format (massiv):
[
  {
    "external_key": "natlib-123",
    "title": "...",
    "full_text": "...",
    "source_url": "https://...",
    "source_type": "natlib",
    "author_names": "...",
    "language": "ru"
  }
]
"""
from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.articles.models import AntiplagCorpusDocument


class Command(BaseCommand):
    help = 'Antiplagiat korpus hujjatlarini JSON fayldan import qilish'

    def add_arguments(self, parser):
        parser.add_argument('json_path', type=str, help='JSON fayl yo\'li')
        parser.add_argument(
            '--replace',
            action='store_true',
            help='external_key bo\'yicha mavjud yozuvlarni yangilash',
        )

    def handle(self, *args, **options):
        path = Path(options['json_path'])
        if not path.is_file():
            raise CommandError(f'Fayl topilmadi: {path}')

        raw = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(raw, list):
            raise CommandError('JSON root massiv bo\'lishi kerak')

        created = updated = skipped = 0
        for item in raw:
            if not isinstance(item, dict):
                skipped += 1
                continue
            key = str(item.get('external_key') or '').strip()
            title = str(item.get('title') or '').strip()
            text = str(item.get('full_text') or '').strip()
            if not key or not title or len(text) < 80:
                skipped += 1
                continue

            defaults = {
                'title': title[:500],
                'full_text': text[:500000],
                'source_url': str(item.get('source_url') or '')[:500],
                'source_type': str(item.get('source_type') or 'import')[:40],
                'author_names': str(item.get('author_names') or '')[:300],
                'language': str(item.get('language') or 'uz')[:12],
                'is_active': True,
            }
            if options['replace']:
                _, was_created = AntiplagCorpusDocument.objects.update_or_create(
                    external_key=key,
                    defaults=defaults,
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
            else:
                if AntiplagCorpusDocument.objects.filter(external_key=key).exists():
                    skipped += 1
                    continue
                AntiplagCorpusDocument.objects.create(external_key=key, **defaults)
                created += 1

        from apps.articles.antiplagiat_corpus import invalidate_corpus_cache

        invalidate_corpus_cache()

        self.stdout.write(
            self.style.SUCCESS(
                f'Tayyor: yaratildi={created}, yangilandi={updated}, o\'tkazildi={skipped}',
            )
        )
