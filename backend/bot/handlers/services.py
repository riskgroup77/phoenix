"""Paid and free author services (mirrors /services pages)."""
import logging

from asgiref.sync import sync_to_async
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes, ConversationHandler

from apps.articles.antiplagiat_modules import MODULE_PRESETS, module_catalog_count
from bot.api_client import ApiError
from bot.app_links import (
    SERVICE_APP_PATHS,
    plagiarism_check_url,
    plagiarism_result_url,
    service_url,
)
from bot.payment_helpers import reply_with_payment_button
from bot.constants import (
    BACK,
    BOOK_ABSTRACT,
    BOOK_COVER,
    BOOK_FILE,
    BOOK_JOURNAL,
    BOOK_JOURNAL_SEARCH,
    BOOK_KEYWORDS,
    BOOK_PAGES,
    BOOK_TITLE,
    CANCEL,
    DOI_FILE,
    DOI_FIRST,
    DOI_LAST,
    PLAG_FILE,
    PLAG_MODULES,
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
from bot.journal_browse import init_journal_session, send_filter_menu
from bot.journal_callbacks import process_journal_pick_callback, process_journal_search_message
from bot.keyboards import (
    author_main_keyboard,
    cancel_keyboard,
    quality_keyboard,
    services_keyboard,
    translation_lang_keyboard,
)
from bot.list_browse import app_link_button, carousel_keyboard
from bot.session import get_client_from_context
from bot.utils import format_api_error, format_money, parse_keywords, truncate

logger = logging.getLogger(__name__)


BOOK_HEADING = "📖 *Kitob nashr* — 1-qadam: Jurnal tanlash"


async def show_services_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not await require_author(update, context):
        return
    client = get_client_from_context(context)
    if not update.message or not client:
        return
    kb = carousel_keyboard(
        'lv:srv', 0, 1,
        action_rows=[
            [
                app_link_button(client, '🛡️ Antiplagiat', service_url(client, SERVICE_APP_PATHS['plagiarism'])),
                app_link_button(client, '🔗 DOI', service_url(client, SERVICE_APP_PATHS['doi'])),
            ],
            [
                app_link_button(client, '📑 UDK', service_url(client, SERVICE_APP_PATHS['udk'])),
                app_link_button(client, '🌐 Tarjima', service_url(client, SERVICE_APP_PATHS['translation'])),
            ],
            [
                app_link_button(client, '📋 Maqola namuna', service_url(client, SERVICE_APP_PATHS['sample'])),
                app_link_button(client, '📖 Kitob', service_url(client, SERVICE_APP_PATHS['book'])),
            ],
        ],
    )
    await update.message.reply_text(
        "✨ *Xizmatlar*\n\n"
        "Botda buyurtma bering yoki ilovada oching.\n"
        "Quyidagi tugmalar orqali saytga o'tishingiz mumkin:",
        parse_mode='Markdown',
        reply_markup=kb,
    )
    await update.message.reply_text("Bot xizmatlari menyusi:", reply_markup=services_keyboard())


async def services_back(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message:
        await update.message.reply_text("Asosiy menyu:", reply_markup=author_main_keyboard())


# --- DOI ---
async def doi_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await require_author(update, context):
        return ConversationHandler.END
    if update.message:
        await update.message.reply_text(
            "🔗 *DOI olish* — 1/3 qadam\n\nIsmingizni kiriting:",
            parse_mode='Markdown',
            reply_markup=cancel_keyboard(),
        )
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
        tx_id = result.get('transaction_id')
        amount = result.get('amount')
        if tx_id and amount:
            await reply_with_payment_button(
                update.message,
                client,
                str(tx_id),
                text="✅ DOI so'rovi yuborildi!\n\nTo'lovni ilovada amalga oshiring:",
                amount=amount,
            )
        else:
            await update.message.reply_text("✅ DOI so'rovi yuborildi!", reply_markup=services_keyboard())
            return ConversationHandler.END
        await update.message.reply_text("Xizmatlar menyusi:", reply_markup=services_keyboard())
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
        tx_id = result.get('transaction_id')
        amount = result.get('amount')
        if tx_id and amount:
            await reply_with_payment_button(
                update.message,
                client,
                str(tx_id),
                text="✅ UDK so'rovi yuborildi!\n\nTo'lovni ilovada amalga oshiring:",
                amount=amount,
            )
        else:
            await update.message.reply_text("✅ UDK so'rovi yuborildi!", reply_markup=services_keyboard())
            return ConversationHandler.END
        await update.message.reply_text("Xizmatlar menyusi:", reply_markup=services_keyboard())
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
        if tx_id:
            await reply_with_payment_button(
                update.message,
                client,
                str(tx_id),
                text="✅ Tarjima buyurtmasi yaratildi!\n\nTo'lovni ilovada amalga oshiring:",
                amount=fields['cost'],
            )
            await update.message.reply_text("Xizmatlar menyusi:", reply_markup=services_keyboard())
        else:
            await update.message.reply_text("✅ Tarjima buyurtmasi yaratildi!", reply_markup=services_keyboard())
    except ApiError as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=services_keyboard())
    return ConversationHandler.END


# --- Plagiarism ---
def _plag_module_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(
            f"🔬 Barcha modullar ({len(MODULE_PRESETS['all'])})",
            callback_data='plagm:all',
        )],
        [InlineKeyboardButton(
            f"⭐ Asosiy ({len(MODULE_PRESETS['core'])})",
            callback_data='plagm:core',
        )],
        [InlineKeyboardButton(
            f"🌍 Global bazalar ({len(MODULE_PRESETS['global'])})",
            callback_data='plagm:global',
        )],
        [InlineKeyboardButton(
            f"🇺🇿 Milliy bazalar ({len(MODULE_PRESETS['milliy'])})",
            callback_data='plagm:milliy',
        )],
    ])


