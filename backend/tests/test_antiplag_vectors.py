"""
Lokal vektor indeksi (antiplagiat_vectors): qurish, qayta ishlatish, qidirish va parafraz/tarjima
aniqlash. Haqiqiy E5 modeli o'rniga soxta "ko'p tilli" embedder: so'zlar umumiy ma'no tugunlariga
xaritalanadi (masalan, «iqtisodiyot» = «экономика» = «economy»), shuning uchun tarjima yaqin vektor beradi.
"""
import shutil
import tempfile
from unittest import mock

import numpy as np
from django.test import TestCase, override_settings

from apps.articles import antiplagiat_vectors as V
from apps.articles.antiplagiat_paraphrase import scan_paraphrase_hits
from apps.articles.models import AntiplagIndexedDocument

CONCEPTS = {
    'raqamli': 'digital', 'цифровая': 'digital', 'цифровой': 'digital', 'digital': 'digital',
    'iqtisodiyot': 'economy', 'iqtisodiyotda': 'economy', 'экономика': 'economy', 'экономике': 'economy', 'economy': 'economy',
    'kichik': 'small', 'малый': 'small', 'малого': 'small', 'small': 'small',
    'biznes': 'business', 'бизнес': 'business', 'бизнеса': 'business', 'business': 'business',
    'rivojlanishiga': 'growth', 'развитию': 'growth', 'развитие': 'growth', 'growth': 'growth', "o'sishiga": 'growth',
    'transformatsiya': 'transform', 'трансформация': 'transform', 'transformation': 'transform',
    'katta': 'strong', 'значительно': 'strong', 'significantly': 'strong', 'sezilarli': 'strong',
    "ta'sir": 'impact', 'влияет': 'impact', 'affects': 'impact', "ko'rsatadi": 'impact',
    'tibbiyot': 'medicine', 'медицина': 'medicine', 'yurak': 'heart', 'сердце': 'heart',
    'kasalliklari': 'disease', 'заболевания': 'disease', 'davolash': 'treat', 'лечение': 'treat',
}
DIM = 64


def fake_embed(texts):
    out = np.zeros((len(texts), DIM), dtype=np.float32)
    for i, t in enumerate(texts):
        for w in t.lower().replace(',', ' ').replace('.', ' ').split():
            c = CONCEPTS.get(w)
            if c:
                out[i, hash(c) % DIM] += 1.0
        out[i, DIM - 1] += 0.05  # bo'sh vektor bo'lmasin
    norms = np.linalg.norm(out, axis=1, keepdims=True)
    return out / norms


RU_SOURCE = ('Цифровая трансформация в экономике значительно влияет на развитие малого бизнеса. '
             'Погода в горах была солнечной и тёплой весь прошлый месяц подряд.')
UZ_TRANSLATION = "Raqamli transformatsiya iqtisodiyotda kichik biznes rivojlanishiga katta ta'sir ko'rsatadi."
UZ_UNRELATED = "Yurak kasalliklari davolash usullari tibbiyot amaliyotida keng qo'llaniladi va o'rganiladi."


class LocalVectorIndexTests(TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='phx-vec-')
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.ov = override_settings(ANTIPLAG_LOCAL_VECTORS_ENABLED=True, ANTIPLAG_VECTOR_DIR=self.tmp,
                                    ANTIPLAG_VECTOR_PASSAGE_CHARS=60, ANTIPLAG_CROSSLINGUAL_THRESHOLD=0.84)
        self.ov.enable()
        self.addCleanup(self.ov.disable)
        p1 = mock.patch.object(V, '_embed', side_effect=fake_embed)
        p2 = mock.patch('apps.articles.antiplagiat_embeddings.embeddings_available', return_value=True)
        p3 = mock.patch('apps.articles.antiplagiat_paraphrase.embeddings_available', return_value=True)
        p1.start(); p2.start(); p3.start()
        self.addCleanup(mock.patch.stopall)
        V.reset_cache()
        self.ru = AntiplagIndexedDocument.objects.create(
            doc_key='corpus:ru-1', kind='corpus', title='Цифровая экономика', url='https://example.org/ru-1',
            source_type='journal', is_public=True, content_hash='h1', text=RU_SOURCE)

    def test_split_passages_respects_sentences(self):
        spans = V.split_passages(RU_SOURCE, max_chars=60)
        self.assertGreaterEqual(len(spans), 2)
        for s, e in spans:
            self.assertTrue(RU_SOURCE[s:e].strip())

    def test_build_is_incremental(self):
        stats = V.build_index()
        self.assertEqual(stats['embedded'], 1)
        self.assertGreater(stats['passages'], 0)
        stats2 = V.build_index()
        self.assertEqual(stats2['embedded'], 0)
        self.assertEqual(stats2['reused'], 1)
        self.ru.content_hash = 'h2'
        self.ru.save()
        self.assertEqual(V.build_index()['embedded'], 1)
        self.ru.delete()
        self.assertEqual(V.build_index()['passages'], 0)

    def test_cross_lingual_translation_detected(self):
        V.build_index()
        self.assertTrue(V.local_vectors_ready())
        hits = scan_paraphrase_hits([(0, UZ_TRANSLATION), (1, UZ_UNRELATED)], {'semantic_paraphrase'})
        self.assertEqual(len(hits), 1, hits)
        h = hits[0]
        self.assertEqual(h['match_subtype'], 'translation')
        self.assertIn('tarjima', h['search_module'])
        self.assertGreaterEqual(h['embedding_score'], 0.84)
        self.assertEqual(h['snippet'], UZ_TRANSLATION[:220])

    def test_own_article_excluded(self):
        AntiplagIndexedDocument.objects.filter(pk=self.ru.pk).update(doc_key='article:abc', kind='article')
        V.build_index(rebuild=True)
        hits = scan_paraphrase_hits([(0, UZ_TRANSLATION)], {'semantic_paraphrase'}, exclude_article_id='abc')
        self.assertEqual(hits, [])

    @override_settings(ANTIPLAG_LOCAL_VECTORS_ENABLED=False)
    def test_disabled_returns_nothing(self):
        self.assertFalse(V.local_vectors_ready())
        self.assertEqual(scan_paraphrase_hits([(0, UZ_TRANSLATION)], {'semantic_paraphrase'}), [])
