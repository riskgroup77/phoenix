"""
Taqrizchilarga muddat eslatmasi (kuniga bir marta ishga tushiring: systemd timer yoki cron).

  python manage.py send_deadline_reminders            # yuborish
  python manage.py send_deadline_reminders --dry-run  # faqat ko'rsatish

- Har bir faol taqrizchiga: muddati 24 soat ichida tugaydigan va kechikkan ishlar ro'yxati (bitta xabar).
- Bosh adminlarga: kechikkan ishlar soni bo'yicha qisqa hisobot.
Bir kunda bir martadan ortiq yuborilmaydi (metadata.digest_date bo'yicha tekshiriladi).
Bildirishnomalar Telegram botga ham boradi (apps/notifications/telegram.py).
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.analytics.sla import reviewer_queue
from apps.notifications.models import Notification

DIGEST_KIND = 'sla_digest'


def _already_sent(user, today: str) -> bool:
    return Notification.objects.filter(
        user=user, notification_type='system', metadata__digest_kind=DIGEST_KIND, metadata__digest_date=today,
    ).exists()


def _format_lines(rows, limit=8):
    lines = []
    for r in rows[:limit]:
        if r['overdue']:
            when = f"{abs(int(r['hours_left'] // 24)) or 1} kun kechikdi" if r['hours_left'] <= -24 else 'muddati o\'tdi'
        else:
            when = f"{max(1, int(r['hours_left']))} soat qoldi"
        lines.append(f"• {r['kind_label']}: {r['title'][:70]} — {when}")
    if len(rows) > limit:
        lines.append(f"… va yana {len(rows) - limit} ta")
    return '\n'.join(lines)


class Command(BaseCommand):
    help = "Taqrizchilarga muddati yaqin/o'tgan ishlar bo'yicha eslatma yuboradi."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **opts):
        User = get_user_model()
        now = timezone.now()
        today = timezone.localdate().isoformat()
        dry = opts['dry_run']
        sent = 0

        shared = [it.as_dict(now) for it in reviewer_queue(None)]
        reviewers = User.objects.filter(role='reviewer', is_active=True)
        for reviewer in reviewers:
            rows = list(shared)
            # Shaxsan tayinlangan taqrizlar (PeerReview) faqat o'sha taqrizchiga
            personal = [it.as_dict(now) for it in reviewer_queue(reviewer) if it.kind == 'peer_review']
            rows += personal
            urgent = [r for r in rows if r['overdue'] or r['due_soon']]
            if not urgent:
                continue
            urgent.sort(key=lambda r: r['hours_left'])
            overdue_n = sum(1 for r in urgent if r['overdue'])
            soon_n = len(urgent) - overdue_n
            title = 'Muddati yaqin ishlar' if not overdue_n else f'Kechikkan ishlar: {overdue_n} ta'
            message = (
                f"Kechikkan: {overdue_n} ta, 24 soat ichida tugaydi: {soon_n} ta.\n" + _format_lines(urgent)
            )
            self.stdout.write(f'{reviewer.phone}: {title}')
            if dry or _already_sent(reviewer, today):
                continue
            Notification.notify(
                user=reviewer,
                title=title,
                message=message,
                notification_type='system',
                link='/dashboard',
                metadata={'digest_kind': DIGEST_KIND, 'digest_date': today, 'overdue': overdue_n, 'due_soon': soon_n},
            )
            sent += 1

        overdue_total = [r for r in shared if r['overdue']]
        if overdue_total:
            for admin in User.objects.filter(role='super_admin', is_active=True):
                self.stdout.write(f'admin {admin.phone}: {len(overdue_total)} kechikkan')
                if dry or _already_sent(admin, today):
                    continue
                Notification.notify(
                    user=admin,
                    title=f'Taqrizchilar: {len(overdue_total)} ta kechikkan ish',
                    message=_format_lines(sorted(overdue_total, key=lambda r: r['hours_left'])),
                    notification_type='system',
                    link='/analytics',
                    metadata={'digest_kind': DIGEST_KIND, 'digest_date': today, 'overdue': len(overdue_total)},
                )
                sent += 1

        self.stdout.write(self.style.SUCCESS(f'Yuborildi: {sent}' + (' (dry-run)' if dry else '')))
