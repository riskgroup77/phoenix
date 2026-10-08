"""
OAI-PMH orqali jurnal arxivlarini ichki antiplagiat bazasiga yig'ish (bepul manbalar).

    python manage.py harvest_oai --all                       # standart O'zbekiston manbalari (yoki ANTIPLAG_OAI_SOURCES)
    python manage.py harvest_oai https://journal.uz/index.php/jur/oai
    python manage.py harvest_oai --all --fill-full-text 300  # + 300 ta yozuvning PDF to'liq matni
    python manage.py harvest_oai <url> --set jur --from 2026-01-01 --limit 500
    python manage.py harvest_oai --status                    # har manba/jurnal bo'yicha holat

- OJS'ning sayt bo'yicha endpoint'i (…/index.php/index/oai) jurnal-jurnal (set) bo'yicha yig'iladi;
- har set uchun oxirgi yozuv sanasi saqlanadi (AntiplagHarvestState) — keyingi ishga tushirishda faqat yangilari;
- yozuvlar AntiplagCorpusDocument ga (external_key = oai:<identifier>) yoziladi va darhol indekslanadi;
- --fill-full-text N: annotatsiyasi bor, lekin PDF matni hali olinmagan N ta yozuv uchun to'liq matn
  (har tungi ishga tushirishda bir qismi — server va manba saytlariga yuk tushirmasdan).
"""
from __future__ import annotations

import time
from functools import partial
from urllib.parse import urlparse

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.articles import antiplagiat_oai as oai
from apps.articles.antiplagiat_index import index_corpus_document, suppress_auto_index
from apps.articles.antiplagiat_oai import (
    DEFAULT_OAI_SOURCES,
    full_text_for,
    iter_records,
    list_sets,
    parse_source,
    record_full_text,
)


