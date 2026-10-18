"""Antiplagiat hisobot muqovasi uchun meta: muallif ish joyi, asl fayl nomi, hajmi; taqrizchidan yashirish."""
import os
import tempfile
from types import SimpleNamespace

from apps.articles.plagiarism_check_service import _fill_report_document_meta
from apps.articles.serializers import _REPORT_IDENTITY_KEYS


def _author(**kw):
    base = {'first_name': 'Aziza', 'last_name': 'Karimova', 'affiliation': 'TDIU, Raqamli iqtisodiyot kafedrasi'}
    base.update(kw)
    return SimpleNamespace(**base)


def test_fills_workplace_file_name_and_size_for_uploader():
    with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as fh:
        fh.write(b'x' * 2048)
        path = fh.name
    try:
        report = {'author_first_name': 'aziza', 'author_last_name': 'Karimova'}
        _fill_report_document_meta(report, SimpleNamespace(author=_author()), path)
        assert report['author_workplace'] == 'TDIU, Raqamli iqtisodiyot kafedrasi'
        assert report['original_file_name'] == os.path.basename(path)
        assert report['file_size_bytes'] == 2048
    finally:
        os.unlink(path)


def test_does_not_attach_uploader_workplace_to_other_named_author():
    report = {'author_first_name': 'Boshqa', 'author_last_name': 'Shaxs'}
    _fill_report_document_meta(report, SimpleNamespace(author=_author()), None)
    assert 'author_workplace' not in report
    assert 'file_size_bytes' not in report


def test_keeps_existing_values_and_hides_workplace_from_reviewers():
    report = {'author_workplace': 'Avvalgi', 'original_file_name': 'asl.docx', 'file_size_bytes': 5}
    _fill_report_document_meta(report, SimpleNamespace(author=_author()), __file__)
    assert report == {'author_workplace': 'Avvalgi', 'original_file_name': 'asl.docx', 'file_size_bytes': 5}
    assert 'author_workplace' in _REPORT_IDENTITY_KEYS
