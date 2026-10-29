"""
Local Telegram Bot API server (docker: aiogram/telegram-bot-api, api_id + api_hash) bilan ishlash.

Local serverda fayl 2000 MB gacha yuboriladi va yuklab olishda hajm cheklovi yo'q. Fayl HTTP orqali
yuklanmaydi — `document=file:///yo'l` beriladi, server faylni o'zi diskdan o'qiydi (shu sabab media va
spool papkalari konteynerga AYNAN SHU YO'L bilan ulanadi: infrastructure/telegram-bot-api/docker-compose.yml).
getFile esa konteyner ichidagi to'liq yo'lni qaytaradi — u TG_BOT_API_DATA_DIR (hostdagi papka) ga o'giriladi.

Bir nechta bot (TG_STORAGE_BOT_TOKENS) navbat bilan ishlatiladi: kanalga yuborish tezligi cheklovi
(bitta bot ~20 xabar/daqiqa) botlar soniga ko'payadi. Botlar kanalga admin qilib qo'shilgan bo'lishi kerak.
"""
from __future__ import annotations

import itertools
import logging
import os
import shutil
import time
from dataclasses import dataclass

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# Oddiy (cloud) Bot API va local serverning multipart cheklovi uchun xavfsiz chegara
MULTIPART_MAX_BYTES = 50 * 1024 * 1024
# Oddiy (cloud) Bot API: getFile orqali yuklab olish chegarasi
CLOUD_DOWNLOAD_MAX_BYTES = 20 * 1024 * 1024

_counter = itertools.count()


class TelegramStorageError(Exception):
    pass


@dataclass(frozen=True)
class Bot:
    token: str

    @property
    def id(self) -> str:
        return self.token.split(':', 1)[0]


def bots() -> list[Bot]:
    return [Bot(t) for t in getattr(settings, 'TG_STORAGE_BOT_TOKENS', []) if t]


def chat_id() -> str:
    return str(getattr(settings, 'TG_STORAGE_CHAT_ID', '') or '').strip()


def mirror_chat_ids() -> list[str]:
    """Qo'shimcha nusxalar: botga /start bosgan foydalanuvchilar chatlari (TG_STORAGE_MIRROR_CHAT_IDS)."""
    return [str(c).strip() for c in getattr(settings, 'TG_STORAGE_MIRROR_CHAT_IDS', []) if str(c).strip()]


def storage_chats() -> list[str]:
    """Fayl saqlanadigan barcha chatlar: avval kanal, keyin foydalanuvchi chatlari (takrorsiz)."""
    seen, out = set(), []
    for c in [chat_id(), *mirror_chat_ids()]:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def is_configured() -> bool:
    return bool(bots() and chat_id())


def _base_url() -> str:
    return str(getattr(settings, 'TG_BOT_API_URL', 'http://127.0.0.1:8081')).rstrip('/')


def _local_mode() -> bool:
    return bool(getattr(settings, 'TG_BOT_API_LOCAL', True))


def pick_bot() -> Bot:
    items = bots()
    if not items:
        raise TelegramStorageError('TG_STORAGE_BOT_TOKENS sozlanmagan')
    return items[next(_counter) % len(items)]


def bot_by_id(bot_id: str) -> Bot | None:
    return next((b for b in bots() if b.id == str(bot_id)), None)


def call(bot: Bot, method: str, *, data: dict | None = None, files: dict | None = None,
         timeout: float = 120) -> dict:
    """Bot API metodi; 429 (tezlik cheklovi) bo'lsa retry_after kutib qayta urinadi."""
    url = f'{_base_url()}/bot{bot.token}/{method}'
    for _attempt in range(6):
        try:
            resp = requests.post(url, data=data, files=files, timeout=timeout)
        except requests.RequestException as exc:
            raise TelegramStorageError(f'{method}: Bot API serverga ulanib bo\'lmadi ({exc})') from exc
        try:
            payload = resp.json()
        except ValueError:
            payload = {}
        if payload.get('ok'):
            return payload.get('result')
        if resp.status_code == 429:
            wait = int((payload.get('parameters') or {}).get('retry_after') or 5)
            logger.info('Telegram tezlik cheklovi (%s): %s s kutilmoqda', method, wait)
            time.sleep(min(wait, 90))
            continue
        raise TelegramStorageError(f'{method}: {payload.get("description") or resp.status_code}')
    raise TelegramStorageError(f'{method}: tezlik cheklovi tufayli yuborilmadi')


def _message_info(bot: Bot, message: dict) -> dict:
    doc = message.get('document') or {}
    if not doc.get('file_id'):
        raise TelegramStorageError('Xabarda hujjat yo\'q')
    return {
        'bot_id': bot.id,
        'chat_id': int(message['chat']['id']),
        'message_id': int(message['message_id']),
        'file_id': doc['file_id'],
        'file_unique_id': doc.get('file_unique_id', ''),
    }


