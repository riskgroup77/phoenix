"""Main menu router and /start with session restore."""
import logging

from telegram import Update
from telegram.ext import ContextTypes

from bot.constants import BACK
from bot.handlers.auth import logout
from bot.handlers.dashboard import show_dashboard
from bot.handlers.list_views import (
    show_archive,
    show_articles,
    show_collections,
    show_notifications,
    show_publications,
    show_translations,
)
from bot.handlers.profile import open_payment_app, show_payments, show_profile
from bot.handlers.services import services_back, show_services_menu
from bot.keyboards import author_main_keyboard, guest_keyboard
from bot.session import apply_client_to_context, restore_client

logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    tg_user = update.effective_user
    if not tg_user or not update.message:
        return

    client = await restore_client(tg_user.id)
    if client:
        try:
            from asgiref.sync import sync_to_async
            profile = await sync_to_async(client.profile)()
            apply_client_to_context(context, client, profile)
            name = f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip()
            await update.message.reply_text(
                f"Salom, {name}! 👋\n\n"
                "Siz avval kirgansiz — qayta parol so'ralmaydi.\n"
                "Muallif paneli tayyor. Menyudan tanlang:",
                reply_markup=author_main_keyboard(),
            )
            return
        except Exception:
            logger.exception('session restore profile failed')

    if context.user_data:
        context.user_data.clear()

    await update.message.reply_text(
        "Salom! **Ilmiy Faoliyat** muallif botiga xush kelibsiz! 🎓\n\n"
        "Bu bot orqali saytdagi barcha muallif funksiyalaridan foydalanishingiz mumkin:\n"
        "• Maqola yuborish va kuzatish\n"
        "• Antiplagiat, DOI, UDK, tarjima\n"
        "• To'lovlar, arxiv, bildirishnomalar\n\n"
        "Boshlash uchun kiring yoki ro'yxatdan o'ting:",
        parse_mode='Markdown',
        reply_markup=guest_keyboard(),
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    authed = context.user_data.get('authenticated') if context.user_data else False
    kb = author_main_keyboard() if authed else guest_keyboard()
    await update.message.reply_text(
        "ℹ️ **Yordam**\n\n"
        "/start — Bosh menyu (avto-kirish)\n"
        "/logout — Chiqish\n"
        "/help — Yordam\n\n"
        "Sayt: https://ilmiyfaoliyat.uz\n"
        "To'lov uchun «💰 To'lov qilish» tugmasini bosing — ilova ochiladi.",
        parse_mode='Markdown',
        reply_markup=kb,
    )


async def menu_router(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    text = (update.message.text or '').strip()

    # Conversation flows (login, register, submit, services) — alohida ConversationHandler orqali
    routes = {
        'ℹ️ Yordam': help_command,
        '🔓 Chiqish': logout,
        '📊 Boshqaruv paneli': show_dashboard,
        '📄 Maqolalarim': show_articles,
        '✨ Xizmatlar': show_services_menu,
        "📚 To'plamlarim": show_collections,
        '🌐 Tarjimalarim': show_translations,
        '📁 Arxiv hujjatlar': show_archive,
        '📖 Muallif nashrlari': show_publications,
        '👤 Profil': show_profile,
        '🔔 Bildirishnomalar': show_notifications,
        '💰 To\'lov qilish': open_payment_app,
        '💳 To\'lovlar': show_payments,
        BACK: services_back,
    }

    handler = routes.get(text)
    if handler:
        result = handler(update, context)
        if hasattr(result, '__await__'):
            await result
        return

    authed = context.user_data.get('authenticated') if context.user_data else False
    kb = author_main_keyboard() if authed else guest_keyboard()
    await update.message.reply_text("Menyudan tugmani tanlang:", reply_markup=kb)
