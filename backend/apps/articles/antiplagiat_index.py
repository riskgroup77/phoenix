"""
Antiplagiat barmoq izlari indeksi (ma'lumotlar bazasida).

- index_document(): hujjat matnidan winnowing barmoq izlarini yozadi (matn o'zgarmagan bo'lsa — o'tkazib yuboradi);
- index_article() / index_corpus_document(): platforma maqolasi va arxiv hujjati uchun;
- find_index_matches(): tekshirilayotgan hujjatning BARCHA bo'laklarini indeksdan qidiradi va har bir mos
  hujjat uchun aniq mos qismlarni qaytaradi.

Korpus endi har tekshiruvda xotiraga yuklanmaydi va PDF'lar qayta o'qilmaydi — indeks oldindan quriladi
(`python manage.py build_antiplag_index`) va yangi maqolalar avtomatik qo'shiladi (signals).
"""
from __future__ import annotations

import hashlib
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.db import close_old_connections, transaction

from apps.articles.antiplagiat_fingerprint import (
    K,
    MIN_SPAN_TOKENS,
    W,
    Span,
    TextMatch,
    compare_tokens,
    covered_spans,
    shingles,
    winnow,
)
from apps.articles.antiplagiat_normalize import NORMALIZE_VERSION, Token, normalize_text, tokenize

logger = logging.getLogger(__name__)

INDEX_TEXT_MAX = 400_000  # bitta hujjatdan indekslanadigan matn (belgi)
QUERY_CHUNK = 500  # SQL IN (...) bo'lagi
MIN_MATCHED_SHINGLES = 2  # hujjat nomzod bo'lishi uchun kamida shuncha mos bo'lak

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='antiplag-index')
_local = threading.local()


@contextmanager
def suppress_auto_index():
    """Ommaviy import/yig'ishda signal orqali fon indekslash o'chiriladi (buyruq o'zi sinxron indekslaydi)."""
    prev = getattr(_local, 'suppressed', False)
    _local.suppressed = True
    try:
        yield
    finally:
        _local.suppressed = prev


def _content_hash(text: str) -> str:
    # Normalizatsiya versiyasi xeshga kiradi: qoidalar o'zgarsa barmoq izlari ham qayta yoziladi
    return hashlib.sha1(f'v{NORMALIZE_VERSION}|{normalize_text(text)}'.encode('utf-8')).hexdigest()


BUILT_MARKER_KEY = 'meta:index-built'


def index_ready() -> bool:
    """
    Indeks to'liq qurilganmi (build_antiplag_index oxirida belgi qo'yiladi). Qurilish davomida chala indeks
    ishlatilmaydi — tekshiruvlar eski usulda (korpus xotirada) davom etadi.
    """
    from apps.articles.models import AntiplagIndexedDocument

    try:
        return AntiplagIndexedDocument.objects.filter(doc_key=BUILT_MARKER_KEY).exists()
    except Exception:
        return False


def mark_index_built() -> None:
    from apps.articles.models import AntiplagIndexedDocument

    AntiplagIndexedDocument.objects.update_or_create(
        doc_key=BUILT_MARKER_KEY, defaults={'kind': 'meta', 'title': "Indeks to'liq qurilgan", 'is_public': False},
    )


def index_document(
    doc_key: str,
    text: str,
    *,
    kind: str,
    title: str = '',
    url: str = '',
    source_type: str = '',
    is_public: bool = False,
    author_id: str = '',
    store_text: bool = True,
    force: bool = False,
) -> int:
    """Hujjatni indeksga yozadi. Yozilgan barmoq izlari soni (0 — o'zgarmagan yoki matn juda qisqa)."""
    from apps.articles.models import AntiplagFingerprint, AntiplagIndexedDocument

    text = (text or '')[:INDEX_TEXT_MAX]
    chash = _content_hash(text)
    existing = AntiplagIndexedDocument.objects.filter(doc_key=doc_key).first()
    meta = {
        'kind': kind,
        'title': (title or '')[:500],
        'url': (url or '')[:500],
        'source_type': (source_type or '')[:40],
        'is_public': bool(is_public),
        'author_id': str(author_id or '')[:64],
        'content_hash': chash,
        'text': text if store_text else '',
    }
    if existing and existing.content_hash == chash and not force:
        # Matn o'zgarmagan — faqat meta (masalan nashr holati) yangilanadi, qayta tokenlanmaydi
        changed = [f for f, v in meta.items() if getattr(existing, f) != v]
        if changed:
            for f in changed:
                setattr(existing, f, meta[f])
            existing.save(update_fields=changed + ['indexed_at'])
        return 0

    tokens = tokenize(text)
    if len(tokens) < K + 2:
        remove_document(doc_key)
        return 0
    meta['token_count'] = len(tokens)
    fps = winnow(shingles(tokens))
    with transaction.atomic():
        doc, _ = AntiplagIndexedDocument.objects.update_or_create(doc_key=doc_key, defaults=meta)
        AntiplagFingerprint.objects.filter(document=doc).delete()
        AntiplagFingerprint.objects.bulk_create(
            [AntiplagFingerprint(hash=h, document=doc, position=pos) for h, pos in fps],
            batch_size=2000,
        )
    return len(fps)