def send_document(path: str, caption: str = '', bot: Bot | None = None, chat: str | int | None = None) -> dict:
    """Faylni chatga (default — kanal) hujjat sifatida yuborish → {bot_id, chat_id, message_id, file_id, ...}."""
    bot = bot or pick_bot()
    path = os.path.abspath(path)
    size = os.path.getsize(path)
    data = {
        'chat_id': chat if chat is not None else chat_id(),
        'caption': caption[:1000],
        'disable_content_type_detection': 'true',
        'disable_notification': 'true',
    }
    if _local_mode():
        try:
            result = call(bot, 'sendDocument', data={**data, 'document': f'file://{path}'}, timeout=1800)
            return _message_info(bot, result)
        except TelegramStorageError as exc:
            # Konteyner faylni ko'rmasa (volume ulanmagan / ruxsat yo'q) — kichik fayl HTTP orqali ketadi
            if size > MULTIPART_MAX_BYTES:
                raise
            logger.warning('file:// orqali yuborilmadi, HTTP orqali urinilmoqda: %s', exc)
    elif size > MULTIPART_MAX_BYTES:
        raise TelegramStorageError(f'Fayl {size} bayt — 50 MB dan katta fayl uchun local Bot API kerak')
    with open(path, 'rb') as fh:
        content = fh.read()
    result = call(bot, 'sendDocument', data=data,
                  files={'document': (os.path.basename(path), content)}, timeout=600)
    return _message_info(bot, result)


def copy_document(file_id: str, chat: str | int, caption: str = '', bot: Bot | None = None) -> dict:
    """Telegram'dagi faylni boshqa chatga qayta yuklamasdan (file_id orqali) yuborish."""
    bot = bot or pick_bot()
    result = call(bot, 'sendDocument', data={
        'chat_id': chat,
        'document': file_id,
        'caption': caption[:1000],
        'disable_notification': 'true',
    })
    return _message_info(bot, result)


def _refresh_file_id(chat: int, message_id: int) -> tuple[Bot, str]:
    """Faylni yuklagan bot endi yo'q: boshqa bot xabarni kanal ichida forward qilib o'z file_id sini oladi."""
    bot = pick_bot()
    msg = call(bot, 'forwardMessage', data={
        'chat_id': chat, 'from_chat_id': chat, 'message_id': message_id, 'disable_notification': 'true',
    })
    info = _message_info(bot, msg)
    try:
        call(bot, 'deleteMessage', data={'chat_id': chat, 'message_id': info['message_id']})
    except TelegramStorageError:
        pass
    return bot, info['file_id']


def _host_path(file_path: str) -> str:
    """Konteyner ichidagi yo'l → hostdagi yo'l (TG_BOT_API_DATA_DIR)."""
    container_dir = str(getattr(settings, 'TG_BOT_API_CONTAINER_DIR', '/var/lib/telegram-bot-api')).rstrip('/')
    host_dir = str(getattr(settings, 'TG_BOT_API_DATA_DIR', '') or '').rstrip('/')
    if host_dir and file_path.startswith(container_dir + '/'):
        return host_dir + file_path[len(container_dir):]
    return file_path


def download_to(*, bot_id: str, chat_id_value: int, message_id: int, file_id: str, dest: str) -> None:
    """Faylni dest ga yozish (avval vaqtinchalik faylga, keyin atomik almashtirish)."""
    bot = bot_by_id(bot_id)
    if bot is None:
        bot, file_id = _refresh_file_id(chat_id_value, message_id)
    try:
        info = call(bot, 'getFile', data={'file_id': file_id}, timeout=1800)
    except TelegramStorageError:
        # file_id eskirgan bo'lishi mumkin — xabardan yangisini olamiz
        bot, file_id = _refresh_file_id(chat_id_value, message_id)
        info = call(bot, 'getFile', data={'file_id': file_id}, timeout=1800)
    file_path = info.get('file_path') or ''
    if not file_path:
        raise TelegramStorageError('getFile: file_path bo\'sh')

    os.makedirs(os.path.dirname(dest) or '.', exist_ok=True)
    tmp = f'{dest}.tg-{os.getpid()}-{time.monotonic_ns()}'
    try:
        if os.path.isabs(file_path):
            src = _host_path(file_path)
            if not os.path.isfile(src):
                raise TelegramStorageError(
                    f'Bot API fayli hostda topilmadi: {src} (TG_BOT_API_DATA_DIR to\'g\'rimi?)'
                )
            shutil.copyfile(src, tmp)
            try:
                os.remove(src)  # Bot API keshini tozalash (ruxsat bo'lmasa — `tgstorage cleanup-cache`)
            except OSError:
                pass
        else:
            url = f'{_base_url()}/file/bot{bot.token}/{file_path}'
            with requests.get(url, stream=True, timeout=1800) as resp:
                if resp.status_code != 200:
                    raise TelegramStorageError(f'Fayl yuklab olinmadi: HTTP {resp.status_code}')
                with open(tmp, 'wb') as fh:
                    for chunk in resp.iter_content(chunk_size=1024 * 1024):
                        fh.write(chunk)
        os.replace(tmp, dest)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def delete_message(*, bot_id: str, chat_id_value: int, message_id: int) -> None:
    bot = bot_by_id(bot_id) or pick_bot()
    call(bot, 'deleteMessage', data={'chat_id': chat_id_value, 'message_id': message_id})
