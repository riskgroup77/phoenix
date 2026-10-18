"""
Shablon rasmlarining tilga moslangan nusxalari (ru, en, uz-cyrl) — o'zbekcha (lotin) asl rasmlardan.

Asl rasmlarda yorliqlar rasmning o'ziga «pishirilgan» (MUALLIF, HUJJAT RAQAMI, SERTIFIKAT ...).
Har bir til uchun:
  1) yorliq turgan to'rtburchakdagi matn piksellari aniqlanadi (chegaradan interpolyatsiya qilingan fon bilan
     farqi katta piksellar + kengaytirish) va atrofdagi fon bilan to'ldiriladi (garmonik inpaint) —
     fon (gradient, marmar, to'lqin chiziqlar) matn bo'lmagan joylarda o'zgarmaydi;
  2) tarjima qilingan yorliq xuddi shu joyga, shu rang va bosh harf balandligida chiziladi
     (uzun yorliq ajratilgan kenglikka sig'guncha kichraytiriladi — qiymatlar koordinatasi o'zgarmaydi).

Natija (ikkala nusxa bir xil):
  backend/assets/antiplag_templates/{sertifikat,hisobot1}.{ru,en,uz-cyrl}.jpg
  frontend/public/antiplag-templates/{...}
  backend/assets/udk_template/udk_malumotnoma.{ru,en,uz-cyrl}.jpg
  frontend/public/udk-template/{...}

Shriftlar: lotin — Lexend-Bold, kirill — DejaVu Sans Bold (repo: backend/assets/hisobot_template/fonts);
sarlavhalar — Noto Serif Display / Noto Serif Bold (Linux: fonts-noto), bo'lmasa DejaVu Serif Bold.

Ishga tushirish (repo ildizidan):
  backend/venv/bin/python scripts/build_localized_templates.py [--preview DIR]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'backend'))
from config.doc_i18n import to_cyrillic  # noqa: E402

REPO_FONTS = ROOT / 'backend' / 'assets' / 'hisobot_template' / 'fonts'
SYS_FONTS = Path('/usr/share/fonts/truetype')

FONTS = {
    'sans_lat': [REPO_FONTS / 'Lexend-Bold.ttf'],
    'sans_cyr': [REPO_FONTS / 'DejaVuSans-Bold.ttf'],
    # guruhdagi eng uzun yorliq juda kichrayib ketsa — butun guruh tor (condensed) shriftda
    'sans_cyr_cond': [SYS_FONTS / 'dejavu' / 'DejaVuSansCondensed-Bold.ttf', REPO_FONTS / 'DejaVuSans-Bold.ttf'],
    'display': [SYS_FONTS / 'noto' / 'NotoSerifDisplay-Bold.ttf', SYS_FONTS / 'dejavu' / 'DejaVuSerif-Bold.ttf'],
    'serif': [SYS_FONTS / 'noto' / 'NotoSerif-Bold.ttf', SYS_FONTS / 'dejavu' / 'DejaVuSerif-Bold.ttf'],
}

LANGS = ('ru', 'en', 'uz-cyrl')

# Yorliq matnlari: kalit → (uz, ru, en). uz-cyrl — o'zbekcha matn kirillga o'giriladi.
TEXTS: dict[str, tuple[str, str, str]] = {
    # --- antiplagiat sertifikati
    'c_check_date': ('TEKSHIRISH SANASI', 'ДАТА ПРОВЕРКИ', 'CHECK DATE'),
    'c_doc_number': ('HUJJAT RAQAMI', 'НОМЕР ДОКУМЕНТА', 'DOCUMENT NUMBER'),
    'c_title': ('SERTIFIKAT', 'СЕРТИФИКАТ', 'CERTIFICATE'),
    'c_author': ('MUALLIF', 'АВТОР', 'AUTHOR'),
    'c_work_type': ('ISH TURI', 'ТИП РАБОТЫ', 'WORK TYPE'),
    'c_file_name': ('FAYL NOMI', 'ИМЯ ФАЙЛА', 'FILE NAME'),
    'c_citations': ('IQTIBOSLAR', 'ЦИТИРОВАНИЯ', 'CITATIONS'),
    'c_self_citation': ('O‘Z-O‘ZIGA IQTIBOS', 'САМОЦИТИРОВАНИЕ', 'SELF-CITATION'),
    'c_plagiarism': ('O‘ZLASHTIRISH', 'ЗАИМСТВОВАНИЯ', 'PLAGIARISM'),
    'c_originality': ('ORIGINALLIK', 'ОРИГИНАЛЬНОСТЬ', 'ORIGINALITY'),
    'c_website': ('WEB-SAYT', 'ВЕБ-САЙТ', 'WEBSITE'),
    'c_search': ('QIDIRUV TIZIMLARI', 'ПОИСКОВЫЕ СИСТЕМЫ', 'SEARCH ENGINES'),
    'c_qr1': ('TEKSHIRISH UCHUN QR', 'ДЛЯ ПРОВЕРКИ', 'SCAN THE QR CODE'),
    'c_qr2': ('KODDAN FOYDALANING', 'ОТСКАНИРУЙТЕ QR-КОД', 'TO VERIFY'),
    # --- antiplagiat hisobot muqovasi
    'h_upload_date': ('Hujjat yaratilgan sana:', 'Дата создания документа:', 'Document date:'),
    'h_doc_number': ('Hujjat raqami:', 'Номер документа:', 'Document number:'),
    'h_title1': ('ANTIPLAGIAT TEKSHIRUVI', 'ОТЧЁТ О ПРОВЕРКЕ', 'ANTI-PLAGIARISM'),
    'h_title2': ('HISOBOTI', 'НА АНТИПЛАГИАТ', 'CHECK REPORT'),
    'h_author': ('Muallif familiya, ismi, sharifi:', 'Ф.И.О. автора:', 'Author’s full name:'),
    'h_workplace': ('Muallif ish yoki o‘qish joyi:', 'Место работы или учёбы:', 'Place of work or study:'),
    'h_position': ('Muallifning lavozimi:', 'Должность автора:', 'Author’s position:'),
    'h_qr1': ('HUJJATNI TEKSHIRISH', 'ДЛЯ ПРОВЕРКИ', 'SCAN THE QR CODE'),
    'h_qr2': ('UCHUN QR KODDAN', 'ДОКУМЕНТА', 'TO VERIFY'),
    'h_qr3': ('FOYDALANING', 'ОТСКАНИРУЙТЕ QR-КОД', 'THE DOCUMENT'),
    # --- UDK ma'lumotnoma
    'u_doc_number': ('HUJJAT RAQAMI:', 'ДОКУМЕНТ №:', 'DOCUMENT NO.:'),
    'u_doc_date': ('HUJJAT SANASI:', 'ДАТА ВЫДАЧИ:', 'ISSUE DATE:'),
    'u_title1': ('UDK HAQIDA', 'СПРАВКА', 'UDC INDEX'),
    'u_title2': ('MA’LUMOTNOMA', 'ОБ ИНДЕКСЕ УДК', 'CERTIFICATE'),
    'u_author': ('MUALLIF', 'АВТОР', 'AUTHOR'),
    'u_title': ('ISH NOMI', 'НАЗВАНИЕ РАБОТЫ', 'TITLE'),
    'u_code': ('UDK RAQAMI', 'ИНДЕКС УДК', 'UDC CODE'),
    'u_website': ('WEB-SAYT', 'ВЕБ-САЙТ', 'WEBSITE'),
    'u_qr1': ('TEKSHIRISH UCHUN', 'ДЛЯ ПРОВЕРКИ', 'SCAN THE'),
    'u_qr2': ('QR KODDAN', 'ОТСКАНИРУЙТЕ', 'QR CODE'),
    'u_qr3': ('FOYDALANING', 'QR-КОД', 'TO VERIFY'),
    # --- Hujjat holati haqida ma'lumotnoma ("Ishlarim" dagi har bir hujjat uchun)
    'm_doc_number': ('HUJJAT RAQAMI:', 'ДОКУМЕНТ №:', 'DOCUMENT NO.:'),
    'm_doc_date': ('HUJJAT SANASI:', 'ДАТА ВЫДАЧИ:', 'ISSUE DATE:'),
    'm_title1': ('QABUL HAQIDA', 'СПРАВКА', 'CERTIFICATE'),
    'm_title2': ('MA’LUMOTNOMA', 'О ПРИЁМЕ', 'OF ACCEPTANCE'),
    'm_author': ('MUALLIF', 'АВТОР', 'AUTHOR'),
    'm_work_type': ('ISH TURI', 'ВИД РАБОТЫ', 'WORK TYPE'),
    'm_work_title': ('ISH NOMI', 'НАЗВАНИЕ РАБОТЫ', 'TITLE'),
    'm_journal': ('JURNAL NOMI', 'НАЗВАНИЕ ЖУРНАЛА', 'JOURNAL'),
    'm_org': ('TASHKILOT NOMI', 'ОРГАНИЗАЦИЯ', 'ORGANIZATION'),
    'm_pub_date': ('NASHR ETILISH SANASI', 'ДАТА ПУБЛИКАЦИИ', 'PUBLICATION DATE'),
    'm_status': ('HOZIRGI HOLATI', 'ТЕКУЩИЙ СТАТУС', 'CURRENT STATUS'),
    'm_website': ('WEB-SAYT', 'ВЕБ-САЙТ', 'WEBSITE'),
    'm_qr1': ('TEKSHIRISH UCHUN', 'ДЛЯ ПРОВЕРКИ', 'SCAN THE'),
    'm_qr2': ('QR KODDAN', 'ОТСКАНИРУЙТЕ', 'QR CODE'),
    'm_qr3': ('FOYDALANING', 'QR-КОД', 'TO VERIFY'),
}


def text_for(key: str, lang: str) -> str:
    uz, ru, en = TEXTS[key]
    if lang == 'uz-cyrl':
        return to_cyrillic(uz)
    return {'ru': ru, 'en': en, 'uz': uz}[lang]


def L(key, x, baseline, cap, color, right, *, font='sans', align='left', tracking=0.0, group=None):
    """Yorliq: x — chap chet (align=left) yoki markaz (align=center); right — o'ng chegara (left) / max kenglik (center).
    group — bir guruhdagi yorliqlar bir xil o'lchamda chiziladi (eng uzuni sig'adigan o'lcham)."""
    return dict(key=key, x=x, baseline=baseline, cap=cap, color=color, right=right, font=font, align=align,
                tracking=tracking, group=group or key)


