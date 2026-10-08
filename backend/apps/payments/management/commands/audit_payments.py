"""
To'lov teshiklari (2026-10 tuzatishlaridan oldin) suiiste'mol qilinganmi — tekshirish.
Faqat O'QIYDI, bazada hech narsani o'zgartirmaydi.

    python manage.py audit_payments
    python manage.py audit_payments --verify-click   # shubhalilarni Click API orqali tasdiqlatish

1) Imzosiz "complete": completed, lekin prepare bosqichi bo'lmagan (click_service_id bo'sh) Click tranzaksiyalari.
   Haqiqiy Click to'lovida prepare har doim complete'dan oldin keladi. Istisno — "To'lovni tekshirish"
   (sync_transaction_from_click) orqali tasdiqlanganlar; --verify-click ularni ajratib beradi.
2) Arzon to'lov: completed tranzaksiya summasi hozirgi server narxidan past.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.payments.models import Transaction
from apps.payments import pricing


class Command(BaseCommand):
    help = "Completed tranzaksiyalarni imzosiz tasdiqlash va arzon to'lov belgilari bo'yicha tekshiradi (faqat o'qish)."

    def add_arguments(self, parser):
        parser.add_argument('--verify-click', action='store_true', help='Shubhalilarni Click API orqali tekshirish')

    def handle(self, *args, **options):
        completed = Transaction.objects.filter(status='completed').select_related(
            'user', 'article', 'article__journal', 'translation_request'
        ).exclude(service_type='top_up')

        # 1) Prepare bo'lmagan Click "complete"lar
        no_prepare = [
            tx for tx in completed
            if not (tx.payme_trans_id or '').strip() and not (tx.click_service_id or '').strip()
        ]
        self.stdout.write(self.style.MIGRATE_HEADING(
            f'\n1) Prepare bosqichisiz completed (Click): {len(no_prepare)} ta'
        ))
        click = None
        if options['verify_click'] and no_prepare:
            from apps.payments.services import ClickPaymentService
            click = ClickPaymentService()
        unconfirmed = 0
        for tx in no_prepare:
            verdict = ''
            if click is not None:
                verdict = self._verify_with_click(click, tx)
                if verdict != 'CLICK TASDIQLADI':
                    unconfirmed += 1
            self.stdout.write(
                f'   {tx.id} | {tx.service_type} | {tx.amount} | {tx.user.phone if tx.user_id else "-"} | '
                f'{timezone.localtime(tx.completed_at).strftime("%Y-%m-%d %H:%M") if tx.completed_at else "-"} '
                f'| click_trans_id={tx.click_trans_id or "-"} {verdict}'
            )
        if click is not None:
            self.stdout.write(self.style.WARNING(f'   Click tasdiqlamagan: {unconfirmed} ta'))

        # 2) Hozirgi narxdan arzon to'lovlar
        cheap = []
        for tx in completed:
            expected = pricing.expected_amount_for_transaction(tx)
            if expected is not None and expected > 0 and Decimal(str(tx.amount)) < expected - Decimal('0.01'):
                cheap.append((tx, expected))
        self.stdout.write(self.style.MIGRATE_HEADING(
            f'\n2) Hozirgi narxdan arzon completed to\'lovlar: {len(cheap)} ta'
        ))
        self.stdout.write('   (Eslatma: narx keyinroq oshirilgan bo\'lsa — bu normal holat; summasi juda kichiklarga e\'tibor bering.)')
        for tx, expected in cheap:
            self.stdout.write(
                f'   {tx.id} | {tx.service_type} | to\'langan={tx.amount} | hozirgi narx={expected} | '
                f'{tx.user.phone if tx.user_id else "-"}'
            )

        self.stdout.write('')

    @staticmethod
    def _verify_with_click(click, tx) -> str:
        service_id = str(tx.click_service_id or click.service_id)
        mti = str(tx.merchant_trans_id or tx.id)
        created = timezone.localtime(tx.created_at or timezone.now())
        for date_str in (created.strftime('%Y-%m-%d'), created.strftime('%d.%m.%Y')):
            try:
                result = click.check_payment_status_by_mti(service_id, mti, date_str)
            except Exception as exc:
                return f'[Click so\'rov xatosi: {exc}]'
            if click._click_payment_is_paid(result):
                return 'CLICK TASDIQLADI'
        return '[!] CLICK TASDIQLAMADI'
