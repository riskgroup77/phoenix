"""
Antiplagiat barmoq izlari indeksini qurish / yangilash.

    python manage.py build_antiplag_index            # o'zgarganlarini yangilash (tez qayta ishga tushirsa bo'ladi)
    python manage.py build_antiplag_index --rebuild  # hammasini qaytadan
    python manage.py build_antiplag_index --only articles|corpus
    python manage.py build_antiplag_index --stats

Yangi maqolalar va arxiv hujjatlari keyinchalik avtomatik indekslanadi (ANTIPLAG_AUTO_INDEX).
"""
from __future__ import annotations

import time

from django.core.management.base import BaseCommand

from apps.articles.antiplagiat_index import (
    article_is_indexable,
    index_article,
    index_corpus_document,
    index_stats,
    mark_index_built,
)


class Command(BaseCommand):
    help = 'Antiplagiat barmoq izlari indeksini qurish (butun hujjatni butun baza bilan solishtirish uchun)'

    def add_arguments(self, parser):
        parser.add_argument('--rebuild', action='store_true', help='Matni o\'zgarmaganlarini ham qayta yozish')
        parser.add_argument('--only', choices=['articles', 'corpus'], help='Faqat bitta manba turi')
        parser.add_argument('--stats', action='store_true', help='Faqat statistika')
        parser.add_argument('--prune', action='store_true', help='Bazada yo\'q hujjatlarni indeksdan o\'chirish')

    def handle(self, *args, **opts):
        if opts['stats']:
            self._print_stats()
            return
        force = bool(opts['rebuild'])
        started = time.monotonic()
        if opts['only'] in (None, 'articles'):
            self._articles(force)
        if opts['only'] in (None, 'corpus'):
            self._corpus(force)
        if opts['prune']:
            self._prune()
        if opts['only'] is None:
            # Faqat to'liq o'tishdan keyin tekshiruvlar indeksga o'tadi (chala indeks ishlatilmaydi)
            mark_index_built()
        self.stdout.write(self.style.SUCCESS(f'Tayyor: {time.monotonic() - started:.1f} s'))
        self._print_stats()

    def _articles(self, force: bool) -> None:
        from apps.articles.models import Article

        qs = Article.objects.exclude(status__in=['Draft', 'Rejected']).order_by('-submission_date')
        total = qs.count()
        done = written = 0
        for art in qs.iterator(chunk_size=200):
            done += 1
            if not article_is_indexable(art):
                continue
            try:
                if index_article(art, force=force):
                    written += 1
            except Exception as exc:
                self.stderr.write(f'  maqola {art.pk}: {exc}')
            if done % 200 == 0:
                self.stdout.write(f'  maqolalar: {done}/{total}')
        self.stdout.write(f'Maqolalar: {total} ta ko\'rildi, {written} ta indekslandi/yangilandi')

    def _corpus(self, force: bool) -> None:
        from apps.articles.models import AntiplagCorpusDocument

        qs = AntiplagCorpusDocument.objects.order_by('-updated_at')
        total = qs.count()
        done = written = 0
        for doc in qs.iterator(chunk_size=200):
            done += 1
            try:
                if index_corpus_document(doc, force=force):
                    written += 1
            except Exception as exc:
                self.stderr.write(f'  korpus {doc.external_key}: {exc}')
            if done % 500 == 0:
                self.stdout.write(f'  arxiv: {done}/{total}')
        self.stdout.write(f'Arxiv hujjatlari: {total} ta ko\'rildi, {written} ta indekslandi/yangilandi')

    def _prune(self) -> None:
        from apps.articles.models import AntiplagCorpusDocument, AntiplagIndexedDocument, Article

        removed = 0
        article_ids = {str(pk) for pk in Article.objects.values_list('pk', flat=True)}
        corpus_keys = set(AntiplagCorpusDocument.objects.filter(is_active=True).values_list('external_key', flat=True))
        for doc in AntiplagIndexedDocument.objects.only('id', 'doc_key').iterator():
            kind, _, ref = doc.doc_key.partition(':')
            if kind == 'meta':
                continue
            if (kind in ('article', 'check') and ref not in article_ids) or (kind == 'corpus' and ref not in corpus_keys):
                doc.delete()
                removed += 1
        self.stdout.write(f'Indeksdan o\'chirildi: {removed} ta')

    def _print_stats(self) -> None:
        st = index_stats()
        for kind, row in sorted(st['by_kind'].items()):
            self.stdout.write(f'  {kind:8} hujjat: {row["documents"]:>7}   so\'z: {row["tokens"]:>10}')
        self.stdout.write(f'  barmoq izlari: {st["fingerprints"]}')
        ready = 'ha' if st['ready'] else "yo'q (to'liq qurilmagan)"
        self.stdout.write(f'  tekshiruvlarda ishlatiladi: {ready}')
