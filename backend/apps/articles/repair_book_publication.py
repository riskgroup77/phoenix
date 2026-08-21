"""Kitob nashr to'lovi: maqola yaratish, taqrizchiga yuborish va eski tranzaksiyalarni tiklash."""
import json
import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)

DEBUG_LOG = Path(__file__).resolve().parents[3] / 'debug-ac7877.log'
DEBUG_SESSION = 'ac7877'


def _debug_log(hypothesis_id: str, location: str, message: str, data: dict | None = None, run_id: str = 'repair'):
    try:
        entry = {
            'sessionId': DEBUG_SESSION,
            'runId': run_id,
            'hypothesisId': hypothesis_id,
            'location': location,
            'message': message,
            'data': data or {},
            'timestamp': int(time.time() * 1000),
        }
        with open(DEBUG_LOG, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    except Exception:
        pass


def _pick_journal():
    from apps.journals.models import Journal

    return Journal.objects.order_by('created_at').first()


def _build_book_abstract(extra: dict, transaction) -> str:
    parts = ['Kitob nashr buyurtmasi (to\'lov tasdiqlangan).']
    pub_type = extra.get('publication_type')
    if pub_type:
        parts.append(f"Nashr turi: {pub_type}.")
    pages = extra.get('pages')
    copies = extra.get('copies')
    if pages:
        parts.append(f"Sahifalar: {pages}.")
    if copies:
        parts.append(f"Nusxalar: {copies}.")
    region = extra.get('shipping_region')
    address = extra.get('shipping_address')
    if region or address:
        parts.append(f"Yetkazib berish: {region or ''} {address or ''}".strip())
    phone = extra.get('shipping_phone')
    if phone:
        parts.append(f"Telefon: {phone}.")
    parts.append(f"Tranzaksiya: {transaction.id}.")
    return ' '.join(parts)[:5000]


def ensure_book_article_for_transaction(transaction):
    """
    To'lov tasdiqlangan, lekin article bog'lanmagan eski/yangi kitob tranzaksiyalarini tiklaydi.
    Yaratilgan yoki mavjud maqolani qaytaradi.
    """
    if getattr(transaction, 'service_type', None) != 'book_publication':
        return None
    if transaction.status != 'completed':
        return getattr(transaction, 'article', None)

    existing = getattr(transaction, 'article', None)
    if existing is not None:
        return existing

    extra = getattr(transaction, 'extra_data', None) or {}
    if not isinstance(extra, dict):
        extra = {}

    journal = _pick_journal()
    if journal is None:
        logger.warning('book_publication repair: no journal for tx %s', transaction.id)
        _debug_log('H5-fix', 'ensure_book_article', 'no journal', {'tx': str(transaction.id)})
        return None

    title_base = (
        (extra.get('book_title') or extra.get('title') or '').strip()
        or f"Kitob buyurtmasi {str(transaction.id)[:8]}"
    )
    title = title_base if title_base.upper().startswith('[KITOB]') else f'[KITOB] {title_base}'

    from apps.articles.models import Article

    article = Article.objects.create(
        title=title[:500],
        abstract=_build_book_abstract(extra, transaction),
        keywords=['kitob', 'nashr', 'book_publication'],
        author=transaction.user,
        journal=journal,
        status='QabulQilingan',
        page_count=max(0, int(extra.get('pages') or 0)),
    )
    transaction.article = article
    transaction.save(update_fields=['article'])
    logger.info('book_publication repair: created article %s for tx %s', article.id, transaction.id)
    _debug_log(
        'H5-fix',
        'ensure_book_article',
        'article created',
        {'tx': str(transaction.id), 'article_id': str(article.id), 'title': title[:80]},
    )
    return article


def fulfill_book_publication(transaction):
    """
    Tranzaksiya service_type='book_publication' va status='completed' bo'lganda chaqiriladi.
    Bog'langan [KITOB] maqolasini taqrizchilar ko'radigan holatga o'tkazadi.
    """
    if getattr(transaction, 'service_type', None) != 'book_publication':
        return
    if transaction.status != 'completed':
        return

    article = ensure_book_article_for_transaction(transaction)
    if article is None:
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
        for rev in User.objects.filter(role='reviewer', is_active=True)[:30]:
            Notification.notify(
                user=rev,
                title='Yangi kitob nashr buyurtmasi',
                message=f'"{title_short}" — kitob nashr buyurtmasi. Taqrizchilar panelida ko\'ring.',
                notification_type='article',
                link='/articles?tab=book-orders',
                metadata={'article_id': str(article.id), 'kind': 'book_publication'},
            )
        _debug_log(
            'H5-fix',
            'fulfill_book_publication',
            'reviewers notified',
            {'article_id': str(article.id)},
        )
    except Exception as exc:
        logger.warning('book_publication notify reviewers failed: %s', exc)


def repair_book_publications_for_user(user):
    """Muallifning tasdiqlangan, lekin maqolasiz kitob tranzaksiyalarini tiklaydi."""
    from apps.payments.models import Transaction

    qs = Transaction.objects.filter(
        user=user,
        service_type='book_publication',
        status='completed',
        article__isnull=True,
    ).order_by('-completed_at', '-created_at')
    repaired = 0
    for tx in qs:
        article = ensure_book_article_for_transaction(tx)
        if article is not None:
            fulfill_book_publication(tx)
            repaired += 1
    if repaired:
        _debug_log(
            'H5-fix',
            'repair_book_publications_for_user',
            'repaired count',
            {'user_id': str(user.id), 'repaired': repaired},
        )
    return repaired
