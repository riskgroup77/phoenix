"""Ro'yxatlarni sahifalab ko'rsatish (carousel) — barcha bo'limlar uchun."""
from __future__ import annotations

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from bot.api_client import PhonixApiClient


def nav_row(prefix: str, page: int, total: int) -> list[InlineKeyboardButton]:
    row: list[InlineKeyboardButton] = []
    if page > 0:
        row.append(InlineKeyboardButton('◀️', callback_data=f'{prefix}:p:{page - 1}'))
    row.append(InlineKeyboardButton(f'{page + 1}/{total}', callback_data=f'{prefix}:noop'))
    if page < total - 1:
        row.append(InlineKeyboardButton('▶️', callback_data=f'{prefix}:p:{page + 1}'))
    return row


def carousel_keyboard(
    prefix: str,
    page: int,
    total: int,
    *,
    action_rows: list[list[InlineKeyboardButton]] | None = None,
    extra_rows: list[list[InlineKeyboardButton]] | None = None,
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = list(action_rows or [])
    if total > 1:
        rows.append(nav_row(prefix, page, total))
    rows.extend(extra_rows or [])
    return InlineKeyboardMarkup(rows)


async def send_or_edit_carousel(
    update,
    context,
    *,
    prefix: str,
    text: str,
    keyboard: InlineKeyboardMarkup,
    msg_key: str = 'list_msg_id',
) -> None:
    chat_id = update.effective_chat.id if update.effective_chat else None
    if not chat_id:
        return
    query = update.callback_query
    stored_id = (context.user_data or {}).get(msg_key)

    if query and stored_id:
        try:
            await context.bot.edit_message_text(
                chat_id=chat_id,
                message_id=stored_id,
                text=text,
                parse_mode='Markdown',
                reply_markup=keyboard,
                disable_web_page_preview=True,
            )
            return
        except Exception:
            pass

    if query:
        try:
            await query.message.delete()
        except Exception:
            pass

    origin = update.message if update.message else (query.message if query else None)
    if origin:
        sent = await origin.reply_text(
            text,
            parse_mode='Markdown',
            reply_markup=keyboard,
            disable_web_page_preview=True,
        )
    else:
        sent = await context.bot.send_message(
            chat_id,
            text,
            parse_mode='Markdown',
            reply_markup=keyboard,
            disable_web_page_preview=True,
        )
    context.user_data[msg_key] = sent.message_id


def app_link_button(client: PhonixApiClient, label: str, url: str) -> InlineKeyboardButton:
    return InlineKeyboardButton(label, url=url)
