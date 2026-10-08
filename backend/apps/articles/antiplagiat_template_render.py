"""
JPG shablon ustiga matn (sertifikat.jpg, hisobot1.jpg, hisobot2.jpg).
"""
from __future__ import annotations

import json
import textwrap
from io import BytesIO
from pathlib import Path
from typing import Any

import qrcode
from PIL import Image, ImageDraw, ImageFont

from config.verify_links import verify_url

ASSETS_DIR = Path(__file__).resolve().parent.parent.parent / 'assets' / 'antiplag_templates'
LAYOUT_PATH = ASSETS_DIR / 'layout.json'

# (oddiy, qalin) juftliklari — o'zbek harflari (o‘, g‘) bor shriftlar
_FONT_CANDIDATES = (
    (Path(r'C:\Windows\Fonts\arial.ttf'), Path(r'C:\Windows\Fonts\arialbd.ttf')),
    (Path('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'),
     Path('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf')),
    (Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')),
)


def _load_layout() -> dict[str, Any]:
    return json.loads(LAYOUT_PATH.read_text(encoding='utf-8'))


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for regular, bold_path in _FONT_CANDIDATES:
        path = bold_path if bold and bold_path.is_file() else regular
        if path.is_file():
            try:
                return ImageFont.truetype(str(path), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def _hex_to_rgb(color: str) -> tuple[int, int, int]:
    c = color.lstrip('#')
    return tuple(int(c[i : i + 2], 16) for i in (0, 2, 4))


def _draw_field(
    draw: ImageDraw.ImageDraw,
    img_w: int,
    img_h: int,
    text: str,
    spec: dict[str, Any],
) -> None:
    if not text:
        return
    x = int(spec['x'] * img_w)
    y = int(spec['y'] * img_h)
    size = int(spec.get('size', 36))
    bold = bool(spec.get('bold'))
    font = _font(size, bold=bold)
    color = _hex_to_rgb(spec.get('color', '#1e293b'))
    max_w = int(spec.get('max_width', 0.4) * img_w)
    line_h = int(spec.get('line_height', size + 8))
    # baseline=True: y — yorliq bilan umumiy tayanch chizig'i (matn shu chiziqda "turadi")
    anchor = 'ls' if spec.get('baseline') else 'la'
    text = ' '.join(str(text).split())

    if spec.get('multiline'):
        max_lines = int(spec.get('max_lines') or 6)
        lines = _wrap_pixels(draw, text, font, max_w)
        if len(lines) > max_lines:
            lines = lines[:max_lines]
            lines[-1] = _fit_pixels(draw, lines[-1] + ' …', font, max_w)
        for i, line in enumerate(lines):
            draw.text((x, y + i * line_h), line, fill=color, font=font, anchor=anchor)
        return

    # Uzun qiymat (masalan F.I.Sh. yoki fayl nomi): avval shriftni 80% gacha kichraytirib sig'diramiz,
    # baribir sig'masa oxiri "…" bilan qisqartiriladi
    min_size = max(12, int(size * 0.8))
    while size > min_size and _text_w(draw, text, font) > max_w:
        size -= 2
        font = _font(size, bold=bold)
    draw.text((x, y), _fit_pixels(draw, text, font, max_w), fill=color, font=font, anchor=anchor)


def _text_w(draw: ImageDraw.ImageDraw, text: str, font) -> float:
    try:
        return draw.textlength(text, font=font)
    except Exception:
        return len(text) * 10


def _fit_pixels(draw, text: str, font, max_w: int) -> str:
    """Bir qatorli qiymat ajratilgan kenglikdan oshsa — oxiri "…" bilan qisqartiriladi."""
    if max_w <= 0 or _text_w(draw, text, font) <= max_w:
        return text
    while text and _text_w(draw, text + '…', font) > max_w:
        text = text[:-1]
    return text.rstrip() + '…'


def _wrap_pixels(draw, text: str, font, max_w: int) -> list[str]:
    lines: list[str] = []
    cur = ''
    for word in text.split():
        trial = f'{cur} {word}'.strip()
        if not cur or _text_w(draw, trial, font) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines or textwrap.wrap(text, 40)


def _paste_qr(base: Image.Image, verify_url: str, spec: dict[str, Any]) -> None:
    qr = qrcode.QRCode(box_size=10, border=1)
    qr.add_data(verify_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color='#17306f', back_color='white').convert('RGBA')
    side = int(spec['size'] * base.width)
    # NEAREST — QR kataklari xira bo'lmasin (skanerlash ishonchli)
    qr_img = qr_img.resize((side, side), Image.Resampling.NEAREST)
    if 'center_x' in spec and 'center_y' in spec:
        cx = spec['center_x'] * base.width
        cy = spec['center_y'] * base.height
        x = int(cx - side / 2)
        y = int(cy - side / 2)
    else:
        x = int(spec.get('x', 0) * base.width)
        y = int(spec.get('y', 0) * base.height)
    base.paste(qr_img, (x, y), qr_img)


def render_certificate(values: dict[str, str], *, verify_id: str = '') -> Image.Image:
    layout = _load_layout()['certificate']
    path = ASSETS_DIR / layout['image']
    img = Image.open(path).convert('RGBA')
    draw = ImageDraw.Draw(img)
    w, h = img.size

    mapping = {
        'check_date': values.get('check_date', ''),
        'document_number': values.get('document_number', ''),
        'author': values.get('author', ''),
        'work_type': values.get('work_type', ''),
        'file_name': values.get('file_name', ''),
        'citations': values.get('citations', ''),
        'self_citation': values.get('self_citation', ''),
        'plagiarism': values.get('plagiarism', ''),
        'originality': values.get('originality', ''),
        'search_modules': values.get('search_modules', ''),
    }
    for key, spec in layout['fields'].items():
        _draw_field(draw, w, h, mapping.get(key, ''), spec)

    vid = verify_id or values.get('document_number', '')
    if vid and layout.get('qr'):
        _paste_qr(img, verify_url(vid), layout['qr'])
    return img


def render_report_cover(values: dict[str, str], *, verify_id: str = '') -> Image.Image:
    layout = _load_layout()['report_cover']
    path = ASSETS_DIR / layout['image']
    img = Image.open(path).convert('RGBA')
    draw = ImageDraw.Draw(img)
    w, h = img.size

    mapping = {
        'upload_date': values.get('upload_date', ''),
        'document_number': values.get('document_number', ''),
        'author': values.get('author', ''),
        'workplace': values.get('workplace', '') or '—',
        'position': values.get('position', '') or '—',
    }
    for key, spec in layout['fields'].items():
        _draw_field(draw, w, h, mapping.get(key, ''), spec)

    vid = verify_id or values.get('document_number', '')
    if vid and layout.get('qr'):
        _paste_qr(img, verify_url(vid), layout['qr'])
    return img


def render_report_inner_page(lines: list[str], *, title: str = '') -> Image.Image:
    """hisobot2.jpg fonida matn (2+ sahifalar)."""
    layout = _load_layout()['report_inner']
    typo = layout.get('typography') or {}
    path = ASSETS_DIR / layout['image']
    img = Image.open(path).convert('RGBA')
    draw = ImageDraw.Draw(img)
    w, h = img.size
    box = layout['content_box']
    x0 = int(box['x'] * w)
    y0 = int(box['y'] * h)
    font_title = _font(int(typo.get('title', 54)), bold=True)
    font_body = _font(int(typo.get('body', 36)))
    font_link = _font(int(typo.get('link', 32)))
    color = _hex_to_rgb('#172033')
    link_color = _hex_to_rgb('#0a7a8c')
    y = y0
    line_h = int(typo.get('line_height', 44))
    max_w = int(box['w'] * w)
    max_y = y0 + int(box['h'] * h) - line_h

    if title:
        title_size = int(typo.get('title', 54))
        draw.text((x0, y), title[:120], fill=_hex_to_rgb('#286c80'), font=font_title)
        y += title_size + 28
        draw.rounded_rectangle((x0, y, x0 + 180, y + 10), radius=5, fill=_hex_to_rgb('#0a7a8c'))
        y += 46

    for line in lines:
        if y > max_y:
            break
        is_url_line = line.strip().startswith('http') or ' — http' in line
        font = font_link if is_url_line else font_body
        fill = link_color if is_url_line else color
        for chunk in _wrap_pixels(draw, line, font, max_w)[:4]:
            if y > max_y:
                break
            draw.text((x0, y), chunk, fill=fill, font=font)
            y += line_h
    return img


def _source_url(src: dict) -> str:
    raw = (src.get('source') or src.get('url') or '').strip()
    if raw.startswith('http'):
        return raw
    return ''


def format_source_lines(sources: list[dict], *, start: int = 1, limit: int = 28) -> list[str]:
    lines: list[str] = []
    for i, s in enumerate(sources[start - 1 : start - 1 + limit], start):
        sim = float(s.get('similarity') or 0)
        title = (s.get('title') or s.get('snippet') or 'Manba')[:90]
        url = _source_url(s)
        mod = (s.get('search_module') or '')[:50]
        lines.append(f'[{i:02d}] {sim:.2f}% — {title}')
        if url:
            lines.append(f'    {url}')
        if mod:
            lines.append(f'    Modul: {mod}')
    return lines


def save_image(img: Image.Image, dest: Path, fmt: str = 'JPEG') -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if fmt.upper() == 'JPEG':
        img.convert('RGB').save(dest, format='JPEG', quality=95)
    else:
        img.save(dest, format=fmt)


def image_to_bytes(img: Image.Image, fmt: str = 'PNG') -> bytes:
    buf = BytesIO()
    if fmt.upper() == 'JPEG':
        img.convert('RGB').save(buf, format='JPEG', quality=95)
    else:
        img.save(buf, format=fmt)
    return buf.getvalue()
