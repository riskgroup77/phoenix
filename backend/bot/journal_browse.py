"""Jurnal filtrlash va rasmli ko'rsatish — maqola va kitob uchun."""
from __future__ import annotations

import os
from typing import Optional

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, InputMediaPhoto

from bot.api_client import PhonixApiClient
from bot.journal_categories import PUBLICATION_TYPES, SUBJECT_AREAS
from bot.utils import format_money, truncate

SUBJECTS_PER_PAGE = 6
TYPES_PER_PAGE = 4


def _key(prefix: str, name: str) -> str:
    return f'{prefix}_{name}'


def init_journal_session(context, prefix: str, journals: list[dict]) -> None:
    context.user_data[_key(prefix, 'journals')] = journals
    context.user_data[_key(prefix, 'filter_type')] = ''
    context.user_data[_key(prefix, 'filter_subject')] = ''
    context.user_data[_key(prefix, 'filter_search')] = ''
    context.user_data.pop(_key(prefix, 'browse_msg_id'), None)


def filters(context, prefix: str = 'submit') -> dict:
    ud = context.user_data or {}
    return {
        'type': (ud.get(_key(prefix, 'filter_type')) or '').strip(),
        'subject': (ud.get(_key(prefix, 'filter_subject')) or '').strip(),
        'search': (ud.get(_key(prefix, 'filter_search')) or '').strip(),
    }


def filter_journals(journals: list[dict], *, filter_type: str = '', filter_subject: str = '', search: str = '') -> list[dict]:
    out: list[dict] = []
    for j in journals:
        if filter_type and (j.get('category_name') or '') != filter_type:
            continue
        if filter_subject:
            sub = filter_subject.lower()
            name = (j.get('name') or '').lower()
            desc = (j.get('description') or '').lower()
            if sub not in name and sub not in desc:
                continue
        if search:
            q = search.strip().lower()
            if q not in (j.get('name') or '').lower() and q not in (j.get('description') or '').lower():
                continue
        out.append(j)
    return out


def filtered_from_context(context, prefix: str = 'submit') -> list[dict]:
    f = filters(context, prefix)
    all_j = (context.user_data or {}).get(_key(prefix, 'journals')) or []
    return filter_journals(all_j, filter_type=f['type'], filter_subject=f['subject'], search=f['search'])


def resolve_journal_image(journal: dict, client: PhonixApiClient) -> Optional[str]:
    url = journal.get('image_url')
    if not url:
        return None
    if str(url).startswith('http'):
        return str(url)
    media_base = os.getenv('MEDIA_BASE_URL', 'https://api.ilmiyfaoliyat.uz/media/').rstrip('/') + '/'
    path = str(url)
    if path.startswith('/media/'):
        path = path[len('/media/') :]
    elif path.startswith('media/'):
        path = path[len('media/') :]
    path = path.lstrip('/')
    return f"{media_base}{path}" if path else None


def journal_price_label(journal: dict) -> tuple[str, str]:
    pricing = journal.get('pricing_type') or journal.get('pricingType') or 'fixed'
    pub_fee = float(journal.get('publication_fee') or journal.get('publicationFee') or 0)
    price_per_page = float(journal.get('price_per_page') or journal.get('pricePerPage') or 0)
    if pricing == 'fixed' or (pub_fee > 0 and not price_per_page):
        return format_money(pub_fee), "To'liq to'lov"
    if price_per_page > 0:
        return f"{format_money(price_per_page)} / sahifa", 'Sahifabop narx'
    return 'Bepul', "To'lov talab qilinmaydi"


def journal_payment_model(journal: dict) -> str:
    model = (journal.get('payment_model') or 'pre-payment').lower()
    return "Oldindan to'lov" if model == 'pre-payment' else "Keyin to'lov"


