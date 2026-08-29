"""
Antiplagiat to'lovi (Transaction.service_type='language_editing') tasdiqlanganda
maqolani Draft → PaymentCompleted ga o'tkazadi va AI tekshiruvni avtomatik ishga tushiradi.
"""
import logging
import threading

logger = logging.getLogger(__name__)


def fulfill_language_editing_payment(transaction):
    """
    Click/Payme complete callbackida chaqiriladi.
    Faqat antiplagiat/plagiat to'lovi (frontend language_editing sifatida) uchun.
    """
    if getattr(transaction, 'service_type', None) != 'language_editing':
        return
    article = getattr(transaction, 'article', None)
    if article is None:
        return
    if article.status != 'Draft':
        # To'lov allaqachon qayta ishlangan bo'lishi mumkin — tekshiruv bo'lmasa yana urinamiz
        if article.plagiarism_checked_at:
            return
    else:
        article.status = 'PaymentCompleted'
        article.save(update_fields=['status'])
        logger.info(
            'Article %s: Draft → PaymentCompleted (language_editing payment confirmed)',
            article.id,
        )

    user = getattr(transaction, 'user', None)
    if user is None:
        return

    article_id = str(article.id)
    user_id = str(user.id)

    def _bg():
        from apps.articles.plagiarism_check_service import run_auto_plagiarism_check

        run_auto_plagiarism_check(article_id, user_id)

    threading.Thread(target=_bg, daemon=True, name=f'plagiarism-{article_id[:8]}').start()
    logger.info('Article %s: auto plagiarism check queued', article.id)
