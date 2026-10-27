"""
/admin — bosh admin paneli (faqat super_admin bilan botga kirganlar yoki settings.TELEGRAM_ADMIN_IDS).

Bo'limlar: statistika, hujjatlar (turlar bo'yicha ro'yxat → hujjat → faylni yuklab olish), foydalanuvchilar
(telefon / ism-familiya / ID bo'yicha qidirish → profil → hujjatlari va fayllari), reklama tarixi,
fayl ombori va zaxiralar, server holati. Ma'lumotlar: bot/handlers/admin_data.py.

Har bir tugma bosilganda ruxsat qayta tekshiriladi; yuborilgan har bir fayl logga yoziladi.
"""
import asyncio
import logging

from asgiref.sync import sync_to_async
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.error import BadRequest, TelegramError
from telegram.ext import ContextTypes, ConversationHandler

from bot.constants import ADM_SEARCH
from bot.handlers import admin_data as data
from bot.handlers.broadcast import DENIED, admin_user, broadcast_start

logger = logging.getLogger(__name__)

# Bitta foydalanuvchining barcha fayllarini yuborishda ko'pi bilan shuncha fayl
MAX_BULK_FILES = 50


def _markup(rows) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton(text, callback_data=cb) for text, cb in row] for row in rows])


def _with_menu(rows):
    return rows + [[('🏠 Menyu', 'adm:menu')]]


async def _is_admin(update: Update) -> bool:
    user = update.effective_user
    if not user:
        return False
    allowed, _ = await admin_user(user.id)
    return allowed


async def _show(update: Update, text: str, rows) -> None:
    """Callback bo'lsa — xabarni tahrirlash, aks holda yangi xabar."""
    markup = _markup(rows)
    query = update.callback_query
    if query and query.message:
        try:
            await query.edit_message_text(text, parse_mode='HTML', reply_markup=markup,
                                          disable_web_page_preview=True)
            return
        except BadRequest as exc:
            if 'not modified' in str(exc).lower():
                return
    await update.effective_chat.send_message(text, parse_mode='HTML', reply_markup=markup,
                                             disable_web_page_preview=True)


async def admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await _is_admin(update):
        await update.effective_message.reply_text(DENIED)
        return
    text, rows = data.main_menu()
    await _show(update, text, rows)


