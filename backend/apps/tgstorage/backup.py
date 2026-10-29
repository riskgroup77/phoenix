"""
Baza zaxirasini Telegram kanaliga yuborish va qaytarib olish.

Dump avval shifrlanadi (openssl AES-256-CBC + PBKDF2, kalit faqat serverda va sizda) — kanalga ochiq
ma'lumot ketmaydi. Shifrlangan oqim TG_STORAGE_PART_MB (standart 1900 MB) lik bo'laklarga bo'linadi
(local Bot API: bitta fayl ≤ 2000 MB); har bo'lak spool papkasiga yozilib, yuborilgach darhol o'chiriladi —
serverda vaqtincha ko'pi bilan bitta bo'lak turadi.

Tiklash: python manage.py tgstorage backup-download <nom> <fayl.dump>
Qo'lda (Telegram'dan bo'laklarni yuklab olib): cat *.part* | openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
    -pass file:<kalit fayl> > phoenix.dump
"""
from __future__ import annotations

import logging
import os
import subprocess
from collections import OrderedDict
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from . import client, services
from .models import TelegramStoredFile
from .services import file_digest

logger = logging.getLogger(__name__)

PBKDF2_ITER = '200000'
_PASS_ENV = 'PHONIX_TG_BACKUP_PASS'


class BackupError(Exception):
    pass


def backup_enabled() -> bool:
    return client.is_configured() and bool(getattr(settings, 'TG_STORAGE_BACKUP_ENABLED', False))


def _spool_dir() -> Path:
    d = Path(getattr(settings, 'TG_STORAGE_SPOOL_DIR', '') or Path(settings.BASE_DIR).parent / 'tg-spool')
    d.mkdir(parents=True, exist_ok=True)
    # Bot API konteyneri (boshqa foydalanuvchi) faylni o'qiy olishi kerak; bo'laklar shifrlangan
    try:
        os.chmod(d, 0o755)
    except OSError:
        pass
    return d


def _part_bytes() -> int:
    return int(float(getattr(settings, 'TG_STORAGE_PART_MB', 1900)) * 1024 * 1024)


def _openssl(decrypt: bool) -> tuple[list[str], dict]:
    key_file = str(getattr(settings, 'TG_BACKUP_PASSPHRASE_FILE', '') or '').strip()
    passphrase = str(getattr(settings, 'TG_BACKUP_PASSPHRASE', '') or '')
    env = dict(os.environ)
    if key_file:
        if not os.path.isfile(key_file):
            raise BackupError(f'Shifrlash kaliti fayli topilmadi: {key_file}')
        pass_arg = f'file:{key_file}'
    elif passphrase:
        env[_PASS_ENV] = passphrase
        pass_arg = f'env:{_PASS_ENV}'
    else:
        raise BackupError(
            'Zaxira shifrlash kaliti yo\'q: .env ga TG_BACKUP_PASSPHRASE_FILE (yoki TG_BACKUP_PASSPHRASE) yozing'
        )
    cmd = ['openssl', 'enc', '-d' if decrypt else '-e', '-aes-256-cbc', '-pbkdf2', '-iter', PBKDF2_ITER,
           '-pass', pass_arg]
    if not decrypt:
        cmd.insert(3, '-salt')
    return cmd, env


