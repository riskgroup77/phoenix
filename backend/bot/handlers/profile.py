"""Profile, payments."""
import logging

from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import ContextTypes

from bot.app_links import profile_url
from bot.constants import SERVICE_LABELS, TX_STATUS_LABELS
from bot.handlers.auth import require_author
from bot.keyboards import author_main_keyboard
from bot.list_browse import app_link_button, carousel_keyboard
from bot.payment_helpers import open_app_keyboard, pending_payments_keyboard
from bot.session import get_client_from_context
from bot.utils import format_api_error, format_money

logger = logging.getLogger(__name__)


async def show_profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client or not update.message:
        return
    try:
        user = await sync_to_async(client.profile)()
        gp = user.get('gamification_profile') or {}
        points = gp.get('points', user.get('gamification_points', 0))
        text = (
            f"👤 *Profil*\n\n"
            f"*{user.get('first_name', '')} {user.get('last_name', '')}*\n"
            f"📱 {user.get('phone', '')}\n"
            f"📧 {user.get('email') or '—'}\n"
            f"🏛 {user.get('affiliation') or '—'}\n"
            f"💼 Rol: Muallif\n"
            f"⭐ Ball: {points}\n\n"
            "Profilni tahrirlash uchun ilovani oching:"
        )
        kb = carousel_keyboard(
            'lv:prf', 0, 1,
            action_rows=[
                [app_link_button(client, '✏️ Profilni tahrirlash', profile_url(client))],
                [app_link_button(client, '⚙️ Sozlamalar', profile_url(client, 'settings'))],
            ],
        )
        await update.message.reply_text(text, parse_mode='Markdown', reply_markup=kb)
        await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
    except Exception as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def open_payment_app(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client or not update.message:
        return
    try:
        txs = await sync_to_async(client.transactions)()
        pending = [t for t in txs if (t.get('status') or '').lower() == 'pending']
        if pending:
            lines = [
                "💰 *To'lov qilish*\n",
                f"Kutilayotgan to'lovlar: **{len(pending)}** ta\n",
                "Tugmani bosing — ilovada Click to'lov sahifasi ochiladi (QR kod ham bor).\n",
            ]
            for t in pending[:5]:
                svc = SERVICE_LABELS.get(t.get('service_type', ''), t.get('service_type', 'To\'lov'))
                lines.append(f"• {svc}: {format_money(t.get('amount'))}")
            await update.message.reply_text(
                '\n'.join(lines),
                parse_mode='Markdown',
                reply_markup=pending_payments_keyboard(client, txs),
            )
        else:
            await update.message.reply_text(
                "💰 Hozircha **kutilayotgan to'lov yo'q**.\n\nIlovada to'lovlar tarixini ko'ring.",
                parse_mode='Markdown',
                reply_markup=open_app_keyboard(client),
            )
        await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
    except Exception as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def show_payments(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client or not update.message:
        return
    try:
        txs = await sync_to_async(client.transactions)()
        if not txs:
            await update.message.reply_text("💳 Tranzaksiyalar yo'q.", reply_markup=open_app_keyboard(client))
            await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
            return
        pending = [t for t in txs if (t.get('status') or '').lower() == 'pending']
        lines = ["💳 *To'lovlar tarixi*\n"]
        for t in txs[:8]:
            svc = SERVICE_LABELS.get(t.get('service_type', ''), t.get('service_type', ''))
            st = TX_STATUS_LABELS.get(t.get('status', ''), t.get('status', ''))
            lines.append(f"• {svc}: {format_money(t.get('amount'))} — {st}")
        if len(txs) > 8:
            lines.append(f"\n… va yana {len(txs) - 8} ta (ilovada to'liq ro'yxat)")
        if pending:
            lines.append(f"\n⏳ To'lanmagan: **{len(pending)}** ta — «💰 To'lov qilish»")
        kb = pending_payments_keyboard(client, txs) if pending else open_app_keyboard(client)
        await update.message.reply_text('\n'.join(lines), parse_mode='Markdown', reply_markup=kb)
        await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
    except Exception as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())
