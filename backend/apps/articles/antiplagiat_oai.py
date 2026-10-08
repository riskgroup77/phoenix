"""
OAI-PMH yig'uvchi (harvester): jurnallar arxivlarini ichki antiplagiat bazasiga qo'shish.

O'zbekistondagi ilmiy jurnallarning aksariyati OJS (Open Journal Systems) da ishlaydi va OAI-PMH
endpoint'i bor: https://<jurnal>/index.php/<jurnal>/oai . ListRecords (oai_dc) orqali barcha maqolalar
sarlavhasi, annotatsiyasi va havolasi olinadi; --full-text bilan maqola sahifasidagi
<meta name="citation_pdf_url"> orqali PDF ham yuklab olinib, to'liq matni indekslanadi.
"""
from __future__ import annotations

import hashlib
import logging
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Iterator
from urllib.parse import urljoin

import requests

logger = logging.getLogger(__name__)

NS = {
    'oai': 'http://www.openarchives.org/OAI/2.0/',
    'dc': 'http://purl.org/dc/elements/1.1/',
    'oai_dc': 'http://www.openarchives.org/OAI/2.0/oai_dc/',
}
REQUEST_TIMEOUT = 40
MAX_RESPONSE_BYTES = 30 * 1024 * 1024
RETRIES = 3

# Tekshirilgan (2026-10-08, verb=Identify / ListRecords ishlaydi) bepul O'zbekiston manbalari.
# OJS'ning sayt bo'yicha umumiy endpoint'i (index.php/index/oai) — o'sha o'rnatmadagi BARCHA jurnallar.
# "|insecure" — sayt SSL sertifikat zanjiri to'liq emas (faqat ochiq ma'lumot o'qiladi).
DEFAULT_OAI_SOURCES = [
    'https://inlibrary.uz/index.php/index/oai',            # inLibrary — ilmiy elektron kutubxona (~133 ming yozuv)
    'https://www.in-academy.uz/index.php/index/oai',       # In Academy jurnallari (~53 ming)
    'https://phoenixpublication.net/index.php/index/oai',  # Phoenix Publication (~13 ming)
    'https://journals.nuu.uz/index.php/index/oai|insecure',  # O'zMU nashriyoti (~9 ming)
    'https://www.openscience.uz/index.php/index/oai',      # Open Science (~7 ming)
    'https://universaljournal.uz/index.php/index/oai',     # Universal xalqaro ilmiy jurnal
    'https://journals.uznauka.uz/index.php/index/oai',     # UzNauka / Fan va jamiyat
]


def parse_source(spec: str) -> tuple[str, bool]:
    """'url|insecure' → (url, insecure)"""
    url, _, flags = spec.strip().partition('|')
    return url.strip(), 'insecure' in flags.lower()


@dataclass
class OaiRecord:
    identifier: str
    deleted: bool = False
    titles: list[str] = field(default_factory=list)
    descriptions: list[str] = field(default_factory=list)
    creators: list[str] = field(default_factory=list)
    identifiers: list[str] = field(default_factory=list)
    relations: list[str] = field(default_factory=list)
    languages: list[str] = field(default_factory=list)
    datestamp: str = ''

    @property
    def external_key(self) -> str:
        key = f'oai:{self.identifier}'
        if len(key) > 160:
            key = 'oai:' + hashlib.sha1(self.identifier.encode('utf-8')).hexdigest()
        return key

    @property
    def title(self) -> str:
        return (self.titles[0] if self.titles else '').strip()

    @property
    def landing_url(self) -> str:
        for u in self.identifiers + self.relations:
            if u.startswith(('http://', 'https://')) and not _looks_like_pdf(u) and not _OJS_GALLEY_RE.search(u):
                return u
        return ''

    @property
    def pdf_urls(self) -> list[str]:
        out = []
        for u in self.identifiers + self.relations:
            if not u.startswith(('http://', 'https://')):
                continue
            if _looks_like_pdf(u):
                out.append(u)
            elif _OJS_GALLEY_RE.search(u):
                # OJS galereyasi: article/view/ID/GALLEY → article/download/ID/GALLEY
                out.append(_OJS_GALLEY_RE.sub(r'/article/download/\1/\2', u))
        return out

    @property
    def text(self) -> str:
        return '\n'.join(p.strip() for p in [self.title, *self.descriptions] if p and p.strip())


