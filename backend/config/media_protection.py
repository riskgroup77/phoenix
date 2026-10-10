"""
Yuklangan fayllar (media) himoyasi.

Ochiq fayllar (jurnal rasmlari, son muqovalari/to'plamlari, avatarlar, nashr sertifikatlari) — oddiy havola.
Qolgan barcha fayllar (qo'lyozmalar, cheklar, DOI/UDK/tarjima fayllari, versiyalar) faqat IMZOLI va MUDDATLI
havola orqali ochiladi: /media/<yo'l>?e=<muddat>&s=<imzo>. Imzo SECRET_KEY bilan; muddat soat boshiga
yaxlitlanadi (bir soat ichida havola o'zgarmaydi — brauzer keshi ishlaydi).

API bergan havolalar avtomatik imzolanadi (ProtectedMediaStorage.url) — frontend o'zgarmaydi.
Imzosiz/eskirgan havola bilan kirilsa — 403 (nashr etilgan maqola PDF'i bundan mustasno).

Nginx (infrastructure/nginx/phoenix-api-ilmiyfaoliyat.conf): ochiq papkalar to'g'ridan-to'g'ri,
qolganlari Django orqali (tekshiruv) → X-Accel-Redirect bilan /_protected_media/ (internal) dan beriladi.
"""
from __future__ import annotations

import hashlib
import hmac
import mimetypes
import os
import time
from urllib.parse import quote

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.http import FileResponse, Http404, HttpResponse, HttpResponseForbidden
from django.views.decorators.http import require_GET

# Hech qanday maxfiy ma'lumot bo'lmagan, ochiq ko'rsatiladigan papkalar
PUBLIC_PREFIXES = (
    'journals/',
    'issues/',
    'avatars/',
    'articles/publication_certificates/',
)


def protection_enabled() -> bool:
    return bool(getattr(settings, 'MEDIA_PROTECTION_ENABLED', True))


def is_public(name: str) -> bool:
    return name.replace('\\', '/').lstrip('/').startswith(PUBLIC_PREFIXES)


def _ttl() -> int:
    return int(getattr(settings, 'MEDIA_URL_TTL_SECONDS', 6 * 3600))


def _signature(name: str, expires: int) -> str:
    key = f'media-url:{settings.SECRET_KEY}'.encode('utf-8')
    msg = f'{name}|{expires}'.encode('utf-8')
    return hmac.new(key, msg, hashlib.sha256).hexdigest()[:32]


def sign(name: str, *, now: float | None = None) -> tuple[int, str]:
    now = time.time() if now is None else now
    # Soat boshiga yaxlitlash: bir soat davomida havola bir xil (kesh), amal qilish muddati TTL..TTL+1 soat
    expires = int(now // 3600 * 3600) + _ttl() + 3600
    return expires, _signature(name, expires)


def verify(name: str, expires: str | None, sig: str | None, *, now: float | None = None) -> bool:
    if not expires or not sig:
        return False
    try:
        exp = int(expires)
    except (TypeError, ValueError):
        return False
    if exp < (time.time() if now is None else now):
        return False
    return hmac.compare_digest(_signature(name, exp), sig)


class ProtectedMediaStorage(FileSystemStorage):
    """FileSystemStorage, lekin maxfiy fayllar url() si imzo bilan qaytadi."""

    def url(self, name):
        base = super().url(name)
        if not name or not protection_enabled() or is_public(name):
            return base
        expires, sig = sign(name.replace('\\', '/'))
        return f'{base}?e={expires}&s={sig}'


def _published_pdf(name: str) -> bool:
    from apps.articles.models import Article

    return Article.objects.filter(final_pdf_path=name, status='Published').exists()


@require_GET
def protected_media(request, path: str):
    name = os.path.normpath(path).replace('\\', '/').lstrip('/')
    if name.startswith('..') or '/../' in f'/{name}/':
        raise Http404
    full = os.path.join(settings.MEDIA_ROOT, name)
    if not os.path.isfile(full):
        raise Http404

    allowed = (
        not protection_enabled()
        or is_public(name)
        or verify(name, request.GET.get('e'), request.GET.get('s'))
        or (name.startswith('articles/pdfs/') and _published_pdf(name))
    )
    if not allowed:
        return HttpResponseForbidden(
            "Fayl havolasining muddati tugagan yoki havola noto'g'ri. "
            "Sahifani yangilab, faylni qaytadan oching.",
            content_type='text/plain; charset=utf-8',
        )

    content_type, _ = mimetypes.guess_type(name)
    if getattr(settings, 'MEDIA_ACCEL_REDIRECT', False):
        # Faylni nginx beradi (tez, Django oqimini band qilmaydi)
        resp = HttpResponse(content_type=content_type or 'application/octet-stream')
        resp['X-Accel-Redirect'] = '/_protected_media/' + quote(name)
    else:
        resp = FileResponse(open(full, 'rb'), content_type=content_type or 'application/octet-stream')
    resp['Cache-Control'] = 'private, max-age=3600'
    resp['X-Content-Type-Options'] = 'nosniff'
    resp['X-Robots-Tag'] = 'noindex'
    return resp
