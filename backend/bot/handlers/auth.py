"""Login, register, logout, session restore."""
import logging

import requests
from asgiref.sync import sync_to_async
from django.conf import settings
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

from bot.api_client import ApiError, PhonixApiClient
from bot.constants import LOGIN_PASSWORD, LOGIN_PHONE, REG_FIRST, REG_LAST, REG_PASSWORD, REG_PHONE
from bot.keyboards import author_main_keyboard, guest_keyboard
from bot.session import delete_session, get_client_from_context, persist_login
from bot.utils import format_api_error, normalize_phone

logger = logging.getLogger(__name__)


async def require_author(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    client = get_client_from_context(context)
    if client and context.user_data.get('role') == 'author':
        return True
    if update.message:
        await update.message.reply_text(
            "❌ Bu bot faqat **mualliflar** uchun. Avval muallif sifatida kiring.",
            reply_markup=guest_keyboard(),
            parse_mode='Markdown',
        )
    return False


async def _delete_password_message(update: Update) -> None:
    """Parol yozilgan xabarni chat tarixidan o'chirish (telefon boshqa birovning qo'liga tushsa ham ko'rinmasin)."""
    try:
        await update.message.delete()
    except Exception:
        # Botga o'chirish huquqi bo'lmasligi mumkin — kirish jarayoni davom etadi
        pass


async def login_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message:
        await update.message.reply_text(
            "📱 Telefon raqamingizni kiriting (masalan: 911111111 yoki 998911111111):"
        )
    return LOGIN_PHONE


async def login_phone(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['login_phone'] = normalize_phone(update.message.text or '')
        await update.message.reply_text("🔑 Parolni kiriting:")
    return LOGIN_PASSWORD


async def login_password(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or context.user_data is None:
        return ConversationHandler.END
    phone = context.user_data.get('login_phone', '')
    password = update.message.text or ''
    await _delete_password_message(update)
    tg_user = update.effective_user
    await update.message.reply_text('⏳ Tekshirilmoqda, biroz kuting...')
    client = PhonixApiClient()
    try:
        data = await sync_to_async(client.login)(phone, password)
        user = data.get('user') or {}
        if user.get('role') != 'author':
            await update.message.reply_text(
                "❌ Bu bot hozircha faqat muallif (author) roli uchun.\n"
                "Sayt orqali boshqa rollar bilan ishlang.",
                reply_markup=guest_keyboard(),
            )
            return ConversationHandler.END
        await persist_login(context, tg_user.id, data, tg_user.username or '')
        name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        await update.message.reply_text(
            f"✅ Xush kelibsiz, {name}!\n\n"
            "Siz avtomatik eslab qolindik — keyingi safar qayta parol so'ralmaydi.\n"
            "Quyidagi menyu orqali saytdagi barcha muallif funksiyalaridan foydalaning.",
            reply_markup=author_main_keyboard(),
        )
    except ApiError as e:
        await update.message.reply_text(f"❌ Kirish xatoligi: {format_api_error(e)}", reply_markup=guest_keyboard())
    except requests.Timeout:
        await update.message.reply_text(
            "❌ Server javob bermadi (vaqt tugadi). Bir necha daqiqadan keyin qayta urinib ko'ring.",
            reply_markup=guest_keyboard(),
        )
    except requests.ConnectionError:
        await update.message.reply_text(
            "❌ API serverga ulanib bo'lmadi. Texnik xizmat bilan bog'laning.",
            reply_markup=guest_keyboard(),
        )
    except Exception as e:
        logger.exception('login failed')
        await update.message.reply_text(f"❌ Kirishda xatolik: {format_api_error(e)}", reply_markup=guest_keyboard())
    return ConversationHandler.END


async def register_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message:
        site = getattr(settings, 'PUBLIC_SITE_URL', '') or 'https://ilmiyfaoliyat.uz'
        await update.message.reply_text(
            "📄 Ro'yxatdan o'tish orqali siz ommaviy oferta va maxfiylik siyosati shartlarini qabul qilasiz:\n"
            f"{site}/#/oferta\n{site}/#/maxfiylik",
            disable_web_page_preview=True,
        )
        await update.message.reply_text("👤 Ismingizni kiriting:")
    return REG_FIRST


async def register_first(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['reg_first'] = (update.message.text or '').strip()
        await update.message.reply_text("👥 Familiyangizni kiriting:")
    return REG_LAST


async def register_last(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['reg_last'] = (update.message.text or '').strip()
        await update.message.reply_text("📱 Telefon raqamingizni kiriting:")
    return REG_PHONE


async def register_phone(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['reg_phone'] = normalize_phone(update.message.text or '')
        await update.message.reply_text("🔑 Parol o'ylab toping (kamida 6 belgi):")
    return REG_PASSWORD


async def register_password(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or context.user_data is None:
        return ConversationHandler.END
    password = update.message.text or ''
    await _delete_password_message(update)
    phone = context.user_data.get('reg_phone', '')
    first = context.user_data.get('reg_first', '')
    last = context.user_data.get('reg_last', '')
    tg_user = update.effective_user
    client = PhonixApiClient()
    payload = {
        'phone': phone,
        'password': password,
        'password_confirm': password,
        'first_name': first,
        'last_name': last,
        'affiliation': 'Telegram orqali ro\'yxatdan o\'tgan',
        # register_start da oferta havolasi ko'rsatildi — ro'yxatdan o'tishni davom ettirish = aksept
        'terms_accepted': True,
        'terms_version': getattr(settings, 'LEGAL_TERMS_VERSION', ''),
    }
    try:
        data = await sync_to_async(client.register)(payload)
        await persist_login(context, tg_user.id, data, tg_user.username or '')
        user = data.get('user') or {}
        await update.message.reply_text(
            f"✅ Ro'yxatdan o'tdingiz!\n\n"
            f"👤 {user.get('first_name')} {user.get('last_name')}\n"
            f"📱 {user.get('phone')}\n\n"
            "Endi saytdagi barcha muallif imkoniyatlari botda ham mavjud.",
            reply_markup=author_main_keyboard(),
        )
    except ApiError as e:
        await update.message.reply_text(f"❌ Ro'yxatdan o'tish xatoligi: {format_api_error(e)}", reply_markup=guest_keyboard())
    except Exception as e:
        logger.exception('register failed')
        await update.message.reply_text(f"❌ Xatolik: {e}", reply_markup=guest_keyboard())
    return ConversationHandler.END


async def logout(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    tg_user = update.effective_user
    if tg_user:
        await delete_session(tg_user.id)
    if context.user_data:
        context.user_data.clear()
    if update.message:
        await update.message.reply_text(
            "✅ Chiqdingiz. Qayta kirish uchun «🔒 Kirish» tugmasini bosing.",
            reply_markup=guest_keyboard(),
        )