async def plag_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await require_author(update, context):
        return ConversationHandler.END
    if update.message:
        total = module_catalog_count()
        await update.message.reply_text(
            f"🛡️ *Antiplagiat* — chuqur tekshiruv {total}+ modul bo'yicha.\n\n"
            "Maqola nomini kiriting:",
            parse_mode='Markdown',
            reply_markup=cancel_keyboard(),
        )
    return PLAG_TITLE


async def plag_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message and context.user_data is not None:
        context.user_data['plag_title'] = update.message.text.strip()
        await update.message.reply_text(
            "Tekshiruv profilini tanlang (modullar soni tugmada ko'rsatilgan):",
            reply_markup=_plag_module_keyboard(),
        )
    return PLAG_MODULES


def _format_plag_status_message(article: dict) -> str:
    report = article.get('plagiarism_report') or {}
    if not isinstance(report, dict):
        report = {}
    status = str(report.get('check_status') or 'idle')
    progress = float(report.get('progress_percent') or 0)
    modules_total = int(report.get('modules_total') or 0)
    modules_done = int(report.get('modules_completed') or 0)
    current = str(report.get('current_module_label') or '')
    phase = str(report.get('check_phase') or '')
    error = str(report.get('check_error') or '')
    title = str(report.get('document_name') or article.get('title') or 'Hujjat')[:80]

    if status == 'completed' or article.get('plagiarism_checked_at'):
        plag = article.get('plagiarism_percentage')
        orig = article.get('originality_percentage')
        return (
            f"✅ *Antiplagiat tayyor*\n\n"
            f"📄 {title}\n"
            f"O'zlashtirish: *{plag}%*\n"
            f"Originallik: *{orig}%*\n\n"
            "To'liq hisobot uchun «Natija sahifasi» tugmasini bosing."
        )

    if status == 'failed':
        return (
            f"❌ *Tekshiruv xatosi*\n\n"
            f"📄 {title}\n"
            f"{error or 'Noma\'lum xato.'}\n\n"
            "Iltimos, ilovada qayta urinib ko'ring yoki qo'llab-quvvatlashga murojaat qiling."
        )

    if status == 'processing':
        bar_filled = int(progress // 10)
        bar = '█' * bar_filled + '░' * (10 - bar_filled)
        mod_line = f"\nModullar: {modules_done}/{modules_total}" if modules_total else ''
        phase_line = f"\nBosqich: {phase}" if phase else ''
        cur_line = f"\nHozir: {current}" if current else ''
        return (
            f"⏳ *Tekshiruv davom etmoqda*\n\n"
            f"📄 {title}\n"
            f"[{bar}] {progress:.0f}%{mod_line}{phase_line}{cur_line}\n\n"
            "Chuqur tekshiruv 10–30 daqiqa davom etishi mumkin."
        )

    paid_hint = ''
    if (article.get('status') or '').lower() == 'draft':
        paid_hint = "\n\n💳 Avval to'lovni amalga oshiring — keyin tekshiruv avtomatik boshlanadi."

    return (
        f"ℹ️ *Antiplagiat holati*\n\n"
        f"📄 {title}\n"
        f"Holat: {status or 'kutilmoqda'}{paid_hint}"
    )


async def plag_status_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    if not await require_author(update, context):
        return
    await query.answer()
    article_id = query.data.split(':', 1)[-1].strip()
    client = get_client_from_context(context)
    if not client or not article_id:
        return
    try:
        article = await sync_to_async(client.article_detail)(article_id)
        text = _format_plag_status_message(article)
        aid = str(article.get('id') or article_id)
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton('🔄 Yangilash', callback_data=f'plags:{aid}')],
            [
                app_link_button(client, '📊 Natija', plagiarism_result_url(client, aid)),
                app_link_button(client, '🛡️ Antiplagiat', plagiarism_check_url(client)),
            ],
        ])
        await query.edit_message_text(text, parse_mode='Markdown', reply_markup=kb)
    except ApiError as e:
        await query.edit_message_text(f"❌ {format_api_error(e)}")