async def user_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/user <telefon | ism familiya | ID>"""
    if not await _is_admin(update):
        await update.effective_message.reply_text(DENIED)
        return
    query = ' '.join(context.args or []).strip()
    if not query:
        await update.effective_message.reply_text('Foydalanish: /user 901234567  yoki  /user Aliyev Vali  yoki  /user <ID>')
        return
    await _send_search(update, query)


async def _send_search(update: Update, query: str) -> None:
    users = await sync_to_async(data.search_users)(query)
    if len(users) == 1:
        text, rows = await sync_to_async(data.user_detail)(str(users[0].pk))
    else:
        text, rows = await sync_to_async(data.search_results)(query)
    await update.effective_chat.send_message(text, parse_mode='HTML', reply_markup=_markup(rows))


# ----------------------------------------------------------------------------- qidiruv suhbati
async def search_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if query:
        await query.answer()
    if not await _is_admin(update):
        await update.effective_chat.send_message(DENIED)
        return ConversationHandler.END
    await update.effective_chat.send_message(
        '🔎 Qidiruv: telefon raqam (901234567), ism / familiya (Aliyev Vali) yoki ID ni yuboring.\n'
        'Bekor qilish: /cancel'
    )
    return ADM_SEARCH


async def search_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await _is_admin(update):
        await update.effective_message.reply_text(DENIED)
        return ConversationHandler.END
    await _send_search(update, update.effective_message.text or '')
    return ConversationHandler.END


async def search_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.effective_message.reply_text('Qidiruv bekor qilindi. /admin')
    return ConversationHandler.END


async def broadcast_from_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """«📣 Yangi reklama» tugmasi — /reklama suhbatining kirish nuqtasi."""
    if update.callback_query:
        await update.callback_query.answer()
    return await broadcast_start(update, context)


# ----------------------------------------------------------------------------- fayl yuborish
async def _send_file(update: Update, context: ContextTypes.DEFAULT_TYPE, cat: str, pk: str, idx: int) -> bool:
    info = await sync_to_async(data.resolve_file)(cat, pk, idx)
    chat = update.effective_chat
    if info is None:
        await chat.send_message('❌ Fayl topilmadi.')
        return False
    if not info['path']:
        await chat.send_message(f"❌ «{info['filename']}» diskda ham, Telegram omborida ham topilmadi.")
        return False
    if info['size'] > data.SEND_LIMIT_BYTES:
        await chat.send_message(
            f"⚠️ «{info['filename']}» — {data.fmt_size(info['size'])}. Bot 50 MB dan katta faylni yubora olmaydi; "
            'saytdagi admin panel orqali yuklab oling.'
        )
        return False
    logger.info('[ADMIN] tg=%s fayl oldi: %s (%s/%s)', update.effective_user.id, info['name'], cat, pk)
    try:
        with open(info['path'], 'rb') as fh:
            await context.bot.send_document(chat.id, document=fh, filename=info['filename'],
                                            caption=info['caption'][:1024])
        return True
    except TelegramError as exc:
        await chat.send_message(f"❌ «{info['filename']}» yuborilmadi: {exc}")
        return False


async def _send_user_files(update: Update, context: ContextTypes.DEFAULT_TYPE, user_id: str) -> None:
    files = await sync_to_async(data.user_files)(user_id)
    chat = update.effective_chat
    if not files:
        await chat.send_message('Bu foydalanuvchida fayl yo\'q.')
        return
    shown = files[:MAX_BULK_FILES]
    await chat.send_message(f'📦 {len(shown)} ta fayl yuborilmoqda...'
                            + (f' (jami {len(files)}, birinchi {MAX_BULK_FILES} tasi)' if len(files) > len(shown) else ''))
    sent = 0
    for cat, pk, idx in shown:
        if await _send_file(update, context, cat, pk, idx):
            sent += 1
        await asyncio.sleep(0.4)  # Telegram tezlik cheklovi
    await chat.send_message(f'✅ Yuborildi: {sent}/{len(shown)}', reply_markup=_markup([
        [('👤 Foydalanuvchiga', f'adm:u:{user_id}'), ('🏠 Menyu', 'adm:menu')],
    ]))


# ----------------------------------------------------------------------------- tugmalar
async def admin_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    if not await _is_admin(update):
        await query.answer(DENIED, show_alert=True)
        return
    parts = (query.data or '').split(':')
    action = parts[1] if len(parts) > 1 else 'menu'

    if action == 'noop':
        await query.answer()
        return
    if action in ('f', 'ua'):
        await query.answer('⏳ Yuborilmoqda...')
        if action == 'f' and len(parts) == 5:
            await _send_file(update, context, parts[2], parts[3], int(parts[4]) if parts[4].isdigit() else -1)
        elif action == 'ua' and len(parts) == 3:
            await _send_user_files(update, context, parts[2])
        return

    await query.answer()
    page = lambda value: int(value) if str(value).isdigit() else 0  # noqa: E731
    if action == 'stats':
        text = await sync_to_async(data.stats_text)()
        rows = [[('🔄 Yangilash', 'adm:stats'), ('🏠 Menyu', 'adm:menu')]]
    elif action == 'docs':
        text, rows = await sync_to_async(data.documents_menu)()
        rows = _with_menu(rows)
    elif action == 'dl' and len(parts) == 4:
        text, rows = await sync_to_async(data.document_list)(parts[2], page(parts[3]))
    elif action == 'd' and len(parts) == 4:
        text, rows = await sync_to_async(data.document_detail)(parts[2], parts[3])
    elif action in ('users', 'ulist'):
        text, rows = await sync_to_async(data.users_menu)(page(parts[2] if len(parts) > 2 else 0))
    elif action == 'u' and len(parts) == 3:
        text, rows = await sync_to_async(data.user_detail)(parts[2])
    elif action == 'ul' and len(parts) == 5:
        text, rows = await sync_to_async(data.document_list)(parts[3], page(parts[4]), user_id=parts[2])
    elif action == 'bcl':
        text, rows = await sync_to_async(data.broadcasts_text)()
    elif action == 'storage':
        text = await sync_to_async(data.storage_text)()
        rows = [[('🔄 Yangilash', 'adm:storage'), ('🏠 Menyu', 'adm:menu')]]
    elif action == 'server':
        text = await sync_to_async(data.server_text)()
        rows = [[('🔄 Yangilash', 'adm:server'), ('🏠 Menyu', 'adm:menu')]]
    else:
        text, rows = data.main_menu()
    await _show(update, text[:4096], rows)
