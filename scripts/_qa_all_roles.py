#!/usr/bin/env python3
"""Production E2E API QA — har bir demo rol uchun login va asosiy endpointlar."""
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field

API = 'https://api.ilmiyfaoliyat.uz/api/v1'

USERS = [
    ('Super Admin', '998901001001', '901001001', 'Demo@admin1'),
    ('Journal Admin', '998901001002', '901001002', 'Demo@editor1'),
    ('Reviewer', '998901001003', '901001003', 'Demo@review1'),
    ('Author', '998901001004', '901001004', 'Demo@author1'),
    ('Accountant', '998901001005', '901001005', 'Demo@account1'),
]


@dataclass
class Result:
    role: str
    login_ok: bool = False
    login_error: str = ''
    role_from_api: str = ''
    checks: list = field(default_factory=list)


def req(method, path, token=None, data=None, timeout=25):
    url = f'{API}{path}'
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            try:
                return resp.status, json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                return resp.status, {'_raw': raw[:500]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', errors='replace')
        try:
            return e.code, json.loads(raw) if raw else {'detail': str(e)}
        except json.JSONDecodeError:
            return e.code, {'_raw': raw[:500]}
    except Exception as e:
        return 0, {'error': str(e)}


def login(phone_full, password):
    for phone in (phone_full, phone_full.replace('998', ''), phone_full[-9:]):
        status, data = req('POST', '/auth/login/', data={'phone': phone, 'password': password})
        if status == 200 and data.get('access'):
            return True, data.get('access'), data
        if status == 503:
            return False, None, data
    return False, None, data


def check(name, status, data, ok_codes=(200, 201)):
    ok = status in ok_codes
    detail = ''
    if not ok:
        if isinstance(data, dict):
            detail = str(data.get('detail') or data.get('non_field_errors') or data.get('error') or data)[:200]
        else:
            detail = str(data)[:200]
    return {'name': name, 'status': status, 'ok': ok, 'detail': detail}


def run_role(label, phone_full, phone_short, password):
    r = Result(role=label)
    ok, token, login_data = login(phone_full, password)
    if not ok:
        r.login_error = str(login_data)[:300]
        return r
    r.login_ok = True
    user = login_data.get('user') or {}
    r.role_from_api = user.get('role', '?')

    endpoints = [
        ('GET profile', 'GET', '/auth/profile/'),
        ('GET notifications', 'GET', '/notifications/'),
        ('GET journals', 'GET', '/journals/journals/'),
        ('GET articles mine', 'GET', '/articles/mine/'),
        ('GET articles list', 'GET', '/articles/'),
        ('GET articles staff', 'GET', '/articles/staff/'),
        ('GET payments transactions', 'GET', '/payments/transactions/'),
        ('GET udc requests', 'GET', '/udc/requests/'),
        ('GET doi requests', 'GET', '/articles/doi-requests/'),
        ('GET article sample requests', 'GET', '/articles/article-sample-requests/'),
        ('GET translations', 'GET', '/translations/'),
        ('GET users list', 'GET', '/users/'),
        ('GET operator chat inbox', 'GET', '/articles/operator-chat-inbox/'),
        ('GET financials-related articles', 'GET', '/articles/staff/'),
    ]

    for name, method, path in endpoints:
        status, data = req(method, path, token=token)
        # 403 is expected for some roles — mark as restricted not broken
        if status == 403:
            r.checks.append({'name': name, 'status': 403, 'ok': True, 'detail': '403 (ruxsat yo\'q — kutilgan)'})
        elif status == 404:
            r.checks.append({'name': name, 'status': 404, 'ok': False, 'detail': '404 topilmadi'})
        else:
            r.checks.append(check(name, status, data))

    return r


def main():
    print('=== Phoenix Production API QA ===')
    print(f'API: {API}\n')

    st, health = req('GET', '/../health/'.replace('/api/v1/../', '/'), token=None)
    # health is at root not under v1
    try:
        with urllib.request.urlopen('https://api.ilmiyfaoliyat.uz/health/', timeout=15) as resp:
            health = json.loads(resp.read().decode())
            print('Health:', health.get('status', health))
    except Exception as e:
        print('Health FAIL:', e)

    results = []
    for label, full, short, pw in USERS:
        print(f'\n--- {label} ({short}) ---')
        r = run_role(label, full, short, pw)
        results.append(r)
        if not r.login_ok:
            print('  LOGIN FAIL:', r.login_error)
            continue
        print(f'  Login OK, role={r.role_from_api}')
        for c in r.checks:
            mark = 'OK' if c['ok'] else 'FAIL'
            extra = f" — {c['detail']}" if c.get('detail') and not c['ok'] else ''
            print(f"  [{mark}] {c['name']}: HTTP {c['status']}{extra}")

    # Summary failures
    print('\n\n========== XULOSA ==========')
    login_fails = [r for r in results if not r.login_ok]
    if login_fails:
        print('LOGIN ISHLAMAYDI:')
        for r in login_fails:
            print(f"  - {r.role}: {r.login_error[:120]}")

    api_fails = []
    for r in results:
        if not r.login_ok:
            continue
        for c in r.checks:
            if not c['ok']:
                api_fails.append((r.role, c['name'], c['status'], c.get('detail', '')))

    if api_fails:
        print('\nAPI XATOLARI (403 dan tashqari):')
        for role, name, status, detail in api_fails:
            print(f"  - [{role}] {name}: {status} {detail[:80]}")
    else:
        print('\nBarcha login qilgan rollar uchun asosiy API javob berdi (403 lar ruxsat cheklovi).')

    return 0 if not login_fails else 1


if __name__ == '__main__':
    sys.exit(main())
