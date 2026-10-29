"""
Media fayllar Telegram kanalida: yuklangan har bir fayl kanalga ham yuboriladi (file_id bazada),
uzoq ishlatilmagan fayllar serverdan o'chiriladi (evict) va kerak bo'lganda Telegram'dan qaytariladi.

Server diski — faqat kesh: ochilgan fayl yana diskka tushadi va TG_STORAGE_EVICT_DAYS kun ishlatilmasa
yana o'chiriladi. Telegram'da hali yo'q fayl hech qachon o'chirilmaydi.
"""
from __future__ import annotations

import hashlib
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, close_old_connections, transaction
from django.db.models import Q
from django.utils import timezone

from . import client
from .models import TelegramFileCopy, TelegramStoredFile

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='tg-storage')



def media_enabled() -> bool:
    return client.is_configured() and bool(getattr(settings, 'TG_STORAGE_MEDIA_ENABLED', False))


def _media_root() -> str:
    return str(settings.MEDIA_ROOT)


def local_path(name: str) -> str:
    return os.path.join(_media_root(), name)


def _normalize(name: str) -> str:
    return str(name).replace('\\', '/').lstrip('/')


def file_digest(path: str) -> tuple[int, str]:
    h = hashlib.sha256()
    size = 0
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b''):
            h.update(chunk)
            size += len(chunk)
    return size, h.hexdigest()


def _live(kind=TelegramStoredFile.KIND_MEDIA):
    return TelegramStoredFile.objects.filter(kind=kind, deleted_at__isnull=True)


def get_record(name: str) -> TelegramStoredFile | None:
    if not client.is_configured():
        return None
    return _live().filter(name=_normalize(name), part=0).first()


def has_record(name: str) -> bool:
    if not client.is_configured():
        return False
    return _live().filter(name=_normalize(name)).exists()


def upload_media(name: str) -> TelegramStoredFile | None:
    """Faylni kanalga yuborish (allaqachon yuborilgan bo'lsa — mavjud yozuv)."""
    name = _normalize(name)
    path = local_path(name)
    if not os.path.isfile(path):
        return None
    existing = get_record(name)
    if existing:
        return existing
    size, sha = file_digest(path)
    caption = f'media: {name}'
    # Asosiy nusxa: avval kanal; kanalga yuborib bo'lmasa (o'chirilgan / bot admin emas) — foydalanuvchi chatlari
    info, last_exc = None, None
    for chat in client.storage_chats():
        try:
            info = client.send_document(path, caption=caption, chat=chat)
            break
        except client.TelegramStorageError as exc:
            last_exc = exc
            logger.warning('Telegram chatga yuborilmadi (%s → %s): %s', name, chat, exc)
    if info is None:
        raise last_exc or client.TelegramStorageError('Saqlash uchun chat sozlanmagan')
    try:
        with transaction.atomic():
            rec = TelegramStoredFile.objects.create(
                kind=TelegramStoredFile.KIND_MEDIA, name=name, size=size, sha256=sha, **info,
            )
    except IntegrityError:
        # Parallel jarayon shu faylni bizdan oldin yozib qo'ydi — ortiqcha xabarni o'chiramiz
        try:
            client.delete_message(bot_id=info['bot_id'], chat_id_value=info['chat_id'],
                                  message_id=info['message_id'])
        except client.TelegramStorageError:
            pass
        return get_record(name)
    ensure_copies(rec)
    return rec


def _record_chats(rec: TelegramStoredFile) -> set[int]:
    return {int(rec.chat_id), *(int(c) for c in rec.copies.values_list('chat_id', flat=True))}


