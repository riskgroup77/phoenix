"""
Telefonni tasdiqlash va parolni tiklash (Telegram kontakt ulashish orqali — bepul, SMS'siz).

Saytdan: t.me/<bot>?start=v_<kod> (tasdiqlash), r_<kod> (parolni tiklash) yoki g_<kod> (ro'yxatdan o'tish —
kontakt tasdiqlangach bot 4 xonali kod yuboradi, foydalanuvchi uni saytga kiritadi).
Botning o'zidan: «🔑 Parolni tiklash» tugmasi.
"""
import logging

from asgiref.sync import sync_to_async
from telegram import KeyboardButton, ReplyKeyboardMarkup, Update
from telegram.ext import ContextTypes

from apps.users import phone_verification as pv
from bot.keyboards import author_main_keyboard, guest_keyboard

logger = logging.getLogger(__name__)

PENDING_KEY = 'phone_challenge'
DIRECT_RESET = 'direct_reset'
FROM_BOT_KEY = 'phone_verify_from_bot'


def _menu_keyboard(context):
    authed = context.user_data.get('authenticated') if context.user_data else False
    return author_main_keyboard() if authed else guest_keyboard()


def _bot_verify_state_sync(telegram_id: int) -> tuple[str, str]:
    """(xabar, kod): xabar bo'sh — ruxsat. Aks holda yangi tasdiqlash kodi yaratiladi."""
    from apps.users.models import TelegramSession

    row = TelegramSession.objects.select_related('user').filter(telegram_id=telegram_id).first()
    if row is None:
        return '', ''
    user = row.user
    blocked = pv.verification_required_message(user)
    if not blocked:
        return '', ''
    return blocked, pv.start_verification_in_bot(user)


async def ensure_phone_verified(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    """
    Maqola/kitob yuborishdan oldin: telefon tasdiqlanmagan muallifdan kontakt so'raladi (o'sha tasdiqlash oqimi).
    True — davom etish mumkin.
    """
    tg_user = update.effective_user
    if not tg_user:
        return True
    try:
        blocked, code = await sync_to_async(_bot_verify_state_sync)(tg_user.id)
    except Exception:
        logger.exception('phone verification gate failed')
        return True  # backend baribir tekshiradi
    if not blocked:
        return True
    context.user_data[PENDING_KEY] = (pv.PhoneChallenge.PURPOSE_VERIFY, code)
    context.user_data[FROM_BOT_KEY] = True
    if update.effective_chat:
        await context.bot.send_message(
            update.effective_chat.id,
            "🔐 Maqola yoki kitob yuborishdan oldin telefon raqamingizni tasdiqlash kerak (bir martalik, bepul).\n\n"
            "Pastdagi «📱 Raqamni ulashish» tugmasini bosing — Telegram'dagi raqamingiz saytdagi "
            "raqamingiz bilan solishtiriladi.",
            reply_markup=contact_keyboard(),
        )
    return False


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
    what = {
        'verify': 'telefon raqamingizni tasdiqlash',
        'register': "ro'yxatdan o'tish kodini olish",
    }.get(purpose, 'parolingizni tiklash')
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
        await msg.reply_text(f'❌ {exc}', reply_markup=_menu_keyboard(context))
        return
    except Exception:
        logger.exception('contact verification failed')
        await msg.reply_text("❌ Xatolik yuz berdi. Birozdan keyin qayta urinib ko'ring.",
                             reply_markup=_menu_keyboard(context))
        return
    context.user_data.pop(PENDING_KEY, None)
    from_bot = context.user_data.pop(FROM_BOT_KEY, False)
    if result.purpose == 'register':
        await msg.reply_text(
            f"✅ Raqamingiz tasdiqlandi.\n\nRo'yxatdan o'tish kodingiz: <b>{result.otp}</b>\n\n"
            "Saytga qayting va shu kodni kiriting (15 daqiqa amal qiladi). Kodni hech kimga bermang.",
            parse_mode='HTML',
            reply_markup=guest_keyboard(),
        )
    elif result.purpose == 'verify' and from_bot:
        if isinstance(context.user_data.get('user'), dict):
            context.user_data['user']['phone_verified'] = True
        await msg.reply_text(
            "✅ Telefon raqamingiz tasdiqlandi! Endi amalni qayta boshlang (masalan, «📝 Maqola yuborish»).",
            reply_markup=_menu_keyboard(context),
        )
    elif result.purpose == 'verify':
        await msg.reply_text(
            "✅ Telefon raqamingiz tasdiqlandi! Saytga qayting — sahifa o'zi yangilanadi.",
            reply_markup=_menu_keyboard(context),
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
    context.user_data.pop(FROM_BOT_KEY, None)
    if update.message:
        await update.message.reply_text('Bekor qilindi.', reply_markup=_menu_keyboard(context))
