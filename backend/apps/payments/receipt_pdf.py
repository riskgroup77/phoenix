"""
To'lov cheki (PDF) — "Milliy zamonaviy" uslubida: lojuvard sarlavha, girih naqshi, QR tasdiqlash.
Faqat yakunlangan (completed) tranzaksiyalar uchun.
"""
from __future__ import annotations

import math
from io import BytesIO

from django.utils import timezone

from config.pdf_fonts import pdf_text, register_fonts
from config.verify_links import verify_url

from .labels import PROVIDER_LABELS, receipt_number, service_label

LAPIS = '#1f3f8f'
LAPIS_DEEP = '#17306f'
FIRUZA = '#0b6f74'
TEXT = '#172033'
MUTED = '#55607a'
BORDER = '#e3e8f2'
BG_SOFT = '#f5f7fb'


def _verify_url(code: str) -> str:
    return verify_url(code)


def _girih_star(c, cx, cy, r):
    """8 qirrali yulduz (girih elementi) — chiziqlar bilan."""
    pts = []
    for i in range(16):
        ang = math.pi / 8 * i
        rr = r if i % 2 == 0 else r * 0.55
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    p = c.beginPath()
    p.moveTo(*pts[0])
    for pt in pts[1:]:
        p.lineTo(*pt)
    p.close()
    c.drawPath(p, stroke=1, fill=0)


def _qr_drawing(data: str, size: float):
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing

    widget = QrCodeWidget(data)
    widget.barFillColor = _hex(LAPIS_DEEP)
    x1, y1, x2, y2 = widget.getBounds()
    w, h = x2 - x1, y2 - y1
    d = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
    d.add(widget)
    return d


def _hex(value):
    from reportlab.lib import colors
    return colors.HexColor(value)


def _payer_name(tx) -> str:
    user = tx.user
    name = (user.get_full_name() or '').strip() if user else ''
    return name or (getattr(user, 'phone', '') if user else '')


def _related_title(tx) -> str:
    if tx.article_id and tx.article:
        return (tx.article.title or '').strip()
    if tx.translation_request_id and tx.translation_request:
        return (getattr(tx.translation_request, 'title', '') or '').strip()
    extra = tx.extra_data if isinstance(tx.extra_data, dict) else {}
    for key in ('book_title', 'topic', 'title', 'document_name', 'udk_title'):
        if extra.get(key):
            return str(extra[key]).strip()
    return ''


def _wrap(text: str, font: str, size: float, max_width: float, max_lines: int = 3) -> list[str]:
    from reportlab.pdfbase.pdfmetrics import stringWidth

    words = (text or '').split()
    lines, cur = [], ''
    for w in words:
        trial = f'{cur} {w}'.strip()
        if stringWidth(trial, font, size) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
        if len(lines) >= max_lines:
            break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    if len(lines) == max_lines and len(' '.join(lines)) < len(text or ''):
        lines[-1] = lines[-1].rstrip('.,;: ') + '…'
    return lines


