"""
UDK HAQIDA MA'LUMOTNOMA — asl dizayn (assets/udk_template/udk_malumotnoma.jpg) ustiga qiymatlar yoziladi.
Koordinatalar: assets/udk_template/layout.json (frontend/constants/udkTemplateLayout.ts bilan sinxron).
"""
from __future__ import annotations

import json
import logging
from datetime import date
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Any

from apps.articles.antiplagiat_template_render import (
    _fit_pixels, _font, _hex_to_rgb, _text_w, _wrap_pixels, localized_template_path,
)
from config.doc_i18n import Dictionary, normalize_lang

logger = logging.getLogger(__name__)

ASSETS_DIR = Path(__file__).resolve().parent.parent.parent / 'assets' / 'udk_template'
_PDF_TEXT = Dictionary({
    'title': ("UDK haqida ma'lumotnoma", 'Справка об индексе УДК', 'UDC index certificate'),
    'author': ('Phoenix nashriyoti — ilmiyfaoliyat.uz', 'Издательство Phoenix — ilmiyfaoliyat.uz',
               'Phoenix Publishing — ilmiyfaoliyat.uz'),
})

# Shablon 2000px — matn chop etishda tiniq chiqishi uchun 2 barobar kattalikda chiziladi
RENDER_SCALE = 2


@lru_cache(maxsize=1)
def _layout() -> dict[str, Any]:
    return json.loads((ASSETS_DIR / 'layout.json').read_text(encoding='utf-8'))


def _draw_value(draw, text: str, spec: dict[str, Any], s: float) -> None:
    text = ' '.join(str(text or '').split())
    if not text:
        return
    x, y = spec['x'] * s, spec['y'] * s
    max_w = int(spec['max_width'] * s)
    color = _hex_to_rgb(spec['color'])
    bold = bool(spec.get('bold'))

    if spec.get('multiline'):
        font = _font(int(spec['size'] * s), bold=bold)
        lines = _wrap_pixels(draw, text, font, max_w)
        max_lines = int(spec.get('max_lines') or 3)
        if len(lines) > max_lines:
            lines = lines[:max_lines]
            lines[-1] = _fit_pixels(draw, lines[-1] + ' …', font, max_w)
        for i, line in enumerate(lines):
            draw.text((x, y + i * spec['line_height'] * s), line, fill=color, font=font, anchor='ls')
        return

    # Bir qator: avval min_size gacha kichraytiramiz (yorliqlar oralig'i 50px — qatorlar ustma-ust tushmasin)
    size = int(spec['size'] * s)
    min_size = int(spec.get('min_size', spec['size'] * 0.8) * s)
    font = _font(size, bold=bold)
    while size > min_size and _text_w(draw, text, font) > max_w:
        size -= 2
        font = _font(size, bold=bold)
    wrap = spec.get('wrap')
    if _text_w(draw, text, font) <= max_w or not wrap:
        draw.text((x, y), _fit_pixels(draw, text, font, max_w), fill=color, font=font, anchor='ls')
        return

    # Uzun ish nomi: ikki qatorga sig'guncha shrift kichrayadi; oxirgi qator — yorliq qatori atrofida
    max_lines = wrap['max_lines']
    for wrap_size in wrap['sizes']:
        font = _font(int(wrap_size * s), bold=bold)
        all_lines = _wrap_pixels(draw, text, font, max_w)
        if len(all_lines) <= max_lines:
            break
    lines = all_lines[:max_lines]
    if len(all_lines) > max_lines:
        lines[-1] = _fit_pixels(draw, lines[-1] + ' …', font, max_w)
    if len(lines) == 1:
        draw.text((x, y), lines[0], fill=color, font=font, anchor='ls')
        return
    line_h = wrap_size * 1.15
    for i, line in enumerate(lines):
        ly = wrap['last_y'] - (len(lines) - 1 - i) * line_h
        draw.text((x, ly * s), line, fill=color, font=font, anchor='ls')