def format_journal_caption(journal: dict, index: int, total: int) -> str:
    name = journal.get('name') or 'Jurnal'
    price_main, price_sub = journal_price_label(journal)
    lines = [f"📚 *{name}*", '']
    if journal.get('issn'):
        lines.append(f"📖 ISSN: `{journal['issn']}`")
    if journal.get('category_name'):
        lines.append(f"📂 {journal['category_name']}")
    if journal.get('admin_name'):
        lines.append(f"👤 Admin: {journal['admin_name']}")
    lines.append(f"💰 *{price_main}* — {price_sub}")
    lines.append(f"💳 {journal_payment_model(journal)}")
    if journal.get('description'):
        lines.extend(['', f"_{truncate(journal['description'], 280)}_"])
    lines.extend(['', f"📄 *{index} / {total}*"])
    return '\n'.join(lines)


def filter_summary_text(context, total_all: int, *, prefix: str = 'submit', heading: str) -> str:
    f = filters(context, prefix)
    shown = len(filtered_from_context(context, prefix))
    return (
        f"{heading}\n\n"
        "Avval filtrlang, keyin jurnallarni rasmlari va ma'lumotlari bilan ko'ring.\n\n"
        "🔎 *Filtrlar:*\n"
        f"• Nashr turi: {f['type'] or 'Barchasi'}\n"
        f"• Soha: {f['subject'] or 'Barchasi'}\n"
        f"• Qidiruv: {f['search'] or '—'}\n\n"
        f"📊 Jami: *{total_all}* | Ko'rsatiladi: *{shown}*"
    )


def filter_menu_keyboard(context, prefix: str = 'submit') -> InlineKeyboardMarkup:
    shown = len(filtered_from_context(context, prefix))
    p = prefix
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton('📚 Nashr turi', callback_data=f'{p}f:t'),
            InlineKeyboardButton('🔬 Soha', callback_data=f'{p}f:s'),
        ],
        [
            InlineKeyboardButton('🔍 Qidiruv', callback_data=f'{p}f:search'),
            InlineKeyboardButton('🔄 Tozalash', callback_data=f'{p}f:clear'),
        ],
        [InlineKeyboardButton(f"📋 Jurnallarni ko'rish ({shown})", callback_data=f'{p}f:go')],
        [InlineKeyboardButton('❌ Bekor qilish', callback_data=f'{p}j:cancel')],
    ])


def type_picker_keyboard(prefix: str = 'submit', page: int = 0) -> InlineKeyboardMarkup:
    start = page * TYPES_PER_PAGE
    chunk = PUBLICATION_TYPES[start : start + TYPES_PER_PAGE]
    rows: list[list[InlineKeyboardButton]] = []
    for i, name in enumerate(chunk):
        idx = start + i
        rows.append([InlineKeyboardButton(truncate(name, 28), callback_data=f'{prefix}f:ti:{idx}')])
    rows.append([InlineKeyboardButton('📂 Barcha turlar', callback_data=f'{prefix}f:ti:all')])
    nav: list[InlineKeyboardButton] = []
    if page > 0:
        nav.append(InlineKeyboardButton('◀️', callback_data=f'{prefix}f:tp:{page - 1}'))
    if start + TYPES_PER_PAGE < len(PUBLICATION_TYPES):
        nav.append(InlineKeyboardButton('▶️', callback_data=f'{prefix}f:tp:{page + 1}'))
    if nav:
        rows.append(nav)
    rows.append([InlineKeyboardButton('⬅️ Filtr menyusi', callback_data=f'{prefix}f:menu')])
    return InlineKeyboardMarkup(rows)