def remove_document(doc_key: str) -> None:
    from apps.articles.models import AntiplagIndexedDocument

    AntiplagIndexedDocument.objects.filter(doc_key=doc_key).delete()


# ---------------------------------------------------------------- maqola va arxiv hujjatlari

def article_is_indexable(article) -> bool:
    from apps.articles.antiplagiat_corpus import _looks_like_standalone_check
    from config.demo import is_demo_article

    # Demo (namuna) maqolalar haqiqiy foydalanuvchilar tekshiruvida manba bo'lmasin
    return (
        article.status not in ('Draft', 'Rejected')
        and not _looks_like_standalone_check(article)
        and not is_demo_article(article)
    )


def article_index_text(article) -> str:
    """Faqat asar matni: sarlavha, annotatsiya, kalit so'zlar va fayl matni (adabiyotlar va taqriz kirmaydi)."""
    from apps.articles.antiplagiat_corpus import _keywords_text, _resolve_pdf_path

    parts = [article.title or '', article.abstract or '', _keywords_text(article.keywords)]
    path = _resolve_pdf_path(article)
    if path:
        try:
            from apps.services import extract_plain_text_from_file

            body = extract_plain_text_from_file(path)
            if body and len(body.strip()) >= 80:
                parts.append(body.strip())
        except Exception as exc:
            logger.warning('index: fayl matnini o\'qib bo\'lmadi %s: %s', article.pk, exc)
    return '\n'.join(p for p in parts if p and p.strip())


def index_article(article, *, force: bool = False) -> int:
    key = f'article:{article.pk}'
    if not article_is_indexable(article):
        remove_document(key)
        return 0
    doi = (article.doi or '').strip()
    url = doi if doi.startswith('http') else (f'https://doi.org/{doi}' if doi else f'https://ilmiyfaoliyat.uz/#/articles/{article.pk}')
    return index_document(
        key,
        article_index_text(article),
        kind='article',
        title=article.title or '',
        url=url,
        source_type='platform',
        is_public=article.status == 'Published',
        author_id=str(article.author_id or ''),
        force=force,
    )


def index_corpus_document(doc, *, force: bool = False) -> int:
    key = f'corpus:{doc.external_key}'
    if not doc.is_active:
        remove_document(key)
        return 0
    return index_document(
        key,
        '\n'.join(p for p in [doc.title or '', doc.full_text or ''] if p),
        kind='corpus',
        title=doc.title or '',
        url=doc.source_url or '',
        source_type=doc.source_type or 'import',
        is_public=True,
        author_id=str(doc.author_user_id or ''),
        force=force,
    )


def index_private_check(article, text: str) -> int:
    """
    Mustaqil tekshiruvga yuklangan hujjat — faqat ANTIPLAG_INDEX_PRIVATE_CHECKS=True bo'lsa.
    Matn saqlanmaydi (faqat barmoq izlari): keyingi tekshiruvlarda «nashr etilmagan hujjat» sifatida topiladi,
    lekin uning mazmuni hech kimga ko'rsatilmaydi.
    """
    if not getattr(settings, 'ANTIPLAG_INDEX_PRIVATE_CHECKS', False):
        return 0
    return index_document(
        f'check:{article.pk}',
        text,
        kind='check',
        title='',
        source_type='check',
        is_public=False,
        author_id=str(article.author_id or ''),
        store_text=False,
    )


def schedule(fn, *args) -> None:
    """Indekslashni so'rovdan keyin fon oqimida bajarish (PDF o'qish sekin bo'lishi mumkin)."""
    if not getattr(settings, 'ANTIPLAG_AUTO_INDEX', True) or getattr(_local, 'suppressed', False):
        return

    def _run():
        close_old_connections()
        try:
            fn(*args)
        except Exception as exc:
            logger.warning('antiplag index fon vazifasi xato: %s', exc)
        finally:
            close_old_connections()

    if getattr(settings, 'ANTIPLAG_INDEX_SYNC', False):
        transaction.on_commit(_run)
    else:
        transaction.on_commit(lambda: _executor.submit(_run))


