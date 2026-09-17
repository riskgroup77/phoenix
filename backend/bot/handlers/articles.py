"""Article submission flow."""
import json
import logging

from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

from bot.api_client import ApiError
from bot.constants import (
    BACK,
    CANCEL,
    SUBMIT_ABSTRACT,
    SUBMIT_FILE,
    SUBMIT_KEYWORDS,
    SUBMIT_JOURNAL,
    SUBMIT_PAGES,
    SUBMIT_TITLE,
)
from bot.handlers.auth import require_author
from bot.keyboards import author_main_keyboard, cancel_keyboard, journal_inline_keyboard
from bot.session import get_client_from_context, save_session
from bot.utils import format_api_error, format_money, parse_keywords

logger = logging.getLogger(__name__)


async def _download_doc(update: Update, context: ContextTypes.DEFAULT_TYPE) -> tuple[bytes, str]:
    doc = update.message.document
    tg_file = await context.bot.get_file(doc.file_id)
    data = await tg_file.download_as_bytearray()
    return bytes(data), doc.file_name or 'document.docx'


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
        context.user_data['submit_journals'] = journals
        if update.message:
            await update.message.reply_text(
                "📝 **Maqola yuborish**\n\n1-qadam: Jurnalni tanlang:",
                parse_mode='Markdown',
                reply_markup=journal_inline_keyboard(journals, 'submitj'),
            )
        return SUBMIT_JOURNAL
    except Exception as e:
        if update.message:
            await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())
        return ConversationHandler.END


async def article_submit_journal_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query or context.user_data is None:
        return ConversationHandler.END
    await query.answer()
    data = query.data or ''
    if data == 'submitj:cancel':
        await query.edit_message_text("❌ Bekor qilindi.")
        return ConversationHandler.END
    if not data.startswith('submitj:'):
        return SUBMIT_JOURNAL
    jid = data.split(':', 1)[1]
    context.user_data['submit_journal_id'] = jid
    journals = context.user_data.get('submit_journals') or []
    jname = next((j.get('name') for j in journals if str(j.get('id')) == jid), 'Jurnal')
    context.user_data['submit_journal_name'] = jname
    await query.edit_message_text(f"✅ Jurnal: {jname}\n\n2-qadam: Maqola sarlavhasini yozing:")
    return SUBMIT_TITLE


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

        # Publication fee if journal requires payment
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
                pay = await sync_to_async(client.process_payment)(str(tx_id))
                pay_url = pay.get('payment_url') or client.payment_page_url(str(tx_id))
                msg += f"\n💳 Nashr to'lovi: {format_money(amount)}\n🔗 To'lov: {pay_url}"

        await update.message.reply_text(msg, disable_web_page_preview=False, reply_markup=author_main_keyboard())

        # Persist refreshed tokens if any
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
