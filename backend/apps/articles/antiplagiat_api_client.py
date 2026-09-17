"""
Antiplagiat / Antiplag.uz ApiCorp SOAP klienti (zeep).

Hujjatlar: https://docs.antiplagiat.ru/en/api/
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

NS = '{http://www.antiplagiat.ru/3.0/apicorp}'


def is_external_antiplagiat_configured() -> bool:
    return bool(
        (getattr(settings, 'ANTIPLAGIAT_API_WSDL', '') or '').strip()
        and (getattr(settings, 'ANTIPLAGIAT_API_LOGIN', '') or '').strip()
        and (getattr(settings, 'ANTIPLAGIAT_API_PASSWORD', '') or '').strip()
    )


def external_antiplagiat_enabled() -> bool:
    if not is_external_antiplagiat_configured():
        return False
    flag = (getattr(settings, 'ANTIPLAGIAT_API_ENABLED', '') or '').strip().lower()
    if flag in ('0', 'false', 'no', 'off'):
        return False
    return True


def _zeep_get(obj: Any, attr: str, default: Any = None) -> Any:
    if obj is None:
        return default
    try:
        return getattr(obj, attr, default)
    except Exception:
        return default


def _serialize(obj: Any) -> Any:
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, (list, tuple)):
        return [_serialize(x) for x in obj]
    if hasattr(obj, '__dict__'):
        out = {}
        for key in dir(obj):
            if key.startswith('_'):
                continue
            val = getattr(obj, key, None)
            if callable(val):
                continue
            out[key] = _serialize(val)
        return out
    return str(obj)


class AntiplagiatApiClient:
    """ApiCorp SOAP wrapper."""

    def __init__(
        self,
        *,
        wsdl: str | None = None,
        login: str | None = None,
        password: str | None = None,
    ) -> None:
        self.wsdl = (wsdl or settings.ANTIPLAGIAT_API_WSDL or '').strip()
        self.login = (login or settings.ANTIPLAGIAT_API_LOGIN or '').strip()
        self.password = (password or settings.ANTIPLAGIAT_API_PASSWORD or '').strip()
        self._client = None

    def _service(self):
        if self._client is None:
            from zeep import Client
            from zeep.wsse.username import UsernameToken

            self._client = Client(
                self.wsdl,
                wsse=UsernameToken(self.login, self.password),
            )
        return self._client.service

    def _types(self):
        if self._client is None:
            self._service()
        return self._client

    def ping(self) -> str:
        return str(self._service().Ping() or '')

    def get_check_services(self) -> list[dict[str, str]]:
        raw = self._service().GetCheckServices()
        items = raw or []
        out: list[dict[str, str]] = []
        for item in items:
            code = str(_zeep_get(item, 'Code', '') or '').strip()
            desc = str(_zeep_get(item, 'Description', '') or '').strip()
            if code:
                out.append({'code': code, 'description': desc})
        return out

    def upload_document(
        self,
        file_path: str,
        *,
        external_user_id: str,
        file_name: str | None = None,
        author_name: str = '',
        work_title: str = '',
        developer_id: str | None = None,
    ) -> dict[str, Any]:
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f'Hujjat topilmadi: {file_path}')

        ext = path.suffix.lower()
        if ext == '.doc':
            ext = '.docx'
        if ext not in {'.txt', '.docx', '.html', '.htm', '.pdf', '.rtf', '.odt', '.pptx'}:
            raise ValueError(f'Antiplagiat API qo\'llab-quvvatlamaydigan format: {ext}')

        types = self._types()
        doc_data = types.get_type(f'{NS}DocData')(
            FileName=file_name or path.name,
            FileType=ext,
            Data=path.read_bytes(),
            ExternalUserID=(external_user_id or 'phonix-user')[:40],
            DeveloperID=(developer_id or getattr(settings, 'ANTIPLAGIAT_API_DEVELOPER_ID', '') or None),
        )

        attributes = None
        if author_name or work_title:
            doc_desc_type = types.get_type(f'{NS}VerificationReportOptions')
            doc_desc = doc_desc_type(Work=work_title or path.stem)
            if author_name:
                author_type = types.get_type(f'{NS}AuthorName')
                parts = author_name.split(None, 1)
                doc_desc.Authors = [
                    author_type(Surname=parts[0], OtherNames=parts[1] if len(parts) > 1 else ''),
                ]
            attr_type = types.get_type(f'{NS}DocAttributes')
            attributes = attr_type(DocumentDescription=doc_desc)

        upload_opts = None
        if getattr(settings, 'ANTIPLAGIAT_API_ADD_TO_INDEX', False):
            upload_opts = types.get_type(f'{NS}UploadOptions')(AddToIndex=True)

        result = self._service().UploadDocument(doc_data, attributes, upload_opts)
        doc_ids = _zeep_get(result, 'DocumentIds') or []
        parsed_ids = []
        for doc_id in doc_ids:
            parsed_ids.append({
                'id': int(_zeep_get(doc_id, 'Id', 0) or 0),
                'external': str(_zeep_get(doc_id, 'External', '') or ''),
            })
        if not parsed_ids:
            failed = _zeep_get(result, 'FailedFiles') or []
            details = []
            for ff in failed:
                details.append(str(_zeep_get(ff, 'FailDetails', '') or _zeep_get(ff, 'FileName', '')))
            raise RuntimeError(
                'Antiplagiat API: hujjat yuklanmadi.'
                + (f' Sabab: {"; ".join(details)}' if details else '')
            )
        return {'document_ids': parsed_ids, 'raw': _serialize(result)}

    def check_document(
        self,
        doc_id: int,
        check_services: list[str] | None = None,
    ) -> None:
        types = self._types()
        document_id = types.get_type(f'{NS}DocumentId')(Id=int(doc_id))
        check_params = None
        dev_id = (getattr(settings, 'ANTIPLAGIAT_API_DEVELOPER_ID', '') or '').strip()
        if dev_id:
            check_params = types.get_type(f'{NS}CheckDocParams')(DeveloperID=dev_id)
        services = check_services if check_services else None
        self._service().CheckDocument(document_id, services, check_params)

    def get_check_status(self, doc_id: int) -> dict[str, Any]:
        types = self._types()
        document_id = types.get_type(f'{NS}DocumentId')(Id=int(doc_id))
        status = self._service().GetCheckStatus(document_id)
        summary = _zeep_get(status, 'Summary')
        detailed = _zeep_get(summary, 'DetailedScore') if summary else None
        base = _zeep_get(summary, 'BaseScore') if summary else None
        score = detailed or base
        return {
            'doc_id': doc_id,
            'status': _report_status_value(_zeep_get(status, 'Status')),
            'fail_details': str(_zeep_get(status, 'FailDetails', '') or ''),
            'estimated_wait_sec': int(_zeep_get(status, 'EstimatedWaitTime', 0) or 0),
            'report_num': int(_zeep_get(summary, 'ReportNum', 0) or 0),
            'report_web_id': str(_zeep_get(summary, 'ReportWebId', '') or ''),
            'readonly_report_web_id': str(_zeep_get(summary, 'ReadonlyReportWebId', '') or ''),
            'is_suspicious': bool(_zeep_get(summary, 'IsSuspicious', False)),
            'score': {
                'plagiarism': float(_zeep_get(score, 'Plagiarism', 0) or 0),
                'legal': float(_zeep_get(score, 'Legal', 0) or 0),
                'self_cite': float(_zeep_get(score, 'SelfCite', 0) or 0),
                'originality': float(_zeep_get(score, 'Unknown', 0) or 0),
            },
            'raw': _serialize(status),
        }

    def get_report_view(self, doc_id: int, *, full_report: bool = True) -> dict[str, Any]:
        types = self._types()
        document_id = types.get_type(f'{NS}DocumentId')(Id=int(doc_id))
        options = types.get_type(f'{NS}ReportViewOptions')(
            FullReport=full_report,
            NeedText=True,
            NeedStats=True,
            NeedAttributes=True,
        )
        view = self._service().GetReportView(document_id, options)
        service_results = []
        for item in (_zeep_get(view, 'CheckServiceResults') or []):
            svc_score = _zeep_get(item, 'ScoreByReport') or _zeep_get(item, 'ScoreByCollection')
            sources = []
            for src in (_zeep_get(item, 'Sources') or []):
                sources.append({
                    'name': str(_zeep_get(src, 'Name', '') or ''),
                    'url': str(_zeep_get(src, 'Url', '') or ''),
                    'author': str(_zeep_get(src, 'Author', '') or ''),
                    'similarity': float(_zeep_get(src, 'ScoreByReport', 0) or _zeep_get(src, 'ScoreBySource', 0) or 0),
                    'type': int(_zeep_get(src, 'Type', 0) or 0),
                    'src_hash': int(_zeep_get(src, 'SrcHash', 0) or 0),
                })
            service_results.append({
                'service_name': str(_zeep_get(item, 'CheckServiceName', '') or ''),
                'collection': str(_zeep_get(item, 'CollectionDescription', '') or ''),
                'score': {
                    'plagiarism': float(_zeep_get(svc_score, 'Plagiarism', 0) or 0),
                    'legal': float(_zeep_get(svc_score, 'Legal', 0) or 0),
                    'self_cite': float(_zeep_get(svc_score, 'SelfCite', 0) or 0),
                    'originality': float(_zeep_get(svc_score, 'Unknown', 0) or 0),
                },
                'sources': sources,
            })

        stats = _zeep_get(view, 'Stats')
        details = _zeep_get(view, 'Details')
        summary = _zeep_get(view, 'Summary')
        detailed = _zeep_get(summary, 'DetailedScore') if summary else None
        return {
            'doc_id': doc_id,
            'summary': {
                'report_web_id': str(_zeep_get(summary, 'ReportWebId', '') or ''),
                'readonly_report_web_id': str(_zeep_get(summary, 'ReadonlyReportWebId', '') or ''),
                'short_report_web_id': str(_zeep_get(summary, 'ShortReportWebId', '') or ''),
                'is_suspicious': bool(_zeep_get(summary, 'IsSuspicious', False)),
            },
            'score': {
                'plagiarism': float(_zeep_get(detailed, 'Plagiarism', 0) or 0),
                'legal': float(_zeep_get(detailed, 'Legal', 0) or 0),
                'self_cite': float(_zeep_get(detailed, 'SelfCite', 0) or 0),
                'originality': float(_zeep_get(detailed, 'Unknown', 0) or 0),
            },
            'stats': {
                'text_size': int(_zeep_get(stats, 'TextSize', 0) or 0),
                'sentence_count': int(_zeep_get(stats, 'SentenceCount', 0) or 0),
                'language': str(_zeep_get(stats, 'Language', '') or ''),
            },
            'document_text': str(_zeep_get(details, 'Text', '') or ''),
            'service_results': service_results,
            'raw': _serialize(view),
        }

    def export_report_pdf(self, doc_id: int, *, report_num: int = 0) -> bytes:
        types = self._types()
        document_id = types.get_type(f'{NS}DocumentId')(Id=int(doc_id))
        fmt = types.get_type(f'{NS}FormattingOptions')(Language='uz')
        options = types.get_type(f'{NS}ExportReportOptions')(
            ReportNum=report_num,
            ShortReport=False,
            FormattingOptions=fmt,
        )
        result = self._service().ExportReportToPdf(document_id, options)
        data = _zeep_get(result, 'DownloadLink')
        if data:
            import requests
            resp = requests.get(str(data), timeout=120)
            resp.raise_for_status()
            return resp.content
        raise RuntimeError('Antiplagiat PDF hisobot havolasi qaytmadi')


def _report_status_value(status: Any) -> str:
    if status is None:
        return 'unknown'
    name = getattr(status, 'name', None) or getattr(status, 'value', None) or str(status)
    name = str(name).strip().lower()
    if name in {'ready', 'completed', 'done', '2'}:
        return 'ready'
    if name in {'inprogress', 'in_progress', 'processing', 'checking', '1'}:
        return 'processing'
    if name in {'failed', 'error', 'fail', '3'}:
        return 'failed'
    return name


@lru_cache(maxsize=1)
def get_antiplagiat_api_client() -> AntiplagiatApiClient:
    return AntiplagiatApiClient()
