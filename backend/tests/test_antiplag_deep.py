"""
Antiplagiat 1-bosqich (algoritm 5.0): normalizatsiya, barmoq izlari, indeks, chuqur skaner,
ochiq API to'liq matni, OAI-PMH yig'uvchi va sezgirlik benchmarki.
"""
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.articles.antiplagiat_deep_scan import (
    UNPUBLISHED_TITLE,
    compare_source,
    split_sentences_with_offsets,
)
from apps.articles.antiplagiat_engine import _split_sentences, get_antiplagiat_engine
from apps.articles.antiplagiat_fingerprint import compare_texts
from apps.articles.antiplagiat_index import (
    find_index_matches,
    index_article,
    index_document,
    index_private_check,
    index_ready,
    mark_index_built,
)
from apps.articles.antiplagiat_normalize import stem, tokenize, translit_to_latin
from apps.articles.antiplagiat_oai import find_pdf_url, iter_records, parse_list_records
from apps.articles.antiplagiat_overlap import compute_verified_coverage, sentence_overlap_score
from apps.articles.management.commands.antiplag_benchmark import (
    SAME_TOPIC,
    UNRELATED,
    VARIANTS,
    _new_percent,
)
from apps.articles.models import AntiplagCorpusDocument, AntiplagIndexedDocument, Article
from tests.test_p1_integrity import COPIED, LOCAL_MODULES, ORIGINAL, Fixture

COPIED_CYR = (
    "Рақамли иқтисодиёт шароитида кичик бизнес субъектларининг молиявий барқарорлигини "
    "таъминлаш учун инновацион бошқарув механизмларини жорий этиш зарур ҳисобланади. "
    "Тадқиқот натижалари шуни кўрсатадики, электрон ҳисоб тизимлари харажатларни сезиларли камайтиради."
)


class NormalizeTests(TestCase):
    def test_cyrillic_and_apostrophes(self):
        self.assertEqual(translit_to_latin('Ўзбекистон иқтисодиёти').lower(), 'ozbekiston iqtisodiyoti')
        a = [t.stem for t in tokenize("o‘zbek ma'lumotlari")]
        b = [t.stem for t in tokenize("oʻzbek maʼlumotlari")]
        c = [t.stem for t in tokenize('ўзбек маълумотлари')]
        self.assertEqual(a, b)
        self.assertEqual(a, c)

    def test_suffixes_reduce_to_same_stem(self):
        self.assertEqual(stem('iqtisodiyotning'), stem('iqtisodiyotda'))
        self.assertEqual(stem('barqarorligini'), stem('barqarorlik'))
        self.assertEqual(stem('korxonalarning'), stem('korxonalar'))

    def test_stopwords_dropped_offsets_kept(self):
        text = 'Tadqiqot va tahlil uchun'
        toks = tokenize(text)
        self.assertEqual([text[t.start:t.end] for t in toks], ['Tadqiqot', 'tahlil'])

    def test_overlap_score_survives_script_and_suffixes(self):
        self.assertGreater(sentence_overlap_score(COPIED_CYR.split('.')[0], COPIED), 0.5)


class FingerprintTests(TestCase):
    def test_variants_found(self):
        src = VARIANTS["aynan ko'chirish"]
        for name in ("qo'shimchalar o'zgargan", 'kirill yozuvida', 'apostrof boshqacha (ʻ)'):
            self.assertGreater(compare_texts(VARIANTS[name], src).ratio, 0.9, name)
        self.assertEqual(compare_texts(UNRELATED, src).ratio, 0.0)

    def test_sentence_split_matches_engine(self):
        text = COPIED + '\n' + ORIGINAL + ' Qisqa.  Yana bir gap shu yerda turibdi!'
        self.assertEqual([s.text for s in split_sentences_with_offsets(text)], _split_sentences(text))
        for s in split_sentences_with_offsets(text):
            self.assertEqual(text[s.start:s.end], s.text)

    def test_reordered_sentence_detected(self):
        text = VARIANTS["so'z tartibi + sinonim"]
        sents = split_sentences_with_offsets(text)
        hits = compare_source(
            text, sents, tokenize(text), VARIANTS["aynan ko'chirish"],
            title='M', url='', module_id='milliy_reestr', module_label='M',
        )
        self.assertTrue(any(h['match_subtype'] == 'reordered' for h in hits))
        self.assertEqual(len({h['document_fragment'] for h in hits}), len(sents))

    def test_benchmark_thresholds(self):
        for name, text in VARIANTS.items():
            pct, found, total = _new_percent(text)
            self.assertGreaterEqual(pct, 80, name)
        self.assertEqual(_new_percent(UNRELATED)[0], 0.0)
        self.assertLess(_new_percent(SAME_TOPIC)[0], 10.0)

    def test_coverage_unions_ranges_of_two_sources(self):
        text = 'Birinchi yarmi bir manbadan olingan, ikkinchi yarmi esa boshqa manbadan olingan matn.'
        frag = text
        hits = [
            {'match_type': 'verified', 'overlap_chars': 30, 'document_fragment': frag, 'doc_ranges': [(0, 40)]},
            {'match_type': 'verified', 'overlap_chars': 30, 'document_fragment': frag, 'doc_ranges': [(40, len(text))]},
        ]
        total = len(text.replace(' ', ''))
        self.assertAlmostEqual(compute_verified_coverage(hits, total, text=text)['verified_plagiarism_pct'], 100.0)
        # text berilmasa — eski xatti-harakat (eng kattasi)
        self.assertLess(compute_verified_coverage(hits, total)['verified_plagiarism_pct'], 50.0)


