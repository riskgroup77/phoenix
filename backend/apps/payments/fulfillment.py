"""To'lov tasdiqlangandan keyingi xizmatni bajarish (Click va Payme uchun umumiy)."""
import logging

logger = logging.getLogger(__name__)


def _fulfill_after_payment(transaction):
    """Post-payment business logic (Click complete callback va sinxron tekshiruv)."""
    service_type = getattr(transaction, 'service_type', None)
    if service_type == 'udk_request':
        try:
            from apps.udc.fulfill import fulfill_udk_request
            fulfill_udk_request(transaction)
        except Exception as e:
            logger.error('UDK fulfill failed: %s', e, exc_info=True)
    if service_type == 'article_sample':
        try:
            from apps.articles.fulfill_sample import fulfill_article_sample
            fulfill_article_sample(transaction)
        except Exception as e:
            logger.error('Article sample fulfill failed: %s', e, exc_info=True)
    if service_type == 'doi_request':
        try:
            from apps.articles.fulfill_doi import fulfill_doi_request
            fulfill_doi_request(transaction)
        except Exception as e:
            logger.error('DOI request fulfill failed: %s', e, exc_info=True)
    if service_type == 'language_editing':
        try:
            from apps.articles.fulfill_plagiarism_payment import fulfill_language_editing_payment
            fulfill_language_editing_payment(transaction)
        except Exception as e:
            logger.error('Language editing fulfill failed: %s', e, exc_info=True)
    if service_type == 'publication_fee':
        try:
            from apps.articles.fulfill_publication_fee import fulfill_publication_fee
            fulfill_publication_fee(transaction)
        except Exception as e:
            logger.error('Publication fee fulfill failed: %s', e, exc_info=True)
    if service_type == 'book_publication':
        try:
            from apps.articles.fulfill_book_publication import fulfill_book_publication
            fulfill_book_publication(transaction)
        except Exception as e:
            logger.error('Book publication fulfill failed: %s', e, exc_info=True)
