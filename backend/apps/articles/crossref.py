"""
Crossref DOI depoziti (schema 5.3.1, journal_article).

- build_deposit_xml(article) — nashr etilgan maqola uchun depozit XML.
- deposit(article) — CROSSREF_USERNAME/PASSWORD sozlangan bo'lsa Crossref'ga yuboradi (doMDUpload).
- DOI bo'lmasa va CROSSREF_DOI_PREFIX berilgan bo'lsa: <prefix>/phx.<yil>.<id8> ko'rinishida beriladi.

DOI resurs manzili — ochiq maqola sahifasi /p/article/<id>/ (Google Scholar meta-teglari bilan).
"""
from __future__ import annotations

import time
import urllib.error
import urllib.request
import uuid
from xml.sax.saxutils import escape

from django.conf import settings
from django.urls import reverse

from .scholar import article_authors, publication_date

CROSSREF_NS = 'http://www.crossref.org/schema/5.3.1'


class CrossrefError(Exception):
    pass


def _site() -> str:
    return (getattr(settings, 'PUBLIC_SITE_URL', '') or getattr(settings, 'FRONTEND_BASE_URL', '')).rstrip('/')


def resource_url(article) -> str:
    return f"{_site()}{reverse('scholar_article_page', args=[article.pk])}"


def suggested_doi(article) -> str:
    prefix = (getattr(settings, 'CROSSREF_DOI_PREFIX', '') or '').strip().strip('/')
    if not prefix:
        return ''
    pub = publication_date(article)
    year = pub.year if pub else ''
    return f'{prefix}/phx.{year}.{str(article.pk).replace("-", "")[:8]}'


def normalized_doi(article) -> str:
    doi = (article.doi or '').strip()
    for p in ('https://doi.org/', 'http://doi.org/', 'https://dx.doi.org/', 'doi:'):
        if doi.lower().startswith(p):
            doi = doi[len(p):]
    return doi


def _split_name(full: str) -> tuple[str, str]:
    """'Familiya Ism Otasining' → (given='Ism Otasining', surname='Familiya')."""
    parts = (full or '').split()
    if len(parts) <= 1:
        return '', full or ''
    return ' '.join(parts[1:]), parts[0]


