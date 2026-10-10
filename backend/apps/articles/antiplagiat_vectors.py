"""
Lokal semantik indeks (OpenSearch'siz, bepul): parafraz va TARJIMA plagiatini aniqlash.

Indeksdagi hujjatlar (AntiplagIndexedDocument.text) ~400 belgili parchalarga bo'linadi va ko'p tilli
E5 modeli (intfloat/multilingual-e5-small) bilan vektorga aylantiriladi. Vektorlar normallashtirilgan
float16 matritsa sifatida diskda saqlanadi (numpy memmap — xotiraga to'liq yuklanmaydi):

    <ANTIPLAG_VECTOR_DIR>/vectors.npy   (N × D, float16)
    <ANTIPLAG_VECTOR_DIR>/rows.npy      (N × 3, int64: hujjat pk, parcha boshi, parcha oxiri)
    <ANTIPLAG_VECTOR_DIR>/manifest.json (model, o'lcham, hujjat → content_hash)

E5 tillararo: o'zbekcha jumla va uning ruscha/inglizcha asli bir-biriga yaqin vektor beradi — shuning
uchun boshqa tildan tarjima qilib olingan matn ham topiladi (leksik usul buni ko'rmaydi).

Yoqish: ANTIPLAG_LOCAL_VECTORS_ENABLED=true (sentence-transformers o'rnatilgan bo'lishi kerak, ~0.5 GB RAM),
keyin: python manage.py build_antiplag_vectors (o'zgarmagan hujjatlar qayta hisoblanmaydi).
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
from pathlib import Path
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

_cache_lock = threading.Lock()
_cache: dict[str, Any] = {}

SENT_SPLIT_RE = re.compile(r'(?<=[.!?…])\s+')


# ------------------------------------------------------------------ sozlamalar


def vector_dir() -> Path:
    d = getattr(settings, 'ANTIPLAG_VECTOR_DIR', '') or ''
    return Path(d) if d else Path(settings.BASE_DIR) / 'antiplag_vectors'


def local_vectors_enabled() -> bool:
    if not getattr(settings, 'ANTIPLAG_LOCAL_VECTORS_ENABLED', False):
        return False
    try:
        import numpy  # noqa: F401
    except ImportError:
        return False
    from apps.articles.antiplagiat_embeddings import embeddings_available

    return embeddings_available()


def local_vectors_ready() -> bool:
    """Yoqilgan va indeks qurilgan (fayllar mavjud)."""
    if not local_vectors_enabled():
        return False
    d = vector_dir()
    return (d / 'vectors.npy').exists() and (d / 'rows.npy').exists()


# ------------------------------------------------------------------ embedding (testlarda almashtiriladi)


def _embed(texts: list[str]):
    """Normallashtirilgan vektorlar (numpy float32, len(texts) × D) yoki None."""
    import numpy as np

    from apps.articles.antiplagiat_embeddings import embed_passages

    vecs = embed_passages(texts)
    if not vecs:
        return None
    arr = np.asarray(vecs, dtype=np.float32)
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return arr / norms


# ------------------------------------------------------------------ parchalash


def split_passages(text: str, *, max_chars: int | None = None, max_passages: int | None = None) -> list[tuple[int, int]]:
    """Matnni gap chegarasida ~max_chars belgili parchalarga bo'lish → [(boshi, oxiri), ...]."""
    max_chars = max_chars or int(getattr(settings, 'ANTIPLAG_VECTOR_PASSAGE_CHARS', 400))
    max_passages = max_passages or int(getattr(settings, 'ANTIPLAG_VECTOR_PASSAGES_PER_DOC', 24))
    text = text or ''
    spans: list[tuple[int, int]] = []
    start = None
    end = 0
    pos = 0
    for part in SENT_SPLIT_RE.split(text):
        idx = text.find(part, pos)
        if idx < 0:
            continue
        pos = idx + len(part)
        if not part.strip():
            continue
        if start is None:
            start = idx
        end = pos
        if end - start >= max_chars:
            spans.append((start, end))
            start = None
            if len(spans) >= max_passages:
                return spans
    if start is not None and end - start >= 60:
        spans.append((start, end))
    return spans[:max_passages]