_OJS_GALLEY_RE = re.compile(r'/article/view/(\d+)/(\d+)')


def _looks_like_pdf(url: str) -> bool:
    u = url.lower()
    return u.endswith('.pdf') or '/download/' in u or 'format=pdf' in u


def _safe_parse(xml_bytes: bytes) -> ET.Element:
    # Tashqi server javobi: DTD/ENTITY bo'lsa rad etiladi (entity expansion hujumlaridan himoya)
    head = xml_bytes[:4096].upper()
    if b'<!DOCTYPE' in head or b'<!ENTITY' in xml_bytes.upper():
        raise ValueError('OAI javobida DTD/ENTITY bor — rad etildi')
    # Real jurnallar matnida XML'da taqiqlangan boshqaruv belgilari uchraydi (masalan \x02) — bo'shliq bilan almashtiriladi
    return ET.fromstring(_XML_INVALID_RE.sub(b' ', xml_bytes))


_XML_INVALID_RE = re.compile(rb'[\x00-\x08\x0b\x0c\x0e-\x1f]')


def _texts(meta: ET.Element, tag: str) -> list[str]:
    return [re.sub(r'\s+', ' ', (el.text or '')).strip() for el in meta.findall(f'.//dc:{tag}', NS) if (el.text or '').strip()]


def parse_list_records(xml_bytes: bytes) -> tuple[list[OaiRecord], str, str]:
    """(yozuvlar, resumptionToken, xato kodi)."""
    root = _safe_parse(xml_bytes)
    err = root.find('oai:error', NS)
    if err is not None:
        return [], '', err.get('code') or 'error'
    records: list[OaiRecord] = []
    for rec in root.findall('.//oai:ListRecords/oai:record', NS):
        header = rec.find('oai:header', NS)
        if header is None:
            continue
        ident = (header.findtext('oai:identifier', default='', namespaces=NS) or '').strip()
        if not ident:
            continue
        r = OaiRecord(
            identifier=ident,
            deleted=header.get('status') == 'deleted',
            datestamp=(header.findtext('oai:datestamp', default='', namespaces=NS) or '').strip(),
        )
        meta = rec.find('oai:metadata', NS)
        if meta is not None:
            r.titles = _texts(meta, 'title')
            r.descriptions = _texts(meta, 'description')
            r.creators = _texts(meta, 'creator')
            r.identifiers = _texts(meta, 'identifier')
            r.relations = _texts(meta, 'relation')
            r.languages = _texts(meta, 'language')
        records.append(r)
    token_el = root.find('.//oai:ListRecords/oai:resumptionToken', NS)
    token = (token_el.text or '').strip() if token_el is not None and token_el.text else ''
    return records, token, ''


def _get(url: str, params: dict | None = None, *, verify: bool = True) -> bytes:
    """GET (tarmoq/5xx xatolarida 3 marta qayta urinadi; 429/503 da Retry-After hurmat qilinadi)."""
    from apps.articles.antiplagiat_open_api import USER_AGENT

    last_exc: Exception | None = None
    for attempt in range(RETRIES):
        try:
            with requests.get(url, params=params, headers={'User-Agent': USER_AGENT}, timeout=REQUEST_TIMEOUT,
                              stream=True, verify=verify) as resp:
                if resp.status_code in (429, 500, 502, 503, 504) and attempt < RETRIES - 1:
                    wait = resp.headers.get('Retry-After', '')
                    time.sleep(min(60.0, float(wait)) if wait.isdigit() else 5.0 * (attempt + 1))
                    continue
                resp.raise_for_status()
                data = b''
                for chunk in resp.iter_content(256 * 1024):
                    data += chunk
                    if len(data) > MAX_RESPONSE_BYTES:
                        raise ValueError('OAI javobi juda katta')
                return data
        except (requests.ConnectionError, requests.Timeout) as exc:
            last_exc = exc
            if attempt < RETRIES - 1:
                time.sleep(5.0 * (attempt + 1))
    raise last_exc or RuntimeError(f'{url}: javob olinmadi')