class IndexScanTests(Fixture):
    def setUp(self):
        super().setUp()
        mark_index_built()

    def check(self, text, **kw):
        kw.setdefault('exclude_author_id', str(self.author.id))
        return get_antiplagiat_engine().check_text(text, enabled_modules=LOCAL_MODULES, **kw)

    def published(self, author, status='Published', title='Ochiq nashr', abstract=COPIED):
        art = Article.objects.create(title=title, abstract=abstract, author=author, journal=self.journal, status=status)
        index_article(art)
        return art

    def test_index_finds_cyrillic_copy_and_scans_whole_document(self):
        self.published(self.other)
        self.assertTrue(index_ready())
        res = self.check(COPIED_CYR + ' ' + ORIGINAL)
        rep = res['report']
        self.assertGreater(res['plagiarism_percentage'], 30)
        self.assertEqual(rep['sources'][0]['title'], 'Ochiq nashr')
        self.assertTrue(rep['index_used'])
        self.assertEqual(rep['checked_sentences'], rep['sentence_count'])
        self.assertEqual(rep['scan_coverage_percent'], 100.0)
        self.assertEqual(rep['algorithm_version'], '5.0')

    def test_index_hides_unpublished_source(self):
        self.published(self.other, status='WithEditor', title="Maxfiy qo'lyozma")
        res = self.check(COPIED)
        self.assertGreater(res['plagiarism_percentage'], 0)
        for src in res['report']['sources']:
            self.assertEqual(src['title'], UNPUBLISHED_TITLE)
            self.assertEqual(src.get('source', ''), '')
            self.assertEqual(src.get('source_text', ''), '')

    def test_index_self_citation(self):
        self.published(self.author, title='Oldingi ishim')
        res = self.check(COPIED)
        self.assertEqual(res['plagiarism_percentage'], 0.0)
        self.assertGreater(res['report']['self_citation_percent'], 0)

    def test_checked_article_excluded(self):
        art = self.published(self.other)
        res = self.check(COPIED, exclude_article_id=str(art.id), exclude_author_id=str(self.author.id))
        self.assertEqual(res['report']['sources'], [])

    def test_draft_and_standalone_not_indexed(self):
        self.published(self.other, status='Draft')
        art = self.published(self.other, status='Accepted', title='Plagiarism Check - x.docx')
        self.assertFalse(AntiplagIndexedDocument.objects.filter(doc_key=f'article:{art.id}').exists())
        self.assertFalse(AntiplagIndexedDocument.objects.filter(kind='article').exists())

    def test_partial_index_not_used_until_built(self):
        AntiplagIndexedDocument.objects.filter(kind='meta').delete()
        self.assertFalse(index_ready())
        Article.objects.create(title='Ochiq nashr', abstract=COPIED, author=self.other, journal=self.journal,
                               status='Published')
        res = self.check(COPIED)
        # Indeks qurilmagan — korpus xotirada solishtiriladi (natija baribir topiladi)
        self.assertFalse(res['report']['index_used'])
        self.assertGreater(res['plagiarism_percentage'], 50)
        call_command('build_antiplag_index', stdout=StringIO())
        self.assertTrue(index_ready())
        self.assertTrue(self.check(COPIED)['report']['index_used'])

    def test_unchanged_text_not_reindexed(self):
        self.assertGreater(index_document('corpus:t1', COPIED, kind='corpus', is_public=True), 0)
        self.assertEqual(index_document('corpus:t1', COPIED, kind='corpus', is_public=True), 0)

    @override_settings(ANTIPLAG_INDEX_PRIVATE_CHECKS=True)
    def test_private_check_fingerprints_only(self):
        art = Article.objects.create(title='Plagiarism Check - a.docx', abstract='x', author=self.other,
                                     journal=self.journal, status='Accepted')
        self.assertGreater(index_private_check(art, COPIED), 0)
        doc = AntiplagIndexedDocument.objects.get(doc_key=f'check:{art.id}')
        self.assertEqual(doc.text, '')
        matches = find_index_matches(tokenize(COPIED))
        self.assertEqual(len(matches), 1)
        self.assertIsNone(matches[0].source_tokens)
        res = self.check(COPIED)
        self.assertGreater(res['plagiarism_percentage'], 50)
        self.assertEqual(res['report']['sources'][0]['title'], UNPUBLISHED_TITLE)

    @override_settings(ANTIPLAG_AUTO_INDEX=True, ANTIPLAG_INDEX_SYNC=True)
    def test_signals_keep_index_in_sync(self):
        with self.captureOnCommitCallbacks(execute=True):
            art = Article.objects.create(title='Signal', abstract=COPIED, author=self.other,
                                         journal=self.journal, status='Published')
        key = f'article:{art.id}'
        self.assertTrue(AntiplagIndexedDocument.objects.filter(doc_key=key, is_public=True).exists())
        with self.captureOnCommitCallbacks(execute=True):
            art.status = 'Rejected'
            art.save()
        self.assertFalse(AntiplagIndexedDocument.objects.filter(doc_key=key).exists())
        with self.captureOnCommitCallbacks(execute=True):
            doc = AntiplagCorpusDocument.objects.create(external_key='k1', title='Arxiv', full_text=COPIED,
                                                        source_type='natlib')
        self.assertTrue(AntiplagIndexedDocument.objects.filter(doc_key='corpus:k1').exists())
        doc.delete()
        self.assertFalse(AntiplagIndexedDocument.objects.filter(doc_key='corpus:k1').exists())

    def test_build_index_command(self):
        Article.objects.create(title='Cmd', abstract=COPIED, author=self.other, journal=self.journal, status='Published')
        AntiplagCorpusDocument.objects.create(external_key='k2', title='Arxiv', full_text=ORIGINAL, source_type='otm')
        out = StringIO()
        call_command('build_antiplag_index', stdout=out)
        self.assertEqual(AntiplagIndexedDocument.objects.exclude(kind='meta').count(), 2)
        self.assertTrue(index_ready())
        self.assertIn('barmoq izlari', out.getvalue())

    def test_corpus_source_type_sets_module(self):
        index_document('corpus:natlib-1', COPIED, kind='corpus', title='Kutubxona', source_type='natlib', is_public=True)
        res = get_antiplagiat_engine().check_text(
            COPIED, enabled_modules=['milliy_reestr', 'natlib_uz'], exclude_author_id=str(self.author.id),
        )
        self.assertEqual(res['report']['sources'][0]['module_id'], 'natlib_uz')
        self.assertIn('natlib_uz', res['report']['executed_module_ids'])


