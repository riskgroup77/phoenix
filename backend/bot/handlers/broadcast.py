"""
/reklama — barcha bot foydalanuvchilariga ommaviy (reklama) xabar yuborish. Faqat adminlar uchun:
TelegramSession orqali super_admin roliga bog'langan Telegram hisoblar yoki settings.TELEGRAM_ADMIN_IDS.

Oqim: xabar (matn/rasm/video/hujjat, formatlash bilan) → ixtiyoriy tugma («Matn | https://url» yoki /skip) →
ko'rib chiqish (aynan shu ko'rinishda) → «Ha, yuborish» → fonda yuborish (~20 xabar/soniya) → hisobot.
"""
import asyncio
import logging

from asgiref.sync import sync_to_async
from django.conf import settings
from django.utils import timezone
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Message, ReplyKeyboardRemove, Update
from telegram.error import BadRequest, Forbidden, RetryAfter, TelegramError
from telegram.ext import ContextTypes, ConversationHandler

from bot.constants import BC_BUTTON, BC_CONFIRM, BC_MESSAGE

logger = logging.getLogger(__name__)

SEND_DELAY = 0.05  # ~20 xabar/soniya (Telegram cheklovi ~30/s)
MAX_RETRIES = 3
RUNNING_KEY = 'broadcast_running'

DENIED = "⛔ Ruxsat yo'q."


# ----------------------------------------------------------------------------- DB (sync)
def _admin_user_sync(telegram_id: int):
    """(ruxsat, user|None)."""
    from apps.users.models import TelegramSession

    row = TelegramSession.objects.select_related('user').filter(telegram_id=telegram_id).first()
    user = row.user if row else None
    if user is not None and user.is_active and (user.role == 'super_admin' or user.is_superuser):
        return True, user
    allowed_ids = set(getattr(settings, 'TELEGRAM_ADMIN_IDS', None) or [])
    return telegram_id in allowed_ids, user


def _recipients_sync() -> list[int]:
    from apps.users.models import PhoneChallenge, TelegramSession

    ids = set(TelegramSession.objects.filter(user__is_active=True).values_list('telegram_id', flat=True))
    ids.update(
        PhoneChallenge.objects.filter(
            telegram_id__isnull=False, used_at__isnull=False,
            purpose__in=(PhoneChallenge.PURPOSE_VERIFY, PhoneChallenge.PURPOSE_RESET),
        ).values_list('telegram_id', flat=True)
    )
    ids.discard(None)
    return sorted(int(i) for i in ids)


def _create_log_sync(**fields):
    from apps.notifications.models import BroadcastLog

    return BroadcastLog.objects.create(**fields)


def _finish_log_sync(log_id: int, sent: int, failed: int, status: str) -> None:
    from apps.notifications.models import BroadcastLog

    BroadcastLog.objects.filter(pk=log_id).update(
        sent_count=sent, failed_count=failed, status=status, finished_at=timezone.now(),
    )


admin_user = sync_to_async(_admin_user_sync)
get_recipients = sync_to_async(_recipients_sync)
create_log = sync_to_async(_create_log_sync)
finish_log = sync_to_async(_finish_log_sync)


# ----------------------------------------------------------------------------- yordamchilar
def _content_type(msg: Message) -> str:
    for attr in ('photo', 'video', 'animation', 'document', 'audio', 'voice', 'video_note', 'sticker'):
        if getattr(msg, attr, None):
            return attr
    return 'text' if msg.text else 'other'


def _button_markup(data: dict):
    if data.get('button_text') and data.get('button_url'):
        return InlineKeyboardMarkup([[InlineKeyboardButton(data['button_text'], url=data['button_url'])]])
    return None


def _clear(context) -> None:
    context.user_data.pop('broadcast', None)