def ensure_copies(rec: TelegramStoredFile) -> int:
    """Fayl hamma saqlash chatlarida (kanal + TG_STORAGE_MIRROR_CHAT_IDS) bo'lsin. Qo'shilgan nusxalar soni."""
    have = _record_chats(rec)
    added = 0
    for chat in client.storage_chats():
        try:
            chat_int = int(chat)
        except ValueError:
            continue
        if chat_int in have:
            continue
        caption = f'media: {rec.name}'
        try:
            info = client.copy_document(rec.file_id, chat, caption=caption)
        except client.TelegramStorageError as exc:
            # file_id ishlamasa — diskdagi asl fayldan yuklaymiz
            path = local_path(rec.name)
            if not os.path.isfile(path):
                logger.warning('Nusxa yuborilmadi (%s → %s): %s', rec.name, chat, exc)
                continue
            try:
                info = client.send_document(path, caption=caption, chat=chat)
            except client.TelegramStorageError as exc2:
                logger.warning('Nusxa yuborilmadi (%s → %s): %s', rec.name, chat, exc2)
                continue
        try:
            TelegramFileCopy.objects.create(stored=rec, **info)
        except IntegrityError:
            continue
        have.add(chat_int)
        added += 1
    return added


def _upload_safely(name: str) -> None:
    close_old_connections()
    try:
        upload_media(name)
    except Exception as exc:  # keyingi `tgstorage sync` qayta urinadi
        logger.warning('Telegram\'ga yuborilmadi (%s): %s', name, exc)
    finally:
        close_old_connections()


def schedule_upload(name: str) -> None:
    """Fayl saqlangach (tranzaksiya tugagach) fon oqimida Telegram'ga yuborish."""
    if not media_enabled():
        return

    def _submit():
        if getattr(settings, 'TG_STORAGE_SYNC', False):
            _upload_safely(name)
        else:
            _executor.submit(_upload_safely, name)

    transaction.on_commit(_submit)


def ensure_local(name: str) -> bool:
    """Fayl diskda bo'lmasa Telegram'dan qaytarish. True — fayl diskda bor."""
    name = _normalize(name)
    path = local_path(name)
    if os.path.exists(path):
        return True
    rec = get_record(name)
    if rec is None:
        return False
    # Avval asosiy nusxa (kanal), ishlamasa — foydalanuvchi chatlaridagi nusxalar
    sources = [rec, *rec.copies.all()]
    for src in sources:
        try:
            client.download_to(bot_id=src.bot_id, chat_id_value=src.chat_id, message_id=src.message_id,
                               file_id=src.file_id, dest=path)
        except Exception as exc:
            logger.warning('Telegram\'dan qaytarilmadi (%s, chat %s): %s', name, src.chat_id, exc)
            continue
        if rec.size and os.path.getsize(path) != rec.size:
            logger.error('Telegram\'dan qaytgan fayl hajmi mos emas (%s, chat %s)', name, src.chat_id)
            os.remove(path)
            continue
        break
    else:
        logger.error('Telegram\'dan qaytarilmadi (%s): hech bir nusxa ishlamadi', name)
        return False
    TelegramStoredFile.objects.filter(pk=rec.pk).update(restored_at=timezone.now())
    return True


def mark_deleted(name: str) -> None:
    if not client.is_configured():
        return
    _live().filter(name=_normalize(name)).update(deleted_at=timezone.now())


def _iter_media_files():
    root = _media_root()
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in filenames:
            # Yashirin va vaqtinchalik fayllar (client.download_to: "<fayl>.tg-…", yarim yozilgan "*.part")
            if fn.startswith('.') or '.tg-' in fn or fn.endswith('.part'):
                continue
            full = os.path.join(dirpath, fn)
            yield _normalize(os.path.relpath(full, root)), full


