"""
Maqola yaratilganda yoki Draft → Yangi o'tganda xodimlarga bildirishnoma (callback/sinxron o'tkazib yuborilgan holatlar uchun).
"""
import logging

from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from .models import Article
from .submission_notifications import (
    notify_article_draft_pending_payment,
    notify_article_submitted,
    _is_standalone_antiplagiat,
)

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Article)
def article_track_previous_status(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_status = None
        return
    try:
        instance._previous_status = (
            Article.objects.filter(pk=instance.pk).values_list('status', flat=True).first()
        )
    except Exception:
        instance._previous_status = None


@receiver(post_save, sender=Article)
def article_record_status_event(sender, instance, created, **kwargs):
    """Holat o'zgarsa tarixga yozish (maqola sahifasidagi vaqt chizig'i shu jadvaldan)."""
    from config.demo import is_seeding

    if is_seeding():  # demo to'ldiruvchi tarixni o'zi (o'tgan sanalar bilan) yozadi
        return
    prev = getattr(instance, '_previous_status', None)
    status = instance.status
    if not created and prev == status:
        return
    try:
        from config.current_request import current_user
        from .models import ArticleStatusEvent

        actor = current_user()
        note = str(getattr(instance, '_status_note', '') or '')[:2000]
        ArticleStatusEvent.objects.create(
            article=instance,
            from_status='' if created else (prev or ''),
            to_status=status,
            actor=actor,
            actor_role=(getattr(actor, 'role', '') or '')[:20] if actor else '',
            note=note,
        )
        # _previous_status ni o'zgartirmaymiz: keyingi receiver (xodimlarga xabar) undan foydalanadi;
        # pre_save har saqlashda uni bazadan qayta o'qiydi.
        instance._status_note = ''
    except Exception as exc:
        logger.warning('article_record_status_event failed %s: %s', instance.pk, exc)


@receiver(post_save, sender=Article)
def article_notify_staff_on_submission(sender, instance, created, **kwargs):
    from config.demo import is_seeding

    if _is_standalone_antiplagiat(instance) or is_seeding():
        return

    prev = getattr(instance, '_previous_status', None)
    status = instance.status

    try:
        if created:
            if status == 'Yangi':
                notify_article_submitted(instance)
            elif status == 'Draft':
                notify_article_draft_pending_payment(instance)
            return

        if prev == status:
            return
        if status == 'Yangi' and prev in (None, 'Draft'):
            notify_article_submitted(instance)
        elif status == 'Draft' and prev is None:
            notify_article_draft_pending_payment(instance)
    except Exception as exc:
        logger.warning('article_notify_staff_on_submission failed %s: %s', instance.pk, exc)


# ---------------------------------------------------------------- antiplagiat barmoq izlari indeksi

_INDEX_FIELDS = {'title', 'abstract', 'keywords', 'final_pdf_path', 'status', 'doi', 'author', 'author_id'}


def _index_article_by_pk(pk):
    from .antiplagiat_index import index_article

    art = Article.objects.filter(pk=pk).first()
    if art is not None:
        index_article(art)


@receiver(post_save, sender=Article)
def article_update_antiplag_index(sender, instance, created, update_fields=None, **kwargs):
    """Maqola matni/holati o'zgarsa — indeks fon oqimida yangilanadi (matn o'zgarmagan bo'lsa tez o'tadi)."""
    from config.demo import is_seeding

    if is_seeding() or (update_fields is not None and not (set(update_fields) & _INDEX_FIELDS)):
        return
    try:
        from .antiplagiat_index import schedule

        schedule(_index_article_by_pk, instance.pk)
    except Exception as exc:
        logger.warning('antiplag index schedule failed %s: %s', instance.pk, exc)


@receiver(post_delete, sender=Article)
def article_remove_from_antiplag_index(sender, instance, **kwargs):
    try:
        from .antiplagiat_index import remove_document

        remove_document(f'article:{instance.pk}')
    except Exception as exc:
        logger.warning('antiplag index remove failed %s: %s', instance.pk, exc)


def _index_corpus_by_pk(pk):
    from .antiplagiat_index import index_corpus_document
    from .models import AntiplagCorpusDocument

    doc = AntiplagCorpusDocument.objects.filter(pk=pk).first()
    if doc is not None:
        index_corpus_document(doc)


def _connect_corpus_signals():
    from .models import AntiplagCorpusDocument

    def on_save(sender, instance, **kwargs):
        try:
            from .antiplagiat_index import schedule

            schedule(_index_corpus_by_pk, instance.pk)
        except Exception as exc:
            logger.warning('antiplag corpus index schedule failed %s: %s', instance.pk, exc)

    def on_delete(sender, instance, **kwargs):
        try:
            from .antiplagiat_index import remove_document

            remove_document(f'corpus:{instance.external_key}')
        except Exception as exc:
            logger.warning('antiplag corpus index remove failed %s: %s', instance.pk, exc)

    post_save.connect(on_save, sender=AntiplagCorpusDocument, weak=False, dispatch_uid='antiplag_corpus_index_save')
    post_delete.connect(on_delete, sender=AntiplagCorpusDocument, weak=False, dispatch_uid='antiplag_corpus_index_del')


_connect_corpus_signals()