# ----------------------------------------------------------------------------- suhbat
async def broadcast_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    # /reklama buyrug'i yoki admin paneldagi «📣 Yangi reklama» tugmasi (callback)
    chat = update.effective_chat
    if not chat or not update.effective_user:
        return ConversationHandler.END
    allowed, _ = await admin_user(update.effective_user.id)
    if not allowed:
        await chat.send_message(DENIED)
        return ConversationHandler.END
    if context.application.bot_data.get(RUNNING_KEY):
        await chat.send_message("⏳ Oldingi reklama hali yuborilmoqda. Tugashini kuting.")
        return ConversationHandler.END
    _clear(context)
    await chat.send_message(
        "📣 *Reklama yuborish*\n\n"
        "1/3. Yubormoqchi bo'lgan xabarni jo'nating: matn, rasm, video yoki hujjat (izoh va formatlash bilan).\n\n"
        "Bekor qilish: /cancel",
        parse_mode='Markdown',
        reply_markup=ReplyKeyboardRemove(),
    )
    return BC_MESSAGE


async def broadcast_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    msg = update.message
    if not msg:
        return BC_MESSAGE
    if msg.media_group_id and context.user_data.get('broadcast', {}).get('media_group_id') == msg.media_group_id:
        return BC_BUTTON  # albomning qolgan qismlari — faqat birinchisi olinadi
    context.user_data['broadcast'] = {
        'chat_id': msg.chat_id,
        'message_id': msg.message_id,
        'media_group_id': msg.media_group_id,
        'content_type': _content_type(msg),
        'preview': (msg.text or msg.caption or '')[:500],
    }
    note = "\n(Albom yuborildi — faqat birinchi element yuboriladi.)" if msg.media_group_id else ''
    await msg.reply_text(
        "2/3. Xabar ostiga tugma qo'shasizmi?\n\n"
        "Formati: Tugma matni | https://havola\n"
        "Masalan: Saytga o'tish | https://ilmiyfaoliyat.uz\n\n"
        f"Tugmasiz yuborish: /skip{note}",
    )
    return BC_BUTTON


async def broadcast_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    msg = update.message
    data = context.user_data.get('broadcast')
    if not msg or not data:
        return ConversationHandler.END
    if msg.media_group_id and msg.media_group_id == data.get('media_group_id'):
        return BC_BUTTON
    raw = (msg.text or '').strip()
    if '|' not in raw:
        await msg.reply_text("❌ Format noto'g'ri. Masalan: Saytga o'tish | https://ilmiyfaoliyat.uz\nYoki /skip")
        return BC_BUTTON
    text, url = (p.strip() for p in raw.split('|', 1))
    if not text or len(text) > 64:
        await msg.reply_text("❌ Tugma matni 1–64 belgi bo'lishi kerak. Qaytadan yuboring yoki /skip")
        return BC_BUTTON
    if not url.lower().startswith(('https://', 'http://', 'tg://')) or ' ' in url:
        await msg.reply_text("❌ Havola https:// bilan boshlanishi kerak. Qaytadan yuboring yoki /skip")
        return BC_BUTTON
    data['button_text'], data['button_url'] = text, url
    return await _show_preview(update, context)


async def broadcast_skip(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    data = context.user_data.get('broadcast')
    if not data:
        return ConversationHandler.END
    data.pop('button_text', None)
    data.pop('button_url', None)
    return await _show_preview(update, context)


async def _show_preview(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    data = context.user_data['broadcast']
    chat_id = update.effective_chat.id
    await context.bot.send_message(chat_id, "3/3. Ko'rib chiqing — foydalanuvchilar xabarni aynan shunday oladi:")
    try:
        await context.bot.copy_message(
            chat_id=chat_id, from_chat_id=data['chat_id'], message_id=data['message_id'],
            reply_markup=_button_markup(data),
        )
    except TelegramError as exc:
        await context.bot.send_message(chat_id, f"❌ Xabarni nusxalab bo'lmadi: {exc}\nBoshqa xabar yuboring.")
        return BC_MESSAGE
    count = len(await get_recipients())
    await context.bot.send_message(
        chat_id,
        f"Ushbu xabar {count} ta foydalanuvchiga yuboriladi. Tasdiqlaysizmi?",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton('✅ Ha, yuborish', callback_data='bc:yes'),
            InlineKeyboardButton('❌ Bekor qilish', callback_data='bc:no'),
        ]]),
    )
    return BC_CONFIRM


