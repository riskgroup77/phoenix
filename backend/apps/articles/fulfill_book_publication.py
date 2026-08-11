"""Kitob nashr to'lovi tasdiqlanganda maqolani taqrizchiga yuborish."""
import logging

logger = logging.getLogger(__name__)


def fulfill_book_publication(transaction):
    """
    Tranzaksiya service_type='book_publication' va status='completed' bo'lganda chaqiriladi.
    Bog'langan [KITOB] maqolasini taqrizchilar ko'radigan holatga o'tkazadi.
    """
    if getattr(transaction, 'service_type', None) != 'book_publication':
        return
    article = getattr(transaction, 'article', None)
    if article is None:
        logger.warning('book_publication fulfill: article missing for tx %s', transaction.id)
        return
    title = (article.title or '').strip()
    if not title.upper().startswith('[KITOB]'):
        logger.info('book_publication fulfill: skip non-book article %s', article.id)
        return
    if article.status in ('Published', 'Rejected'):
        return
    if article.status != 'QabulQilingan':
        article.status = 'QabulQilingan'
        article.save(update_fields=['status'])
        logger.info('Article %s: → QabulQilingan (kitob nashr to\'lovi)', article.id)

    try:
        from apps.notifications.models import Notification
        from django.contrib.auth import get_user_model

        User = get_user_model()
        title_short = title[:120]
        link = f'/articles/{article.id}'
        for rev in User.objects.filter(role='reviewer', is_active=True)[:30]:
            Notification.notify(
                user=rev,
                title='Yangi kitob nashr buyurtmasi',
                message=f'"{title_short}" — kitob nashr buyurtmasi. Taqrizchilar panelida ko\'ring.',
                notification_type='article',
                link='/articles?tab=book-orders',
                metadata={'article_id': str(article.id), 'kind': 'book_publication'},
            )
    except Exception as exc:
        logger.warning('book_publication notify reviewers failed: %s', exc)