# ---------------------------------------------------------------- qidiruv

@dataclass
class IndexMatch:
    doc: Any  # AntiplagIndexedDocument
    spans: list[Span]
    matched_tokens: int
    source_tokens: list[Token] | None  # matn saqlangan bo'lsa (mos qismni ko'rsatish uchun)


def find_index_matches(
    query_tokens: list[Token],
    *,
    exclude_doc_keys: set[str] | None = None,
    max_docs: int = 40,
) -> list[IndexMatch]:
    """Hujjatning barcha bo'laklarini indeksdan qidiradi; eng ko'p mos kelgan hujjatlarni aniqlashtiradi."""
    from apps.articles.models import AntiplagFingerprint, AntiplagIndexedDocument

    q_shingles = shingles(query_tokens)
    if not q_shingles:
        return []
    by_hash: dict[int, list[int]] = {}
    for h, pos in q_shingles:
        by_hash.setdefault(h, []).append(pos)

    exclude = exclude_doc_keys or set()
    exclude_ids = set(
        AntiplagIndexedDocument.objects.filter(doc_key__in=exclude).values_list('id', flat=True)
    ) if exclude else set()

    # Ko'p hujjatlarda uchraydigan bo'laklar (umumiy/shablon iboralar: "ushbu maqolada ... tahlil qilingan")
    # nomzod tanlashda hisobga olinmaydi — aks holda tasodifiy hujjatlar "o'xshash" bo'lib chiqadi
    total_docs = AntiplagIndexedDocument.objects.count()
    common_limit = max(int(getattr(settings, 'ANTIPLAG_COMMON_SHINGLE_MIN_DOCS', 30)), int(total_docs * 0.01))

    # hujjat → {so'rov pozitsiyasi: [manba pozitsiyalari]}
    per_doc: dict[int, dict[int, list[int]]] = {}
    hashes = list(by_hash.keys())
    for i in range(0, len(hashes), QUERY_CHUNK):
        chunk = hashes[i : i + QUERY_CHUNK]
        rows_by_hash: dict[int, list[tuple[int, int]]] = {}
        for h, doc_id, spos in AntiplagFingerprint.objects.filter(hash__in=chunk).values_list(
            'hash', 'document_id', 'position'
        ):
            if doc_id not in exclude_ids:
                rows_by_hash.setdefault(h, []).append((doc_id, spos))
        for h, rows in rows_by_hash.items():
            if len({d for d, _ in rows}) > common_limit:
                continue
            for doc_id, spos in rows:
                m = per_doc.setdefault(doc_id, {})
                for qpos in by_hash.get(h, ()):
                    m.setdefault(qpos, []).append(spos)

    ranked = sorted(
        ((doc_id, m) for doc_id, m in per_doc.items() if len(m) >= MIN_MATCHED_SHINGLES),
        key=lambda item: len(item[1]),
        reverse=True,
    )[:max_docs]
    if not ranked:
        return []
    docs = {d.id: d for d in AntiplagIndexedDocument.objects.filter(id__in=[d for d, _ in ranked])}

    out: list[IndexMatch] = []
    for doc_id, m in ranked:
        doc = docs.get(doc_id)
        if doc is None:
            continue
        if doc.text:
            # Matn bor — aniq (winnowingsiz) solishtirish: barcha mos qismlar to'liq topiladi
            src_tokens = tokenize(doc.text)
            match: TextMatch = compare_tokens(query_tokens, src_tokens)
            spans, matched = match.spans, match.matched_tokens
        else:
            # Maxfiy hujjat (faqat barmoq izlari): winnowing bo'shliqlarini to'ldirib birlashtiramiz
            src_tokens = None
            spans = covered_spans(m.keys(), merge_gap=W + K - 2, source_map=m)
            matched = sum(s.length for s in spans)
        spans = [s for s in spans if s.length >= MIN_SPAN_TOKENS]
        if spans:
            out.append(IndexMatch(doc, spans, matched, src_tokens))
    out.sort(key=lambda x: x.matched_tokens, reverse=True)
    return out


def index_stats() -> dict[str, Any]:
    from django.db.models import Count, Sum

    from apps.articles.models import AntiplagFingerprint, AntiplagIndexedDocument

    by_kind = {
        row['kind']: {'documents': row['n'], 'tokens': row['tokens'] or 0}
        for row in AntiplagIndexedDocument.objects.exclude(kind='meta').values('kind')
        .annotate(n=Count('id'), tokens=Sum('token_count'))
    }
    return {'by_kind': by_kind, 'fingerprints': AntiplagFingerprint.objects.count(), 'ready': index_ready()}
