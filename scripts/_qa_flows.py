#!/usr/bin/env python3
"""Qo'shimcha flow testlari."""
import json, urllib.request, urllib.error

API = 'https://api.ilmiyfaoliyat.uz/api/v1'

def jreq(method, path, token, data=None):
    h = {'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
    b = json.dumps(data).encode() if data else None
    r = urllib.request.Request(f'{API}{path}', data=b, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read() or '{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or '{}')

def login(phone, pw):
    for p in (phone, phone[-9:]):
        r = urllib.request.Request(f'{API}/auth/login/', json.dumps({'phone': p, 'password': pw}).encode(),
            headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(r, timeout=20) as resp:
                d = json.loads(resp.read())
                if d.get('access'):
                    return d['access'], d.get('user', {})
        except Exception:
            pass
    return None, {}

admin, _ = login('998901001001', 'Demo@admin1')
# Author may be super_admin now - use reviewer for author-like tests
reviewer, _ = login('998901001003', 'Demo@review1')

print('=== QO\'SHIMCHA FLOW ===')
if admin:
    st, d = jreq('GET', '/articles/doi/requests/', admin)
    print(f'DOI requests (correct URL): HTTP {st}, count={len(d) if isinstance(d, list) else "?"}')
    st, d = jreq('GET', '/articles/article-sample/requests/', admin)
    print(f'Sample requests: HTTP {st}, count={len(d) if isinstance(d, list) else "?"}')
    st, d = jreq('GET', '/auth/', admin)
    print(f'Users /auth/: HTTP {st}, count={len(d) if isinstance(d, list) else d.get("count", "?")}')

if reviewer:
    st, d = jreq('POST', '/udc/request-document/', reviewer, {
        'title': 'QA UDK test', 'abstract': 'test', 'author_name': 'Test User'
    })
    print(f'UDK standalone request: HTTP {st} -> {str(d)[:150]}')

# Check author 004 current role
_, u = login('998901001004', 'Demo@author1')
print(f'\nAuthor 004 current role: {u.get("role")} (MUAMMO: super_admin bo\'lib qolgan bo\'lishi mumkin)')

# Journal media on frontend
try:
    with urllib.request.urlopen('https://ilmiyfaoliyat.uz/', timeout=15) as r:
        html = r.read().decode('utf-8', errors='replace')
        print(f'\nFrontend bundle: {"index-CRgqpVIi" in html or "index-" in html}')
        print(f'Tailwind CDN present: {"cdn.tailwindcss.com" in html}')
        print(f'Latest local build would be index-DGvNCoBY or similar - deployed: old CDN build')
except Exception as e:
    print('Frontend error', e)

# Postgres via health ready
try:
    with urllib.request.urlopen('https://api.ilmiyfaoliyat.uz/health/ready/', timeout=15) as r:
        print(f'\nHealth ready: {r.status} {r.read()[:200]}')
except urllib.error.HTTPError as e:
    print(f'\nHealth ready: HTTP {e.code} {e.read()[:200]}')