async def plag_module_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query or context.user_data is None:
        return PLAG_MODULES
    await query.answer()
    preset = (query.data or '').split(':', 1)[-1]
    modules = MODULE_PRESETS.get(preset) or MODULE_PRESETS['all']
    context.user_data['plag_modules'] = modules
    context.user_data['plag_preset'] = preset
    preset_labels = {
        'all': 'Barcha modullar', 'core': 'Asosiy', 'global': 'Global bazalar', 'milliy': 'Milliy bazalar',
    }
    label = preset_labels.get(preset, preset)
    await query.edit_message_text(
        f"✅ Tanlandi: *{label}* ({len(modules)} modul).\n\n"
        "Endi maqola faylini yuboring (DOC/DOCX/PDF):",
        parse_mode='Markdown',
    )
    return PLAG_FILE


async def plag_file(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.message.document or context.user_data is None:
        await update.message.reply_text("❌ Fayl yuboring.")
        return PLAG_FILE
    client = get_client_from_context(context)
    if not client:
        return ConversationHandler.END
    enabled_modules = context.user_data.get('plag_modules') or MODULE_PRESETS['all']
    preset = context.user_data.get('plag_preset', 'all')
    preset_labels = {
        'all': 'Barcha modullar', 'core': 'Asosiy', 'global': 'Global bazalar', 'milliy': 'Milliy bazalar',
    }
    try:
        file_bytes, filename = await _download_doc(update, context)
        user = context.user_data.get('user') or {}
        journals = await sync_to_async(client.journals)()
        journal_id = str(journals[0]['id']) if journals else ''
        title = context.user_data.get('plag_title') or 'Antiplagiat tekshiruvi'
        fields = {
            'title': title,
            'abstract': 'Antiplagiat tekshiruvi',
            'keywords': ['plagiarism'],
            'journal': journal_id,
            'page_count': 1,
        }
        article = await sync_to_async(client.create_article_multipart)(fields, file_bytes, filename)
        aid = str(article.get('id', ''))
        await sync_to_async(client.save_plagiarism_config)(
            aid,
            enabled_modules=enabled_modules,
            document_name=title,
            author_first_name=user.get('first_name') or '',
            author_last_name=user.get('last_name') or '',
        )
        amount = await sync_to_async(client.service_price)('language_editing', 100000)
        tx = await sync_to_async(client.create_transaction)({
            'amount': amount,
            'currency': 'UZS',
            'service_type': 'language_editing',
            'article': aid,
        })
        tx_id = tx.get('id')
        module_label = preset_labels.get(preset, preset)
        if tx_id:
            await sync_to_async(client.process_payment)(str(tx_id))
            pay_kb = InlineKeyboardMarkup([
                [InlineKeyboardButton(
                    f"💳 To'lov qilish — {format_money(amount)}",
                    url=client.payment_page_url(str(tx_id)),
                )],
                [
                    app_link_button(client, '📊 Natija sahifasi', plagiarism_result_url(client, aid)),
                    app_link_button(client, '🛡️ Antiplagiat', plagiarism_check_url(client)),
                ],
                [InlineKeyboardButton('🔄 Tekshiruv holati', callback_data=f'plags:{aid}')],
            ])
            await update.message.reply_text(
                f"✅ Maqola yaratildi.\n"
                f"Profil: *{module_label}* ({len(enabled_modules)} modul)\n\n"
                "1️⃣ Avval to'lovni amalga oshiring.\n"
                "2️⃣ To'lovdan keyin chuqur tekshiruv *avtomatik* boshlanadi (10–15 daqiqa).\n"
                "3️⃣ Natijani ilovada yoki «Natija sahifasi» tugmasidan ko'ring.",
                parse_mode='Markdown',
                reply_markup=pay_kb,
                disable_web_page_preview=True,
            )
            await update.message.reply_text("Xizmatlar menyusi:", reply_markup=services_keyboard())
        else:
            await update.message.reply_text(
                f"✅ Maqola yaratildi (ID: {aid}).",
                reply_markup=services_keyboard(),
            )
    except ApiError as e:
        await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=services_keyboard())
    return ConversationHandler.END


