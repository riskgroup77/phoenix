"""
Antiplagiat — bepul kuchaytirish: aldash usullarini aniqlash, adabiyotlar ro'yxatini chiqarish,
umumiy iboralar filtri, bepul API'lar (DOAJ, Vikipediya, arXiv, Europe PMC), OAI yig'ish holati.
"""
import os
import tempfile
import zipfile
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.articles import antiplagiat_open_api as api
from apps.articles.antiplagiat_engine import get_antiplagiat_engine, strip_bibliography
from apps.articles.antiplagiat_index import find_index_matches, index_document, mark_index_built
from apps.articles.antiplagiat_normalize import guess_lang, tokenize
from apps.articles.antiplagiat_oai import OaiRecord, list_sets, parse_list_records
from apps.articles.antiplagiat_tricks import clean_text, docx_visible_text
from apps.articles.models import AntiplagCorpusDocument, AntiplagHarvestState
from tests.test_antiplag_deep import OAI_PAGE2
from tests.test_p1_integrity import COPIED, LOCAL_MODULES, ORIGINAL, Fixture


def _docx(runs: list[tuple[str, str]]) -> str:
    """Minimal DOCX: runs = [(matn, rPr xml)]."""
    body = ''.join(f'<w:r><w:rPr>{rpr}</w:rPr><w:t xml:space="preserve">{t}</w:t></w:r>' for t, rpr in runs)
    xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body><w:p>{body}</w:p></w:body></w:document>'
    )
    fd, path = tempfile.mkstemp(suffix='.docx')
    os.close(fd)
    with zipfile.ZipFile(path, 'w') as zf:
        zf.writestr('word/document.xml', xml)
    return path


class TricksTests(TestCase):
    def test_invisible_chars_and_homoglyphs_cleaned(self):
        tricky = COPIED.replace('iqtisodiyot', 'iqtisod​iyot').replace('biznes', 'biznеs')  # kirill е
        cleaned, stats = clean_text(tricky)
        self.assertEqual(cleaned, COPIED)
        self.assertEqual(stats['invisible_chars'], 1)
        self.assertEqual(stats['homoglyph_words'], 1)

    def test_pure_cyrillic_and_latin_words_untouched(self):
        text = 'Иқтисодиёт va iqtisodiyot. Экономика и economy.'
        self.assertEqual(clean_text(text)[0], text)

    def test_tricks_do_not_hide_plagiarism_and_are_reported(self):
        Fixture.setUp(self)
        from apps.articles.models import Article
        from apps.articles.antiplagiat_index import index_article

        art = Article.objects.create(title='Manba', abstract=COPIED, author=self.other, journal=self.journal,
                                     status='Published')
        index_article(art)
        mark_index_built()
        tricky = (COPIED.replace(' ', ' ​').replace('a', 'а')) + ' ' + ORIGINAL
        res = get_antiplagiat_engine().check_text(tricky, enabled_modules=LOCAL_MODULES,
                                                  exclude_author_id=str(self.author.id))
        rep = res['report']
        self.assertGreater(res['plagiarism_percentage'], 30)
        self.assertTrue(rep['bypass_attempts']['detected'])
        self.assertEqual(rep['overall_risk'], 'high')
        self.assertTrue(any('aldash' in r for r in rep['recommendations']))

    def test_docx_hidden_white_text_removed(self):
        path = _docx([
            ('Raqamli iqtisodiyot sharoitida ', ''),
            ('xyzzy qwerty plugh ', '<w:color w:val="FFFFFF"/>'),
            ('kichik biznes ', ''),
            ('yashirin', '<w:vanish/>'),
            ('subyektlari.', '<w:sz w:val="24"/>'),
        ])
        try:
            text, stats = docx_visible_text(path)
        finally:
            os.unlink(path)
        self.assertEqual(text, 'Raqamli iqtisodiyot sharoitida kichik biznes subyektlari.')
        self.assertEqual(stats['hidden_reasons'], {'white': 18, 'hidden': 8})

    def test_check_file_uses_visible_text(self):
        noise = ' '.join(f'zz{i}' for i in range(60))
        path = _docx([(COPIED[:150], ''), (noise, '<w:color w:val="FFFFFF"/>'), (COPIED[150:], '')])
        try:
            res = get_antiplagiat_engine().check_file(path, enabled_modules=['shablon_iboralar'])
        finally:
            os.unlink(path)
        rep = res['report']
        self.assertGreater(rep['bypass_attempts']['hidden_text_chars'], 100)
        self.assertNotIn('zz1', ' '.join(p['text'] for p in rep['annotated_document']))


