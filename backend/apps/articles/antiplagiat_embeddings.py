"""
Multilingual E5 embedding — parafraz aniqlash (lexical past, semantic yuqori).
"""
from __future__ import annotations

import logging
import threading
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

_model = None
_model_lock = threading.Lock()


def embeddings_available() -> bool:
    if not getattr(settings, 'ANTIPLAG_EMBEDDINGS_ENABLED', True):
        return False
    try:
        import sentence_transformers  # noqa: F401
        return True
    except ImportError:
        return False


def _get_model():
    global _model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is not None:
            return _model
        from sentence_transformers import SentenceTransformer

        name = getattr(
            settings,
            'ANTIPLAG_EMBEDDING_MODEL',
            'intfloat/multilingual-e5-small',
        )
        logger.info('Antiplag E5 model yuklanmoqda: %s', name)
        _model = SentenceTransformer(name)
        return _model


def _prefix_passage(text: str) -> str:
    t = (text or '').strip()
    if not t:
        return 'passage: '
    if t.lower().startswith('passage:') or t.lower().startswith('query:'):
        return t
    return f'passage: {t[:2000]}'


def embed_passages(texts: list[str]) -> list[list[float]] | None:
    if not texts or not embeddings_available():
        return None
    try:
        model = _get_model()
        prefixed = [_prefix_passage(t) for t in texts]
        vectors = model.encode(
            prefixed,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=int(getattr(settings, 'ANTIPLAG_EMBEDDING_BATCH', 16)),
        )
        return [v.tolist() for v in vectors]
    except Exception as exc:
        logger.warning('E5 embed xato: %s', exc)
        return None


def embedding_cosine(a: str, b: str) -> float:
    vecs = embed_passages([a, b])
    if not vecs or len(vecs) != 2:
        return 0.0
    va, vb = vecs[0], vecs[1]
    if not va or not vb:
        return 0.0
    return float(sum(x * y for x, y in zip(va, vb)))


def is_paraphrase_pair(
    doc_sentence: str,
    source_text: str,
    *,
    lexical_score: float,
) -> tuple[bool, float]:
    """
    Parafraz: lexical overlap past, embedding cosine yuqori.
    """
    threshold = float(getattr(settings, 'ANTIPLAG_PARAPHRASE_THRESHOLD', 0.78))
    max_lex = float(getattr(settings, 'ANTIPLAG_PARAPHRASE_MAX_LEXICAL', 0.34))
    if lexical_score > max_lex:
        return False, 0.0
    cos = embedding_cosine(doc_sentence, source_text)
    return cos >= threshold, cos


def embedding_dimension() -> int:
    if not embeddings_available():
        return 0
    try:
        vecs = embed_passages(['test'])
        return len(vecs[0]) if vecs else 384
    except Exception:
        return 384
