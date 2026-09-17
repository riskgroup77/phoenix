"""Article submission flow."""
import logging

from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

from bot.api_client import ApiError
from bot.constants import (
    CANCEL,
    SUBMIT_ABSTRACT,
    SUBMIT_FILE,
    SUBMIT_JOURNAL,
    SUBMIT_JOURNAL_SEARCH,
    SUBMIT_KEYWORDS,
    SUBMIT_PAGES,
    SUBMIT_TITLE,
)
from bot.handlers.auth import require_author
from bot.journal_browse import init_journal_session, send_filter_menu
from bot.journal_callbacks import process_journal_pick_callback, process_journal_search_message
from bot.keyboards import author_main_keyboard, cancel_keyboard
from bot.payment_helpers import reply_with_payment_button
from bot.session import get_client_from_context, save_session
from bot.utils import format_api_error, format_money, parse_keywords

logger = logging.getLogger(__name__)

SUBMIT_HEADING = "📝 *Maqola yuborish* — 1-qadam: Jurnal tanlash"


async def _download_doc(update: Update, context: ContextTypes.DEFAULT_TYPE) -> tuple[bytes, str]:
    doc = update.message.document
    tg_file = await context.bot.get_file(doc.file_id)
    data = await tg_file.download_as_bytearray()
    return bytes(data), doc.file_name or 'document.docx'


async def _on_journal_selected(update: Update, context: ContextTypes.DEFAULT_TYPE, jid: str, jname: str) -> int:
    if update.effective_chat:
        await context.bot.send_message(
            update.effective_chat.id,
            f"✅ Jurnal: *{jname}*\n\n2-qadam: Maqola sarlavhasini yozing:",
            parse_mode='Markdown',
            reply_markup=cancel_keyboard(),
        )
    return SUBMIT_TITLE


async def article_submit_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await require_author(update, context):
        return ConversationHandler.END
    client = get_client_from_context(context)
    if not client:
        return ConversationHandler.END
    try:
        journals = await sync_to_async(client.journals)()
        if not journals:
            if update.message:
                await update.message.reply_text("❌ Jurnallar topilmadi.", reply_markup=author_main_keyboard())
            return ConversationHandler.END
        init_journal_session(context, 'submit', journals)
        context.user_data['submit_journals'] = journals
        context.user_data['submit_heading'] = SUBMIT_HEADING
        await send_filter_menu(update, context, prefix='submit', heading=SUBMIT_HEADING)
        return SUBMIT_JOURNAL
    except Exception as e:
        if update.message:
            await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())
        return ConversationHandler.END