C_TEAL, C_DARK = '#0a98b0', '#3d566e'
H_COL = '#286c81'

# Koordinatalar asl rasm pikselida (yorliqlardan o'lchangan). erase — tozalanadigan to'rtburchaklar (chegarasida
# matn bo'lmasligi kerak); labels — qayta chiziladigan yorliqlar.
TEMPLATES = {
    'sertifikat': {
        'src': ROOT / 'backend' / 'assets' / 'antiplag_templates' / 'sertifikat.jpg',
        'dests': [ROOT / 'backend' / 'assets' / 'antiplag_templates', ROOT / 'frontend' / 'public' / 'antiplag-templates'],
        'erase': [(165, 200, 1600, 282), (320, 470, 1860, 692), (172, 893, 797, 1482), (262, 2322, 772, 2422)],
        'labels': [
            L('c_check_date', 180, 257, 39, C_DARK, 960, group='c_top'),
            L('c_doc_number', 1004, 257, 39, C_DARK, 1590, group='c_top'),
            L('c_title', 1087, 669, 182, '#3d556d', 1560, font='display', align='center'),
            L('c_author', 188, 955, 43, C_TEAL, 795, group='c_list'),
            L('c_work_type', 188, 1017, 43, C_TEAL, 795, group='c_list'),
            L('c_file_name', 188, 1080, 43, C_TEAL, 795, group='c_list'),
            L('c_citations', 188, 1142, 43, C_TEAL, 795, group='c_list'),
            L('c_self_citation', 188, 1205, 43, C_TEAL, 795, group='c_list'),
            L('c_plagiarism', 188, 1268, 43, C_TEAL, 795, group='c_list'),
            L('c_originality', 188, 1330, 43, C_DARK, 795, group='c_list'),
            L('c_website', 188, 1393, 43, C_TEAL, 795, group='c_list'),
            L('c_search', 188, 1455, 43, C_TEAL, 795, group='c_list'),
            L('c_qr1', 516, 2362, 30, C_TEAL, 500, align='center', group='c_qr'),
            L('c_qr2', 516, 2405, 30, C_TEAL, 500, align='center', group='c_qr'),
        ],
    },
    'hisobot1': {
        'src': ROOT / 'backend' / 'assets' / 'antiplag_templates' / 'hisobot1.jpg',
        'dests': [ROOT / 'backend' / 'assets' / 'antiplag_templates', ROOT / 'frontend' / 'public' / 'antiplag-templates'],
        'erase': [(280, 328, 2010, 430), (235, 745, 2170, 1072), (110, 1380, 1192, 1672), (350, 2908, 1000, 3132)],
        'labels': [
            L('h_upload_date', 299, 397, 51, H_COL, 1450, group='h_top'),
            L('h_doc_number', 1509, 397, 51, H_COL, 2380, group='h_top'),
            L('h_title1', 1200, 894, 131, '#286c7f', 1980, align='center', group='h_title'),
            L('h_title2', 1200, 1053, 131, '#286c7f', 1980, align='center', group='h_title'),
            L('h_author', 127, 1454, 57, H_COL, 1188, group='h_list'),
            L('h_workplace', 127, 1545, 57, H_COL, 1188, group='h_list'),
            L('h_position', 127, 1635, 57, H_COL, 1188, group='h_list'),
            L('h_qr1', 673, 2973, 45, H_COL, 640, align='center', group='h_qr'),
            L('h_qr2', 673, 3042, 45, H_COL, 640, align='center', group='h_qr'),
            L('h_qr3', 673, 3112, 45, H_COL, 640, align='center', group='h_qr'),
        ],
    },
    'udk_malumotnoma': {
        'src': ROOT / 'backend' / 'assets' / 'udk_template' / 'udk_malumotnoma.jpg',
        'dests': [ROOT / 'backend' / 'assets' / 'udk_template', ROOT / 'frontend' / 'public' / 'udk-template'],
        # marmar fon: to'ldirilgan joyga shu toza maydonning mayda tuzilishi (donadorligi) ko'chiriladi
        'texture_src': (660, 320, 1300, 510),
        'erase': [(60, 45, 398, 100), (728, 45, 1054, 100), (188, 122, 1196, 296), (80, 520, 632, 728),
                  (408, 1280, 698, 1392)],
        'labels': [
            # qiymat shu qatorda x=405 / x=1060 dan boshlanadi — yorliq o'ng chegarasi undan oldin
            L('u_doc_number', 72, 85, 30, '#074ba7', 392, group='u_top'),
            L('u_doc_date', 739, 85, 30, '#074ba6', 1048, group='u_top'),
            L('u_title1', 623, 186, 53, '#0897b0', 940, font='serif', align='center', tracking=0.14),
            L('u_title2', 690, 284, 70, '#034bab', 1060, font='serif', align='center', tracking=0.14),
            L('u_author', 90, 566, 35, '#0897af', 625, group='u_list'),
            L('u_title', 90, 616, 35, '#0897af', 625, group='u_list'),
            L('u_code', 90, 665, 35, '#0897af', 625, group='u_list'),
            L('u_website', 90, 715, 35, '#0897af', 625, group='u_list'),
            L('u_qr1', 551, 1310, 22, '#1194ab', 280, align='center', group='u_qr'),
            L('u_qr2', 551, 1344, 22, '#1194ab', 280, align='center', group='u_qr'),
            L('u_qr3', 551, 1378, 22, '#1194ab', 280, align='center', group='u_qr'),
        ],
    },
    'malumotnoma': {
        'src': ROOT / 'backend' / 'assets' / 'reference_template' / 'malumotnoma.jpg',
        'dests': [ROOT / 'backend' / 'assets' / 'reference_template'],
        'texture_src': (700, 320, 1300, 400),
        'erase': [(60, 45, 398, 100), (728, 45, 1054, 100), (188, 122, 1196, 296), (78, 440, 632, 846),
                  (408, 1280, 698, 1390)],
        'labels': [
            # qiymatlar: yuqorida x=405 / x=1060 dan, ro'yxatda vertikal chiziqdan keyin (x=700)
            L('m_doc_number', 72, 83, 29, '#0c5984', 392, group='m_top'),
            L('m_doc_date', 739, 83, 29, '#0d5983', 1048, group='m_top'),
            L('m_title1', 681, 184, 51, '#047a9b', 1000, font='serif', align='center', tracking=0.14),
            L('m_title2', 690, 282, 68, '#085885', 1060, font='serif', align='center', tracking=0.14),
            L('m_author', 87, 486, 33, '#057a9a', 625, group='m_list'),
            L('m_work_type', 87, 536, 33, '#057a9b', 625, group='m_list'),
            L('m_work_title', 87, 586, 33, '#057a9b', 625, group='m_list'),
            L('m_journal', 87, 636, 33, '#057a9b', 625, group='m_list'),
            L('m_org', 87, 686, 33, '#057a9b', 625, group='m_list'),
            L('m_pub_date', 87, 736, 33, '#057b9b', 625, group='m_list'),
            L('m_status', 87, 786, 33, '#0a5984', 625, group='m_list'),
            L('m_website', 87, 835, 33, '#057b9b', 625, group='m_list'),
            L('m_qr1', 551, 1309, 21, '#0e7a98', 290, align='center', group='m_qr'),
            L('m_qr2', 551, 1342, 21, '#0e7a98', 290, align='center', group='m_qr'),
            L('m_qr3', 551, 1376, 21, '#0e7a98', 290, align='center', group='m_qr'),
        ],
    },
}