class OpenApiDeepTests(Fixture):
    @override_settings(ANTIPLAG_FULLTEXT_ENABLED=True, ANTIPLAG_OPEN_API_QUERIES_PER_MODULE=5)
    def test_openalex_abstract_and_full_text(self):
        work = {'title': 'Xorijiy maqola', 'abstract': 'Boshqa mavzudagi qisqa annotatsiya matni bu yerda.',
                'url': 'https://example.org/w1', 'doi': '10.1/x', 'pdf_url': 'https://example.org/w1.pdf'}
        body = 'Kirish qismi. ' + COPIED + ' Xulosa qismi. ' * 30
        with mock.patch.dict('apps.articles.antiplagiat_real_scan.OPEN_API_SEARCHERS',
                             {'openalex': lambda q: [work]}), \
                mock.patch('apps.articles.antiplagiat_real_scan.fetch_fulltext', return_value=body) as ft:
            res = get_antiplagiat_engine().check_text(
                COPIED + ' ' + ORIGINAL, enabled_modules=['openalex'], exclude_author_id=str(self.author.id),
            )
        ft.assert_called_once_with('https://example.org/w1.pdf')
        srcs = res['report']['sources']
        self.assertTrue(srcs)
        self.assertEqual(srcs[0]['module_id'], 'openalex')
        self.assertEqual(srcs[0]['match_subtype'], 'full_text')
        self.assertGreater(res['plagiarism_percentage'], 30)
        self.assertEqual(res['report']['fulltext_docs_compared'], 1)