# ------------------------------------------------------------------ qurish


def build_index(*, rebuild: bool = False, limit: int | None = None, batch: int = 32, progress=None) -> dict[str, int]:
    """Indeksni qurish/yangilash. O'zgarmagan hujjatlar (content_hash bir xil) qayta vektorlanmaydi."""
    import numpy as np

    from apps.articles.models import AntiplagIndexedDocument

    d = vector_dir()
    d.mkdir(parents=True, exist_ok=True)
    manifest_path = d / 'manifest.json'
    old_manifest: dict[str, Any] = {}
    old_vecs = old_rows = None
    if not rebuild and manifest_path.exists() and (d / 'vectors.npy').exists():
        try:
            old_manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            if old_manifest.get('model') == getattr(settings, 'ANTIPLAG_EMBEDDING_MODEL', ''):
                old_vecs = np.load(d / 'vectors.npy')
                old_rows = np.load(d / 'rows.npy')
            else:
                old_manifest = {}
        except Exception:
            logger.warning('Vektor indeksini o\'qib bo\'lmadi — qaytadan quriladi', exc_info=True)
            old_manifest = {}
    old_hashes: dict[str, str] = old_manifest.get('docs', {}) if old_vecs is not None else {}

    docs = (AntiplagIndexedDocument.objects.filter(kind__in=('article', 'corpus'))
            .exclude(text='').only('id', 'content_hash', 'text').order_by('id'))
    if limit:
        docs = docs[:limit]

    keep_ids: set[int] = set()
    todo: list[tuple[int, str, str]] = []
    new_hashes: dict[str, str] = {}
    for doc in docs.iterator(chunk_size=500):
        h = doc.content_hash or str(len(doc.text))
        new_hashes[str(doc.pk)] = h
        if old_hashes.get(str(doc.pk)) == h:
            keep_ids.add(doc.pk)
        else:
            todo.append((doc.pk, h, doc.text))

    parts_vecs = []
    parts_rows = []
    if old_vecs is not None and keep_ids:
        mask = np.isin(old_rows[:, 0], np.fromiter(keep_ids, dtype=np.int64))
        parts_vecs.append(old_vecs[mask])
        parts_rows.append(old_rows[mask])

    embedded_docs = 0
    pending_texts: list[str] = []
    pending_rows: list[tuple[int, int, int]] = []

    def flush():
        if not pending_texts:
            return
        vecs = _embed(pending_texts)
        if vecs is None:
            raise RuntimeError('Embedding modeli ishlamadi (sentence-transformers o\'rnatilganmi?)')
        parts_vecs.append(vecs.astype(np.float16))
        parts_rows.append(np.asarray(pending_rows, dtype=np.int64))
        pending_texts.clear()
        pending_rows.clear()

    for pk, _h, text in todo:
        for s, e in split_passages(text):
            pending_texts.append(text[s:e])
            pending_rows.append((pk, s, e))
            if len(pending_texts) >= batch:
                flush()
        embedded_docs += 1
        if progress and embedded_docs % 100 == 0:
            progress(embedded_docs, len(todo))
    flush()

    if parts_vecs:
        vecs = np.concatenate(parts_vecs, axis=0)
        rows = np.concatenate(parts_rows, axis=0)
    else:
        vecs = np.zeros((0, 0), dtype=np.float16)
        rows = np.zeros((0, 3), dtype=np.int64)

    # Atomar yozish: avval vaqtinchalik fayl, keyin almashtirish
    for name, arr in (('vectors.npy', vecs), ('rows.npy', rows)):
        tmp = d / f'.{name}.tmp'
        with open(tmp, 'wb') as fh:
            np.save(fh, arr)
        os.replace(tmp, d / name)
    manifest = {
        'model': getattr(settings, 'ANTIPLAG_EMBEDDING_MODEL', ''),
        'dim': int(vecs.shape[1]) if vecs.ndim == 2 and vecs.size else 0,
        'passages': int(rows.shape[0]),
        'docs': new_hashes,  # saqlangan + yangi vektorlangan hujjatlar (o'chirilganlari tushib qoladi)
    }
    tmp = d / '.manifest.json.tmp'
    tmp.write_text(json.dumps(manifest), encoding='utf-8')
    os.replace(tmp, manifest_path)
    reset_cache()
    return {'documents': len(new_hashes), 'embedded': embedded_docs, 'reused': len(keep_ids), 'passages': int(rows.shape[0])}