def list_sets(endpoint: str, *, fetch=None, delay: float = 1.0) -> list[str]:
    """Yuqori darajadagi set'lar (OJS'da — jurnallar; 'jurnal:BO`LIM' kichik set'lar tashlanadi)."""
    fetch = fetch or _get
    params = {'verb': 'ListSets'}
    out: list[str] = []
    while True:
        root = _safe_parse(fetch(endpoint, params))
        for el in root.findall('.//oai:ListSets/oai:set/oai:setSpec', NS):
            spec = (el.text or '').strip()
            if spec and ':' not in spec:
                out.append(spec)
        token_el = root.find('.//oai:ListSets/oai:resumptionToken', NS)
        token = (token_el.text or '').strip() if token_el is not None and token_el.text else ''
        if not token:
            return out
        params = {'verb': 'ListSets', 'resumptionToken': token}
        if delay:
            time.sleep(delay)


def iter_records(
    endpoint: str,
    *,
    set_spec: str = '',
    date_from: str = '',
    limit: int = 0,
    delay: float = 1.0,
    fetch=None,
) -> Iterator[OaiRecord]:
    """ListRecords sahifalari (resumptionToken) bo'ylab barcha yozuvlar."""
    fetch = fetch or _get
    params = {'verb': 'ListRecords', 'metadataPrefix': 'oai_dc'}
    if set_spec:
        params['set'] = set_spec
    if date_from:
        params['from'] = date_from
    count = 0
    while True:
        data = fetch(endpoint, params)
        records, token, err = parse_list_records(data)
        if err and err != 'noRecordsMatch':
            raise ValueError(f'OAI xato: {err}')
        for r in records:
            yield r
            count += 1
            if limit and count >= limit:
                return
        if not token:
            return
        params = {'verb': 'ListRecords', 'resumptionToken': token}
        if delay:
            time.sleep(delay)


_PDF_META_RE = re.compile(
    r'<meta[^>]+name=["\']citation_pdf_url["\'][^>]+content=["\']([^"\']+)["\']'
    r'|<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']citation_pdf_url["\']',
    re.I,
)


def find_pdf_url(landing_html: str, base_url: str) -> str:
    """Maqola sahifasidagi Google Scholar meta tegi (OJS va ko'p jurnallarda bor)."""
    m = _PDF_META_RE.search(landing_html or '')
    if not m:
        return ''
    url = (m.group(1) or m.group(2) or '').strip()
    url = urljoin(base_url, url)
    # OJS: article/view/ID/GALLEY → article/download/ID/GALLEY (to'g'ridan-to'g'ri fayl)
    return re.sub(r'/article/view/(\d+)/(\d+)', r'/article/download/\1/\2', url)


def record_full_text(record: OaiRecord, *, verify: bool = True) -> str:
    """Yozuvning to'liq matni (PDF). Topilmasa — bo'sh satr."""
    return full_text_for(record.landing_url, record.pdf_urls, verify=verify)


def full_text_for(landing: str, pdf_urls: list[str] | None = None, *, verify: bool = True) -> str:
    """PDF havolalari bo'lmasa — maqola sahifasidagi citation_pdf_url orqali."""
    from apps.articles.antiplagiat_deep_scan import fetch_fulltext

    candidates = list(pdf_urls or [])
    if landing and not candidates:
        try:
            html = _get(landing, verify=verify).decode('utf-8', errors='ignore')
            pdf = find_pdf_url(html, landing)
            if pdf:
                candidates.append(pdf)
        except Exception as exc:
            logger.info('OAI landing sahifa o\'qilmadi %s: %s', landing, exc)
    for url in candidates[:2]:
        text = fetch_fulltext(url, verify=verify)
        if text and len(text) >= 400:
            return text
    return ''