class BibliographyTests(TestCase):
    def test_strip_bibliography_in_second_half(self):
        body = ORIGINAL * 3
        bib = "\nFoydalanilgan adabiyotlar ro'yxati:\n1. Aliyev A. Raqamli iqtisodiyot. — T., 2020.\n2. Smith J. (2019)."
        out, excluded = strip_bibliography(body + bib)
        self.assertEqual(out, body.rstrip())
        self.assertGreater(excluded, 30)
        # Hujjat boshidagi (mundarija) sarlavha kesilmaydi
        early = 'Adabiyotlar\n' + body
        self.assertEqual(strip_bibliography(early)[0], early)

    def test_russian_and_english_headings(self):
        for head in ('Список литературы', 'СПИСОК ИСПОЛЬЗОВАННЫХ ИСТОЧНИКОВ', 'References', '5. Adabiyotlar:'):
            out, excluded = strip_bibliography(ORIGINAL * 2 + f'\n{head}\n1. Kitob.')
            self.assertGreater(excluded, 0, head)

    def test_bibliography_not_counted_as_plagiarism(self):
        res = get_antiplagiat_engine().check_text(
            ORIGINAL * 2 + '\nFoydalanilgan adabiyotlar\n' + COPIED, enabled_modules=['shablon_iboralar'],
        )
        self.assertGreater(res['report']['excluded_bibliography_chars'], 100)


class CommonShingleTests(TestCase):
    @override_settings(ANTIPLAG_COMMON_SHINGLE_MIN_DOCS=3)
    def test_boilerplate_phrase_does_not_make_candidates(self):
        boiler = 'Ushbu maqolada zamonaviy pedagogik texnologiyalarning samaradorligi masalalari tahlil qilingan.'
        for i in range(6):
            index_document(f'corpus:b{i}', boiler + f' Mavzu {i} bo\'yicha alohida tajriba natijalari keltirilgan '
                           f'raqam{i} maydon{i} usul{i} xulosa{i}.', kind='corpus', is_public=True)
        self.assertEqual(find_index_matches(tokenize(boiler + ' ' + ORIGINAL)), [])
        index_document('corpus:real', COPIED, kind='corpus', is_public=True)
        self.assertEqual(len(find_index_matches(tokenize(COPIED))), 1)


class LangTests(TestCase):
    def test_guess_lang(self):
        self.assertEqual(guess_lang("Ushbu maqolada o'zbek tili va adabiyoti masalalari ko'rib chiqilgan."), 'uz')
        self.assertEqual(guess_lang('This paper studies the effect of digital tools on learning.'), 'en')
        self.assertEqual(guess_lang('В статье рассматриваются вопросы экономики.'), 'ru')
        self.assertEqual(guess_lang('Мақолада иқтисодиёт масалалари кўриб чиқилган.'), 'uz')


def _resp(json_data=None, content=b''):
    r = mock.Mock()
    r.json.return_value = json_data
    r.content = content
    r.raise_for_status.return_value = None
    return r


