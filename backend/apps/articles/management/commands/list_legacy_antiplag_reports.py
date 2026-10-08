"""
Eski algoritm (versiya < 4.0) bilan berilgan antiplagiat natijalari ro'yxati.

4.0 dan oldingi versiya manbalar, havolalar va foizlarning bir qismini hash asosida "to'qib"
chiqargan. Bu buyruq faqat O'QIYDI — qayta tekshirish yoki foydalanuvchilarni xabardor qilish
qarori administratorniki.

    python manage.py list_legacy_antiplag_reports
    python manage.py list_legacy_antiplag_reports --csv legacy_reports.csv
"""
import csv

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.articles.antiplagiat_utils import is_standalone_antiplagiat
from apps.articles.models import Article

# "To'qib chiqarish" 4.0 da olib tashlangan. 5.0 (chuqurroq skaner) natijalari eski emas, faqat sayozroq —
# shuning uchun chegara joriy versiya emas, aynan shu versiya.
FABRICATION_FIXED_VERSION = '4.0'


def _version_tuple(value) -> tuple[int, ...]:
    try:
        return tuple(int(x) for x in str(value).split('.'))
    except (TypeError, ValueError):
        return (0,)


class Command(BaseCommand):
    help = "Eski antiplagiat algoritmi bilan berilgan natijalarni ko'rsatadi (faqat o'qish)."

    def add_arguments(self, parser):
        parser.add_argument('--csv', dest='csv_path', help='Natijani CSV faylga yozish')

    def handle(self, *args, **options):
        current = _version_tuple(FABRICATION_FIXED_VERSION)
        rows = []
        qs = (
            Article.objects.filter(plagiarism_checked_at__isnull=False)
            .select_related('author', 'journal')
            .order_by('-plagiarism_checked_at')
        )
        for art in qs.iterator(chunk_size=500):
            report = art.plagiarism_report if isinstance(art.plagiarism_report, dict) else {}
            version = report.get('algorithm_version') or ''
            if _version_tuple(version) >= current:
                continue
            rows.append({
                'article_id': str(art.id),
                'turi': 'mustaqil tekshiruv' if is_standalone_antiplagiat(art) else 'jurnal maqolasi',
                'holat': art.status,
                'hujjat': (report.get('document_name') or art.title or '')[:150],
                'muallif_telefon': art.author.phone if art.author_id else '',
                'tekshirilgan': timezone.localtime(art.plagiarism_checked_at).strftime('%Y-%m-%d %H:%M'),
                'plagiat_foiz': art.plagiarism_percentage,
                'sertifikat_raqami': report.get('certificate_number') or '',
                'algoritm': version or "noma'lum",
            })

        rejected = sum(1 for r in rows if r['holat'] in ('Rejected', 'PlagiarismReview'))
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"Eski algoritm (< {FABRICATION_FIXED_VERSION}) bilan berilgan natijalar: {len(rows)} ta"
        ))
        self.stdout.write(f"   shundan rad etilgan / bosh admin ko'rigidagi maqolalar: {rejected} ta")
        for r in rows[:50]:
            self.stdout.write(
                f"   {r['tekshirilgan']} | {r['turi']} | {r['holat']} | {r['plagiat_foiz']}% | "
                f"{r['hujjat'][:60]} | {r['muallif_telefon']}"
            )
        if len(rows) > 50:
            self.stdout.write(f"   ... yana {len(rows) - 50} ta (to'liq ro'yxat uchun --csv)")

        if options.get('csv_path'):
            with open(options['csv_path'], 'w', newline='', encoding='utf-8-sig') as fh:
                writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()) if rows else ['article_id'])
                writer.writeheader()
                writer.writerows(rows)
            self.stdout.write(self.style.SUCCESS(f"CSV yozildi: {options['csv_path']}"))
