"""Paid and free author services (mirrors /services pages)."""
import logging

from asgiref.sync import sync_to_async
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler

from bot.api_client import ApiError
from bot.constants import (
    BACK,
    BOOK_ABSTRACT,
    BOOK_COVER,
    BOOK_FILE,
    BOOK_KEYWORDS,
    BOOK_PAGES,
    BOOK_TITLE,
    CANCEL,
    DOI_FILE,
    DOI_FIRST,
    DOI_LAST,
    PLAG_FILE,
    PLAG_TITLE,
    SAMPLE_PAGES,
    SAMPLE_QUALITY,
    SAMPLE_REQUIREMENTS,
    SAMPLE_TOPIC,
    TRANS_CONFIRM,
    TRANS_FILE,
    TRANS_TARGET,
    UDK_ABSTRACT,
    UDK_FILE,
    UDK_FIRST,
    UDK_LAST,
    UDK_TITLE,
)
from bot.handlers.auth import require_author
from bot.handlers.articles import _download_doc
from bot.keyboards import (
    author_main_keyboard,
    cancel_keyboard,
    quality_keyboard,
    services_keyboard,
    translation_lang_keyboard,
)
from bot.session import get_client_from_context
from bot.utils import format_api_error, format_money, parse_keywords, truncate

logger = logging.getLogger(__name__)


async def show_services_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    if update.message:
        await update.message.reply_text(
            "✨ **Xizmatlar**\n\nSaytdagi barcha muallif xizmatlari:",
            parse_mode='Markdown',
            reply_markup=services_keyboard(),
        )