def subject_picker_keyboard(prefix: str = 'submit', page: int = 0) -> InlineKeyboardMarkup:
    start = page * SUBJECTS_PER_PAGE
    chunk = SUBJECT_AREAS[start : start + SUBJECTS_PER_PAGE]
    rows: list[list[InlineKeyboardButton]] = []
    for i, name in enumerate(chunk):
        idx = start + i
        rows.append([InlineKeyboardButton(truncate(name, 32), callback_data=f'{prefix}f:si:{idx}')])
    rows.append([InlineKeyboardButton('📂 Barcha sohalar', callback_data=f'{prefix}f:si:all')])
    nav: list[InlineKeyboardButton] = []
    if page > 0:
        nav.append(InlineKeyboardButton('◀️', callback_data=f'{prefix}f:sp:{page - 1}'))
    if start + SUBJECTS_PER_PAGE < len(SUBJECT_AREAS):
        nav.append(InlineKeyboardButton('▶️', callback_data=f'{prefix}f:sp:{page + 1}'))
    if nav:
        rows.append(nav)
    rows.append([InlineKeyboardButton('⬅️ Filtr menyusi', callback_data=f'{prefix}f:menu')])
    return InlineKeyboardMarkup(rows)


def browse_keyboard(journal: dict, page: int, total: int, prefix: str = 'submit') -> InlineKeyboardMarkup:
    jid = str(journal.get('id', ''))
    rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton('✅ Tanlash', callback_data=f'{prefix}j:{jid}')],
    ]
    nav: list[InlineKeyboardButton] = []
    if page > 0:
        nav.append(InlineKeyboardButton('◀️', callback_data=f'{prefix}b:{page - 1}'))
    nav.append(InlineKeyboardButton(f'{page + 1}/{total}', callback_data=f'{prefix}b:noop'))
    if page < total - 1:
        nav.append(InlineKeyboardButton('▶️', callback_data=f'{prefix}b:{page + 1}'))
    rows.append(nav)
    rows.append([InlineKeyboardButton('🔎 Filtr', callback_data=f'{prefix}f:menu')])
    return InlineKeyboardMarkup(rows)


async def send_filter_menu(update, context, *, prefix: str = 'submit', heading: str, edit: bool = False) -> None:
    total = len((context.user_data or {}).get(_key(prefix, 'journals')) or [])
    text = filter_summary_text(context, total, prefix=prefix, heading=heading)
    kb = filter_menu_keyboard(context, prefix)
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(text, parse_mode='Markdown', reply_markup=kb)
        return
    if update.message:
        await update.message.reply_text(text, parse_mode='Markdown', reply_markup=kb)


async def show_journal_page(update, context, client: PhonixApiClient, page: int = 0, prefix: str = 'submit') -> None:
    journals = filtered_from_context(context, prefix)
    query = update.callback_query
    chat_id = update.effective_chat.id if update.effective_chat else None
    if not chat_id:
        return

    if not journals:
        text = "❌ Filtr bo'yicha jurnal topilmadi.\n\nFiltrni o'zgartiring yoki tozalang."
        if query:
            await query.edit_message_text(text, reply_markup=filter_menu_keyboard(context, prefix))
        return

    page = max(0, min(page, len(journals) - 1))
    context.user_data[_key(prefix, 'journal_page')] = page
    journal = journals[page]
    caption = format_journal_caption(journal, page + 1, len(journals))
    kb = browse_keyboard(journal, page, len(journals), prefix)
    image_url = resolve_journal_image(journal, client)
    msg_key = _key(prefix, 'browse_msg_id')
    msg_id = context.user_data.get(msg_key)

    if query and msg_id:
        try:
            if image_url:
                await context.bot.edit_message_media(
                    chat_id=chat_id,
                    message_id=msg_id,
                    media=InputMediaPhoto(media=image_url, caption=caption, parse_mode='Markdown'),
                    reply_markup=kb,
                )
            else:
                await context.bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=msg_id,
                    text=caption,
                    parse_mode='Markdown',
                    reply_markup=kb,
                )
            return
        except Exception:
            pass

    if query:
        try:
            await query.message.delete()
        except Exception:
            pass

    if image_url:
        sent = await context.bot.send_photo(chat_id, photo=image_url, caption=caption, parse_mode='Markdown', reply_markup=kb)
    else:
        sent = await context.bot.send_message(chat_id, caption, parse_mode='Markdown', reply_markup=kb)
    context.user_data[msg_key] = sent.message_id
