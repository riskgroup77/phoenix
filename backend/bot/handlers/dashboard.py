"""Dashboard, articles list, collections, publications."""
import logging

from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import ContextTypes

from bot.constants import STATUS_LABELS
from bot.handlers.auth import require_author
from bot.keyboards import author_main_keyboard
from bot.session import get_client_from_context
from bot.utils import format_api_error, format_money, truncate

logger = logging.getLogger(__name__)


async def show_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client:
        return
    try:
        articles = await sync_to_async(client.articles_mine)()
        txs = await sync_to_async(client.transactions)()
        unread = await sync_to_async(client.unread_count)()
        completed = [t for t in txs if t.get('status') == 'completed']
        revenue = sum(abs(float(t.get('amount') or 0)) for t in completed)
        published = sum(1 for a in articles if a.get('status') == 'Published')
        pending = sum(1 for a in articles if a.get('status') in ('Yangi', 'WithEditor', 'PlagiarismReview', 'QabulQilingan'))
        user = context.user_data.get('user') or {}
        text = (
            f"📊 **Boshqaruv paneli**\n\n"
            f"👤 {user.get('first_name', '')} {user.get('last_name', '')}\n"
            f"📄 Maqolalar: **{len(articles)}** (nashr: {published}, jarayonda: {pending})\n"
            f"💳 To'lovlar: **{len(txs)}** | Jami: {format_money(revenue)}\n"
            f"🔔 O'qilmagan bildirishnomalar: **{unread}**"
        )
        if update.message:
            await update.message.reply_text(text, parse_mode='Markdown', reply_markup=author_main_keyboard())
    except Exception as e:
        logger.exception('dashboard')
        if update.message:
            await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def show_articles(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client:
        return
    try:
        articles = await sync_to_async(client.articles_mine)()
        if not articles:
            if update.message:
                await update.message.reply_text("📄 Hozircha maqolalar yo'q. «📝 Maqola yuborish» orqali yuboring.", reply_markup=author_main_keyboard())
            return
        lines = ["📄 **Maqolalarim**\n"]
        for a in articles[:15]:
            st = STATUS_LABELS.get(a.get('status', ''), a.get('status', ''))
            title = truncate(a.get('title', '—'), 60)
            journal = truncate(a.get('journal_name') or '', 30)
            lines.append(f"• **{title}**\n  📌 {st}" + (f" | 📚 {journal}" if journal else ''))
        if len(articles) > 15:
            lines.append(f"\n… va yana {len(articles) - 15} ta")
        lines.append("\nBatafsil: saytda maqola sahifasini oching.")
        if update.message:
            await update.message.reply_text('\n'.join(lines), parse_mode='Markdown', reply_markup=author_main_keyboard())
    except Exception as e:
        if update.message:
            await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def show_collections(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client:
        return
    try:
        issues = await sync_to_async(client.issues)()
        if not issues:
            if update.message:
                await update.message.reply_text("📚 To'plamlar hozircha yo'q.", reply_markup=author_main_keyboard())
            return
        lines = ["📚 **To'plamlarim / Oylik sonlar**\n"]
        for issue in issues[:12]:
            name = issue.get('title') or issue.get('name') or 'Son'
            journal = issue.get('journal_name') or ''
            lines.append(f"• {truncate(name, 50)}" + (f" ({journal})" if journal else ''))
        if update.message:
            await update.message.reply_text('\n'.join(lines), parse_mode='Markdown', reply_markup=author_main_keyboard())
    except Exception as e:
        if update.message:
            await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def show_publications(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client:
        return
    try:
        pubs = await sync_to_async(client.my_publications)()
        if not pubs:
            if update.message:
                await update.message.reply_text("📖 Muallif nashrlari ro'yxati bo'sh.", reply_markup=author_main_keyboard())
            return
        lines = ["📖 **Muallif nashrlari**\n"]
        for p in pubs[:12]:
            lines.append(f"• {truncate(p.get('title', '—'), 55)}")
        if update.message:
            await update.message.reply_text('\n'.join(lines), parse_mode='Markdown', reply_markup=author_main_keyboard())
    except Exception as e:
        if update.message:
            await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())