def upload_backup(path: str, label: str = 'daily') -> list[TelegramStoredFile]:
    """Dumpni shifrlab, bo'laklab kanalga yuborish. Yozuvlar: kind=backup, name='<label>/<fayl>.enc'."""
    if not client.is_configured():
        raise BackupError('Telegram ombori sozlanmagan (TG_STORAGE_BOT_TOKENS, TG_STORAGE_CHAT_ID)')
    src = Path(path)
    if not src.is_file() or src.stat().st_size == 0:
        raise BackupError(f'Dump topilmadi yoki bo\'sh: {path}')
    name = f'{label}/{src.name}.enc'
    if TelegramStoredFile.objects.filter(kind=TelegramStoredFile.KIND_BACKUP, name=name,
                                         deleted_at__isnull=True).exists():
        raise BackupError(f'Bu zaxira allaqachon yuborilgan: {name}')

    cmd, env = _openssl(decrypt=False)
    spool = _spool_dir()
    part_size = _part_bytes()
    records: list[TelegramStoredFile] = []
    part_path: Path | None = None
    with open(src, 'rb') as fin:
        proc = subprocess.Popen(cmd, stdin=fin, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        try:
            index = 0
            eof = False
            while not eof:
                part_path = spool / f'{src.name}.enc.part{index:03d}'
                written = 0
                with open(part_path, 'wb') as fout:
                    while written < part_size:
                        chunk = proc.stdout.read(min(4 * 1024 * 1024, part_size - written))
                        if not chunk:
                            eof = True
                            break
                        fout.write(chunk)
                        written += len(chunk)
                if written == 0:
                    part_path.unlink()
                    part_path = None
                    break
                os.chmod(part_path, 0o644)
                size, sha = file_digest(str(part_path))
                info = client.send_document(str(part_path), caption=f'backup: {name} #{index + 1} sha256={sha}')
                records.append(TelegramStoredFile.objects.create(
                    kind=TelegramStoredFile.KIND_BACKUP, name=name, part=index, size=size, sha256=sha, **info,
                ))
                part_path.unlink()
                part_path = None
                index += 1
            proc.stdout.close()
            err = proc.stderr.read().decode('utf-8', 'replace')
            if proc.wait() != 0:
                raise BackupError(f'openssl xato: {err.strip()}')
        except BaseException:
            proc.kill()
            proc.wait()
            if part_path is not None and part_path.exists():
                part_path.unlink()
            # Chala zaxira ro'yxatda qolmasin (kanaldagi bo'laklar ham o'chiriladi)
            _delete_records(records)
            raise
    if not records:
        raise BackupError('Shifrlangan oqim bo\'sh')
    TelegramStoredFile.objects.filter(pk__in=[r.pk for r in records]).update(parts_total=len(records))
    for r in records:
        r.parts_total = len(records)
        # Kanal bilan birga foydalanuvchi chatlariga ham (TG_STORAGE_MIRROR_CHAT_IDS) — kanal o'chsa ham tiklanadi
        services.ensure_copies(r)
    logger.info('Zaxira Telegram\'ga yuborildi: %s (%s bo\'lak)', name, len(records))
    return records


def download_backup(name: str, dest: str) -> str:
    """Bo'laklarni yuklab, tekshirib, deshifrlab dest ga yozish."""
    parts = list(
        TelegramStoredFile.objects.filter(kind=TelegramStoredFile.KIND_BACKUP, name=name,
                                          deleted_at__isnull=True).order_by('part')
    )
    if not parts:
        raise BackupError(f'Zaxira topilmadi: {name}')
    total = parts[0].parts_total
    if [p.part for p in parts] != list(range(total)):
        raise BackupError(f'Zaxira to\'liq emas: {len(parts)}/{total} bo\'lak')

    cmd, env = _openssl(decrypt=True)
    spool = _spool_dir()
    dest_path = Path(dest)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_dest = dest_path.with_name(dest_path.name + '.part')
    with open(tmp_dest, 'wb') as fout:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=fout, stderr=subprocess.PIPE, env=env)
        try:
            for rec in parts:
                part_file = spool / f'restore-{rec.pk}.bin'
                _download_any(rec, part_file)
                try:
                    _size, sha = file_digest(str(part_file))
                    if rec.sha256 and sha != rec.sha256:
                        raise BackupError(f'{rec.part + 1}-bo\'lak buzilgan (sha256 mos emas)')
                    with open(part_file, 'rb') as fin:
                        for chunk in iter(lambda: fin.read(4 * 1024 * 1024), b''):
                            proc.stdin.write(chunk)
                finally:
                    part_file.unlink(missing_ok=True)
            proc.stdin.close()
            err = proc.stderr.read().decode('utf-8', 'replace')
            if proc.wait() != 0:
                raise BackupError(f'Deshifrlash xato (kalit noto\'g\'rimi?): {err.strip()}')
        except BaseException:
            proc.kill()
            proc.wait()
            tmp_dest.unlink(missing_ok=True)
            raise
    os.replace(tmp_dest, dest_path)
    os.chmod(dest_path, 0o600)
    return str(dest_path)


def _download_any(rec: TelegramStoredFile, dest: Path) -> None:
    """Bo'lakni kanaldan, ishlamasa foydalanuvchi chatlaridagi nusxadan yuklab olish."""
    last_exc = None
    for src in [rec, *rec.copies.all()]:
        try:
            client.download_to(bot_id=src.bot_id, chat_id_value=src.chat_id, message_id=src.message_id,
                               file_id=src.file_id, dest=str(dest))
            return
        except Exception as exc:
            last_exc = exc
            logger.warning('Zaxira bo\'lagi olinmadi (%s, chat %s): %s', rec.name, src.chat_id, exc)
    raise BackupError(f'{rec.part + 1}-bo\'lak hech bir chatdan olinmadi: {last_exc}')


def list_backups() -> list[dict]:
    groups: OrderedDict[str, dict] = OrderedDict()
    qs = TelegramStoredFile.objects.filter(kind=TelegramStoredFile.KIND_BACKUP, deleted_at__isnull=True)
    for rec in qs.order_by('-created_at', 'part'):
        g = groups.setdefault(rec.name, {'name': rec.name, 'created_at': rec.created_at, 'size': 0,
                                         'parts': 0, 'parts_total': rec.parts_total})
        g['size'] += rec.size
        g['parts'] += 1
    return list(groups.values())


def _delete_records(records) -> None:
    for rec in records:
        for src in [rec, *rec.copies.all()]:
            try:
                client.delete_message(bot_id=src.bot_id, chat_id_value=src.chat_id, message_id=src.message_id)
            except client.TelegramStorageError as exc:
                logger.info('Telegram xabari o\'chirilmadi (%s, chat %s): %s', rec, src.chat_id, exc)
        rec.delete()


def prune_backups() -> int:
    """Eski zaxiralarni kanaldan o'chirish: daily — TG_BACKUP_KEEP_DAYS, weekly — TG_BACKUP_KEEP_WEEKLY_DAYS."""
    removed = 0
    rules = {
        'daily/': int(getattr(settings, 'TG_BACKUP_KEEP_DAYS', 60)),
        'weekly/': int(getattr(settings, 'TG_BACKUP_KEEP_WEEKLY_DAYS', 365)),
    }
    for prefix, days in rules.items():
        if days <= 0:
            continue
        cutoff = timezone.now() - timedelta(days=days)
        old = TelegramStoredFile.objects.filter(kind=TelegramStoredFile.KIND_BACKUP, name__startswith=prefix,
                                                created_at__lt=cutoff)
        names = set(old.values_list('name', flat=True))
        for name in names:
            _delete_records(list(TelegramStoredFile.objects.filter(kind=TelegramStoredFile.KIND_BACKUP, name=name)))
            removed += 1
    return removed
