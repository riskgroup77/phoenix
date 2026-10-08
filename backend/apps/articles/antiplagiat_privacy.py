"""
Antiplagiat hisobotida boshqa mualliflarning nashr etilmagan matnlari oshkor bo'lmasligi
va tekshirilayotgan hujjat o'zini-o'zi "manba" sifatida topmasligi uchun yordamchilar.
"""
from __future__ import annotations

from typing import Any

from apps.articles.antiplagiat_overlap import matched_source_window

UNPUBLISHED_TITLE = "Phoenix ichki bazasi: nashr etilmagan hujjat"


def is_own_or_excluded(row: dict[str, Any], *, exclude_article_id: str | None, exclude_author_id: str | None) -> bool:
    """Tekshirilayotgan hujjatning o'zi yoki shu muallifning boshqa hujjati (o'z-o'ziga iqtibos alohida)."""
    doc_id = str(row.get('doc_id') or row.get('id') or '')
    if exclude_article_id and doc_id == str(exclude_article_id):
        return True
    author = str(row.get('author_id') or '')
    return bool(exclude_author_id and author and author == str(exclude_author_id))


def safe_source_fields(
    *,
    sentence: str,
    source_text: str,
    title: str,
    url: str,
    is_public: bool,
) -> dict[str, str]:
    """
    Hisobotga yoziladigan manba maydonlari.
    - source_fragment: manbadan faqat AYNAN mos kelgan qism.
    - Nashr etilmagan hujjat: sarlavha, havola va to'liq matn yashiriladi.
    """
    window = matched_source_window(sentence, source_text) or ''
    if is_public:
        return {
            'title': (title or window[:120] or (source_text or '')[:120])[:300],
            'source': url or '',
            # Parafrazda so'zma-so'z kesishma bo'lmasligi mumkin — ochiq manbada parchani ko'rsatamiz
            'source_fragment': (window or (source_text or ''))[:360],
            'source_text': (source_text or '')[:12000],
        }
    return {
        'title': UNPUBLISHED_TITLE,
        'source': '',
        'source_fragment': window[:360],
        'source_text': '',
    }
