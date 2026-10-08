"""
ReportLab uchun o'zbek harflarini (o‘, g‘, ʻ, kirill) to'g'ri chiqaradigan shrift.

Serverda odatda DejaVuSans bor; Windows'da Arial. Topilmasa standart Helvetica ishlatiladi
va matndagi maxsus apostroflar oddiy ' ga almashtiriladi (aks holda "■" chiqadi).
"""
from __future__ import annotations

from pathlib import Path

_CANDIDATES = (
    ('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
    ('LiberationSans', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'),
    ('Arial', r'C:\Windows\Fonts\arial.ttf', r'C:\Windows\Fonts\arialbd.ttf'),
)

_registered: tuple[str, str] | None = None


def register_fonts() -> tuple[str, str]:
    """(oddiy, qalin) shrift nomlarini qaytaradi."""
    global _registered
    if _registered:
        return _registered
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        for name, regular, bold in _CANDIDATES:
            if Path(regular).is_file() and Path(bold).is_file():
                pdfmetrics.registerFont(TTFont(f'{name}-Phx', regular))
                pdfmetrics.registerFont(TTFont(f'{name}-Phx-Bold', bold))
                _registered = (f'{name}-Phx', f'{name}-Phx-Bold')
                return _registered
    except Exception:
        pass
    _registered = ('Helvetica', 'Helvetica-Bold')
    return _registered


def pdf_text(value) -> str:
    """Helvetica holatida ham o'qiladigan matn (TTF bo'lsa o'zgarmaydi)."""
    text = '' if value is None else str(value)
    if register_fonts()[0] != 'Helvetica':
        return text
    return (
        text.replace('\u02bb', "'").replace('\u02bc', "'").replace('\u2018', "'").replace('\u2019', "'")
    )
