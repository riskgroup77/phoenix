"""Jurnal tanlash callbacklari (maqola + kitob)."""
from __future__ import annotations

from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

from bot.journal_browse import (
    _key,
    filter_menu_keyboard,
    filter_summary_text,
    send_filter_menu,
    show_journal_page,
    subject_picker_keyboard,
    type_picker_keyboard,
)
from bot.journal_categories import PUBLICATION_TYPES, SUBJECT_AREAS
from bot.session import get_client_from_context


async def process_journal_pick_callback(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    *,
    prefix: str,
    journal_state: int,
    search_state: int,
    on_selected,
    cancel_message: str,
    cancel_keyboard,
) -> int:
    query = update.callback_query
    if not query or context.user_data is None:
        return ConversationHandler.END
    await query.answer()
    data = query.data or ''
    client = get_client_from_context(context)
    p = prefix
    heading = context.user_data.get(f'{p}_heading', 'Jurnal tanlash')

    def _summary():
        total = len(context.user_data.get(_key(p, 'journals')) or [])
        return filter_summary_text(context, total, prefix=p, heading=heading)

    if data == f'{p}f:menu':
        context.user_data.pop(_key(p, 'browse_msg_id'), None)
        await query.edit_message_text(_summary(), parse_mode='Markdown', reply_markup=filter_menu_keyboard(context, p))
        return journal_state

    if data == f'{p}f:t':
        await query.edit_message_text("📚 *Nashr turini tanlang:*", parse_mode='Markdown', reply_markup=type_picker_keyboard(p, 0))
        return journal_state

    if data.startswith(f'{p}f:tp:'):
        await query.edit_message_text("📚 *Nashr turini tanlang:*", parse_mode='Markdown', reply_markup=type_picker_keyboard(p, int(data.split(':')[-1])))
        return journal_state

    if data.startswith(f'{p}f:ti:'):
        raw = data.split(':')[-1]
        context.user_data[_key(p, 'filter_type')] = '' if raw == 'all' else PUBLICATION_TYPES[int(raw)]
        await query.edit_message_text(_summary(), parse_mode='Markdown', reply_markup=filter_menu_keyboard(context, p))
        return journal_state

    if data == f'{p}f:s':
        await query.edit_message_text(
            "🔬 *Soha / yo'nalishni tanlang:*\n\nJurnal nomi yoki tavsifida qidiriladi.",
            parse_mode='Markdown',
            reply_markup=subject_picker_keyboard(p, 0),
        )
        return journal_state

    if data.startswith(f'{p}f:sp:'):
        await query.edit_message_text(
            "🔬 *Soha / yo'nalishni tanlang:*",
            parse_mode='Markdown',
            reply_markup=subject_picker_keyboard(p, int(data.split(':')[-1])),
        )
        return journal_state

    if data.startswith(f'{p}f:si:'):
        raw = data.split(':')[-1]
        context.user_data[_key(p, 'filter_subject')] = '' if raw == 'all' else SUBJECT_AREAS[int(raw)]
        await query.edit_message_text(_summary(), parse_mode='Markdown', reply_markup=filter_menu_keyboard(context, p))
        return journal_state

    if data == f'{p}f:search':
        await query.edit_message_text(
            "🔍 Jurnal *nomi* yoki *tavsifi* bo'yicha qidiruv so'zini yozing:\n\n(/cancel — bekor qilish)",
            parse_mode='Markdown',
        )
        return search_state

    if data == f'{p}f:clear':
        context.user_data[_key(p, 'filter_type')] = ''
        context.user_data[_key(p, 'filter_subject')] = ''
        context.user_data[_key(p, 'filter_search')] = ''
        await query.edit_message_text(_summary(), parse_mode='Markdown', reply_markup=filter_menu_keyboard(context, p))
        return journal_state

    if data == f'{p}f:go':
        if not client:
            return ConversationHandler.END
        await show_journal_page(update, context, client, page=0, prefix=p)
        return journal_state

    if data.startswith(f'{p}b:'):
        if data.endswith(':noop') or not client:
            return journal_state
        await show_journal_page(update, context, client, page=int(data.split(':')[-1]), prefix=p)
        return journal_state

    if data == f'{p}j:cancel':
        context.user_data.pop(_key(p, 'browse_msg_id'), None)
        try:
            await query.message.delete()
        except Exception:
            await query.edit_message_text("❌ Bekor qilindi.")
        if update.effective_chat:
            await context.bot.send_message(update.effective_chat.id, cancel_message, reply_markup=cancel_keyboard)
        return ConversationHandler.END

    if data.startswith(f'{p}j:'):
        jid = data.split(':', 1)[1]
        context.user_data[_key(p, 'journal_id')] = jid
        journals = context.user_data.get(_key(p, 'journals')) or []
        jname = next((j.get('name') for j in journals if str(j.get('id')) == jid), 'Jurnal')
        context.user_data[_key(p, 'journal_name')] = jname
        if prefix == 'submit':
            context.user_data['submit_journal_id'] = jid
            context.user_data['submit_journal_name'] = jname
        context.user_data.pop(_key(p, 'browse_msg_id'), None)
        try:
            await query.message.delete()
        except Exception:
            pass
        return await on_selected(update, context, jid, jname)

    return journal_state


async def process_journal_search_message(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    *,
    prefix: str,
    journal_state: int,
    heading: str,
) -> int:
    if not update.message or context.user_data is None:
        return ConversationHandler.END
    context.user_data[_key(prefix, 'filter_search')] = (update.message.text or '').strip()
    await update.message.reply_text(f"✅ Qidiruv: «{context.user_data[_key(prefix, 'filter_search')]}»")
    await send_filter_menu(update, context, prefix=prefix, heading=heading)
    return journal_state