async def broadcast_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return BC_CONFIRM
    await query.answer()
    data = context.user_data.get('broadcast')
    if query.data != 'bc:yes' or not data:
        _clear(context)
        await query.edit_message_text("Bekor qilindi.")
        return ConversationHandler.END
    # Tasdiqlash vaqtida ham ruxsatni qayta tekshiramiz
    allowed, user = await admin_user(update.effective_user.id)
    if not allowed:
        _clear(context)
        await query.edit_message_text(DENIED)
        return ConversationHandler.END
    if context.application.bot_data.get(RUNNING_KEY):
        await query.edit_message_text("⏳ Oldingi reklama hali yuborilmoqda. Tugashini kuting.")
        return ConversationHandler.END
    recipients = await get_recipients()
    log = await create_log(
        created_by=user, created_by_telegram_id=update.effective_user.id, text_preview=data.get('preview', ''),
        content_type=data.get('content_type', ''), button_text=data.get('button_text', ''),
        button_url=data.get('button_url', ''), total=len(recipients),
    )
    _clear(context)
    await query.edit_message_text(f"⏳ Yuborish boshlandi: {len(recipients)} ta foydalanuvchi. Tugagach xabar beraman.")
    context.application.bot_data[RUNNING_KEY] = True
    context.application.create_task(
        _run_broadcast(context, data, recipients, log.pk, report_chat_id=update.effective_chat.id),
        update=update,
    )
    return ConversationHandler.END


async def broadcast_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    _clear(context)
    if update.message:
        await update.message.reply_text("Reklama bekor qilindi.")
    return ConversationHandler.END


# ----------------------------------------------------------------------------- fonda yuborish
async def _send_one(bot, chat_id: int, data: dict, markup) -> bool:
    for _ in range(MAX_RETRIES):
        try:
            await bot.copy_message(
                chat_id=chat_id, from_chat_id=data['chat_id'], message_id=data['message_id'], reply_markup=markup,
            )
            return True
        except RetryAfter as exc:
            ra = exc.retry_after
            wait = ra.total_seconds() if hasattr(ra, 'total_seconds') else float(ra)
            await asyncio.sleep(wait + 1)
        except (Forbidden, BadRequest):
            return False  # botni bloklagan / chat topilmadi
        except TelegramError:
            await asyncio.sleep(1)  # tarmoq xatosi — qayta urinish
    return False


async def _run_broadcast(context, data: dict, recipients: list[int], log_id: int, report_chat_id: int) -> None:
    bot = context.bot
    markup = _button_markup(data)
    sent = failed = 0
    status = 'done'
    try:
        for chat_id in recipients:
            if await _send_one(bot, chat_id, data, markup):
                sent += 1
            else:
                failed += 1
            await asyncio.sleep(SEND_DELAY)
    except Exception:
        logger.exception('broadcast %s crashed', log_id)
        status = 'failed'
    finally:
        context.application.bot_data[RUNNING_KEY] = False
        try:
            await finish_log(log_id, sent, failed, status)
        except Exception:
            logger.exception('broadcast log %s save failed', log_id)
    logger.info('broadcast %s finished: sent=%s failed=%s', log_id, sent, failed)
    try:
        await bot.send_message(report_chat_id, f"✅ Reklama yakunlandi.\nYuborildi: {sent}, Xato: {failed}")
    except TelegramError:
        logger.warning('broadcast report could not be delivered to %s', report_chat_id)
