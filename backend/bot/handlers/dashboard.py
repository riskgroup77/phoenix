"""Dashboard — boshqaruv paneli."""
import logging

from asgiref.sync import sync_to_async
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from bot.app_links import articles_url, dashboard_url, submit_article_url
from bot.handlers.auth import require_author
from bot.keyboards import author_main_keyboard
from bot.list_browse import app_link_button
from bot.payment_helpers import app_payments_url
from bot.session import get_client_from_context
from bot.utils import format_api_error, format_money

logger = logging.getLogger(__name__)


def dashboard_actions_keyboard(client) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [app_link_button(client, '📱 Ilovani ochish', dashboard_url(client))],
        [
            InlineKeyboardButton('📝 Maqola yuborish', callback_data='dash:hint:submit'),
            app_link_button(client, '📄 Maqolalarim', articles_url(client)),
        ],
        [
            InlineKeyboardButton('💰 To\'lov qilish', callback_data='dash:hint:pay'),
            app_link_button(client, '💳 To\'lovlar', app_payments_url(client)),
        ],
    ])


async def dashboard_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    await query.answer()
    hints = {
        'dash:hint:submit': "📝 Maqola yuborish uchun asosiy menyudan «📝 Maqola yuborish» tugmasini bosing.",
        'dash:hint:pay': "💰 To'lov uchun «💰 To'lov qilish» tugmasini bosing.",
    }
    msg = hints.get(query.data or '')
    if msg:
        await query.answer(msg, show_alert=True)


async def show_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client or not update.message:
        return
    try:
        articles = await sync_to_async(client.articles_mine)()
        txs = await sync_to_async(client.transactions)()
        unread = await sync_to_async(client.unread_count)()
        completed = [t for t in txs if t.get('status') == 'completed']
        revenue = sum(abs(float(t.get('amount') or 0)) for t in completed)
        published = sum(1 for a in articles if a.get('status') == 'Published')
        pending = sum(1 for a in articles if a.get('status') in ('Yangi', 'WithEditor', 'PlagiarismReview', 'QabulQilingan'))
        pending_pay = sum(1 for t in txs if (t.get('status') or '').lower() == 'pending')
        user = context.user_data.get('user') or {}
        text = (
            f"📊 *Boshqaruv paneli*\n\n"
            f"👤 {user.get('first_name', '')} {user.get('last_name', '')}\n\n"
            f"📄 Maqolalar: **{len(articles)}** (nashr: {published}, jarayonda: {pending})\n"
            f"💳 To'lovlar: **{len(txs)}** | To'langan: {format_money(revenue)}\n"
            f"⏳ Kutilayotgan to'lov: **{pending_pay}** ta\n"
            f"🔔 O'qilmagan bildirishnomalar: **{unread}**\n\n"
            "Tezkor harakatlar:"
        )
        await update.message.reply_text(
            text,
            parse_mode='Markdown',
            reply_markup=dashboard_actions_keyboard(client),
        )
        await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
    except Exception as e:
        logger.exception('dashboard')
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())