def _paste_qr(img, verification_url: str, spec: dict[str, Any], s: float) -> None:
    import qrcode
    from PIL import Image

    qr = qrcode.QRCode(box_size=10, border=1)
    qr.add_data(verification_url)
    qr.make(fit=True)
    side = int(spec['size'] * s)
    # NEAREST — QR kataklari xira bo'lmasin (skanerlash ishonchli)
    qr_img = qr.make_image(fill_color='#17306f', back_color='white').convert('RGB').resize(
        (side, side), Image.Resampling.NEAREST
    )
    img.paste(qr_img, (int(spec['center_x'] * s - side / 2), int(spec['center_y'] * s - side / 2)))


def render_udk_certificate(
    values: dict[str, str], verification_url: str = '', scale: float = RENDER_SCALE, lang: str = 'uz',
):
    """Shablon + qiymatlar → PIL rasm (RGB). lang — yorliqlar tili (udk_malumotnoma.<lang>.jpg)."""
    from PIL import Image, ImageDraw

    layout = _layout()
    w, h = layout['size']
    img = Image.open(localized_template_path(ASSETS_DIR, layout['image'], lang)).convert('RGB')
    if scale != 1:
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(img)
    for key, spec in layout['fields'].items():
        _draw_value(draw, values.get(key, ''), spec, scale)
    if verification_url:
        _paste_qr(img, verification_url, layout['qr'], scale)
    return img


def generate_udk_certificate_pdf(
    article_title: str,
    author_name: str,
    udk_code: str,
    udk_description: str,
    document_number: str = '',
    document_date: str = None,
    verification_url: str = '',
    lang: str = 'uz',
) -> BytesIO:
    """UDK HAQIDA MA'LUMOTNOMA — A4 albom PDF (to'liq sahifa shablon), lang tilidagi yorliqlar bilan."""
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    img = render_udk_certificate(
        {
            'document_number': document_number or '—',
            'document_date': document_date or date.today().strftime('%d.%m.%Y'),
            'author': author_name or '—',
            'title': article_title or '—',
            'udk_code': udk_code or '—',
            'udk_description': udk_description or '',
        },
        verification_url=verification_url or 'https://ilmiyfaoliyat.uz',
        lang=lang,
    )
    jpeg = BytesIO()
    img.save(jpeg, format='JPEG', quality=90, optimize=True)
    jpeg.seek(0)

    buffer = BytesIO()
    pw, ph = landscape(A4)
    c = canvas.Canvas(buffer, pagesize=(pw, ph))
    c.setTitle(_PDF_TEXT.t('title', lang))
    c.setAuthor(_PDF_TEXT.t('author', lang))
    c.drawImage(ImageReader(jpeg), 0, 0, width=pw, height=ph)
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def certificate_document_number(cert) -> str:
    """Standalone ma'lumotnoma raqami — /verify/UDK-000123 va sayt ko'rinishi bilan bir xil."""
    return f'UDK-{cert.id:06d}'


def build_certificate_pdf(cert, lang: str = 'uz') -> BytesIO:
    """Standalone UDKCertificate uchun PDF (lang tilidagi shablon bilan)."""
    from django.conf import settings

    frontend_base = getattr(settings, 'FRONTEND_BASE_URL', 'https://ilmiyfaoliyat.uz').rstrip('/')
    doc_date = cert.created_at.strftime('%d.%m.%Y') if getattr(cert, 'created_at', None) else date.today().strftime('%d.%m.%Y')
    return generate_udk_certificate_pdf(
        article_title=cert.title,
        author_name=cert.author_name or (cert.user.get_full_name() if cert.user_id else ''),
        udk_code=cert.udk_code,
        udk_description=cert.udk_description or '',
        document_number=certificate_document_number(cert),
        document_date=doc_date,
        verification_url=f"{frontend_base}/#/udk-verify?id={cert.id}",
        lang=normalize_lang(lang),
    )


def save_certificate_pdf(cert) -> None:
    """UDKCertificate uchun PDF yaratib, certificate_path ga saqlaydi (eski fayl o'rniga).
    Saqlanadigan nusxa — o'zbekcha; boshqa tillar yuklab olishda talab bo'yicha yaratiladi."""
    from django.core.files.base import ContentFile

    buf = build_certificate_pdf(cert, 'uz')
    if cert.certificate_path:
        cert.certificate_path.delete(save=False)
    cert.certificate_path.save(f"udk_certificate_{cert.id}.pdf", ContentFile(buf.read()), save=True)