@override_settings(ANTIPLAG_API_RATE_DELAY_SEC=0)
class FreeApiTests(TestCase):
    def test_doaj(self):
        data = {'results': [{'bibjson': {
            'title': 'Raqamli iqtisodiyot', 'abstract': COPIED,
            'identifier': [{'type': 'doi', 'id': '10.1/abc'}],
            'link': [{'type': 'fulltext', 'url': 'https://jur.uz/index.php/j/article/view/5'}],
        }}]}
        with mock.patch.object(api.requests, 'get', return_value=_resp(data)):
            r = api.search_doaj('raqamli iqtisodiyot kichik biznes')
        self.assertEqual(r[0]['url'], 'https://doi.org/10.1/abc')
        self.assertEqual(r[0]['landing_url'], 'https://jur.uz/index.php/j/article/view/5')

    def test_wikipedia_language_and_fulltext_url(self):
        data = {'query': {'search': [{'title': 'Raqamli iqtisodiyot', 'snippet': 'raqamli <span>iqtisodiyot</span>'}]}}
        with mock.patch.object(api.requests, 'get', return_value=_resp(data)) as g:
            r = api.search_wikipedia('Рақамли иқтисодиёт кичик бизнес', lang='uz')
        self.assertIn('uz.wikipedia.org/w/api.php', g.call_args[0][0])
        self.assertIn('raqamli iqtisodiyot', g.call_args[1]['params']['srsearch'].lower())
        self.assertEqual(r[0]['pdf_url'], 'https://uz.wikipedia.org/api/rest_v1/page/html/Raqamli_iqtisodiyot')

    def test_arxiv_atom(self):
        atom = (b'<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry>'
                b'<id>http://arxiv.org/abs/1706.03762v7</id><title>Attention Is All You Need</title>'
                b'<summary>The dominant sequence transduction models.</summary>'
                b'<link title="pdf" href="http://arxiv.org/pdf/1706.03762v7"/></entry></feed>')
        with mock.patch.object(api.requests, 'get', return_value=_resp(content=atom)), \
                mock.patch.object(api.time, 'sleep'):
            r = api.search_arxiv('attention transformer sequence transduction models')
        self.assertEqual(r[0]['title'], 'Attention Is All You Need')
        self.assertEqual(r[0]['pdf_url'], 'http://arxiv.org/pdf/1706.03762v7')

    def test_europe_pmc(self):
        data = {'resultList': {'result': [{
            'title': 'T', 'abstractText': 'A', 'doi': '10.2/x', 'isOpenAccess': 'Y',
            'fullTextUrlList': {'fullTextUrl': [{'url': 'https://europepmc.org/articles/PMC1?pdf=render'}]},
        }]}}
        with mock.patch.object(api.requests, 'get', return_value=_resp(data)):
            r = api.search_europe_pmc('query words here for test')
        self.assertEqual(r[0]['pdf_url'], 'https://europepmc.org/articles/PMC1?pdf=render')

    def test_english_only_modules_skip_uzbek_text(self):
        from apps.articles.antiplagiat_real_scan import OPEN_API_SEARCHERS

        calls = []
        with mock.patch.dict(OPEN_API_SEARCHERS, {'arxiv': lambda q: calls.append(q) or []}):
            get_antiplagiat_engine().check_text(COPIED + ' ' + ORIGINAL, enabled_modules=['arxiv'])
        self.assertEqual(calls, [])

    def test_doaj_landing_full_text_used(self):
        from apps.articles.antiplagiat_real_scan import OPEN_API_SEARCHERS

        work = {'title': 'Jurnal maqolasi', 'abstract': 'Boshqa mavzu.', 'url': 'https://doi.org/10.1/z', 'doi': '10.1/z',
                'pdf_url': '', 'landing_url': 'https://jur.uz/index.php/j/article/view/9'}
        with override_settings(ANTIPLAG_FULLTEXT_ENABLED=True), \
                mock.patch.dict(OPEN_API_SEARCHERS, {'doaj': lambda q: [work]}), \
                mock.patch('apps.articles.antiplagiat_oai.full_text_for', return_value='Kirish. ' + COPIED * 3) as ft:
            res = get_antiplagiat_engine().check_text(COPIED + ' ' + ORIGINAL, enabled_modules=['doaj'])
        ft.assert_called_once_with('https://jur.uz/index.php/j/article/view/9')
        self.assertEqual(res['report']['sources'][0]['match_subtype'], 'full_text')


