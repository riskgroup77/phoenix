"""
Nashr to'lovi (publication_fee) tasdiqlanganda bog'langan maqolani faol holatga o'tkazadi.
"""
import logging

logger = logging.getLogger(__name__)

PAID_LOG_ACTION = "Nashr to'lovi qilindi"


def _resolve_article_for_publication_fee(transaction):
    from .models import Article

    article = getattr(transaction, 'article', None)
    if article is None:
        extra = getattr(transaction, 'extra_data', None) or {}
        article_id = extra.get('article_id')
        if article_id:
            article = Article.objects.filter(pk=article_id).first()
            if article and not transaction.article_id:
                transaction.article = article
                transaction.save(update_fields=['article'])
    return article


def fulfill_publication_fee(transaction):
    """
    Click/Payme complete callbackida chaqiriladi.
    Tranzaksiyaga bog'langan maqola Draft bo'lsa → Yangi (taqrizga yuborilgan).
    "Qabuldan keyin to'lov" jurnalida qabul qilingan maqola to'lansa — nashr qiluvchilarga xabar.
    """
    if getattr(transaction, 'service_type', None) != 'publication_fee':
        return
    if getattr(transaction, 'status', None) != 'completed':
        return

    article = _resolve_article_for_publication_fee(transaction)
    if article is None:
        logger.warning('publication_fee fulfill: no article for transaction %s', transaction.id)
        return

    article.refresh_from_db(fields=['status'])  # tranzaksiyadagi obyekt eskirgan bo'lishi mumkin
    if str(article.author_id) != str(transaction.user_id):
        logger.warning('publication_fee fulfill: article user mismatch tx=%s', transaction.id)
        return

    if article.status == 'Draft':
        article.status = 'Yangi'
        article.save(update_fields=['status'])
        logger.info('Article %s: Draft → Yangi after publication_fee payment', article.id)
        try:
            from .submission_notifications import notify_article_submitted
            notify_article_submitted(article)
        except Exception as exc:
            logger.warning('publication_fee fulfill notify failed: %s', exc)
    elif article.status in ('Accepted', 'NashrgaYuborilgan'):
        _notify_ready_to_publish(article)


def _notify_ready_to_publish(article):
    """Post-payment: muallif to'ladi — taqrizchi (u nashr qiladi) va jurnal muharriri bilsin."""
    from apps.notifications.models import Notification
    from apps.reviews.models import PeerReview

    from .models import ActivityLog

    # fulfill_publication_fee qayta chaqiriladi (repair_publication_fee_articles_for_user) — xabar bir marta
    if ActivityLog.objects.filter(article=article, action=PAID_LOG_ACTION).exists():
        return
    recipients = {
        r.reviewer for r in PeerReview.objects.filter(article=article, status='completed').select_related('reviewer')
    }
    journal_admin = getattr(article.journal, 'journal_admin', None)
    if journal_admin is not None:
        recipients.add(journal_admin)
    ActivityLog.objects.create(article=article, user=article.author, action=PAID_LOG_ACTION,
                               details="Maqola nashr qilinishi mumkin.")
    for user in recipients:
        try:
            Notification.notify(
                user=user,
                title="Nashr to'lovi qilindi",
                message=f'Muallif "{article.title}" maqolasi uchun nashr to\'lovini qildi. Maqolani nashr qiling.',
                notification_type='article',
                link=f'/articles/{article.id}',
                metadata={'article_id': str(article.id), 'paid': True},
            )
        except Exception as exc:
            logger.warning('post-payment notify failed %s: %s', article.pk, exc)


def repair_publication_fee_articles_for_user(user):
    """
    To'lov tasdiqlangan, lekin maqola hali Draft qolgan holatlarni tuzatish (arxiv / sinxron tekshiruv).
    """
    from apps.payments.models import Transaction

    txs = (
        Transaction.objects.filter(
            user=user,
            service_type='publication_fee',
            status='completed',
        )
        .select_related('article')
        .order_by('-completed_at', '-created_at')
    )
    for tx in txs:
        fulfill_publication_fee(tx)
