"""
Antiplagiat sertifikati va hisobot shablonlari — Phoenix'ning ASL dizayni asosida.

Manba rasmlar (o'zgartirilmaydi): backend/assets/antiplag_templates/src/classic_*.jpg
Natija (ikkala nusxa bir xil):
  backend/assets/antiplag_templates/{sertifikat,hisobot1,hisobot2}.jpg + layout.json
  frontend/public/antiplag-templates/{...}
  frontend/constants/antiplagTemplateLayout.ts  (layout.json bilan sinxron)

Nima qilinadi:
  - sertifikat: «ORIGINALLAIK» → «ORIGINALLIK» (asl harflar surib tuzatiladi);
  - muqova: noto'g'ri «MAQOLALAR NASHRI HAQIDA HISOBOT» o'rniga «ANTIPLAGIAT TEKSHIRUVI HISOBOTI»,
    «familya» → «familiya» (asl «i» harfi nusxalanadi);
  - ichki sahifa: o'zgarishsiz;
  - maydon koordinatalari asl rasmdagi yorliqlardan piksel bo'yicha o'lchangan, qiymatlar yorliqlar bilan
    bir tayanch chiziqda (baseline) turadi.

Ishga tushirish (Windows'da — Century Gothic shrifti kerak; serverda kerak emas, rasmlar repoda):
  python scripts/build_antiplag_templates.py
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / 'backend' / 'assets' / 'antiplag_templates'
FRONTEND_DIR = ROOT / 'frontend' / 'public' / 'antiplag-templates'
TS_LAYOUT = ROOT / 'frontend' / 'constants' / 'antiplagTemplateLayout.ts'
SRC_DIR = BACKEND_DIR / 'src'
FONT_DIR = Path(r'C:\Windows\Fonts')


def field(x_px, y_px, W, H, size, max_w_px, color='#172033', **extra):
    spec = {
        'x': round(x_px / W, 4),
        'y': round(y_px / H, 4),
        'size': size,
        'color': color,
        'max_width': round(max_w_px / W, 4),
    }
    spec.update(extra)
    return spec


# ---------------------------------------------------------------- sertifikat (asl dizayn)

def fix_originallik(img: Image.Image) -> Image.Image:
    """
    Asl rasmdagi «ORIGINALLAIK» xatosini tuzatish → «ORIGINALLIK».
    Harflar ustunlari (o'lchangan): ... L(477-500) A(505-547) I(552-561) K(571-607), qator y=1278..1340.
    Ortiqcha «A» olib tashlanadi, «IK» asl shrift piksellari bilan chapga suriladi (47 px) — yangi harf chizilmaydi.
    """
    img = img.copy()
    y0, y1 = 1278, 1341
    ik = img.crop((552, y0, 612, y1))
    img.paste((255, 255, 255), (505, y0, 612, y1))
    img.paste(ik, (505, y0))
    return img


def build_certificate():
    """
    Sertifikat — Phoenix'ning asl dizayni (src/classic_sertifikat.jpg) o'zgarishsiz qoladi.
    Qiymatlar har bir yorliqning tayanch chizig'iga (baseline) tekislanadi. Koordinatalar asl rasmdan
    piksel bo'yicha o'lchangan (3509x2481):
      - yorliqlar ustuni x=188..781, qatorlar orasi 62.5 px, bosh harf balandligi 41 px;
      - qiymatlar ustuni x=935 — oldindan bosilgan «www.ilmiyfaoliyat.uz» bilan bir chiziqda;
      - o'ng chegara — muhr (x=1959) dan oldin; pastki oltin chiziq y=1732;
      - QR — dafna novdalari orasidagi bo'sh joy markazi (516, 2095).
    """
    src = fix_originallik(Image.open(SRC_DIR / 'classic_sertifikat.jpg').convert('RGB'))
    W, H = src.size  # 3509 x 2481
    value_x = 935
    value_w = 1915 - value_x
    dark = '#1f2f4a'

    def baseline_field(x, baseline, size, max_w, color=dark, **extra):
        return field(x, baseline, W, H, size, max_w, color=color, baseline=True, **extra)

    # Yorliqlarning tayanch chiziqlari (bosh harf pastki qirrasi): MUALLIF ... QIDIRUV TIZIMLARI
    rows = {
        'author': 953,
        'work_type': 1015,
        'file_name': 1078,
        'citations': 1140,
        'self_citation': 1202,
        'plagiarism': 1265,
        'originality': 1327,
        # 'web_site': 1391 — rasmda «www.ilmiyfaoliyat.uz» oldindan bor
        'search_modules': 1453,
    }
    fields = {
        # Yuqori qator: yorliq ostida, chap chetiga tekis
        'check_date': baseline_field(182, 336, 54, 760, bold=True),
        'document_number': baseline_field(1006, 336, 54, 880, bold=True),
        'author': baseline_field(value_x, rows['author'], 50, value_w, bold=True),
        'work_type': baseline_field(value_x, rows['work_type'], 48, value_w),
        'file_name': baseline_field(value_x, rows['file_name'], 44, value_w),
        'citations': baseline_field(value_x, rows['citations'], 48, value_w),
        'self_citation': baseline_field(value_x, rows['self_citation'], 48, value_w),
        'plagiarism': baseline_field(value_x, rows['plagiarism'], 52, value_w, color='#b91c1c', bold=True),
        'originality': baseline_field(value_x, rows['originality'], 52, value_w, color='#15803d', bold=True),
        # Ko'p qatorli: pastki oltin chiziq (y=1732) gacha 5 qator sig'adi
        'search_modules': baseline_field(value_x, rows['search_modules'], 38, value_w, multiline=True, line_height=52, max_lines=5),
    }
    qr = {'center_x': round(516 / W, 4), 'center_y': round(2095 / H, 4), 'size': round(270 / W, 4)}
    return src, {
        'image': 'sertifikat.jpg', 'size': [W, H], 'orientation': 'landscape', 'fields': fields, 'qr': qr,
    }


# ---------------------------------------------------------------- hisobot muqovasi (asl dizayn)

TITLE_COLOR = (40, 108, 128)  # asl sarlavha rangi (#286c80)


def fix_familiya(img: Image.Image) -> Image.Image:
    """
    Muqovadagi «Muallif familya, ismi, sharifi:» → «familiya».
    Harf ustunlari (o'lchangan, qator y=1385..1480): ... m(472-532) i(540-553) l(562-573) y(578-622) ...
    Shu so'zdagi asl «i» (540-553) nusxalanib «l» dan keyin qo'yiladi, «ya, ismi, sharifi:» 21 px o'ngga
    suriladi (oxiri x=1175 — ko'k chiziq x=1206 gacha sig'adi). Yangi harf chizilmaydi.
    """
    img = img.copy()
    y0, y1 = 1385, 1481
    letter_i = img.crop((540, y0, 554, y1))
    tail = img.crop((578, y0, 1165, y1))
    img.paste((255, 255, 255), (574, y0, 1190, y1))
    img.paste(letter_i, (581, y0))
    img.paste(tail, (599, y0))
    return img


def _draw_tracked(d: ImageDraw.ImageDraw, x: float, baseline: int, text: str, font, tracking: float, stroke: int):
    for ch in text:
        d.text((x, baseline), ch, font=font, fill=TITLE_COLOR, stroke_width=stroke, stroke_fill=TITLE_COLOR, anchor='ls')
        x += font.getlength(ch) + tracking


def _tracked_width(text: str, font, tracking: float, stroke: int) -> float:
    return sum(font.getlength(ch) for ch in text) + tracking * (len(text) - 1) + 2 * stroke


def build_report_cover():
    """
    Antiplagiat hisobot muqovasi — Phoenix'ning asl dizayni (src/classic_hisobot1.jpg).
    Asl rasmdagi sarlavha «MAQOLALAR NASHRI HAQIDA HISOBOT» antiplagiat hisobotiga mos emas edi:
    u fon bilan (2-sahifa foni bilan piksel-piksel bir xil) yopilib, o'rniga
    «ANTIPLAGIAT TEKSHIRUVI / HISOBOTI» asl uslubga yaqin geometrik shriftda (Century Gothic Bold,
    qalinlashtirilgan) yoziladi. Yorliqlar, chiziq, dafna va logotip o'zgarmaydi.
    O'lchovlar (2481x3509): yuqori yorliqlar bosh harfi 346..396; muallif yorliqlari tayanch chiziqlari
    1453/1544/1634; ko'k vertikal chiziq x=1206 (y 1265..1789); dafna ichi markazi (674, 2645).
    """
    cover = fix_familiya(Image.open(SRC_DIR / 'classic_hisobot1.jpg').convert('RGB'))
    inner = Image.open(SRC_DIR / 'classic_hisobot2.jpg').convert('RGB')
    W, H = cover.size

    # Eski sarlavhani (y 752..1061) toza fon bilan yopish
    cover.paste(inner.crop((0, 735, W, 1080)), (0, 735))

    # Yangi sarlavha: asl bilan bir xil markaz (x≈1205, blok markazi y≈906) va bosh harf balandligi
    gothic = str(FONT_DIR / 'GOTHICB.TTF')
    stroke = 3
    cap = 135
    probe = ImageFont.truetype(gothic, 100)
    b = probe.getbbox('H')
    size = int(100 * (cap - 2 * stroke) / (b[3] - b[1]))
    font = ImageFont.truetype(gothic, size)
    # Harf oralig'i tabiiy (ozgina zichlashtirilgan); sahifaga sig'masa o'lcham kichrayadi
    tracking = -2
    lines = ['ANTIPLAGIAT TEKSHIRUVI', 'HISOBOTI']
    max_w = 1900
    widths = [_tracked_width(t, font, tracking, stroke) for t in lines]
    if max(widths) > max_w:  # birinchi qator sahifaga sig'masa — ikkala qator teng kichraytiriladi
        k = max_w / max(widths)
        size = int(size * k)
        font = ImageFont.truetype(gothic, size)
        tracking *= k
        cap = int(cap * k)
        widths = [_tracked_width(t, font, tracking, stroke) for t in lines]
    gap = int(cap * 39 / 135)
    block = 2 * cap + gap
    base1 = int(906 - block / 2 + cap)
    base2 = base1 + cap + gap
    d = ImageDraw.Draw(cover)
    cx = 1205
    for text, w, base in zip(lines, widths, (base1, base2)):
        _draw_tracked(d, cx - w / 2 + stroke, base, text, font, tracking, stroke)

    dark = '#1f2f4a'
    fields = {
        # Yuqori qator: yorliq ostida, chap chetiga tekis
        'upload_date': field(299, 486, W, H, 60, 1000, color=dark, bold=True, baseline=True),
        'document_number': field(1509, 486, W, H, 60, 880, color=dark, bold=True, baseline=True),
        # Ko'k chiziqdan o'ngda, yorliqlar bilan bir tayanch chiziqda
        'author': field(1250, 1453, W, H, 56, 1130, color=dark, bold=True, baseline=True),
        'workplace': field(1250, 1544, W, H, 52, 1130, color=dark, baseline=True),
        'position': field(1250, 1634, W, H, 52, 1130, color=dark, baseline=True),
    }
    qr = {'center_x': round(674 / W, 4), 'center_y': round(2645 / H, 4), 'size': round(290 / W, 4)}
    return cover, {
        'image': 'hisobot1.jpg', 'size': [W, H], 'orientation': 'portrait', 'fields': fields, 'qr': qr,
    }


# ---------------------------------------------------------------- hisobot ichki sahifasi (asl dizayn)

def build_report_inner():
    """Ichki sahifalar — asl ramka (src/classic_hisobot2.jpg) o'zgarishsiz; matn oq maydonga yoziladi."""
    inner = Image.open(SRC_DIR / 'classic_hisobot2.jpg').convert('RGB')
    W, H = inner.size
    return inner, {
        'image': 'hisobot2.jpg', 'size': [W, H], 'orientation': 'portrait',
        # yuqori ramka ~y=420 gacha, pastki naqsh ~y=3120 dan — orasidagi oq maydon
        'content_box': {'x': 0.085, 'y': 0.135, 'w': 0.83, 'h': 0.735},
        'typography': {'title': 66, 'body': 42, 'link': 38, 'line_height': 60},
    }


# ---------------------------------------------------------------- TypeScript

def _ts_fields(fields: dict) -> str:
    lines = []
    for key, spec in fields.items():
        parts = [f"x: {spec['x']}", f"y: {spec['y']}", f"size: {spec['size']}", f"color: '{spec['color']}'",
                 f"max_width: {spec['max_width']}"]
        if spec.get('bold'):
            parts.append('bold: true')
        if spec.get('baseline'):
            parts.append('baseline: true')
        if spec.get('max_lines'):
            parts.append(f"max_lines: {spec['max_lines']}")
        if spec.get('multiline'):
            parts.append('multiline: true')
            # CSS line-height nisbat sifatida (px / shrift o'lchami)
            parts.append(f"line_height: {round(spec['line_height'] / spec['size'], 2)}")
        lines.append(f"    {key}: {{ {', '.join(parts)} }},")
    return '\n'.join(lines)


def write_ts(layout: dict):
    cert, cover, inner = layout['certificate'], layout['report_cover'], layout['report_inner']

    def qr_ts(q):
        return f"{{ center_x: {q['center_x']}, center_y: {q['center_y']}, size: {q['size']} }}"

    ts = f"""/** JPG shablon ustidagi matn koordinatalari (backend layout.json bilan sinxron).
 *  Avtomatik yaratilgan: scripts/build_antiplag_templates.py — qo'lda o'zgartirmang. */

export const ANTIPLAG_TEMPLATE_BASE = '/antiplag-templates';

export type TemplateFieldSpec = {{
  x: number;
  y: number;
  size: number;
  color: string;
  max_width: number;
  bold?: boolean;
  multiline?: boolean;
  line_height?: number;
  /** y — matnning tayanch chizig'i (yorliq bilan bir chiziqda); aks holda yuqori chegara */
  baseline?: boolean;
  max_lines?: number;
}};

export type QrSpec = {{
  size: number;
  center_x?: number;
  center_y?: number;
  x?: number;
  y?: number;
}};

export const CERTIFICATE_TEMPLATE = {{
  image: `${{ANTIPLAG_TEMPLATE_BASE}}/sertifikat.jpg`,
  width: {cert['size'][0]},
  height: {cert['size'][1]},
  aspect: '{cert['size'][0]} / {cert['size'][1]}',
  fields: {{
{_ts_fields(cert['fields'])}
  }} satisfies Record<string, TemplateFieldSpec>,
  qr: {qr_ts(cert['qr'])} satisfies QrSpec,
}} as const;

export const REPORT_COVER_TEMPLATE = {{
  image: `${{ANTIPLAG_TEMPLATE_BASE}}/hisobot1.jpg`,
  width: {cover['size'][0]},
  height: {cover['size'][1]},
  aspect: '{cover['size'][0]} / {cover['size'][1]}',
  fields: {{
{_ts_fields(cover['fields'])}
  }} satisfies Record<string, TemplateFieldSpec>,
  qr: {qr_ts(cover['qr'])} satisfies QrSpec,
}} as const;

export const REPORT_INNER_TEMPLATE = {{
  image: `${{ANTIPLAG_TEMPLATE_BASE}}/hisobot2.jpg`,
  width: {inner['size'][0]},
  height: {inner['size'][1]},
  aspect: '{inner['size'][0]} / {inner['size'][1]}',
  content_box: {{ x: {inner['content_box']['x']}, y: {inner['content_box']['y']}, w: {inner['content_box']['w']}, h: {inner['content_box']['h']} }},
}} as const;
"""
    TS_LAYOUT.write_text(ts, encoding='utf-8')


def main():
    cert_img, cert_layout = build_certificate()
    cover_img, cover_layout = build_report_cover()
    inner_img, inner_layout = build_report_inner()
    layout = {'certificate': cert_layout, 'report_cover': cover_layout, 'report_inner': inner_layout}
    for target in (BACKEND_DIR, FRONTEND_DIR):
        target.mkdir(parents=True, exist_ok=True)
        # Asl rasmlar: tuzatish kiritilganlari yuqori sifatda saqlanadi, ichki sahifa aynan nusxalanadi
        cert_img.save(target / 'sertifikat.jpg', quality=95, subsampling=0, optimize=True)
        cover_img.save(target / 'hisobot1.jpg', quality=95, subsampling=0, optimize=True)
        shutil.copyfile(SRC_DIR / 'classic_hisobot2.jpg', target / 'hisobot2.jpg')
        (target / 'layout.json').write_text(json.dumps(layout, ensure_ascii=False, indent=2), encoding='utf-8')
    write_ts(layout)
    print('Shablonlar yaratildi:', BACKEND_DIR, FRONTEND_DIR)


if __name__ == '__main__':
    main()