SETS_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"><ListSets>
<set><setSpec>jur</setSpec><setName>Jurnal</setName></set>
<set><setSpec>jur:ART</setSpec><setName>Maqolalar</setName></set>
<set><setSpec>ped</setSpec><setName>Pedagogika</setName></set>
</ListSets></OAI-PMH>"""


class OaiFreeTests(TestCase):
    def test_control_chars_and_galley_links(self):
        xml = OAI_PAGE2.replace(b'Ikkinchi maqola', b'Ikkinchi\x02 maqola').replace(
            b'</dc:identifier>', b'</dc:identifier><dc:relation>https://jur.uz/index.php/jur/article/view/3/7</dc:relation>')
        recs, _t, _e = parse_list_records(xml)
        self.assertEqual(recs[0].title, 'Ikkinchi maqola')
        self.assertEqual(recs[0].pdf_urls, ['https://jur.uz/index.php/jur/article/download/3/7'])
        self.assertEqual(recs[0].landing_url, 'https://jur.uz/index.php/jur/article/view/3')

    def test_list_sets_top_level_only(self):
        self.assertEqual(list_sets('https://x/oai', fetch=lambda u, p: SETS_XML, delay=0), ['jur', 'ped'])

    def test_incremental_harvest_uses_saved_datestamp(self):
        calls = []

        def fetch(url, params, **kw):
            calls.append(dict(params))
            return OAI_PAGE2

        with mock.patch('apps.articles.antiplagiat_oai._get', side_effect=fetch):
            call_command('harvest_oai', 'https://jur.uz/oai', '--delay', '0', stdout=StringIO())
            AntiplagHarvestState.objects.update(last_datestamp='2026-05-01T00:00:00Z')
            out = StringIO()
            call_command('harvest_oai', 'https://jur.uz/oai', '--delay', '0', stdout=out)
        self.assertNotIn('from', calls[0])
        self.assertEqual(calls[1].get('from'), '2026-05-01')
        self.assertIn("o'zgarmagan: 1", out.getvalue())
        st = AntiplagHarvestState.objects.get()
        self.assertTrue(st.completed)

    def test_fill_full_text(self):
        doc = AntiplagCorpusDocument.objects.create(
            external_key='oai:x:1', title='Maqola', full_text=ORIGINAL, source_type='journal',
            source_url='https://jur.uz/index.php/j/article/view/1',
        )
        with mock.patch('apps.articles.management.commands.harvest_oai.full_text_for',
                        return_value=COPIED * 3) as ft:
            call_command('harvest_oai', '--fill-full-text', '5', '--delay', '0', stdout=StringIO())
            call_command('harvest_oai', '--fill-full-text', '5', '--delay', '0', stdout=StringIO())
        self.assertEqual(ft.call_count, 1)  # ikkinchi marta qayta urinilmaydi
        doc.refresh_from_db()
        self.assertIn(COPIED, doc.full_text)
        self.assertIsNotNone(doc.fulltext_checked_at)

    def test_default_sources_parse(self):
        from apps.articles.antiplagiat_oai import DEFAULT_OAI_SOURCES, parse_source

        parsed = [parse_source(s) for s in DEFAULT_OAI_SOURCES]
        self.assertTrue(all(u.startswith('https://') and u.endswith('/oai') for u, _ in parsed))
        self.assertIn(('https://journals.nuu.uz/index.php/index/oai', True), parsed)

    def test_record_without_metadata_skipped(self):
        r = OaiRecord(identifier='oai:x:9')
        self.assertEqual(r.text, '')


class AvailableModulesTests(TestCase):
    def test_journal_archive_module_listed_when_harvested(self):
        from apps.articles.antiplagiat_available import available_module_ids

        self.assertNotIn('oak_journals_uz', available_module_ids())
        self.assertIn('wikipedia', available_module_ids())
        AntiplagCorpusDocument.objects.create(external_key='oai:j:1', title='J', full_text=ORIGINAL, source_type='journal')
        ids = available_module_ids()
        self.assertIn('oak_journals_uz', ids)
        self.assertNotIn('natlib_uz', ids)
