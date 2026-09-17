"""
Phoenix / Ilmiy Faoliyat — Muallif Telegram Bot

Saytdagi muallif funksiyalarining to'liq nusxasi:
kirish, ro'yxatdan o'tish (sessiya eslab qolinadi), maqolalar, xizmatlar, to'lovlar, arxiv.

Ishga tushirish (backend/ papkasidan):
  python bot/bot.py

.env:
  TELEGRAM_BOT_TOKEN=...
  # Serverda: ichki loopback (nginx emas). api_client X-Forwarded-Proto yuboradi.
  API_BASE_URL=http://127.0.0.1:8050/api/v1
  FRONTEND_BASE_URL=https://ilmiyfaoliyat.uz
"""
import logging
import os
import sys

import django
from dotenv import load_dotenv
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ConversationHandler,
    MessageHandler,
    filters,
)

# Django setup
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', os.getenv('DJANGO_SETTINGS_MODULE', 'config.settings_local'))
django.setup()

from bot.constants import (  # noqa: E402
    BOOK_ABSTRACT,
    BOOK_COVER,
    BOOK_FILE,
    BOOK_JOURNAL,
    BOOK_JOURNAL_SEARCH,
    BOOK_KEYWORDS,
    BOOK_PAGES,
    BOOK_TITLE,
    DOI_FILE,
    DOI_FIRST,
    DOI_LAST,
    LOGIN_PASSWORD,
    LOGIN_PHONE,
    PLAG_FILE,
    PLAG_MODULES,
    PLAG_TITLE,
    REG_FIRST,
    REG_LAST,
    REG_PASSWORD,
    REG_PHONE,
    SAMPLE_PAGES,
    SAMPLE_QUALITY,
    SAMPLE_REQUIREMENTS,
    SAMPLE_TOPIC,
    SUBMIT_ABSTRACT,
    SUBMIT_FILE,
    SUBMIT_JOURNAL,
    SUBMIT_JOURNAL_SEARCH,
    SUBMIT_KEYWORDS,
    SUBMIT_PAGES,
    SUBMIT_TITLE,
    TRANS_CONFIRM,
    TRANS_FILE,
    TRANS_TARGET,
    UDK_ABSTRACT,
    UDK_FILE,
    UDK_FIRST,
    UDK_LAST,
    UDK_TITLE,
)
from bot.handlers.articles import (  # noqa: E402
    article_submit_abstract,
    article_submit_file,
    article_submit_journal_callback,
    article_submit_keywords,
    article_submit_pages,
    article_submit_search,
    article_submit_start,
    article_submit_title,
)
from bot.handlers.auth import (  # noqa: E402
    login_password,
    login_phone,
    login_start,
    logout,
    register_first,
    register_last,
    register_password,
    register_phone,
    register_start,
)
from bot.handlers.dashboard import dashboard_callback  # noqa: E402
from bot.handlers.list_views import list_view_callback  # noqa: E402
from bot.handlers.router import help_command, menu_router, start  # noqa: E402
from bot.handlers.services import (  # noqa: E402
    book_abstract,
    book_cover,
    book_file,
    book_journal_callback,
    book_journal_search,
    book_keywords,
    book_pages,
    book_start,
    book_title,
    doi_file,
    doi_first,
    doi_last,
    doi_start,
    plag_file,
    plag_module_callback,
    plag_start,
    plag_status_callback,
    plag_title,
    sample_pages,
    sample_quality,
    sample_requirements,
    sample_start,
    sample_topic,
    translation_confirm,
    translation_file,
    translation_start,
    translation_target,
    udk_abstract,
    udk_file,
    udk_first,
    udk_last,
    udk_start,
    udk_title,
)

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def build_application() -> Application:
    token = os.getenv('TELEGRAM_BOT_TOKEN')
    if not token:
        raise RuntimeError('TELEGRAM_BOT_TOKEN .env faylida belgilanmagan')

    app = Application.builder().token(token).build()

    # Auth
    app.add_handler(ConversationHandler(
        entry_points=[MessageHandler(filters.Regex('^🔒 Kirish$'), login_start)],
        states={
            LOGIN_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, login_phone)],
            LOGIN_PASSWORD: [MessageHandler(filters.TEXT & ~filters.COMMAND, login_password)],
        },
        fallbacks=[CommandHandler('cancel', logout)],
        allow_reentry=True,
    ))
    app.add_handler(ConversationHandler(
        entry_points=[MessageHandler(filters.Regex("^📝 Ro'yxatdan o'tish$"), register_start)],
        states={
            REG_FIRST: [MessageHandler(filters.TEXT & ~filters.COMMAND, register_first)],
            REG_LAST: [MessageHandler(filters.TEXT & ~filters.COMMAND, register_last)],
            REG_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, register_phone)],
            REG_PASSWORD: [MessageHandler(filters.TEXT & ~filters.COMMAND, register_password)],
        },
        fallbacks=[CommandHandler('cancel', logout)],
        allow_reentry=True,
    ))

    # Article submit
    app.add_handler(ConversationHandler(
        entry_points=[MessageHandler(filters.Regex('^📝 Maqola yuborish$'), article_submit_start)],
        states={
            SUBMIT_JOURNAL: [
                CallbackQueryHandler(
                    article_submit_journal_callback,
                    pattern=r'^(submitj:|submitf:|submitb:)',
                ),
            ],
            SUBMIT_JOURNAL_SEARCH: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, article_submit_search),
            ],
            SUBMIT_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, article_submit_title)],
            SUBMIT_ABSTRACT: [MessageHandler(filters.TEXT & ~filters.COMMAND, article_submit_abstract)],
            SUBMIT_KEYWORDS: [MessageHandler(filters.TEXT & ~filters.COMMAND, article_submit_keywords)],
            SUBMIT_PAGES: [MessageHandler(filters.TEXT & ~filters.COMMAND, article_submit_pages)],
            SUBMIT_FILE: [MessageHandler(filters.Document.ALL | filters.TEXT, article_submit_file)],
        },
        fallbacks=[CommandHandler('cancel', logout)],
        allow_reentry=True,
    ))

    # DOI
    app.add_handler(ConversationHandler(
        entry_points=[MessageHandler(filters.Regex('^🔗 DOI olish$'), doi_start)],
        states={
            DOI_FIRST: [MessageHandler(filters.TEXT & ~filters.COMMAND, doi_first)],
            DOI_LAST: [MessageHandler(filters.TEXT & ~filters.COMMAND, doi_last)],
            DOI_FILE: [MessageHandler(filters.Document.ALL, doi_file)],
        },
        fallbacks=[CommandHandler('cancel', logout)],
        allow_reentry=True,
    ))

    # UDK
    app.add_handler(ConversationHandler(
        entry_points=[MessageHandler(filters.Regex('^📑 UDK olish$'), udk_start)],
        states={
            UDK_FIRST: [MessageHandler(filters.TEXT & ~filters.COMMAND, udk_first)],
            UDK_LAST: [MessageHandler(filters.TEXT & ~filters.COMMAND, udk_last)],
            UDK_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, udk_title)],
            UDK_ABSTRACT: [MessageHandler(filters.TEXT & ~filters.COMMAND, udk_abstract)],
            UDK_FILE: [MessageHandler(filters.Document.ALL | filters.TEXT, udk_file)],
        },
        fallbacks=[CommandHandler('cancel', logout)],
        allow_reentry=True,
    ))

    # Translation
    app.add_handler(ConversationHandler(
        entry_points=[MessageHandler(filters.Regex('^🌐 Ilmiy tarjima$'), translation_start)],
        states={
            TRANS_FILE: [MessageHandler(filters.Document.ALL, translation_file)],
            TRANS_TARGET: [MessageHandler(filters.TEXT & ~filters.COMMAND, translation_target)],
            TRANS_CONFIRM: [MessageHandler(filters.TEXT & ~filters.COMMAND, translation_confirm)],
        },
        fallbacks=[CommandHandler('cancel', logout)],
        allow_reentry=True,
    ))

    # Plagiarism
    app.add_handler(ConversationHandler(
        entry_points=[MessageHandler(filters.Regex('^🛡️ Antiplagiat$'), plag_start)],
        states={
            PLAG_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, plag_title)],
            PLAG_MODULES: [
                CallbackQueryHandler(plag_module_callback, pattern=r'^plagm:'),
            ],
            PLAG_FILE: [MessageHandler(filters.Document.ALL, plag_file)],
        },
        fallbacks=[CommandHandler('cancel', logout)],
        allow_reentry=True,
    ))

    # Book
    app.add_handler(ConversationHandler(
        entry_points=[MessageHandler(filters.Regex('^📖 Kitob nashr$'), book_start)],
        states={
            BOOK_JOURNAL: [
                CallbackQueryHandler(book_journal_callback, pattern=r'^(bookf:|bookb:|bookj:)'),
            ],
            BOOK_JOURNAL_SEARCH: [MessageHandler(filters.TEXT & ~filters.COMMAND, book_journal_search)],
            BOOK_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, book_title)],
            BOOK_ABSTRACT: [MessageHandler(filters.TEXT & ~filters.COMMAND, book_abstract)],
            BOOK_KEYWORDS: [MessageHandler(filters.TEXT & ~filters.COMMAND, book_keywords)],
            BOOK_PAGES: [MessageHandler(filters.TEXT & ~filters.COMMAND, book_pages)],
            BOOK_FILE: [MessageHandler(filters.Document.ALL, book_file)],
            BOOK_COVER: [MessageHandler(filters.Document.ALL | filters.TEXT, book_cover)],
        },
        fallbacks=[CommandHandler('cancel', logout)],
        allow_reentry=True,
    ))

    # Article sample
    app.add_handler(ConversationHandler(
        entry_points=[MessageHandler(filters.Regex('^📋 Maqola namuna$'), sample_start)],
        states={
            SAMPLE_TOPIC: [MessageHandler(filters.TEXT & ~filters.COMMAND, sample_topic)],
            SAMPLE_PAGES: [MessageHandler(filters.TEXT & ~filters.COMMAND, sample_pages)],
            SAMPLE_QUALITY: [MessageHandler(filters.TEXT & ~filters.COMMAND, sample_quality)],
            SAMPLE_REQUIREMENTS: [MessageHandler(filters.TEXT & ~filters.COMMAND, sample_requirements)],
        },
        fallbacks=[CommandHandler('cancel', logout)],
        allow_reentry=True,
    ))

    app.add_handler(CallbackQueryHandler(list_view_callback, pattern=r'^lv:'))
    app.add_handler(CallbackQueryHandler(dashboard_callback, pattern=r'^dash:'))
    app.add_handler(CallbackQueryHandler(plag_status_callback, pattern=r'^plags:'))

    app.add_handler(CommandHandler('start', start))
    app.add_handler(CommandHandler('help', help_command))
    app.add_handler(CommandHandler('logout', logout))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, menu_router))

    return app


def main() -> None:
    logger.info('Muallif Telegram bot ishga tushmoqda...')
    app = build_application()
    app.run_polling(allowed_updates=['message', 'callback_query'])


if __name__ == '__main__':
    main()