# ---------------------------------------------------------------- fonlarni tozalash

def _coons(region: np.ndarray, band: int = 3) -> np.ndarray:
    """To'rtburchak chegarasidan (3 px chiziq o'rtachasi) ichkariga Coons interpolyatsiyasi."""
    h, w, _ = region.shape
    top = region[:band].mean(0)
    bottom = region[-band:].mean(0)
    left = region[:, :band].mean(1)
    right = region[:, -band:].mean(1)
    ty = np.linspace(0, 1, h)[:, None, None]
    tx = np.linspace(0, 1, w)[None, :, None]
    v = top[None] * (1 - ty) + bottom[None] * ty
    hh = left[:, None] * (1 - tx) + right[:, None] * tx
    c = ((region[0, 0] * (1 - tx) + region[0, -1] * tx) * (1 - ty)
         + (region[-1, 0] * (1 - tx) + region[-1, -1] * tx) * ty)
    return v + hh - c


def _dilate(mask: np.ndarray, r: int) -> np.ndarray:
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy > r * r:
                continue
            out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


def erase_box(arr: np.ndarray, box: tuple[int, int, int, int], *, core: float = 90, halo: float = 18,
              iterations: int = 400, texture: np.ndarray | None = None) -> None:
    """Qutidagi matnni o'chirish: faqat matn piksellari atrofdagi fondan garmonik to'ldiriladi.

    Matn yadrosi — fondan keskin farq qiladigan (to'q) piksellar; ularning 5 px atrofidagi kuchsizroq farqli
    piksellar (antialias) ham qo'shiladi. Uzoqdagi och chiziqlar (to'lqinlar, marmar) saqlanib qoladi.
    """
    x0, y0, x1, y1 = box
    region = arr[y0:y1, x0:x1].astype(np.float32)
    bg = _coons(region)
    diff = np.abs(region - bg).max(axis=2)
    mask = _dilate((diff > halo) & _dilate(diff > core, 5), 2)
    mask[0, :] = mask[-1, :] = mask[:, 0] = mask[:, -1] = False
    out = region.copy()
    out[mask] = bg[mask]
    for _ in range(iterations):
        avg = (np.roll(out, 1, 0) + np.roll(out, -1, 0) + np.roll(out, 1, 1) + np.roll(out, -1, 1)) / 4
        out[mask] = avg[mask]
    if texture is not None:
        th, tw = texture.shape[:2]
        h, w = mask.shape
        tiled = np.tile(texture, ((h + th - 1) // th, (w + tw - 1) // tw, 1))[:h, :w]
        out[mask] = out[mask] + tiled[mask]
    arr[y0:y1, x0:x1] = np.clip(out, 0, 255).astype(np.uint8)


def _box_blur(a: np.ndarray, r: int) -> np.ndarray:
    out = np.zeros_like(a)
    n = 0
    for dy in range(-r, r + 1, max(1, r // 2)):
        for dx in range(-r, r + 1, max(1, r // 2)):
            out += np.roll(np.roll(a, dy, 0), dx, 1)
            n += 1
    return out / n


# ---------------------------------------------------------------- yorliq chizish

_font_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def _font_path(kind: str) -> Path:
    for p in FONTS[kind]:
        if p.is_file():
            return p
    raise SystemExit(f'Shrift topilmadi: {FONTS[kind]}')


def _font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    key = (kind, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(str(_font_path(kind)), size)
    return _font_cache[key]


def _is_cyr(text: str) -> bool:
    return any('Ѐ' <= ch <= 'ӿ' for ch in text)


def _font_kind(label_font: str, text: str) -> str:
    if label_font == 'sans':
        return 'sans_cyr' if _is_cyr(text) else 'sans_lat'
    return label_font


def _cap_ratio(kind: str, text: str) -> float:
    probe = 'Н' if _is_cyr(text) else 'H'
    f = _font(kind, 1000)
    top = f.getbbox(probe, anchor='ls')[1]
    return -top / 1000


def _width(font, text: str, tracking_px: float) -> float:
    if not tracking_px:
        return font.getlength(text)
    return sum(font.getlength(ch) for ch in text) + tracking_px * (len(text) - 1)


def _fit_size(spec: dict, text: str, kind: str) -> int:
    """Bosh harf balandligi asl yorliqqa teng o'lcham; ajratilgan kenglikka sig'maguncha kichraytiriladi."""
    size = max(8, round(spec['cap'] / _cap_ratio(kind, text)))
    max_w = spec['right'] - spec['x'] if spec['align'] == 'left' else spec['right']
    while size > 8 and _width(_font(kind, size), text, spec['tracking'] * size) > max_w:
        size -= 1
    return size


def draw_label(img: Image.Image, spec: dict, text: str, kind: str, size: int) -> None:
    draw = ImageDraw.Draw(img)
    font = _font(kind, size)
    tracking = spec['tracking'] * size
    w = _width(font, text, tracking)
    x = spec['x'] if spec['align'] == 'left' else spec['x'] - w / 2
    if not tracking:
        draw.text((x, spec['baseline']), text, fill=spec['color'], font=font, anchor='ls')
        return
    for ch in text:
        draw.text((x, spec['baseline']), ch, fill=spec['color'], font=font, anchor='ls')
        x += font.getlength(ch) + tracking


def _group_layout(labels: list[dict], lang: str) -> dict[str, tuple[str, int]]:
    """Guruh bo'yicha shrift va o'lcham: guruhdagi eng uzun yorliq sig'adigan umumiy o'lcham."""
    result: dict[str, tuple[str, int]] = {}
    groups: dict[str, list[dict]] = {}
    for spec in labels:
        groups.setdefault(spec['group'], []).append(spec)
    for members in groups.values():
        texts = [text_for(m['key'], lang) for m in members]
        kind = _font_kind(members[0]['font'], texts[0])

        def sizes(k):
            natural = [max(8, round(m['cap'] / _cap_ratio(k, t))) for m, t in zip(members, texts)]
            fitted = [_fit_size(m, t, k) for m, t in zip(members, texts)]
            ratio = min(f / n for f, n in zip(fitted, natural))
            return ratio, natural

        ratio, natural = sizes(kind)
        if kind == 'sans_cyr' and ratio < 0.85:
            kind = 'sans_cyr_cond'
            ratio, natural = sizes(kind)
        for m, n in zip(members, natural):
            result[m['key']] = (kind, max(8, int(n * ratio)))
    return result


def build_variant(name: str, lang: str) -> Image.Image:
    tpl = TEMPLATES[name]
    arr = np.array(Image.open(tpl['src']).convert('RGB'))
    texture = None
    if tpl.get('texture_src'):
        x0, y0, x1, y1 = tpl['texture_src']
        patch = arr[y0:y1, x0:x1].astype(np.float32)
        texture = (patch - _box_blur(patch, 6)).mean(axis=2, keepdims=True)  # faqat yorqinlik, rangsiz
    for box in tpl['erase']:
        erase_box(arr, box, texture=texture)
    img = Image.fromarray(arr)
    layout = _group_layout(tpl['labels'], lang)
    for spec in tpl['labels']:
        kind, size = layout[spec['key']]
        draw_label(img, spec, text_for(spec['key'], lang), kind, size)
    return img


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', help="Faqat shu papkaga yoziladi (repo fayllari o'zgarmaydi)")
    ap.add_argument('--only', help='Shablon nomi (sertifikat | hisobot1 | udk_malumotnoma | malumotnoma)')
    args = ap.parse_args()
    for name, tpl in TEMPLATES.items():
        if args.only and name != args.only:
            continue
        for lang in LANGS:
            img = build_variant(name, lang)
            fname = f'{name}.{lang}.jpg'
            dests = [Path(args.preview)] if args.preview else tpl['dests']
            for d in dests:
                d.mkdir(parents=True, exist_ok=True)
                img.save(d / fname, format='JPEG', quality=92, optimize=True)
            print('ok', fname)


if __name__ == '__main__':
    main()
