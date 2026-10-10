"""
Telefonni tasdiqlash va parolni tiklash (Telegram kontakt ulashish orqali — bepul, SMS'siz).

Saytdan: t.me/<bot>?start=v_<kod> (tasdiqlash) yoki r_<kod> (parolni tiklash).
Botning o'zidan: «🔑 Parolni tiklash» tugmasi.
"""
import logging

from asgiref.sync import sync_to_async
from telegram import KeyboardButton, ReplyKeyboardMarkup, Update
from telegram.ext import ContextTypes

from apps.users import phone_verification as pv
from bot.keyboards import guest_keyboard

logger = logging.getLogger(__name__)

PENDING_KEY = 'phone_challenge'
DIRECT_RESET = 'direct_reset'


def contact_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [[KeyboardButton('📱 Raqamni ulashish', request_contact=True)], ['❌ Bekor qilish']],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


async def handle_start_payload(update: Update, context: ContextTypes.DEFAULT_TYPE, payload: str) -> bool:
    """/start parametri tasdiqlash/tiklash kodi bo'lsa — kontakt so'raydi. True — qayta ishlandi."""
    parsed = pv.parse_start_payload(payload)
    if not parsed or not update.message:
        return False
    purpose, code = parsed
    try:
        await sync_to_async(pv.get_active_challenge)(code, purpose)
    except pv.VerificationError as exc:
        await update.message.reply_text(f'❌ {exc}', reply_markup=guest_keyboard())
        return True
    context.user_data[PENDING_KEY] = (purpose, code)
    what = 'telefon raqamingizni tasdiqlash' if purpose == 'verify' else 'parolingizni tiklash'
    await update.message.reply_text(
        f"🔐 Saytda {what} uchun pastdagi «📱 Raqamni ulashish» tugmasini bosing.\n\n"
        "Telegram sizning hisobingizga bog'langan raqamni yuboradi — u saytdagi raqam bilan solishtiriladi.",
        reply_markup=contact_keyboard(),
    )
    return True


async def reset_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Botdagi «🔑 Parolni tiklash» tugmasi — saytsiz."""
    if not update.message:
        return
    context.user_data[PENDING_KEY] = (DIRECT_RESET, '')
    await update.message.reply_text(
        "🔑 Parolni tiklash uchun «📱 Raqamni ulashish» tugmasini bosing.\n"
        "Raqamingiz bilan ro'yxatdan o'tgan hisob bo'lsa, yangi parol o'rnatish havolasini yuboraman.",
        reply_markup=contact_keyboard(),
    )


async def contact_received(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    msg = update.message
    if not msg or not msg.contact:
        return
    pending = context.user_data.get(PENDING_KEY)
    if not pending:
        await msg.reply_text(
            "ℹ️ Raqamni tasdiqlash uchun saytdagi «Telegram orqali tasdiqlash» tugmasidan foydalaning "
            "yoki «🔑 Parolni tiklash» ni bosing.",
            reply_markup=guest_keyboard(),
        )
        return
    purpose, code = pending
    tg_id = update.effective_user.id
    contact = msg.contact
    try:
        if purpose == DIRECT_RESET:
            started = await sync_to_async(pv.start_password_reset)(contact.phone_number)
            purpose, code = pv.parse_start_payload(started['deep_link'].rsplit('start=', 1)[1])
        result = await sync_to_async(pv.confirm_contact)(
            code, purpose, telegram_id=tg_id, contact_user_id=contact.user_id, contact_phone=contact.phone_number,
        )
    except pv.VerificationError as exc:
        await msg.reply_text(f'❌ {exc}', reply_markup=guest_keyboard())
        return
    except Exception:
        logger.exception('contact verification failed')
        await msg.reply_text("❌ Xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring.", reply_markup=guest_keyboard())
        return
    context.user_data.pop(PENDING_KEY, None)
    if result.purpose == 'verify':
        await msg.reply_text(
            "✅ Telefon raqamingiz tasdiqlandi! Saytga qayting — sahifa o'zi yangilanadi.",
            reply_markup=guest_keyboard(),
        )
    else:
        await msg.reply_text(
            "✅ Raqamingiz tasdiqlandi.\n\n"
            f"Yangi parol o'rnatish uchun havola (30 daqiqa amal qiladi, bir marta ishlatiladi):\n{result.reset_link}\n\n"
            "Havolani hech kimga bermang.",
            reply_markup=guest_keyboard(),
            disable_web_page_preview=True,
        )


async def cancel_pending(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.pop(PENDING_KEY, None)
    if update.message:
        await update.message.reply_text('Bekor qilindi.', reply_markup=guest_keyboard())