def build_deposit_xml(article, doi: str = '') -> str:
    doi = doi or normalized_doi(article) or suggested_doi(article)
    if not doi:
        raise CrossrefError("Maqolada DOI yo'q va CROSSREF_DOI_PREFIX sozlanmagan.")
    journal = article.journal
    pub = publication_date(article)
    batch_id = f'phx-{str(article.pk)[:8]}-{int(time.time())}'
    timestamp = time.strftime('%Y%m%d%H%M%S')

    contributors = []
    for idx, name in enumerate(article_authors(article)):
        given, surname = _split_name(name)
        seq = 'first' if idx == 0 else 'additional'
        orcid = ''
        if idx == 0 and article.author and getattr(article.author, 'orcid_id', ''):
            orcid = f'<ORCID>https://orcid.org/{escape(article.author.orcid_id)}</ORCID>'
        given_xml = f'<given_name>{escape(given)}</given_name>' if given else ''
        contributors.append(
            f'<person_name sequence="{seq}" contributor_role="author">{given_xml}'
            f'<surname>{escape(surname)}</surname>{orcid}</person_name>'
        )

    issue_xml = ''
    if article.issue_id and article.issue:
        issue_xml = (
            f'<journal_issue><publication_date media_type="online"><year>{article.issue.publication_date.year}</year>'
            f'</publication_date><issue>{escape(article.issue.issue_number)}</issue></journal_issue>'
        )

    date_xml = ''
    if pub:
        date_xml = (
            f'<publication_date media_type="online"><month>{pub.month:02d}</month>'
            f'<day>{pub.day:02d}</day><year>{pub.year}</year></publication_date>'
        )

    abstract_xml = ''
    if (article.abstract or '').strip():
        abstract_xml = (
            '<jats:abstract xmlns:jats="http://www.ncbi.nlm.nih.gov/JATS1"><jats:p>'
            f'{escape(article.abstract.strip())}</jats:p></jats:abstract>'
        )

    issn = (getattr(journal, 'issn', '') or '').strip()
    issn_xml = f'<issn media_type="electronic">{escape(issn)}</issn>' if issn else ''
    journal_title = escape(getattr(journal, 'name', '') or 'Phoenix')
    contributors_xml = ''.join(contributors)
    depositor_name = escape(settings.CROSSREF_DEPOSITOR_NAME)
    depositor_email = escape(settings.CROSSREF_DEPOSITOR_EMAIL or 'info@ilmiyfaoliyat.uz')
    registrant = escape(settings.CROSSREF_REGISTRANT)
    title_xml = escape(article.title)
    doi_xml = escape(doi)
    resource_xml = escape(resource_url(article))
    batch_xml = escape(batch_id)

    return f'''<?xml version="1.0" encoding="UTF-8"?>
<doi_batch version="5.3.1" xmlns="{CROSSREF_NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="{CROSSREF_NS} https://www.crossref.org/schemas/crossref5.3.1.xsd">
<head>
<doi_batch_id>{batch_xml}</doi_batch_id>
<timestamp>{timestamp}</timestamp>
<depositor><depositor_name>{depositor_name}</depositor_name><email_address>{depositor_email}</email_address></depositor>
<registrant>{registrant}</registrant>
</head>
<body>
<journal>
<journal_metadata language="uz"><full_title>{journal_title}</full_title>{issn_xml}</journal_metadata>
{issue_xml}
<journal_article publication_type="full_text">
<titles><title>{title_xml}</title></titles>
<contributors>{contributors_xml}</contributors>
{abstract_xml}
{date_xml}
<doi_data><doi>{doi_xml}</doi><resource>{resource_xml}</resource></doi_data>
</journal_article>
</journal>
</body>
</doi_batch>
'''


def _multipart(fields: dict, file_field: str, filename: str, content: bytes) -> tuple[bytes, str]:
    boundary = f'----phx{uuid.uuid4().hex}'
    lines = []
    for key, value in fields.items():
        lines += [f'--{boundary}', f'Content-Disposition: form-data; name="{key}"', '', str(value)]
    head = '\r\n'.join(lines + [
        f'--{boundary}',
        f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"',
        'Content-Type: application/xml',
        '',
        '',
    ]).encode('utf-8')
    tail = f'\r\n--{boundary}--\r\n'.encode('utf-8')
    return head + content + tail, f'multipart/form-data; boundary={boundary}'


def crossref_configured() -> bool:
    return bool(getattr(settings, 'CROSSREF_USERNAME', '') and getattr(settings, 'CROSSREF_PASSWORD', ''))


def deposit(article) -> dict:
    """Crossref'ga yuborish. Muvaffaqiyatda {'doi', 'batch_id', 'response'} qaytaradi."""
    if not crossref_configured():
        raise CrossrefError('Crossref login/parol sozlanmagan (CROSSREF_USERNAME, CROSSREF_PASSWORD).')
    doi = normalized_doi(article) or suggested_doi(article)
    xml = build_deposit_xml(article, doi=doi)
    body, content_type = _multipart(
        {
            'operation': 'doMDUpload',
            'login_id': settings.CROSSREF_USERNAME,
            'login_passwd': settings.CROSSREF_PASSWORD,
        },
        'fname',
        f'phoenix-{str(article.pk)[:8]}.xml',
        xml.encode('utf-8'),
    )
    req = urllib.request.Request(settings.CROSSREF_DEPOSIT_URL, data=body, headers={'Content-Type': content_type}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode('utf-8', errors='replace')[:2000]
            if resp.status >= 300:
                raise CrossrefError(f'Crossref javobi: {resp.status}')
    except urllib.error.HTTPError as exc:
        raise CrossrefError(f'Crossref HTTP {exc.code}') from exc
    except urllib.error.URLError as exc:
        raise CrossrefError(f'Crossref bilan aloqa yo\'q: {exc.reason}') from exc
    return {'doi': doi, 'response': text}
