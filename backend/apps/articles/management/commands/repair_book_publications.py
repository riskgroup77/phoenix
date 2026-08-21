from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Tasdiqlangan, lekin maqolasiz kitob nashr tranzaksiyalarini tiklaydi."

    def handle(self, *args, **options):
        from apps.payments.models import Transaction
        from apps.articles.repair_book_publication import (
            ensure_book_article_for_transaction,
            fulfill_book_publication,
        )

        qs = Transaction.objects.filter(
            service_type='book_publication',
            status='completed',
            article__isnull=True,
        ).select_related('user').order_by('created_at')

        repaired = 0
        for tx in qs:
            article = ensure_book_article_for_transaction(tx)
            if article is not None:
                fulfill_book_publication(tx)
                repaired += 1
                self.stdout.write(self.style.SUCCESS(f'Repaired tx {tx.id} → article {article.id}'))
        self.stdout.write(self.style.SUCCESS(f'Done. Repaired {repaired} transaction(s).'))