def sync(limit: int = 500) -> dict:
    """Telegram'da yo'q fayllarni yuborish va muddati o'tgan o'chirilganlarni kanaldan tozalash."""
    stats = {'uploaded': 0, 'failed': 0, 'pending': 0, 'copied': 0, 'purged': 0}
    known = set(_live().values_list('name', flat=True))
    for name, _full in _iter_media_files():
        if name in known:
            continue
        if stats['uploaded'] + stats['failed'] >= limit:
            stats['pending'] += 1
            continue
        try:
            upload_media(name)
            stats['uploaded'] += 1
        except Exception as exc:
            stats['failed'] += 1
            logger.warning('Telegram\'ga yuborilmadi (%s): %s', name, exc)
    # Qo'shimcha nusxalar (yangi chat qo'shilgan yoki avval yuborilmay qolgan bo'lsa)
    stats['copied'] = 0
    for rec in _live().filter(part=0).prefetch_related('copies').iterator(chunk_size=200):
        if len(_record_chats(rec)) >= len(client.storage_chats()):
            continue
        stats['copied'] += ensure_copies(rec)
    stats['purged'] = purge_deleted()
    return stats


def purge_deleted() -> int:
    days = int(getattr(settings, 'TG_STORAGE_PURGE_DAYS', 30))
    if days <= 0:
        return 0  # 0 — saytdan o'chirilgan faylning kanaldagi nusxasi hech qachon o'chirilmaydi
    cutoff = timezone.now() - timedelta(days=days)
    purged = 0
    qs = TelegramStoredFile.objects.filter(kind=TelegramStoredFile.KIND_MEDIA, deleted_at__lt=cutoff)
    for rec in qs.iterator():
        for src in [rec, *rec.copies.all()]:
            try:
                client.delete_message(bot_id=src.bot_id, chat_id_value=src.chat_id, message_id=src.message_id)
            except client.TelegramStorageError as exc:
                logger.info('Telegram xabari o\'chirilmadi (%s, chat %s): %s', rec.name, src.chat_id, exc)
        rec.delete()
        purged += 1
    return purged


def evict(days: int | None = None, *, dry_run: bool = False) -> dict:
    """Telegram'da nusxasi bor va `days` kun ishlatilmagan fayllarni serverdan o'chirish."""
    days = int(getattr(settings, 'TG_STORAGE_EVICT_DAYS', 30) if days is None else days)
    stats = {'evicted': 0, 'freed_bytes': 0, 'reupload': 0}
    if days <= 0:
        return stats
    cutoff = time.time() - days * 86400
    # Oddiy (cloud) Bot API getFile 20 MB dan kattasini bermaydi — bunday fayl diskdan o'chirilsa qaytmaydi
    max_size = None if client._local_mode() else client.CLOUD_DOWNLOAD_MAX_BYTES
    for rec in _live().filter(part=0).iterator():
        path = local_path(rec.name)
        try:
            st = os.stat(path)
        except FileNotFoundError:
            continue
        if max(st.st_atime, st.st_mtime) > cutoff:
            continue
        if max_size is not None and st.st_size > max_size:
            continue
        if rec.size and st.st_size != rec.size:
            # Fayl yuborilgandan keyin o'zgargan — eski nusxa yaroqsiz, keyingi sync qayta yuboradi
            if not dry_run:
                rec.delete()
            stats['reupload'] += 1
            continue
        if not dry_run:
            os.remove(path)
        stats['evicted'] += 1
        stats['freed_bytes'] += st.st_size
    return stats


def status() -> dict:
    known = set(_live().values_list('name', flat=True))
    local_count = local_bytes = pending = 0
    local_names = set()
    for name, full in _iter_media_files():
        local_count += 1
        local_names.add(name)
        try:
            local_bytes += os.path.getsize(full)
        except OSError:
            pass
        if name not in known:
            pending += 1
    return {
        'telegram_files': len(known),
        'local_files': local_count,
        'local_bytes': local_bytes,
        'pending_upload': pending,
        'only_in_telegram': len(known - local_names),
        'copies_by_chat': _copies_by_chat(),
    }


def _copies_by_chat() -> dict[str, int]:
    live = _live().filter(part=0)
    counts = {}
    for chat in client.storage_chats():
        try:
            c = int(chat)
        except ValueError:
            continue
        counts[chat] = live.filter(Q(chat_id=c) | Q(copies__chat_id=c)).distinct().count()
    return counts