# --- Book ---
async def _on_book_journal_selected(update: Update, context: ContextTypes.DEFAULT_TYPE, jid: str, jname: str) -> int:
    context.user_data['book_journal_id'] = jid
    if update.effective_chat:
        await context.bot.send_message(
            update.effective_chat.id,
            f"✅ Jurnal: *{jname}*\n\n2-qadam: Kitob nomini kiriting:",
            parse_mode='Markdown',
            reply_markup=cancel_keyboard(),
        )
    return BOOK_TITLE


async def book_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not await require_author(update, context):
        return ConversationHandler.END
    client = get_client_from_context(context)
    if not client:
        return ConversationHandler.END
    try:
        journals = await sync_to_async(client.journals)()
        if not journals:
            if update.message:
                await update.message.reply_text("❌ Jurnallar topilmadi.", reply_markup=services_keyboard())
            return ConversationHandler.END
        init_journal_session(context, 'book', journals)
        context.user_data['book_heading'] = BOOK_HEADING
        await send_filter_menu(update, context, prefix='book', heading=BOOK_HEADING)
        return BOOK_JOURNAL
    except Exception as e:
        if update.message:
            await update.message.reply_text(f"❌ {format_api_error(e)}", reply_markup=services_keyboard())
        return ConversationHandler.END


async def book_journal_search(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    return await process_journal_search_message(
        update, context, prefix='book', journal_state=BOOK_JOURNAL, heading=BOOK_HEADING,
    )


async def book_journal_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    return await process_journal_pick_callback(
        update,
        context,
        prefix='book',
        journal_state=BOOK_JOURNAL,
        search_state=BOOK_JOURNAL_SEARCH,
        on_selected=_on_book_journal_selected,
        cancel_message="Kitob nashr bekor qilindi.",
        cancel_keyboard=services_keyboard,
    )


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
        journal_id = str(context.user_data.get('book_journal_id') or '')
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
        if tx_id:
            await reply_with_payment_button(
                update.message,
                client,
                str(tx_id),
                text=f"✅ Kitob buyurtmasi yuborildi! ID: {aid}\n\nTo'lovni ilovada amalga oshiring:",
                amount=book_amount,
            )
            await update.message.reply_text("Xizmatlar menyusi:", reply_markup=services_keyboard())
        else:
            await update.message.reply_text(
                f"✅ Kitob buyurtmasi yuborildi! ID: {aid}",
                reply_markup=services_keyboard(),
            )
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
        if tx_id and amount:
            await reply_with_payment_button(
                update.message,
                client,
                str(tx_id),
                text="✅ Maqola namuna so'rovi yuborildi!\n\nTo'lovni ilovada amalga oshiring:",
                amount=amount,
            )
            await update.message.reply_text("Xizmatlar menyusi:", reply_markup=services_keyboard())
        else:
            await update.message.reply_text("✅ Maqola namuna so'rovi yuborildi!", reply_markup=services_keyboard())
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
