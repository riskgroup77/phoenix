"""
Hujjat tekshirish havolalari (QR kod uchun).

Sayt HashRouter bilan ishlaydi: to'g'ri manzil https://ilmiyfaoliyat.uz/#/verify/<kod>.
(Avval /verify/<kod> berilardi — u bosh sahifaga/kirishga tushib qolardi.)
"""
from __future__ import annotations

import base64
from io import BytesIO
from urllib.parse import quote

from django.conf import settings


def site_base() -> str:
    base = (getattr(settings, 'PUBLIC_SITE_URL', '') or getattr(settings, 'FRONTEND_BASE_URL', '')).rstrip('/')
    # Lokal ishlab chiqishda ham QR haqiqiy saytga olib borsin
    if not base or 'localhost' in base or '127.0.0.1' in base:
        return 'https://ilmiyfaoliyat.uz'
    return base


def verify_url(code: str) -> str:
    return f'{site_base()}/#/verify/{quote(str(code or ""), safe="-_")}'


def qr_png_data_uri(data: str, fill: str = '#17306f') -> str:
    """QR kodni tashqi xizmatsiz (qrcode kutubxonasi) PNG data URI sifatida qaytaradi."""
    import qrcode

    qr = qrcode.QRCode(box_size=6, border=1)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color=fill, back_color='white')
    buf = BytesIO()
    img.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
