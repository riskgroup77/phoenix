"""Ro'yxatlarni filtr + sahifalab ko'rsatish (maqolalar, arxiv, to'plamlar...)."""
from __future__ import annotations

import logging

from asgiref.sync import sync_to_async
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from bot.app_links import (
    archive_url,
    article_url,
    articles_url,
    dashboard_url,
    profile_url,
    publications_url,
    submit_article_url,
    translation_url,
    translations_url,
)
from bot.constants import SERVICE_LABELS, STATUS_LABELS, TX_STATUS_LABELS
from bot.handlers.auth import require_author
from bot.keyboards import author_main_keyboard
from bot.list_browse import app_link_button, carousel_keyboard, send_or_edit_carousel
from bot.payment_helpers import app_payments_url, open_app_keyboard, pending_payments_keyboard
from bot.session import get_client_from_context
from bot.utils import format_api_error, format_money, truncate

logger = logging.getLogger(__name__)

ARTICLE_FILTERS = {
    'all': 'Barchasi',
    'progress': 'Jarayonda',
    'published': 'Nashr etilgan',
    'rejected': 'Rad etilgan',
}
PROGRESS_STATUSES = {
    'Yangi', 'WithEditor', 'PlagiarismReview', 'QabulQilingan',
    'Revision', 'Accepted', 'NashrgaYuborilgan', 'PaymentCompleted', 'Draft',
}


def _filter_articles(articles: list[dict], flt: str) -> list[dict]:
    if flt == 'published':
        return [a for a in articles if a.get('status') == 'Published']
    if flt == 'rejected':
        return [a for a in articles if a.get('status') == 'Rejected']
    if flt == 'progress':
        return [a for a in articles if a.get('status') in PROGRESS_STATUSES]
    return articles


def _article_caption(a: dict, idx: int, total: int) -> str:
    st = STATUS_LABELS.get(a.get('status', ''), a.get('status', ''))
    lines = [
        f"📄 *Maqolalarim* — {idx}/{total}",
        '',
        f"*{truncate(a.get('title', '—'), 120)}*",
        f"📌 Holat: {st}",
    ]
    if a.get('journal_name'):
        lines.append(f"📚 {truncate(a['journal_name'], 60)}")
    if a.get('created_at'):
        lines.append(f"📅 {str(a['created_at'])[:10]}")
    return '\n'.join(lines)


async def _show_article_page(update, context, page: int = 0) -> None:
    client = get_client_from_context(context)
    if not client:
        return
    articles = context.user_data.get('lv_articles') or []
    flt = context.user_data.get('lv_art_filter', 'all')
    filtered = _filter_articles(articles, flt)
    if not filtered:
        text = f"📄 Filtr «{ARTICLE_FILTERS.get(flt, flt)}» bo'yicha maqola topilmadi."
        kb = carousel_keyboard(
            'lv:art',
            0,
            1,
            extra_rows=[
                [InlineKeyboardButton('🔎 Filtr', callback_data='lv:art:menu')],
                [app_link_button(client, '📱 Ilovada ochish', articles_url(client))],
            ],
        )
        await send_or_edit_carousel(update, context, prefix='lv:art', text=text, keyboard=kb, msg_key='lv_msg_id')
        return

    page = max(0, min(page, len(filtered) - 1))
    context.user_data['lv_art_page'] = page
    a = filtered[page]
    aid = str(a.get('id', ''))
    kb = carousel_keyboard(
        'lv:art',
        page,
        len(filtered),
        action_rows=[[app_link_button(client, '📱 Ilovada batafsil', article_url(client, aid))]] if aid else [],
        extra_rows=[[InlineKeyboardButton('🔎 Filtr', callback_data='lv:art:menu')]],
    )
    await send_or_edit_carousel(
        update,
        context,
        prefix='lv:art',
        text=_article_caption(a, page + 1, len(filtered)),
        keyboard=kb,
        msg_key='lv_msg_id',
    )


