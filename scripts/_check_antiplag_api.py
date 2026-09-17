#!/usr/bin/env python3
"""Antiplagiat ApiCorp ulanishini tekshirish."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / 'backend'
sys.path.insert(0, str(BACKEND))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django  # noqa: E402

django.setup()

from apps.articles.antiplagiat_api_client import (  # noqa: E402
    external_antiplagiat_enabled,
    get_antiplagiat_api_client,
    is_external_antiplagiat_configured,
)
from apps.articles.antiplagiat_external import test_external_connection  # noqa: E402


def main() -> int:
    print('Configured:', is_external_antiplagiat_configured())
    print('Enabled:', external_antiplagiat_enabled())
    if not is_external_antiplagiat_configured():
        print('ANTIPLAGIAT_API_WSDL, ANTIPLAGIAT_API_LOGIN, ANTIPLAGIAT_API_PASSWORD kerak.')
        return 1
    try:
        result = test_external_connection(get_antiplagiat_api_client())
        print('Ping:', result.get('ping'))
        print('Services:', result.get('services_count'))
        for svc in result.get('services_sample') or []:
            print(' -', svc.get('code'), '|', svc.get('description', '')[:60])
        return 0
    except Exception as exc:
        print('XATO:', exc)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
