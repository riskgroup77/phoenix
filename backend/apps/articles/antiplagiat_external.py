"""Antiplagiat ApiCorp orqali haqiqiy tashqi tekshiruv."""
from __future__ import annotations

import logging
import time
from typing import Callable

from django.conf import settings

from apps.articles.antiplagiat_api_client import (
    AntiplagiatApiClient,
    external_antiplagiat_enabled,
    get_antiplagiat_api_client,
)
from apps.articles.antiplagiat_api_mapper import (
    convert_api_report_to_phonix,
    resolve_api_service_codes,
)

logger = logging.getLogger(__name__)

ProgressCallback = Callable[..., None]


def run_external_plagiarism_check(
    *,
    file_path: str,
    external_user_id: str,
    enabled_modules: list[str] | None = None,
    document_name: str = '',
    author_name: str = '',
    progress_callback: ProgressCallback | None = None,
) -> dict:
    if not external_antiplagiat_enabled():
        raise RuntimeError('Antiplagiat API sozlanmagan (ANTIPLAGIAT_API_WSDL/LOGIN/PASSWORD).')

    client = get_antiplagiat_api_client()
    poll_interval = max(5, int(getattr(settings, 'ANTIPLAGIAT_API_POLL_INTERVAL_SEC', 15)))
    poll_max = max(60, int(getattr(settings, 'ANTIPLAGIAT_API_POLL_MAX_SEC', 1800)))

    def _progress(**kwargs) -> None:
        if progress_callback:
            progress_callback(**kwargs)

    _progress(
        phase='api_connect',
        progress_percent=2,
        module_label='Antiplagiat API ga ulanish...',
        module_id='api',
    )

    available = client.get_check_services()
    service_codes = resolve_api_service_codes(enabled_modules, available)
    modules_total = len(service_codes) if service_codes else len(available) or len(enabled_modules or [])

    _progress(
        phase='uploading',
        progress_percent=8,
        modules_total=modules_total,
        modules_completed=0,
        module_label='Hujjat Antiplagiat tizimiga yuklanmoqda...',
        module_id='upload',
    )

    upload = client.upload_document(
        file_path,
        external_user_id=external_user_id,
        file_name=document_name or None,
        author_name=author_name,
    )
    doc_id = int(upload['document_ids'][0]['id'])

    _progress(
        phase='checking',
        progress_percent=15,
        modules_total=modules_total,
        modules_completed=0,
        module_label='Chuqur tekshiruv boshlandi (Antiplagiat)...',
        module_id='check',
    )

    client.check_document(doc_id, service_codes)

    started = time.monotonic()
    check_status: dict = {'status': 'processing'}
    while True:
        check_status = client.get_check_status(doc_id)
        status = (check_status.get('status') or '').lower()
        elapsed = time.monotonic() - started
        wait_hint = int(check_status.get('estimated_wait_sec') or 0)
        denom = max(wait_hint, poll_max * 0.6, 120)
        pct = min(92, 15 + int((elapsed / denom) * 77))

        _progress(
            phase='polling',
            progress_percent=pct,
            modules_total=modules_total,
            modules_completed=min(modules_total, int(modules_total * pct / 100)),
            module_label='Antiplagiat tizimi hujjatni skanerlamoqda...',
            module_id='poll',
            sources_found=0,
        )

        if status == 'ready':
            break
        if status == 'failed':
            detail = check_status.get('fail_details') or 'Antiplagiat tekshiruvi muvaffaqiyatsiz.'
            raise RuntimeError(str(detail))
        if elapsed >= poll_max:
            raise TimeoutError(
                f'Antiplagiat tekshiruvi vaqti tugadi ({int(poll_max // 60)} daqiqa). Keyinroq qayta urinib ko\'ring.'
            )
        time.sleep(poll_interval)

    _progress(
        phase='report',
        progress_percent=95,
        modules_total=modules_total,
        modules_completed=modules_total,
        module_label='Hisobot yuklanmoqda...',
        module_id='report',
    )

    report_view = client.get_report_view(doc_id, full_report=True)
    company_url = (getattr(settings, 'ANTIPLAGIAT_API_COMPANY_URL', '') or '').strip()

    result = convert_api_report_to_phonix(
        report_view=report_view,
        check_status=check_status,
        enabled_module_ids=enabled_modules,
        company_url=company_url,
        external_doc_id=doc_id,
    )
    result['report']['external_doc_id'] = doc_id
    result['report']['api_services_requested'] = service_codes
    result['report']['api_services_available'] = [s['code'] for s in available]
    return result


def test_external_connection(client: AntiplagiatApiClient | None = None) -> dict:
    """Admin/diagnostic: API ulanishini tekshirish."""
    api = client or get_antiplagiat_api_client()
    ping = api.ping()
    services = api.get_check_services()
    return {
        'ok': True,
        'ping': ping,
        'services_count': len(services),
        'services_sample': services[:10],
    }