async def article_submit_search(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and update.message.text == CANCEL:
        await update.message.reply_text("Filtr menyusiga qaytdingiz.")
        await send_filter_menu(update, context, prefix='submit', heading=SUBMIT_HEADING)
        return SUBMIT_JOURNAL
    return await process_journal_search_message(
        update, context, prefix='submit', journal_state=SUBMIT_JOURNAL, heading=SUBMIT_HEADING,
    )


async def article_submit_journal_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    return await process_journal_pick_callback(
        update,
        context,
        prefix='submit',
        journal_state=SUBMIT_JOURNAL,
        search_state=SUBMIT_JOURNAL_SEARCH,
        on_selected=_on_journal_selected,
        cancel_message="Maqola yuborish bekor qilindi.",
        cancel_keyboard=author_main_keyboard,
    )


async def article_submit_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        if update.message.text == CANCEL:
            await update.message.reply_text("❌ Bekor qilindi.", reply_markup=author_main_keyboard())
            return ConversationHandler.END
        context.user_data['submit_title'] = update.message.text.strip()
        await update.message.reply_text("3-qadam: Annotatsiya (qisqa tavsif):")
    return SUBMIT_ABSTRACT


async def article_submit_abstract(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['submit_abstract'] = update.message.text.strip()
        await update.message.reply_text("4-qadam: Kalit so'zlar (vergul bilan):")
    return SUBMIT_KEYWORDS


async def article_submit_keywords(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['submit_keywords'] = update.message.text.strip()
        await update.message.reply_text("5-qadam: Sahifalar soni (raqam, masalan: 8):", reply_markup=cancel_keyboard())
    return SUBMIT_PAGES


async def article_submit_pages(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        if update.message.text == CANCEL:
            await update.message.reply_text("❌ Bekor qilindi.", reply_markup=author_main_keyboard())
            return ConversationHandler.END
        try:
            pages = max(1, min(500, int((update.message.text or '1').strip())))
        except ValueError:
            await update.message.reply_text("❌ Raqam kiriting (masalan: 8):")
            return SUBMIT_PAGES
        context.user_data['submit_pages'] = pages
        await update.message.reply_text(
            "6-qadam: Maqola faylini yuboring (DOC yoki DOCX):",
            reply_markup=cancel_keyboard(),
        )
    return SUBMIT_FILE


async def article_submit_file(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or context.user_data is None:
        return ConversationHandler.END
    if update.message.text == CANCEL:
        await update.message.reply_text("❌ Bekor qilindi.", reply_markup=author_main_keyboard())
        return ConversationHandler.END
    if not update.message.document:
        await update.message.reply_text("❌ DOC/DOCX fayl yuboring.")
        return SUBMIT_FILE
    fname = (update.message.document.file_name or '').lower()
    if not (fname.endswith('.doc') or fname.endswith('.docx')):
        await update.message.reply_text("❌ Faqat DOC yoki DOCX qabul qilinadi.")
        return SUBMIT_FILE

    client = get_client_from_context(context)
    if not client:
        return ConversationHandler.END

    try:
        file_bytes, filename = await _download_doc(update, context)
        user = context.user_data.get('user') or {}
        author_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        fields = {
            'title': context.user_data['submit_title'],
            'journal': context.user_data['submit_journal_id'],
            'abstract': context.user_data.get('submit_abstract', ''),
            'keywords': parse_keywords(context.user_data.get('submit_keywords', '')),
            'page_count': context.user_data.get('submit_pages', 1),
            'submitted_author_name': author_name,
            'fast_track': False,
        }
        article = await sync_to_async(client.create_article_multipart)(fields, file_bytes, filename)
        article_id = article.get('id')
        msg = (
            f"✅ Maqola yuborildi!\n\n"
            f"📝 {fields['title']}\n"
            f"📚 {context.user_data.get('submit_journal_name', '')}\n"
            f"🆔 ID: {article_id}\n"
        )

        journals = context.user_data.get('submit_journals') or []
        jid = context.user_data.get('submit_journal_id')
        journal = next((j for j in journals if str(j.get('id')) == str(jid)), {})
        pub_fee = float(journal.get('publication_fee') or journal.get('publicationFee') or 0)
        price_per_page = float(journal.get('price_per_page') or journal.get('pricePerPage') or 0)
        pricing = journal.get('pricing_type') or journal.get('pricingType') or 'fixed'
        pages = fields['page_count']
        amount = price_per_page * pages if pricing == 'per_page' and price_per_page else pub_fee

        if amount > 0 and article_id:
            tx = await sync_to_async(client.create_transaction)({
                'amount': amount,
                'currency': 'UZS',
                'service_type': 'publication_fee',
                'article': article_id,
            })
            tx_id = tx.get('id')
            if tx_id:
                await update.message.reply_text(msg, reply_markup=author_main_keyboard())
                await reply_with_payment_button(
                    update.message,
                    client,
                    str(tx_id),
                    text="💳 Nashr to'lovi — ilovada to'lov qiling:",
                    amount=amount,
                )
                msg = ''

        if msg:
            await update.message.reply_text(msg, reply_markup=author_main_keyboard())

        tg_id = update.effective_user.id if update.effective_user else None
        if tg_id and client.access_token:
            from bot.session import get_user_by_id
            db_user = await get_user_by_id(context.user_data.get('user_id'))
            if db_user:
                await save_session(tg_id, db_user, client.access_token, client.refresh_token or '')

    except ApiError as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())
    except Exception as e:
        logger.exception('article submit')
        await update.message.reply_text(f"❌ Xatolik: {e}", reply_markup=author_main_keyboard())
    return ConversationHandler.END
