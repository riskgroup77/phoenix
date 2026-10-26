"""
Telegram fayl ombori.

  python manage.py tgstorage check                     # botlar, kanal va local Bot API server tekshiruvi
  python manage.py tgstorage status                    # nechta fayl Telegram'da / diskda / yuborilmagan
  python manage.py tgstorage sync [--evict]            # yuborilmaganlarni yuborish (+ eski fayllarni diskdan o'chirish)
  python manage.py tgstorage evict [--days 30] [--dry-run]
  python manage.py tgstorage restore <yo'l> | --all    # Telegram'dan diskka qaytarish
  python manage.py tgstorage cleanup-cache             # Bot API server keshini tozalash
  python manage.py tgstorage backup-upload <dump> --label daily|weekly
  python manage.py tgstorage backup-list
  python manage.py tgstorage backup-download <nom> <fayl.dump>
  python manage.py tgstorage backup-prune
"""
import os
import subprocess
import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.tgstorage import backup, client, services
from apps.tgstorage.models import TelegramStoredFile


def _mb(n: int) -> str:
    return f'{n / 1024 / 1024:.1f} MB'


class Command(BaseCommand):
    help = "Telegram fayl ombori: media va baza zaxiralari"

    def add_arguments(self, parser):
        sub = parser.add_subparsers(dest='action', required=True)
        sub.add_parser('check')
        sub.add_parser('status')
        p = sub.add_parser('sync')
        p.add_argument('--limit', type=int, default=500)
        p.add_argument('--evict', action='store_true')
        p = sub.add_parser('evict')
        p.add_argument('--days', type=int, default=None)
        p.add_argument('--dry-run', action='store_true')
        p = sub.add_parser('restore')
        p.add_argument('name', nargs='?')
        p.add_argument('--all', action='store_true')
        p = sub.add_parser('cleanup-cache')
        p.add_argument('--minutes', type=int, default=30)
        p = sub.add_parser('backup-upload')
        p.add_argument('path')
        p.add_argument('--label', default='daily')
        sub.add_parser('backup-list')
        p = sub.add_parser('backup-download')
        p.add_argument('name')
        p.add_argument('dest')
        sub.add_parser('backup-prune')

    def handle(self, *args, **opts):
        action = opts['action']
        if not client.is_configured():
            if action in ('sync', 'evict', 'cleanup-cache', 'backup-prune'):
                # Timer'dan chaqiriladi — sozlanmagan serverda jim chiqib ketadi
                self.stdout.write('Telegram ombori sozlanmagan (TG_STORAGE_BOT_TOKENS, TG_STORAGE_CHAT_ID)')
                return
            raise CommandError('Telegram ombori sozlanmagan: .env ga TG_STORAGE_BOT_TOKENS va TG_STORAGE_CHAT_ID yozing')
        getattr(self, '_' + action.replace('-', '_'))(opts)

    def _check(self, opts):
        ok = True
        for bot in client.bots():
            try:
                me = client.call(bot, 'getMe', timeout=15)
                member = client.call(bot, 'getChatMember', data={'chat_id': client.chat_id(), 'user_id': me['id']},
                                     timeout=15)
                status = member.get('status')
                if status not in ('administrator', 'creator'):
                    ok = False
                    self.stdout.write(self.style.ERROR(f'@{me.get("username")}: kanalda admin emas ({status})'))
                else:
                    self.stdout.write(self.style.SUCCESS(f'@{me.get("username")}: tayyor (kanal admini)'))
            except client.TelegramStorageError as exc:
                ok = False
                self.stdout.write(self.style.ERROR(f'bot {bot.id}: {exc}'))
        self.stdout.write(f'Media: {"yoqilgan" if services.media_enabled() else "o`chiq"}; '
                          f'zaxira: {"yoqilgan" if backup.backup_enabled() else "o`chiq"}')
        if not ok:
            raise CommandError('Tekshiruvdan o\'tmadi')

    def _status(self, opts):
        st = services.status()
        self.stdout.write(
            f"Telegram'da: {st['telegram_files']} ta fayl\n"
            f"Diskda: {st['local_files']} ta ({_mb(st['local_bytes'])})\n"
            f"Hali yuborilmagan: {st['pending_upload']} ta\n"
            f"Faqat Telegram'da (diskdan o'chirilgan): {st['only_in_telegram']} ta\n"
            f"Zaxiralar: {len(backup.list_backups())} ta"
        )

    def _sync(self, opts):
        if not services.media_enabled():
            self.stdout.write('Media Telegram\'ga yuborilmaydi (TG_STORAGE_MEDIA_ENABLED=false)')
            return
        st = services.sync(limit=opts['limit'])
        self.stdout.write(f"Yuborildi: {st['uploaded']}, xato: {st['failed']}, navbatda: {st['pending']}, "
                          f"kanaldan tozalandi: {st['purged']}")
        if opts['evict']:
            self._evict({'days': None, 'dry_run': False})

    def _evict(self, opts):
        if not services.media_enabled():
            self.stdout.write('Media Telegram\'ga yuborilmaydi — diskdan hech narsa o\'chirilmaydi')
            return
        st = services.evict(opts['days'], dry_run=opts['dry_run'])
        prefix = '(sinov) ' if opts['dry_run'] else ''
        self.stdout.write(f"{prefix}Diskdan o'chirildi: {st['evicted']} ta ({_mb(st['freed_bytes'])}); "
                          f"qayta yuborilishi kerak: {st['reupload']}")

    def _restore(self, opts):
        if opts['all']:
            names = list(TelegramStoredFile.objects.filter(kind=TelegramStoredFile.KIND_MEDIA, part=0,
                                                           deleted_at__isnull=True).values_list('name', flat=True))
        elif opts['name']:
            names = [opts['name']]
        else:
            raise CommandError('Fayl yo\'lini yoki --all ni bering')
        restored = failed = 0
        for name in names:
            if os.path.exists(services.local_path(name)):
                continue
            if services.ensure_local(name):
                restored += 1
            else:
                failed += 1
                self.stdout.write(self.style.WARNING(f'Qaytarilmadi: {name}'))
        self.stdout.write(f'Qaytarildi: {restored}, xato: {failed}')

    def _cleanup_cache(self, opts):
        """Bot API server yuklab olgan fayllar (getFile) o'zi o'chmaydi — eskilarini tozalaymiz."""
        data_dir = str(getattr(settings, 'TG_BOT_API_DATA_DIR', '') or '')
        cutoff = time.time() - opts['minutes'] * 60
        removed = denied = 0
        if data_dir and os.path.isdir(data_dir):
            for dirpath, _dirs, files in os.walk(data_dir):
                # Faqat yuklab olingan fayllar papkalari (<token>/documents, …) — bot sessiya fayllariga tegilmaydi
                if os.path.relpath(dirpath, data_dir).count(os.sep) < 1:
                    continue
                for fn in files:
                    full = os.path.join(dirpath, fn)
                    try:
                        if os.path.getmtime(full) < cutoff:
                            os.remove(full)
                            removed += 1
                    except PermissionError:
                        denied += 1
                    except OSError:
                        pass
        container = str(getattr(settings, 'TG_BOT_API_CONTAINER', '') or '')
        if denied and container:
            # Fayllar konteyner foydalanuvchisiniki — konteyner ichidan o'chiramiz
            cdir = str(getattr(settings, 'TG_BOT_API_CONTAINER_DIR', '/var/lib/telegram-bot-api'))
            subprocess.run(['docker', 'exec', container, 'find', cdir, '-mindepth', '3', '-type', 'f',
                            '-mmin', f'+{opts["minutes"]}', '-delete'], check=False, timeout=300)
            denied = 0
        self.stdout.write(f'Bot API keshidan o\'chirildi: {removed}' + (f' (ruxsat yo\'q: {denied})' if denied else ''))

    def _backup_upload(self, opts):
        try:
            records = backup.upload_backup(opts['path'], label=opts['label'])
        except backup.BackupError as exc:
            raise CommandError(str(exc)) from exc
        total = sum(r.size for r in records)
        self.stdout.write(self.style.SUCCESS(f'Yuborildi: {records[0].name} ({len(records)} bo\'lak, {_mb(total)})'))

    def _backup_list(self, opts):
        rows = backup.list_backups()
        if not rows:
            self.stdout.write('Telegram\'da zaxira yo\'q')
        for row in rows:
            mark = '' if row['parts'] == row['parts_total'] else f"  ⚠ chala {row['parts']}/{row['parts_total']}"
            self.stdout.write(f"{row['created_at']:%Y-%m-%d %H:%M}  {_mb(row['size']):>10}  {row['name']}{mark}")

    def _backup_download(self, opts):
        try:
            path = backup.download_backup(opts['name'], opts['dest'])
        except backup.BackupError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(self.style.SUCCESS(f'Tayyor: {path}'))

    def _backup_prune(self, opts):
        self.stdout.write(f'Kanaldan o\'chirilgan eski zaxiralar: {backup.prune_backups()}')