OAI_PAGE1 = b"""<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
 <ListRecords>
  <record>
   <header><identifier>oai:jur.uz:article/1</identifier><datestamp>2026-01-02</datestamp></header>
   <metadata>
    <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/">
     <dc:title>Raqamli iqtisodiyot</dc:title>
     <dc:creator>Aliyev, Vali</dc:creator>
     <dc:description>Raqamli iqtisodiyot sharoitida kichik biznes subyektlarining moliyaviy barqarorligi tahlil qilinadi.</dc:description>
     <dc:identifier>https://jur.uz/index.php/jur/article/view/1</dc:identifier>
     <dc:relation>https://jur.uz/index.php/jur/article/download/1/5.pdf</dc:relation>
     <dc:language>uzb</dc:language>
    </oai_dc:dc>
   </metadata>
  </record>
  <record><header status="deleted"><identifier>oai:jur.uz:article/2</identifier></header></record>
  <resumptionToken>TOKEN2</resumptionToken>
 </ListRecords>
</OAI-PMH>"""

OAI_PAGE2 = b"""<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
 <ListRecords>
  <record>
   <header><identifier>oai:jur.uz:article/3</identifier></header>
   <metadata>
    <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/">
     <dc:title>Ikkinchi maqola</dc:title>
     <dc:description>Fermer xo'jaliklarida suv resurslaridan oqilona foydalanish masalalari ko'rib chiqiladi.</dc:description>
     <dc:identifier>https://jur.uz/index.php/jur/article/view/3</dc:identifier>
    </oai_dc:dc>
   </metadata>
  </record>
  <resumptionToken/>
 </ListRecords>
</OAI-PMH>"""


class OaiTests(TestCase):
    def fake_fetch(self, url, params, **kw):
        self.calls.append(dict(params))
        return OAI_PAGE2 if params.get('resumptionToken') == 'TOKEN2' else OAI_PAGE1

    def setUp(self):
        self.calls = []

    def test_parse_and_paginate(self):
        recs, token, err = parse_list_records(OAI_PAGE1)
        self.assertEqual((len(recs), token, err), (2, 'TOKEN2', ''))
        r = recs[0]
        self.assertEqual(r.title, 'Raqamli iqtisodiyot')
        self.assertEqual(r.landing_url, 'https://jur.uz/index.php/jur/article/view/1')
        self.assertEqual(r.pdf_urls, ['https://jur.uz/index.php/jur/article/download/1/5.pdf'])
        self.assertTrue(recs[1].deleted)
        all_recs = list(iter_records('https://jur.uz/oai', delay=0, fetch=self.fake_fetch))
        self.assertEqual([x.identifier for x in all_recs],
                         ['oai:jur.uz:article/1', 'oai:jur.uz:article/2', 'oai:jur.uz:article/3'])
        self.assertEqual(self.calls[1], {'verb': 'ListRecords', 'resumptionToken': 'TOKEN2'})

    def test_rejects_entities(self):
        evil = b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><OAI-PMH/>'
        with self.assertRaises(ValueError):
            parse_list_records(evil)

    def test_find_pdf_url(self):
        html = '<meta name="citation_pdf_url" content="https://jur.uz/index.php/jur/article/view/7/12">'
        self.assertEqual(find_pdf_url(html, 'https://jur.uz/x'), 'https://jur.uz/index.php/jur/article/download/7/12')
        self.assertEqual(find_pdf_url('<html></html>', 'https://jur.uz'), '')

    def test_harvest_command(self):
        AntiplagCorpusDocument.objects.create(external_key='oai:oai:jur.uz:article/2', title='Eski',
                                              full_text=ORIGINAL, source_type='journal')
        with mock.patch('apps.articles.antiplagiat_oai._get', side_effect=self.fake_fetch):
            out = StringIO()
            call_command('harvest_oai', 'https://jur.uz/oai', '--delay', '0', stdout=out)
        self.assertTrue(AntiplagCorpusDocument.objects.filter(external_key='oai:oai:jur.uz:article/1').exists())
        self.assertFalse(AntiplagCorpusDocument.objects.get(external_key='oai:oai:jur.uz:article/2').is_active)
        self.assertTrue(AntiplagIndexedDocument.objects.filter(doc_key='corpus:oai:oai:jur.uz:article/1').exists())
        self.assertFalse(AntiplagIndexedDocument.objects.filter(doc_key='corpus:oai:oai:jur.uz:article/2').exists())
        self.assertIn('yangi: 2', out.getvalue())


class BenchmarkCommandTests(TestCase):
    def test_runs(self):
        out = StringIO()
        call_command('antiplag_benchmark', stdout=out)
        self.assertIn("kirill yozuvida", out.getvalue())
