"""
UDK so'rovini to'lovdan keyin avtomatik yakunlash: UDK aniqlanadi, ma'lumotnoma (PDF) yaratiladi, muallifga xabar
ketadi — taqrizchi kerak emas. Aniqlab bo'lmasa (bo'sh nomzodlar / xato) so'rov "submitted" holatida qoladi va
xodimlarga (UdkRequests sahifasi) qo'lda ko'rib chiqish uchun xabar boradi.
"""
import logging
import threading

from django.conf import settings
from django.db import close_old_connections, transaction as db_transaction
from django.utils import timezone

from .models import UDK_REQUEST_STATUS_COMPLETED, UDK_REQUEST_STATUS_SUBMITTED, UDKCertificate, UdkRequest

logger = logging.getLogger(__name__)


def complete_udk_request(udk_req: UdkRequest, udk_code: str, udk_description: str, *, method: str = 'manual',
                         candidates=None) -> UDKCertificate:
    """So'rovni yakunlash: UDKCertificate + PDF + muallifga bildirishnoma (qo'lda va avtomatik uchun umumiy)."""
    udk_req.udk_code = udk_code
    udk_req.udk_description = udk_description
    udk_req.status = UDK_REQUEST_STATUS_COMPLETED
    udk_req.completed_at = timezone.now()
    udk_req.auto_method = method
    fields = ['udk_code', 'udk_description', 'status', 'completed_at', 'auto_method']
    if candidates is not None:
        udk_req.auto_candidates = candidates
        fields.append('auto_candidates')
    udk_req.save(update_fields=fields)

    cert = UDKCertificate.objects.create(
        user=udk_req.user,
        author_name=f"{udk_req.author_last_name} {udk_req.author_first_name} {udk_req.author_middle_name}".strip(),
        title=udk_req.title,
        udk_code=udk_code,
        udk_description=udk_description,
        transaction=udk_req.transaction,
    )
    try:
        from .pdf_generator import save_certificate_pdf

        save_certificate_pdf(cert)
    except Exception as e:
        logger.error('[UDK] PDF yaratilmadi (certificate=%s): %s', cert.id, e, exc_info=True)

    from .views import _notify_author_udk_completed

    _notify_author_udk_completed(udk_req, cert)
    return cert


def auto_complete(udk_request_id) -> bool:
    """True — avtomatik yakunlandi; False — qo'lda ko'rib chiqishga qoldi."""
    from . import auto_classify

    udk_req = UdkRequest.objects.select_related('user', 'transaction').filter(pk=udk_request_id).first()
    if udk_req is None or udk_req.status != UDK_REQUEST_STATUS_SUBMITTED:
        return False
    try:
        result = auto_classify.classify(
            udk_req.title, udk_req.abstract, body_text=auto_classify.file_text(udk_req.file),
        )
    except Exception:
        logger.exception('[UDK] avtomatik aniqlash xatosi (so\'rov %s)', udk_request_id)
        result = None
    if result is None:
        _fallback_to_staff(udk_req)
        return False
    with db_transaction.atomic():
        # Parallel ishga tushgan bo'lsa — faqat bittasi yakunlaydi
        locked = UdkRequest.objects.select_for_update().filter(pk=udk_req.pk, status=UDK_REQUEST_STATUS_SUBMITTED).first()
        if locked is None:
            return False
        complete_udk_request(locked, result.code, result.description, method=result.method,
                             candidates=result.candidates)
    logger.info('[UDK] so\'rov %s avtomatik yakunlandi: %s (%s)', udk_request_id, result.code, result.method)
    return True


def _fallback_to_staff(udk_req: UdkRequest):
    from .views import _notify_reviewers_udk_request

    udk_req.auto_method = 'manual'
    udk_req.save(update_fields=['auto_method'])
    _notify_reviewers_udk_request(udk_req)


def schedule_auto_complete(udk_req: UdkRequest):
    """To'lov tasdiqlangandan keyin chaqiriladi. UDK_AUTO_CLASSIFY=false bo'lsa — eski tartib (xodimlarga xabar)."""
    if not getattr(settings, 'UDK_AUTO_CLASSIFY', True):
        _fallback_to_staff(udk_req)
        return
    pk = udk_req.pk

    def run():
        try:
            auto_complete(pk)
        finally:
            close_old_connections()

    if getattr(settings, 'UDK_AUTO_ASYNC', True):
        # AI/tarmoq so'rovlari to'lov callbackini (Click) kuttirmasligi uchun — alohida oqimda.
        # Oqim uzilsa so'rov "submitted" bo'lib qoladi: `manage.py udk_auto_pending` qayta ishlaydi.
        db_transaction.on_commit(lambda: threading.Thread(target=run, daemon=True, name=f'udk-auto-{pk}').start())
    else:
        db_transaction.on_commit(lambda: auto_complete(pk))
