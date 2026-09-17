"""REST API client for Phoenix platform (mirrors frontend apiService)."""
import json
import os
from typing import Any, Optional
from urllib.parse import urlparse

import requests


class ApiError(Exception):
    def __init__(self, message: str, status: int = 0, response: Any = None):
        super().__init__(message)
        self.status = status
        self.response = response


class PhonixApiClient:
    def __init__(
        self,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        base_url: Optional[str] = None,
        frontend_url: Optional[str] = None,
    ):
        self.base_url = (base_url or os.getenv('API_BASE_URL', 'http://127.0.0.1:8000/api/v1')).rstrip('/')
        self.frontend_url = (frontend_url or os.getenv('FRONTEND_BASE_URL', 'https://ilmiyfaoliyat.uz')).rstrip('/')
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.request_timeout = int(os.getenv('API_REQUEST_TIMEOUT', '45'))

    def _needs_proxy_ssl_header(self) -> bool:
        """Loopback HTTP: Django SECURE_SSL_REDIRECT 301 → https://127.0.0.1 (timeout)."""
        parsed = urlparse(self.base_url)
        host = (parsed.hostname or '').lower()
        return parsed.scheme == 'http' and host in ('127.0.0.1', 'localhost', '::1')

    def payment_page_url(self, transaction_id: str) -> str:
        return f"{self.frontend_url}/#/payment/click?transaction_id={transaction_id}"

    def _headers(self, json_body: bool = True) -> dict:
        h = {}
        if json_body:
            h['Content-Type'] = 'application/json'
        if self.access_token:
            h['Authorization'] = f'Bearer {self.access_token}'
        if self._needs_proxy_ssl_header():
            # Nginx kabi — ichki HTTP so'rovda SSL redirect oldini oladi.
            h['X-Forwarded-Proto'] = 'https'
        return h

    def _parse(self, resp: requests.Response) -> Any:
        text = resp.text or ''
        if not text:
            return {}
        try:
            return resp.json()
        except json.JSONDecodeError:
            return {'detail': text}

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_data: Any = None,
        data: Any = None,
        files: Any = None,
        params: Any = None,
        retry_refresh: bool = True,
    ) -> Any:
        url = f"{self.base_url}{path}"
        headers = self._headers(json_body=(files is None and data is None))
        if files is not None:
            headers.pop('Content-Type', None)

        resp = requests.request(
            method,
            url,
            headers=headers,
            json=json_data,
            data=data,
            files=files,
            params=params,
            timeout=self.request_timeout,
            allow_redirects=False,
        )

        if resp.status_code == 401 and retry_refresh and self.refresh_token and not path.startswith('/auth/'):
            if self.refresh():
                return self._request(
                    method, path, json_data=json_data, data=data, files=files, params=params, retry_refresh=False
                )

        body = self._parse(resp)
        if resp.status_code >= 400:
            detail = body.get('detail') if isinstance(body, dict) else str(body)
            if not detail and isinstance(body, dict):
                parts = [f"{k}: {v}" for k, v in body.items()]
                detail = '; '.join(parts) if parts else resp.text
            raise ApiError(str(detail or f'HTTP {resp.status_code}'), resp.status_code, body)
        return body

    def refresh(self) -> bool:
        if not self.refresh_token:
            return False
        try:
            headers = self._headers()
            resp = requests.post(
                f"{self.base_url}/token/refresh/",
                json={'refresh': self.refresh_token},
                headers=headers,
                timeout=self.request_timeout,
                allow_redirects=False,
            )
            data = self._parse(resp)
            if resp.ok and data.get('access'):
                self.access_token = data['access']
                if data.get('refresh'):
                    self.refresh_token = data['refresh']
                return True
        except Exception:
            pass
        return False

    # --- Auth ---
    def login(self, phone: str, password: str) -> dict:
        data = self._request('POST', '/auth/login/', json_data={'phone': phone, 'password': password}, retry_refresh=False)
        self.access_token = data.get('access')
        self.refresh_token = data.get('refresh')
        return data

    def register(self, payload: dict) -> dict:
        data = self._request('POST', '/auth/register/', json_data=payload, retry_refresh=False)
        self.access_token = data.get('access')
        self.refresh_token = data.get('refresh')
        return data

    def profile(self) -> dict:
        return self._request('GET', '/auth/profile/')

    def archive(self) -> dict:
        return self._request('GET', '/auth/archive/')

    # --- Articles ---
    def articles_mine(self) -> list:
        try:
            return self._request('GET', '/articles/mine/')
        except ApiError:
            data = self._request('GET', '/articles/', params={'page_size': 200, 'page': 1})
            from bot.utils import api_list
            return api_list(data)

    def article_detail(self, article_id: str) -> dict:
        return self._request('GET', f'/articles/{article_id}/')

    def create_article_multipart(self, fields: dict, file_bytes: bytes, filename: str, extra_files: Optional[dict] = None) -> dict:
        data = {}
        for k, v in fields.items():
            if isinstance(v, (list, dict)):
                data[k] = json.dumps(v)
            else:
                data[k] = str(v)
        files = {'final_pdf_path': (filename, file_bytes)}
        if extra_files:
            files.update(extra_files)
        return self._request('POST', '/articles/', data=data, files=files)

    def save_plagiarism_config(
        self,
        article_id: str,
        *,
        enabled_modules: list[str],
        document_name: str = '',
        author_first_name: str = '',
        author_last_name: str = '',
    ) -> dict:
        return self._request(
            'PATCH',
            f'/articles/{article_id}/',
            json_data={
                'plagiarism_report': {
                    'pending_enabled_modules': enabled_modules,
                    'document_name': document_name,
                    'author_first_name': author_first_name,
                    'author_last_name': author_last_name,
                    'is_standalone': True,
                },
            },
        )

    def check_plagiarism(
        self,
        article_id: str,
        *,
        enabled_modules: list[str] | None = None,
        force: bool = False,
    ) -> dict:
        body: dict = {}
        if enabled_modules:
            body['enabled_modules'] = enabled_modules
        if force:
            body['force'] = True
        return self._request('POST', f'/articles/{article_id}/check_plagiarism/', json_data=body or None)

    # --- Journals ---
    def journals(self) -> list:
        from bot.utils import api_list
        return api_list(self._request('GET', '/journals/journals/'))

    def issues(self) -> list:
        from bot.utils import api_list
        return api_list(self._request('GET', '/journals/issues/'))

    # --- Payments ---
    def transactions(self) -> list:
        from bot.utils import api_list
        return api_list(self._request('GET', '/payments/transactions/'))

    def create_transaction(self, payload: dict) -> dict:
        return self._request('POST', '/payments/transactions/', json_data=payload)

    def process_payment(self, transaction_id: str, provider: str = 'click') -> dict:
        return self._request('POST', f'/payments/transactions/{transaction_id}/process_payment/', params={'provider': provider})

    # --- Notifications ---
    def notifications(self) -> list:
        from bot.utils import api_list
        return api_list(self._request('GET', '/notifications/'))

    def unread_count(self) -> int:
        data = self._request('GET', '/notifications/unread_count/')
        return int(data.get('count') or data.get('unread_count') or 0)

    def mark_all_read(self) -> None:
        self._request('POST', '/notifications/mark_all_read/', json_data={})

    # --- DOI ---
    def doi_price(self) -> dict:
        return self._request('GET', '/articles/doi/price/')

    def doi_request(self, fields: dict, file_bytes: bytes, filename: str) -> dict:
        data = {k: str(v) for k, v in fields.items()}
        return self._request('POST', '/articles/doi/request/', data=data, files={'file': (filename, file_bytes)})

    def doi_requests(self) -> list:
        from bot.utils import api_list
        return api_list(self._request('GET', '/articles/doi/requests/'))

    # --- UDK ---
    def udk_price(self) -> dict:
        return self._request('GET', '/udc/price/')

    def udk_request(self, fields: dict, file_bytes: Optional[bytes] = None, filename: Optional[str] = None) -> dict:
        data = {k: str(v) for k, v in fields.items()}
        files = None
        if file_bytes and filename:
            files = {'file': (filename, file_bytes)}
        return self._request('POST', '/udc/request/', data=data, files=files)

    # --- Translation ---
    def translation_analyze(self, file_bytes: bytes, filename: str) -> dict:
        return self._request('POST', '/translations/analyze_file/', files={'file': (filename, file_bytes)})

    def translation_create(self, fields: dict, file_bytes: bytes, filename: str) -> dict:
        data = {k: str(v) for k, v in fields.items()}
        return self._request('POST', '/translations/', data=data, files={'source_file_path': (filename, file_bytes)})

    def translations(self) -> list:
        from bot.utils import api_list
        return api_list(self._request('GET', '/translations/'))

    # --- Article sample ---
    def article_sample_prices(self) -> dict:
        return self._request('GET', '/articles/article-sample/price/')

    def article_sample_request(self, payload: dict) -> dict:
        return self._request('POST', '/articles/article-sample/request/', json_data=payload)

    def article_sample_requests(self) -> list:
        from bot.utils import api_list
        return api_list(self._request('GET', '/articles/article-sample/requests/'))

    # --- Author publications ---
    def my_publications(self) -> list:
        from bot.utils import api_list
        return api_list(self._request('GET', '/journals/author-publications/my_publications/'))

    def service_price(self, service_key: str, default: float = 0) -> float:
        from bot.utils import api_list
        try:
            prices = api_list(self._request('GET', '/udc/service-prices/'))
            for p in prices:
                if p.get('service_key') == service_key:
                    return float(p.get('amount') or default)
        except ApiError:
            pass
        return default
