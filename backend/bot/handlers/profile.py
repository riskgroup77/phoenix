"""Profile, payments, notifications, archive."""
import logging

from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import ContextTypes

from bot.constants import SERVICE_LABELS
from bot.handlers.auth import require_author
from bot.keyboards import author_main_keyboard
from bot.session import get_client_from_context
from bot.utils import format_api_error, format_money, truncate

logger = logging.getLogger(__name__)


async def show_profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client:
        return
    try:
        user = await sync_to_async(client.profile)()
        text = (
            f"👤 **Profil**\n\n"
            f"Ism: {user.get('first_name', '')} {user.get('last_name', '')}\n"
            f"📱 Telefon: {user.get('phone', '')}\n"
            f"📧 Email: {user.get('email', '')}\n"
            f"🏛 Tashkilot: {user.get('affiliation', '—')}\n"
            f"💼 Rol: Muallif\n"
            f"⭐ Ball: {user.get('gamification_points', 0)}"
        )
        if update.message:
            await update.message.reply_text(text, parse_mode='Markdown', reply_markup=author_main_keyboard())
    except Exception as e:
        if update.message:
            await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def show_payments(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client:
        return
    try:
        txs = await sync_to_async(client.transactions)()
        if not txs:
            if update.message:
                await update.message.reply_text("💳 Tranzaksiyalar yo'q.", reply_markup=author_main_keyboard())
            return
        lines = ["💳 **To'lovlar**\n"]
        for t in txs[:10]:
            svc = SERVICE_LABELS.get(t.get('service_type', ''), t.get('service_type', ''))
            st = t.get('status', '')
            amt = format_money(t.get('amount'))
            lines.append(f"• {svc}: {amt} — {st}")
        if update.message:
            await update.message.reply_text('\n'.join(lines), parse_mode='Markdown', reply_markup=author_main_keyboard())
    except Exception as e:
        if update.message:
            await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def show_notifications(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client:
        return
    try:
        notes = await sync_to_async(client.notifications)()
        unread = await sync_to_async(client.unread_count)()
        if unread:
            await sync_to_async(client.mark_all_read)()
        if not notes:
            if update.message:
                await update.message.reply_text("🔔 Bildirishnomalar yo'q.", reply_markup=author_main_keyboard())
            return
        lines = [f"🔔 **Bildirishnomalar** ({unread} ta yangi o'qildi)\n"]
        for n in notes[:10]:
            lines.append(f"• {truncate(n.get('message') or n.get('title') or '—', 80)}")
        if update.message:
            await update.message.reply_text('\n'.join(lines), parse_mode='Markdown', reply_markup=author_main_keyboard())
    except Exception as e:
        if update.message:
            await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def show_archive(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client:
        return
    try:
        data = await sync_to_async(client.archive)()
        items = data.get('items') or []
        if not items:
            if update.message:
                await update.message.reply_text("📁 Arxiv hujjatlar hozircha bo'sh.", reply_markup=author_main_keyboard())
            return
        lines = [f"📁 **Arxiv hujjatlar** ({data.get('total', len(items))} ta)\n"]
        for item in items[:12]:
            label = item.get('label') or item.get('title') or item.get('type', 'Hujjat')
            url = item.get('download_url') or item.get('view_url') or ''
            line = f"• {truncate(label, 50)}"
            if url:
                line += f"\n  🔗 {url}"
            lines.append(line)
        if update.message:
            await update.message.reply_text('\n'.join(lines), parse_mode='Markdown', disable_web_page_preview=True, reply_markup=author_main_keyboard())
    except Exception as e:
        if update.message:
            await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())