async def show_articles(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client or not update.message:
        return
    try:
        articles = await sync_to_async(client.articles_mine)()
        if not articles:
            await update.message.reply_text(
                "📄 Hozircha maqolalar yo'q.\n\nMaqola yuborishni boshlang yoki ilovada ko'ring.",
                reply_markup=carousel_keyboard(
                    'lv:art',
                    0,
                    1,
                    action_rows=[
                        [app_link_button(client, '📝 Ilovada yuborish', submit_article_url(client))],
                    ],
                ),
            )
            await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
            return
        context.user_data['lv_articles'] = articles
        context.user_data['lv_art_filter'] = context.user_data.get('lv_art_filter', 'all')
        context.user_data.pop('lv_msg_id', None)
        await _show_article_page(update, context, 0)
        await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
    except Exception as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


def _collection_caption(issue: dict, idx: int, total: int) -> str:
    lines = [
        f"📚 *To'plamlarim* — {idx}/{total}",
        '',
        f"*{truncate(issue.get('title') or issue.get('name') or 'Son', 100)}*",
    ]
    if issue.get('journal_name'):
        lines.append(f"📖 Jurnal: {issue['journal_name']}")
    if issue.get('issue_number'):
        lines.append(f"🔢 Son: {issue['issue_number']}")
    if issue.get('publication_date'):
        lines.append(f"📅 {str(issue['publication_date'])[:10]}")
    url = issue.get('collection_file_url') or issue.get('collection_url')
    if url:
        lines.append('\n📎 To\'plam fayli mavjud — tugma orqali yuklab oling.')
    return '\n'.join(lines)


async def _show_collection_page(update, context, page: int = 0) -> None:
    client = get_client_from_context(context)
    issues = context.user_data.get('lv_collections') or []
    if not issues or not client:
        return
    page = max(0, min(page, len(issues) - 1))
    issue = issues[page]
    url = issue.get('collection_file_url') or issue.get('collection_url')
    action = [[app_link_button(client, '📥 Yuklab olish', url)]] if url else []
    kb = carousel_keyboard('lv:col', page, len(issues), action_rows=action)
    await send_or_edit_carousel(
        update, context, prefix='lv:col',
        text=_collection_caption(issue, page + 1, len(issues)),
        keyboard=kb, msg_key='lv_msg_id',
    )


async def show_collections(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client or not update.message:
        return
    try:
        issues = await sync_to_async(client.issues)()
        if not issues:
            await update.message.reply_text("📚 To'plamlar hozircha yo'q.", reply_markup=open_app_keyboard(client))
            await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
            return
        context.user_data['lv_collections'] = issues
        context.user_data.pop('lv_msg_id', None)
        await _show_collection_page(update, context, 0)
        await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
    except Exception as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def _show_publication_page(update, context, page: int = 0) -> None:
    client = get_client_from_context(context)
    pubs = context.user_data.get('lv_publications') or []
    if not pubs or not client:
        return
    page = max(0, min(page, len(pubs) - 1))
    p = pubs[page]
    text = (
        f"📖 *Muallif nashrlari* — {page + 1}/{len(pubs)}\n\n"
        f"*{truncate(p.get('title', '—'), 120)}*\n"
    )
    if p.get('journal_name'):
        text += f"📚 {p['journal_name']}\n"
    if p.get('doi'):
        text += f"🔗 DOI: `{p['doi']}`\n"
    kb = carousel_keyboard(
        'lv:pub', page, len(pubs),
        action_rows=[[app_link_button(client, '📱 Ilovada', publications_url(client))]],
    )
    await send_or_edit_carousel(update, context, prefix='lv:pub', text=text, keyboard=kb, msg_key='lv_msg_id')


async def show_publications(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client or not update.message:
        return
    try:
        pubs = await sync_to_async(client.my_publications)()
        if not pubs:
            await update.message.reply_text("📖 Muallif nashrlari ro'yxati bo'sh.", reply_markup=open_app_keyboard(client))
            await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
            return
        context.user_data['lv_publications'] = pubs
        context.user_data.pop('lv_msg_id', None)
        await _show_publication_page(update, context, 0)
        await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
    except Exception as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def _show_translation_page(update, context, page: int = 0) -> None:
    client = get_client_from_context(context)
    items = context.user_data.get('lv_translations') or []
    if not items or not client:
        return
    page = max(0, min(page, len(items) - 1))
    t = items[page]
    tid = str(t.get('id', ''))
    text = (
        f"🌐 *Tarjimalarim* — {page + 1}/{len(items)}\n\n"
        f"*{truncate(t.get('title', '—'), 100)}*\n"
        f"📌 {t.get('status', '—')}\n"
    )
    if t.get('target_language'):
        text += f"🗣 Til: {t['target_language']}\n"
    action = [[app_link_button(client, '📱 Ilovada batafsil', translation_url(client, tid))]] if tid else []
    kb = carousel_keyboard('lv:trn', page, len(items), action_rows=action)
    await send_or_edit_carousel(update, context, prefix='lv:trn', text=text, keyboard=kb, msg_key='lv_msg_id')


async def show_translations(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client or not update.message:
        return
    try:
        items = await sync_to_async(client.translations)()
        if not items:
            await update.message.reply_text(
                "🌐 Tarjima buyurtmalari yo'q.",
                reply_markup=carousel_keyboard(
                    'lv:trn', 0, 1,
                    action_rows=[[app_link_button(client, '✨ Tarjima xizmati', translations_url(client))]],
                ),
            )
            await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
            return
        context.user_data['lv_translations'] = items
        context.user_data.pop('lv_msg_id', None)
        await _show_translation_page(update, context, 0)
        await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
    except Exception as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def _show_archive_page(update, context, page: int = 0) -> None:
    client = get_client_from_context(context)
    items = context.user_data.get('lv_archive') or []
    if not items or not client:
        return
    page = max(0, min(page, len(items) - 1))
    item = items[page]
    label = item.get('label') or item.get('title') or item.get('type', 'Hujjat')
    url = item.get('download_url') or item.get('view_url') or ''
    text = f"📁 *Arxiv* — {page + 1}/{len(items)}\n\n*{truncate(label, 100)}*"
    action = [[app_link_button(client, '📥 Ochish / yuklab olish', url)]] if url else []
    action.append([app_link_button(client, '📱 Barcha arxiv (ilova)', archive_url(client))])
    kb = carousel_keyboard('lv:arc', page, len(items), action_rows=action)
    await send_or_edit_carousel(update, context, prefix='lv:arc', text=text, keyboard=kb, msg_key='lv_msg_id')


async def show_archive(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client or not update.message:
        return
    try:
        data = await sync_to_async(client.archive)()
        items = data.get('items') or []
        if not items:
            await update.message.reply_text("📁 Arxiv hujjatlar hozircha bo'sh.", reply_markup=open_app_keyboard(client))
            await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
            return
        context.user_data['lv_archive'] = items
        context.user_data.pop('lv_msg_id', None)
        await _show_archive_page(update, context, 0)
        await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
    except Exception as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def _show_notification_page(update, context, page: int = 0) -> None:
    client = get_client_from_context(context)
    notes = context.user_data.get('lv_notifications') or []
    if not client:
        return
    page = max(0, min(page, max(len(notes) - 1, 0)))
    if not notes:
        text = "🔔 Bildirishnomalar yo'q."
        kb = open_app_keyboard(client)
        await send_or_edit_carousel(update, context, prefix='lv:not', text=text, keyboard=kb, msg_key='lv_msg_id')
        return
    n = notes[page]
    text = (
        f"🔔 *Bildirishnomalar* — {page + 1}/{len(notes)}\n\n"
        f"{truncate(n.get('message') or n.get('title') or '—', 350)}"
    )
    kb = carousel_keyboard(
        'lv:not', page, len(notes),
        action_rows=[[app_link_button(client, '📱 Ilovada', profile_url(client, 'notifications'))]],
    )
    await send_or_edit_carousel(update, context, prefix='lv:not', text=text, keyboard=kb, msg_key='lv_msg_id')


async def show_notifications(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client or not update.message:
        return
    try:
        notes = await sync_to_async(client.notifications)()
        unread = await sync_to_async(client.unread_count)()
        if unread:
            await sync_to_async(client.mark_all_read)()
        context.user_data['lv_notifications'] = notes
        context.user_data.pop('lv_msg_id', None)
        if not notes:
            await update.message.reply_text("🔔 Bildirishnomalar yo'q.", reply_markup=open_app_keyboard(client))
        else:
            await update.message.reply_text(f"✅ {unread} ta yangi bildirishnoma o'qildi deb belgilandi.")
            await _show_notification_page(update, context, 0)
        await update.message.reply_text("Menyu:", reply_markup=author_main_keyboard())
    except Exception as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())


async def list_view_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not context.user_data:
        return
    await query.answer()
    data = query.data or ''

    if data == 'lv:art:menu':
        client = get_client_from_context(context)
        rows = [
            [InlineKeyboardButton(f"{ARTICLE_FILTERS[k]} {'✓' if context.user_data.get('lv_art_filter') == k else ''}".strip(), callback_data=f'lv:art:f:{k}')]
            for k in ('all', 'progress', 'published', 'rejected')
        ]
        kb = InlineKeyboardMarkup(rows + [[InlineKeyboardButton('⬅️ Orqaga', callback_data='lv:art:p:0')]])
        await query.edit_message_text("🔎 *Maqola filtri:*", parse_mode='Markdown', reply_markup=kb)
        return

    if data.startswith('lv:art:f:'):
        context.user_data['lv_art_filter'] = data.split(':')[-1]
        await _show_article_page(update, context, 0)
        return

    if data.startswith('lv:art:p:'):
        await _show_article_page(update, context, int(data.split(':')[-1]))
        return

    if data.startswith('lv:col:p:'):
        await _show_collection_page(update, context, int(data.split(':')[-1]))
        return

    if data.startswith('lv:pub:p:'):
        await _show_publication_page(update, context, int(data.split(':')[-1]))
        return

    if data.startswith('lv:trn:p:'):
        await _show_translation_page(update, context, int(data.split(':')[-1]))
        return

    if data.startswith('lv:arc:p:'):
        await _show_archive_page(update, context, int(data.split(':')[-1]))
        return

    if data.startswith('lv:not:p:'):
        await _show_notification_page(update, context, int(data.split(':')[-1]))
        return