async def services_back(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message:
        await update.message.reply_text("Asosiy menyu:", reply_markup=author_main_keyboard())


# --- DOI ---
async def doi_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await require_author(update, context):
        return ConversationHandler.END
    if update.message:
        await update.message.reply_text("🔗 DOI olish — ismingizni kiriting:", reply_markup=cancel_keyboard())
    return DOI_FIRST


async def doi_first(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        if update.message.text == CANCEL:
            await update.message.reply_text("❌ Bekor.", reply_markup=services_keyboard())
            return ConversationHandler.END
        context.user_data['doi_first'] = update.message.text.strip()
        await update.message.reply_text("Familiyangizni kiriting:")
    return DOI_LAST


async def doi_last(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['doi_last'] = update.message.text.strip()
        await update.message.reply_text("Maqola faylini yuboring (DOC/DOCX/PDF):", reply_markup=cancel_keyboard())
    return DOI_FILE


async def doi_file(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.message.document or context.user_data is None:
        await update.message.reply_text("❌ Fayl yuboring.")
        return DOI_FILE
    client = get_client_from_context(context)
    if not client:
        return ConversationHandler.END
    try:
        file_bytes, filename = await _download_doc(update, context)
        fields = {
            'first_name': context.user_data['doi_first'],
            'last_name': context.user_data['doi_last'],
        }
        result = await sync_to_async(client.doi_request)(fields, file_bytes, filename)
        msg = "✅ DOI so'rovi yuborildi!"
        tx_id = result.get('transaction_id')
        amount = result.get('amount')
        if tx_id and amount:
            pay = await sync_to_async(client.process_payment)(str(tx_id))
            url = pay.get('payment_url') or client.payment_page_url(str(tx_id))
            msg += f"\n💳 {format_money(amount)}\n🔗 {url}"
        await update.message.reply_text(msg, reply_markup=services_keyboard())
    except ApiError as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=services_keyboard())
    return ConversationHandler.END


# --- UDK ---
async def udk_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await require_author(update, context):
        return ConversationHandler.END
    if update.message:
        await update.message.reply_text("📑 UDK olish — ismingizni kiriting:", reply_markup=cancel_keyboard())
    return UDK_FIRST


async def udk_first(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['udk_first'] = update.message.text.strip()
        await update.message.reply_text("Familiyangizni kiriting:")
    return UDK_LAST


async def udk_last(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['udk_last'] = update.message.text.strip()
        await update.message.reply_text("Maqola mavzusi (sarlavha):")
    return UDK_TITLE


async def udk_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['udk_title'] = update.message.text.strip()
        await update.message.reply_text("Qisqa annotatsiya:")
    return UDK_ABSTRACT


async def udk_abstract(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['udk_abstract'] = update.message.text.strip()
        await update.message.reply_text("Fayl yuboring (ixtiyoriy — o'tkazib yuborish uchun «-» yozing):", reply_markup=cancel_keyboard())
    return UDK_FILE


async def udk_file(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or context.user_data is None:
        return ConversationHandler.END
    client = get_client_from_context(context)
    if not client:
        return ConversationHandler.END
    fields = {
        'author_first_name': context.user_data['udk_first'],
        'author_last_name': context.user_data['udk_last'],
        'title': context.user_data['udk_title'],
        'abstract': context.user_data['udk_abstract'],
    }
    file_bytes, filename = None, None
    if update.message.document:
        file_bytes, filename = await _download_doc(update, context)
    elif (update.message.text or '').strip() != '-':
        await update.message.reply_text("Fayl yuboring yoki «-» deb yozing.")
        return UDK_FILE
    try:
        result = await sync_to_async(client.udk_request)(fields, file_bytes, filename)
        msg = "✅ UDK so'rovi yuborildi!"
        tx_id = result.get('transaction_id')
        amount = result.get('amount')
        if tx_id and amount:
            pay = await sync_to_async(client.process_payment)(str(tx_id))
            url = pay.get('payment_url') or client.payment_page_url(str(tx_id))
            msg += f"\n💳 {format_money(amount)}\n🔗 {url}"
        await update.message.reply_text(msg, reply_markup=services_keyboard())
    except ApiError as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=services_keyboard())
    return ConversationHandler.END


# --- Translation ---
async def translation_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await require_author(update, context):
        return ConversationHandler.END
    if update.message:
        await update.message.reply_text("🌐 Tarjima — faylni yuboring (DOC/DOCX):", reply_markup=cancel_keyboard())
    return TRANS_FILE


async def translation_file(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.message.document or context.user_data is None:
        await update.message.reply_text("❌ Fayl yuboring.")
        return TRANS_FILE
    client = get_client_from_context(context)
    if not client:
        return ConversationHandler.END
    try:
        file_bytes, filename = await _download_doc(update, context)
        analysis = await sync_to_async(client.translation_analyze)(file_bytes, filename)
        context.user_data['trans_analysis'] = analysis
        context.user_data['trans_file_bytes'] = file_bytes
        context.user_data['trans_filename'] = filename
        cost = analysis.get('cost') or 0
        words = analysis.get('word_count') or 0
        await update.message.reply_text(
            f"📊 So'zlar: {words} | Narx: {format_money(cost)}\n\nTarjima yo'nalishini tanlang:",
            reply_markup=translation_lang_keyboard(),
        )
        return TRANS_TARGET
    except ApiError as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=services_keyboard())
        return ConversationHandler.END


async def translation_target(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or context.user_data is None:
        return ConversationHandler.END
    text = (update.message.text or '').strip()
    if text == CANCEL:
        await update.message.reply_text("❌ Bekor.", reply_markup=services_keyboard())
        return ConversationHandler.END
    parts = text.replace('→', ' ').replace('->', ' ').split()
    if len(parts) < 2:
        await update.message.reply_text("Masalan: uz → en")
        return TRANS_TARGET
    context.user_data['trans_source'] = parts[0]
    context.user_data['trans_target'] = parts[-1]
    analysis = context.user_data.get('trans_analysis') or {}
    await update.message.reply_text(
        f"✅ {parts[0]} → {parts[-1]}\nNarx: {format_money(analysis.get('cost'))}\n\nTasdiqlash uchun «Ha» yozing:",
        reply_markup=cancel_keyboard(),
    )
    return TRANS_CONFIRM


async def translation_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or context.user_data is None:
        return ConversationHandler.END
    if (update.message.text or '').strip().lower() not in ('ha', 'yes', 'tasdiqlash', 'ok'):
        await update.message.reply_text("«Ha» deb yozing yoki bekor qiling.")
        return TRANS_CONFIRM
    client = get_client_from_context(context)
    if not client:
        return ConversationHandler.END
    analysis = context.user_data.get('trans_analysis') or {}
    user = context.user_data.get('user') or {}
    fields = {
        'title': truncate(analysis.get('text_preview') or 'Tarjima buyurtmasi', 100),
        'source_language': context.user_data['trans_source'],
        'target_language': context.user_data['trans_target'],
        'word_count': analysis.get('word_count') or 0,
        'cost': analysis.get('cost') or 0,
        'status': 'submitted',
    }
    try:
        tr = await sync_to_async(client.translation_create)(
            fields,
            context.user_data['trans_file_bytes'],
            context.user_data['trans_filename'],
        )
        tx = await sync_to_async(client.create_transaction)({
            'amount': fields['cost'],
            'currency': 'UZS',
            'service_type': 'translation',
            'translation_request': tr.get('id'),
        })
        tx_id = tx.get('id')
        msg = "✅ Tarjima buyurtmasi yaratildi!"
        if tx_id:
            pay = await sync_to_async(client.process_payment)(str(tx_id))
            url = pay.get('payment_url') or client.payment_page_url(str(tx_id))
            msg += f"\n🔗 To'lov: {url}"
        await update.message.reply_text(msg, reply_markup=services_keyboard())
    except ApiError as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=services_keyboard())
    return ConversationHandler.END


# --- Plagiarism ---
async def plag_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await require_author(update, context):
        return ConversationHandler.END
    if update.message:
        await update.message.reply_text("🛡️ Antiplagiat — maqola nomini kiriting:", reply_markup=cancel_keyboard())
    return PLAG_TITLE


async def plag_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['plag_title'] = update.message.text.strip()
        await update.message.reply_text("Maqola faylini yuboring (DOC/DOCX/PDF):")
    return PLAG_FILE


async def plag_file(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.message.document or context.user_data is None:
        await update.message.reply_text("❌ Fayl yuboring.")
        return PLAG_FILE
    client = get_client_from_context(context)
    if not client:
        return ConversationHandler.END
    try:
        file_bytes, filename = await _download_doc(update, context)
        user = context.user_data.get('user') or {}
        journals = await sync_to_async(client.journals)()
        journal_id = str(journals[0]['id']) if journals else ''
        fields = {
            'title': context.user_data['plag_title'],
            'abstract': 'Antiplagiat tekshiruvi',
            'keywords': ['plagiarism'],
            'journal': journal_id,
            'page_count': 1,
        }
        article = await sync_to_async(client.create_article_multipart)(fields, file_bytes, filename)
        aid = article.get('id')
        amount = await sync_to_async(client.service_price)('language_editing', 100000)
        tx = await sync_to_async(client.create_transaction)({
            'amount': amount,
            'currency': 'UZS',
            'service_type': 'language_editing',
            'article': aid,
        })
        tx_id = tx.get('id')
        msg = f"✅ Maqola yaratildi (ID: {aid}).\n"
        if tx_id:
            pay = await sync_to_async(client.process_payment)(str(tx_id))
            url = pay.get('payment_url') or client.payment_page_url(str(tx_id))
            msg += f"Avval to'lovni amalga oshiring:\n🔗 {url}\n\nTo'lovdan keyin saytda yoki qayta /start orqali tekshiruvni boshlang."
        await update.message.reply_text(msg, reply_markup=services_keyboard())
    except ApiError as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=services_keyboard())
    return ConversationHandler.END


# --- Book ---
async def book_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await require_author(update, context):
        return ConversationHandler.END
    if update.message:
        await update.message.reply_text("📖 Kitob nashr — kitob nomini kiriting:", reply_markup=cancel_keyboard())
    return BOOK_TITLE


async def book_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['book_title'] = update.message.text.strip()
        await update.message.reply_text("Annotatsiya:")
    return BOOK_ABSTRACT


async def book_abstract(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['book_abstract'] = update.message.text.strip()
        await update.message.reply_text("Kalit so'zlar (vergul bilan):")
    return BOOK_KEYWORDS


async def book_keywords(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['book_keywords'] = update.message.text.strip()
        await update.message.reply_text("Sahifalar soni:")
    return BOOK_PAGES


async def book_pages(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        try:
            context.user_data['book_pages'] = max(1, int((update.message.text or '1').strip()))
        except ValueError:
            await update.message.reply_text("Raqam kiriting:")
            return BOOK_PAGES
        await update.message.reply_text("Qo'lyozma faylini yuboring (DOC/DOCX):")
    return BOOK_FILE


async def book_file(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.message.document or context.user_data is None:
        await update.message.reply_text("❌ Fayl yuboring.")
        return BOOK_FILE
    context.user_data['book_manuscript'] = await _download_doc(update, context)
    await update.message.reply_text("Muqova rasmini yuboring (ixtiyoriy — «-» o'tkazish):")
    return BOOK_COVER


async def book_cover(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or context.user_data is None:
        return ConversationHandler.END
    client = get_client_from_context(context)
    if not client:
        return ConversationHandler.END
    file_bytes, filename = context.user_data['book_manuscript']
    extra = None
    if update.message.document:
        cover_bytes, cover_name = await _download_doc(update, context)
        extra = {'additional_document_path': (cover_name, cover_bytes)}
    elif (update.message.text or '').strip() != '-':
        await update.message.reply_text("Rasm yuboring yoki «-»")
        return BOOK_COVER
    try:
        journals = await sync_to_async(client.journals)()
        journal_id = str(journals[0]['id']) if journals else ''
        user = context.user_data.get('user') or {}
        title = f"[KITOB] {context.user_data['book_title']}"
        fields = {
            'title': title,
            'abstract': context.user_data['book_abstract'],
            'keywords': parse_keywords(context.user_data['book_keywords']),
            'journal': journal_id,
            'page_count': context.user_data['book_pages'],
            'submitted_author_name': f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        }
        article = await sync_to_async(client.create_article_multipart)(fields, file_bytes, filename, extra)
        aid = article.get('id')
        book_amount = await sync_to_async(client.service_price)('book_publication', 500000)
        tx = await sync_to_async(client.create_transaction)({
            'amount': book_amount,
            'currency': 'UZS',
            'service_type': 'book_publication',
            'article': aid,
        })
        tx_id = tx.get('id')
        msg = f"✅ Kitob buyurtmasi yuborildi! ID: {aid}"
        if tx_id:
            pay = await sync_to_async(client.process_payment)(str(tx_id))
            url = pay.get('payment_url') or client.payment_page_url(str(tx_id))
            msg += f"\n🔗 To'lov: {url}"
        await update.message.reply_text(msg, reply_markup=services_keyboard())
    except ApiError as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=services_keyboard())
    return ConversationHandler.END


# --- Article sample ---
QUALITY_MAP = {
    'quyi sifatli': 'quyi',
    'o\'rta sifatli': 'orta',
    'yuqori sifatli': 'yuqori',
}


async def sample_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await require_author(update, context):
        return ConversationHandler.END
    if update.message:
        await update.message.reply_text("📋 Maqola namuna — mavzuni kiriting:", reply_markup=cancel_keyboard())
    return SAMPLE_TOPIC


async def sample_topic(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['sample_topic'] = update.message.text.strip()
        await update.message.reply_text("Sahifalar soni (raqam):")
    return SAMPLE_PAGES


async def sample_pages(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        try:
            context.user_data['sample_pages'] = max(1, int((update.message.text or '1').strip()))
        except ValueError:
            await update.message.reply_text("Raqam kiriting:")
            return SAMPLE_PAGES
        await update.message.reply_text("Sifat darajasini tanlang:", reply_markup=quality_keyboard())
    return SAMPLE_QUALITY


async def sample_quality(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        q = QUALITY_MAP.get((update.message.text or '').strip().lower(), 'orta')
        context.user_data['sample_quality'] = q
        await update.message.reply_text("Qo'shimcha talablar (ixtiyoriy):", reply_markup=cancel_keyboard())
    return SAMPLE_REQUIREMENTS


async def sample_requirements(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or context.user_data is None:
        return ConversationHandler.END
    client = get_client_from_context(context)
    if not client:
        return ConversationHandler.END
    user = context.user_data.get('user') or {}
    payload = {
        'topic': context.user_data['sample_topic'],
        'pages': context.user_data['sample_pages'],
        'quality_level': context.user_data['sample_quality'],
        'requirements': (update.message.text or '').strip(),
        'first_name': user.get('first_name', ''),
        'last_name': user.get('last_name', ''),
    }
    try:
        result = await sync_to_async(client.article_sample_request)(payload)
        tx_id = result.get('transaction_id')
        amount = result.get('amount')
        msg = "✅ Maqola namuna so'rovi yuborildi!"
        if tx_id and amount:
            pay = await sync_to_async(client.process_payment)(str(tx_id))
            url = pay.get('payment_url') or client.payment_page_url(str(tx_id))
            msg += f"\n💳 {format_money(amount)}\n🔗 {url}"
        await update.message.reply_text(msg, reply_markup=services_keyboard())
    except ApiError as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=services_keyboard())
    return ConversationHandler.END


# --- Translations list ---
async def show_translations(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not client:
        return
    try:
        items = await sync_to_async(client.translations)()
        if not items:
            if update.message:
                await update.message.reply_text("🌐 Tarjima buyurtmalari yo'q.", reply_markup=author_main_keyboard())
            return
        lines = ["🌐 **Tarjimalarim**\n"]
        for t in items[:10]:
            lines.append(f"• {truncate(t.get('title', '—'), 50)} — {t.get('status', '')}")
        if update.message:
            await update.message.reply_text('\n'.join(lines), parse_mode='Markdown', reply_markup=author_main_keyboard())
    except ApiError as e:
        if update.message:
            await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=author_main_keyboard())
