"""
Antiplagiat sertifikatining «bir nechta muallif» nusxalari: MUALLIF → MUALLIFLAR (АВТОР → АВТОРЫ, AUTHOR → AUTHORS,
МУАЛЛИФ → МУАЛЛИФЛАР).

Yorliqlar rasmga «pishirilgan», asl o'zbekcha rasmdagi shrift esa repodagi shriftlarga mos emas — shuning uchun
yetishmaydigan harflar shu rasmning o'zidagi boshqa yorliqdan piksel-piksel ko'chiriladi (shrift, o'lcham va rang
aynan bir xil bo'ladi):
  uz       MUALLIF + «LAR»  ← IQTIBOSLAR
  uz-cyrl  МУАЛЛИФ + «ЛАР»  ← ИҚТИБОСЛАР
  en       AUTHOR  + «S»    ← CITATIONS
  ru       АВТОР   + «Ы»    ← ТИП РАБОТЫ

Natija: frontend/public/antiplag-templates/sertifikat.authors[.<til>].jpg
(frontend: localizedTemplateUrl('sertifikat.authors.jpg', lang) — mualliflar 2 va undan ko'p bo'lsa).

Ishga tushirish (repo ildizidan):
  backend/venv/bin/python scripts/build_authors_templates.py [--preview DIR]
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / 'frontend' / 'public' / 'antiplag-templates'

# Yorliqlar tayanch chizig'i (asl rasm pikselida, build_localized_templates.py bilan bir xil)
AUTHOR_BASELINE = 955
WORK_TYPE_BASELINE = 1017
CITATIONS_BASELINE = 1142

# lang → (manba rasm, ko'chiriladigan harflar: manba qatori, x0, x1; muallif yorlig'idan keyingi bo'shliq px).
# x oraliqlari harf ustunlari bo'yicha o'lchangan (siyoh ustunlari: yorliq oxirgi harflari).
VARIANTS = {
    'uz': ('sertifikat.jpg', CITATIONS_BASELINE, 425, 533, 9),
    'uz-cyrl': ('sertifikat.uz-cyrl.jpg', CITATIONS_BASELINE, 441, 544, 7),
    'en': ('sertifikat.en.jpg', CITATIONS_BASELINE, 514, 547, 8),
    'ru': ('sertifikat.ru.jpg', WORK_TYPE_BASELINE, 485, 522, 6),
}

# Muallif yorlig'i shu ustundan o'ngga chiqmaydi (keyin vertikal chiziq va qiymatlar)
LABEL_RIGHT = 795
ROW_ABOVE, ROW_BELOW = 56, 12  # qator balandligi: tayanch chizig'idan yuqoriga / pastga (qo'shni qatorlarga tegmaydi)


def _ink_columns(arr: np.ndarray, baseline: int, x0: int, x1: int) -> np.ndarray:
    region = arr[baseline - ROW_ABOVE:baseline + ROW_BELOW, x0:x1].min(axis=2)
    return np.where((region < 170).any(axis=0))[0] + x0


def build(lang: str) -> Image.Image:
    src_name, src_baseline, gx0, gx1, gap = VARIANTS[lang]
    arr = np.array(Image.open(SRC_DIR / src_name).convert('RGB'))
    cols = _ink_columns(arr, AUTHOR_BASELINE, 150, LABEL_RIGHT)
    label_end = int(cols.max())
    dest_x = label_end + 1 + gap
    width = gx1 - gx0 + 1
    if dest_x + width > LABEL_RIGHT:
        raise SystemExit(f'{lang}: yorliq ajratilgan joyga sig\'maydi')
    glyphs = arr[src_baseline - ROW_ABOVE:src_baseline + ROW_BELOW, gx0:gx1 + 1]
    target = arr[AUTHOR_BASELINE - ROW_ABOVE:AUTHOR_BASELINE + ROW_BELOW, dest_x:dest_x + width]
    # Oq fonga «qoraytirish» bilan qo'yiladi — atrofdagi fon o'zgarmaydi
    arr[AUTHOR_BASELINE - ROW_ABOVE:AUTHOR_BASELINE + ROW_BELOW, dest_x:dest_x + width] = np.minimum(target, glyphs)
    return Image.fromarray(arr)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', help="Faqat shu papkaga yoziladi (repo fayllari o'zgarmaydi)")
    args = ap.parse_args()
    dest = Path(args.preview) if args.preview else SRC_DIR
    dest.mkdir(parents=True, exist_ok=True)
    for lang in VARIANTS:
        name = 'sertifikat.authors.jpg' if lang == 'uz' else f'sertifikat.authors.{lang}.jpg'
        build(lang).save(dest / name, format='JPEG', quality=92, optimize=True)
        print(dest / name)


if __name__ == '__main__':
    main()