class Command(BaseCommand):
    help = 'OAI-PMH (OJS jurnallari) arxivlarini antiplagiat ichki bazasiga yig\'ish'

    def add_arguments(self, parser):
        parser.add_argument('endpoint', nargs='?', help='OAI-PMH endpoint URL ("url|insecure" ham mumkin)')
        parser.add_argument('--all', action='store_true', help='ANTIPLAG_OAI_SOURCES yoki standart manbalar ro\'yxati')
        parser.add_argument('--set', dest='set_spec', default='', help='Faqat shu OAI set (jurnal)')
        parser.add_argument('--per-set', dest='per_set', action='store_true', default=None,
                            help='Set (jurnal) bo\'yicha yig\'ish (…/index/oai uchun avtomatik)')
        parser.add_argument('--no-per-set', dest='per_set', action='store_false')
        parser.add_argument('--from', dest='date_from', default='', help='Shu sanadan keyingilar (YYYY-MM-DD)')
        parser.add_argument('--full', action='store_true', help='Saqlangan holatga qaramay boshidan yig\'ish')
        parser.add_argument('--limit', type=int, default=0, help='Har set/manbadan ko\'pi bilan shuncha yozuv')
        parser.add_argument('--full-text', action='store_true',
                            help='Yangi yozuvlar uchun darhol PDF to\'liq matnini ham olish (sekin)')
        parser.add_argument('--fill-full-text', type=int, default=0,
                            help='Matni hali olinmagan shuncha yozuv uchun PDF to\'liq matni')
        parser.add_argument('--insecure', action='store_true', help='SSL sertifikatini tekshirmaslik (faqat o\'qish)')
        parser.add_argument('--source-type', default='journal', choices=['journal', 'otm', 'natlib', 'other'])
        parser.add_argument('--delay', type=float, default=1.0, help='So\'rovlar orasidagi kutish (s)')
        parser.add_argument('--status', action='store_true', help='Yig\'ish holatini ko\'rsatish')

    # ------------------------------------------------------------------ kirish

    def handle(self, *args, **opts):
        if opts['status']:
            self._print_status()
            return
        sources: list[tuple[str, bool]] = []
        if opts['endpoint']:
            url, insecure = parse_source(opts['endpoint'])
            sources = [(url, insecure or opts['insecure'])]
        elif opts['all']:
            specs = list(getattr(settings, 'ANTIPLAG_OAI_SOURCES', []) or []) or list(DEFAULT_OAI_SOURCES)
            sources = [(u, ins or opts['insecure']) for u, ins in map(parse_source, specs)]
        elif not opts['fill_full_text']:
            raise CommandError('Endpoint URL, --all yoki --fill-full-text kerak')

        self.insecure_hosts = {urlparse(u).hostname for u, ins in sources if ins}
        self.insecure_hosts |= {
            urlparse(u).hostname for u, ins in map(parse_source, DEFAULT_OAI_SOURCES) if ins
        }
        with suppress_auto_index():
            for url, insecure in sources:
                try:
                    self._harvest_source(url, insecure, opts)
                except Exception as exc:
                    self.stderr.write(self.style.ERROR(f'{url}: {exc}'))
            if opts['fill_full_text']:
                self._fill_full_text(opts['fill_full_text'], opts['delay'])

    # ------------------------------------------------------------------ yig'ish

    def _harvest_source(self, url: str, insecure: bool, opts) -> None:
        fetch = partial(oai._get, verify=not insecure)
        per_set = opts['per_set']
        if per_set is None:
            per_set = url.rstrip('/').endswith('/index/oai')
        if opts['set_spec']:
            sets = [opts['set_spec']]
        elif per_set:
            sets = list_sets(url, fetch=fetch, delay=opts['delay'])
        else:
            sets = ['']
        self.stdout.write(f'== {url} ({len(sets)} ta set)' if sets != [''] else f'== {url}')
        for s in sets:
            try:
                self._harvest_set(url, s, fetch, insecure, opts)
            except Exception as exc:
                self.stderr.write(self.style.ERROR(f'  [{s or "*"}] {exc}'))

    def _harvest_set(self, url: str, set_spec: str, fetch, insecure: bool, opts) -> None:
        from apps.articles.models import AntiplagHarvestState

        state, _ = AntiplagHarvestState.objects.get_or_create(endpoint=url[:300], set_spec=set_spec[:200])
        date_from = opts['date_from']
        if not date_from and not opts['full'] and state.completed and state.last_datestamp:
            date_from = state.last_datestamp[:10]
        stats = {'created': 0, 'updated': 0, 'deleted': 0, 'skipped': 0, 'unchanged': 0}
        max_stamp = state.last_datestamp or ''
        seen = 0
        try:
            for rec in iter_records(url, set_spec=set_spec, date_from=date_from, limit=opts['limit'],
                                    delay=opts['delay'], fetch=fetch):
                seen += 1
                if rec.datestamp and rec.datestamp > max_stamp:
                    max_stamp = rec.datestamp
                stats[self._save_record(rec, insecure, opts)] += 1
        except Exception as exc:
            state.last_error = str(exc)[:2000]
            state.last_run_at = timezone.now()
            state.save()
            raise
        hit_limit = bool(opts['limit']) and seen >= opts['limit']
        if not hit_limit:
            state.completed = True
            state.last_datestamp = max_stamp
        state.records_seen += seen
        state.last_run_at = timezone.now()
        state.last_error = ''
        state.save()
        if seen:
            self.stdout.write(
                f'  [{set_spec or "*"}] yozuv: {seen}; yangi: {stats["created"]}, yangilangan: {stats["updated"]}, '
                f'o\'zgarmagan: {stats["unchanged"]}, o\'chirilgan: {stats["deleted"]}, '
                f'o\'tkazib yuborilgan: {stats["skipped"]}'
            )

    def _save_record(self, rec, insecure: bool, opts) -> str:
        from apps.articles.models import AntiplagCorpusDocument

        key = rec.external_key
        existing = AntiplagCorpusDocument.objects.filter(external_key=key).first()
        if rec.deleted:
            if existing and existing.is_active:
                existing.is_active = False
                existing.save(update_fields=['is_active', 'updated_at'])
                index_corpus_document(existing)
                return 'deleted'
            return 'skipped'
        body = rec.text
        checked_at = existing.fulltext_checked_at if existing else None
        if existing and len(existing.full_text or '') > len(body) + 400:
            body = existing.full_text  # to'liq matn avval olingan — qayta yuklanmaydi
        elif opts['full_text'] and not checked_at:
            ft = record_full_text(rec, verify=not insecure)
            checked_at = timezone.now()
            if ft:
                body = f'{body}\n{ft}'
        if not rec.title or len(body) < 80:
            return 'skipped'
        values = {
            'title': rec.title[:500],
            'full_text': body,
            'source_url': (rec.landing_url or '')[:500],
            'source_type': opts['source_type'],
            'author_names': '; '.join(rec.creators)[:300],
            'language': (rec.languages[0] if rec.languages else 'uz')[:12],
            'is_active': True,
            'fulltext_checked_at': checked_at,
        }
        if existing and all(getattr(existing, f) == v for f, v in values.items()):
            return 'unchanged'
        if existing:
            for f, v in values.items():
                setattr(existing, f, v)
            existing.save()
            doc, result = existing, 'updated'
        else:
            doc, result = AntiplagCorpusDocument.objects.create(external_key=key, **values), 'created'
        index_corpus_document(doc)
        return result

    # ------------------------------------------------------------------ to'liq matn

    def _fill_full_text(self, n: int, delay: float) -> None:
        from apps.articles.models import AntiplagCorpusDocument

        qs = (
            AntiplagCorpusDocument.objects.filter(
                external_key__startswith='oai:', is_active=True, fulltext_checked_at__isnull=True,
            )
            .exclude(source_url='')
            .order_by('-updated_at')[:n]
        )
        got = tried = 0
        for doc in qs:
            tried += 1
            verify = urlparse(doc.source_url).hostname not in self.insecure_hosts
            ft = full_text_for(doc.source_url, verify=verify)
            doc.fulltext_checked_at = timezone.now()
            if ft:
                doc.full_text = f'{doc.full_text}\n{ft}'
                got += 1
            doc.save()
            if ft:
                index_corpus_document(doc)
            if delay:
                time.sleep(delay)
        self.stdout.write(f'To\'liq matn: {tried} ta urinish, {got} tasida PDF matni olindi')

    # ------------------------------------------------------------------ holat

    def _print_status(self) -> None:
        from django.db.models import Count, Q

        from apps.articles.models import AntiplagCorpusDocument, AntiplagHarvestState

        for st in AntiplagHarvestState.objects.order_by('endpoint', 'set_spec'):
            mark = 'tayyor' if st.completed else 'to\'liq emas'
            err = f' | XATO: {st.last_error[:80]}' if st.last_error else ''
            self.stdout.write(f'{st.endpoint} [{st.set_spec or "*"}] {mark}, oxirgi sana: {st.last_datestamp or "-"}, '
                              f'ko\'rilgan: {st.records_seen}{err}')
        agg = AntiplagCorpusDocument.objects.filter(external_key__startswith='oai:').aggregate(
            total=Count('id'), active=Count('id', filter=Q(is_active=True)),
            ft=Count('id', filter=Q(fulltext_checked_at__isnull=False)),
        )
        self.stdout.write(f'OAI hujjatlari: {agg["total"]} (faol: {agg["active"]}, to\'liq matn tekshirilgan: {agg["ft"]})')