# ------------------------------------------------------------------ qidirish


def reset_cache() -> None:
    with _cache_lock:
        _cache.clear()


def _load():
    import numpy as np

    d = vector_dir()
    try:
        mtime = (d / 'vectors.npy').stat().st_mtime
    except OSError:
        return None
    with _cache_lock:
        if _cache.get('mtime') == mtime:
            return _cache['vecs'], _cache['rows']
        vecs = np.load(d / 'vectors.npy', mmap_mode='r')
        rows = np.load(d / 'rows.npy')
        _cache.update(mtime=mtime, vecs=vecs, rows=rows)
        return vecs, rows


def search(sentences: list[str], *, top_k: int = 3, min_score: float = 0.0) -> list[list[dict[str, Any]]]:
    """Har bir jumla uchun eng yaqin indeks parchalari: [{'doc_pk', 'start', 'end', 'score'}, ...]."""
    import numpy as np

    if not sentences:
        return []
    loaded = _load()
    if loaded is None:
        return [[] for _ in sentences]
    vecs, rows = loaded
    if vecs.shape[0] == 0:
        return [[] for _ in sentences]
    q = _embed(sentences)
    if q is None:
        return [[] for _ in sentences]
    q = q.astype(np.float32)
    n = vecs.shape[0]
    chunk = 50_000
    best_scores = np.full((len(sentences), top_k), -1.0, dtype=np.float32)
    best_idx = np.full((len(sentences), top_k), -1, dtype=np.int64)
    for s in range(0, n, chunk):
        block = np.asarray(vecs[s:s + chunk], dtype=np.float32)
        sims = q @ block.T  # (Q, B)
        k = min(top_k, sims.shape[1])
        part = np.argpartition(-sims, k - 1, axis=1)[:, :k]
        part_scores = np.take_along_axis(sims, part, axis=1)
        all_scores = np.concatenate([best_scores, part_scores], axis=1)
        all_idx = np.concatenate([best_idx, part + s], axis=1)
        order = np.argsort(-all_scores, axis=1)[:, :top_k]
        best_scores = np.take_along_axis(all_scores, order, axis=1)
        best_idx = np.take_along_axis(all_idx, order, axis=1)
    out: list[list[dict[str, Any]]] = []
    for qi in range(len(sentences)):
        res = []
        for score, idx in zip(best_scores[qi], best_idx[qi]):
            if idx < 0 or score < min_score:
                continue
            pk, start, end = (int(x) for x in rows[idx])
            res.append({'doc_pk': pk, 'start': start, 'end': end, 'score': float(score)})
        out.append(res)
    return out


def search_fragments(sentences: list[str], *, top_k: int = 3, min_score: float = 0.0) -> list[list[dict[str, Any]]]:
    """search() natijasini manba ma'lumotlari bilan to'ldirish (antiplagiat_paraphrase uchun)."""
    from apps.articles.models import AntiplagIndexedDocument

    raw = search(sentences, top_k=top_k, min_score=min_score)
    pks = {h['doc_pk'] for hits in raw for h in hits}
    docs = {d.pk: d for d in AntiplagIndexedDocument.objects.filter(pk__in=pks)}
    out = []
    for hits in raw:
        rows = []
        for h in hits:
            doc = docs.get(h['doc_pk'])
            if doc is None:
                continue
            key = doc.doc_key or ''
            rows.append({
                'fragment': (doc.text or '')[h['start']:h['end']],
                'title': doc.title,
                'url': doc.url,
                'is_public': doc.is_public,
                'author_id': doc.author_id,
                'doc_id': key.split(':', 1)[1] if key.startswith('article:') else key,
                'module_id': 'milliy_reestr' if doc.kind == 'article' else ('oak_journals_uz' if doc.source_type == 'journal' else 'natlib_uz'),
                'score': h['score'],
            })
        out.append(rows)
    return out