def build_receipt_pdf(tx) -> bytes:
    from reportlab.graphics import renderPDF
    from reportlab.lib.pagesizes import A5
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    regular, bold = register_fonts()
    buf = BytesIO()
    width, height = A5
    c = canvas.Canvas(buf, pagesize=A5)
    code = receipt_number(tx)
    c.setTitle(f"To'lov cheki {code}")
    c.setAuthor('Phoenix Ilmiy nashrlar markazi')

    # Fon
    c.setFillColor(_hex('#ffffff'))
    c.rect(0, 0, width, height, stroke=0, fill=1)

    # Lojuvard sarlavha + girih naqshi
    band_h = 38 * mm
    c.setFillColor(_hex(LAPIS))
    c.rect(0, height - band_h, width, band_h, stroke=0, fill=1)
    c.saveState()
    c.setStrokeColor(_hex('#ffffff'))
    c.setStrokeAlpha(0.12)
    c.setLineWidth(0.6)
    step = 14 * mm
    y = height - band_h + step / 2
    row = 0
    while y < height + step:
        x = (step / 2 if row % 2 else 0)
        while x < width + step:
            _girih_star(c, x, y, 5 * mm)
            x += step
        y += step * 0.75
        row += 1
    c.restoreState()

    # Brend belgisi
    c.setFillColor(_hex('#ffffff'))
    c.roundRect(14 * mm, height - 24 * mm, 11 * mm, 11 * mm, 2.5 * mm, stroke=0, fill=1)
    c.setFillColor(_hex(LAPIS))
    c.setFont(bold, 16)
    c.drawCentredString(19.5 * mm, height - 20.6 * mm, 'P')
    c.setFillColor(_hex('#ffffff'))
    c.setFont(bold, 13)
    c.drawString(28 * mm, height - 17.5 * mm, 'Phoenix')
    c.setFont(regular, 8.5)
    c.drawString(28 * mm, height - 22 * mm, pdf_text('Ilmiy nashrlar markazi · ilmiyfaoliyat.uz'))

    c.setFont(bold, 15)
    c.drawRightString(width - 14 * mm, height - 17.5 * mm, pdf_text("TO'LOV CHEKI"))
    c.setFont(regular, 9)
    c.drawRightString(width - 14 * mm, height - 22.5 * mm, code)

    # Summa kartasi
    top = height - band_h - 8 * mm
    card_h = 24 * mm
    c.setFillColor(_hex(BG_SOFT))
    c.setStrokeColor(_hex(BORDER))
    c.roundRect(14 * mm, top - card_h, width - 28 * mm, card_h, 3.5 * mm, stroke=1, fill=1)
    amount = int(tx.amount or 0)
    amount_str = f'{amount:,}'.replace(',', ' ')
    c.setFillColor(_hex(MUTED))
    c.setFont(regular, 9)
    c.drawString(20 * mm, top - 8 * mm, pdf_text("To'langan summa"))
    c.setFillColor(_hex(TEXT))
    c.setFont(bold, 20)
    c.drawString(20 * mm, top - 17 * mm, pdf_text(f"{amount_str} so'm"))
    # Holat belgisi
    c.setFillColor(_hex('#e6f4f4'))
    badge_w = 26 * mm
    c.roundRect(width - 20 * mm - badge_w, top - 15.5 * mm, badge_w, 8 * mm, 4 * mm, stroke=0, fill=1)
    c.setFillColor(_hex(FIRUZA))
    c.setFont(bold, 9)
    c.drawCentredString(width - 20 * mm - badge_w / 2, top - 12.6 * mm, pdf_text("To'langan"))

    # Tafsilotlar
    rows = [
        ('Xizmat', service_label(tx.service_type)),
        ('Tafsilot', _related_title(tx) or '—'),
        ("To'lovchi", _payer_name(tx) or '—'),
        ("To'lov tizimi", PROVIDER_LABELS.get((tx.payment_provider or '').lower(), tx.payment_provider or '—')),
        ('Tranzaksiya', tx.click_trans_id or tx.payme_trans_id or str(tx.pk)),
        ('Sana', timezone.localtime(tx.completed_at or tx.created_at).strftime('%d.%m.%Y, %H:%M')),
    ]
    y = top - card_h - 9 * mm
    label_x = 14 * mm
    value_x = 46 * mm
    value_w = width - value_x - 14 * mm
    for label, value in rows:
        lines = _wrap(pdf_text(value), regular, 9.5, value_w)
        c.setFillColor(_hex(MUTED))
        c.setFont(regular, 9)
        c.drawString(label_x, y, pdf_text(label))
        c.setFillColor(_hex(TEXT))
        c.setFont(regular, 9.5)
        for i, line in enumerate(lines or ['—']):
            c.drawString(value_x, y - i * 4.6 * mm, line)
        # Ajratuvchi chiziq qator ostida (matnni kesib o'tmasin)
        bottom = y - (max(1, len(lines)) - 1) * 4.6 * mm - 3 * mm
        c.setStrokeColor(_hex(BORDER))
        c.setLineWidth(0.5)
        c.line(label_x, bottom, width - 14 * mm, bottom)
        y = bottom - 6 * mm

    # QR va izoh
    qr_size = 26 * mm
    qr_y = 18 * mm
    renderPDF.draw(_qr_drawing(_verify_url(code), qr_size), c, width - 14 * mm - qr_size, qr_y)
    c.setFillColor(_hex(MUTED))
    c.setFont(regular, 8)
    note_lines = [
        "Chek haqiqiyligini QR kod orqali",
        "yoki ilmiyfaoliyat.uz saytidagi",
        "«Hujjatni tekshirish» bo'limida tekshiring.",
    ]
    for i, line in enumerate(note_lines):
        c.drawString(14 * mm, qr_y + qr_size - 6 * mm - i * 4.2 * mm, pdf_text(line))

    # Pastki chiziq
    c.setFillColor(_hex(FIRUZA))
    c.rect(0, 0, width, 3 * mm, stroke=0, fill=1)
    c.setFillColor(_hex(MUTED))
    c.setFont(regular, 7.5)
    c.drawString(14 * mm, 8 * mm, pdf_text('Phoenix Ilmiy nashrlar markazi — elektron chek'))
    c.drawRightString(width - 14 * mm, 8 * mm, timezone.localtime().strftime('%d.%m.%Y'))

    c.showPage()
    c.save()
    return buf.getvalue()
