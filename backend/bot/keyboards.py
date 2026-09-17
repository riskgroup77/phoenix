"""Reply and inline keyboards for the author bot."""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup

from bot.constants import BACK, CANCEL


def guest_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [
            ['🔒 Kirish', '📝 Ro\'yxatdan o\'tish'],
            ['ℹ️ Yordam'],
        ],
        resize_keyboard=True,
    )


def author_main_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [
            ['📊 Boshqaruv paneli', '📄 Maqolalarim'],
            ['📝 Maqola yuborish', '✨ Xizmatlar'],
            ['📚 To\'plamlarim', '🌐 Tarjimalarim'],
            ['📁 Arxiv hujjatlar', '📖 Muallif nashrlari'],
            ['👤 Profil', '🔔 Bildirishnomalar'],
            ['💳 To\'lovlar', '🔓 Chiqish'],
        ],
        resize_keyboard=True,
    )


def services_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [
            ['🛡️ Antiplagiat', '🔗 DOI olish'],
            ['📑 UDK olish', '🌐 Ilmiy tarjima'],
            ['📋 Maqola namuna', '📖 Kitob nashr'],
            [BACK],
        ],
        resize_keyboard=True,
    )


def cancel_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup([[CANCEL]], resize_keyboard=True)


def back_cancel_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup([[BACK, CANCEL]], resize_keyboard=True)


def quality_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [
            ['Quyi sifatli', 'O\'rta sifatli'],
            ['Yuqori sifatli'],
            [CANCEL],
        ],
        resize_keyboard=True,
    )


def journal_inline_keyboard(journals: list, prefix: str = 'j') -> InlineKeyboardMarkup:
    rows = []
    for j in journals[:20]:
        jid = str(j.get('id', ''))
        name = (j.get('name') or 'Jurnal')[:40]
        rows.append([InlineKeyboardButton(name, callback_data=f'{prefix}:{jid}')])
    rows.append([InlineKeyboardButton(CANCEL, callback_data=f'{prefix}:cancel')])
    return InlineKeyboardMarkup(rows)


def translation_lang_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [
            ['uz → en', 'uz → ru'],
            ['ru → uz', 'en → uz'],
            [CANCEL],
        ],
        resize_keyboard=True,
    )
