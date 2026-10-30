"""Jurnal muqovasini siqish.

Muqovalar faqat kichik kartochkalarda ko'rinadi, lekin 1–4 MB lik asl fayllar yuklanardi —
bosh sahifada rasmlar o'nlab soniya ochilmasdi. Fayl joyida (nomi va URL o'zgarmay) kichraytiriladi.
"""
import logging
import os

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

MAX_SIDE = 800
JPEG_QUALITY = 82
# Bundan kichik va o'lchami me'yorda bo'lgan fayl tegilmaydi
SKIP_BELOW_BYTES = 300 * 1024


def shrink_cover(path: str) -> bool:
    """Rasmni MAX_SIDE gacha kichraytirib, formatini saqlagan holda qayta yozadi. O'zgargan bo'lsa True."""
    if not path or not os.path.isfile(path):
        return False
    try:
        size_before = os.path.getsize(path)
        with Image.open(path) as im:
            fmt = (im.format or '').upper()
            if fmt not in ('JPEG', 'PNG', 'WEBP'):
                return False
            if max(im.size) <= MAX_SIDE and size_before <= SKIP_BELOW_BYTES:
                return False
            im = ImageOps.exif_transpose(im)
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            tmp = f'{path}.tmp'
            if fmt == 'JPEG':
                if im.mode not in ('RGB', 'L'):
                    im = im.convert('RGB')
                im.save(tmp, 'JPEG', quality=JPEG_QUALITY, optimize=True, progressive=True)
            elif fmt == 'PNG':
                im.save(tmp, 'PNG', optimize=True)
            else:
                im.save(tmp, 'WEBP', quality=JPEG_QUALITY)
        if os.path.getsize(tmp) >= size_before:
            os.remove(tmp)
            return False
        os.replace(tmp, path)
        return True
    except Exception:
        logger.exception('Jurnal muqovasini siqib bo\'lmadi: %s', path)
        try:
            os.remove(f'{path}.tmp')
        except OSError:
            pass
        return False
