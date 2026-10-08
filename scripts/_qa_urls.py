#!/usr/bin/env python3
"""To'g'ri URL lar bilan qo'shimcha QA."""
import json
import urllib.request
import urllib.error

API = 'https://api.ilmiyfaoliyat.uz/api/v1'

def req(method, path, token=None, data=None):
    url = f'{API}{path}'
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=25) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {'raw': raw[:300]}

def login(phone, pw):
    for p in (phone, phone[-9:]):
        st, d = req('POST', '/auth/login/', data={'phone': p, 'password': pw})
        if st == 200:
            return d['access'], d.get('user', {})
    return None, {}

tests = []

# Login all including operator variants
users = [
    ('Author', '998901001004', 'Demo@author1'),
    ('Operator 007', '998901001007', 'Operator@1234567890'),
    ('Operator 006', '998901001006', 'Operator@1234567890'),
    ('Super Admin', '998901001001', 'Demo@admin1'),
]

for label, phone, pw in users:
    tok, u = login(phone, pw)
    print(f'{label}: login={"OK" if tok else "FAIL"} role={u.get("role") if tok else "-"}')

tok, _ = login('998901001004', 'Demo@author1')
admin, _ = login('998901001001', 'Demo@admin1')
op, opu = login('998901001007', 'Operator@1234567890')

print('\n--- URL path tekshiruv (frontend vs backend) ---')
paths = [
    ('Frontend noto\'g\'ri DOI', '/articles/doi-requests/'),
    ('Backend to\'g\'ri DOI', '/articles/doi/requests/'),
    ('Frontend noto\'g\'ri sample', '/articles/article-sample-requests/'),
    ('Backend to\'g\'ri sample', '/articles/article-sample/requests/'),
    ('Frontend noto\'g\'ri users', '/users/'),
    ('Backend to\'g\'ri users', '/auth/'),
]
for name, path in paths:
    st, _ = req('GET', path, token=admin)
    print(f'  {name}: {path} -> HTTP {st}')

print('\n--- Media jurnal rasmi ---')
st, journals = req('GET', '/journals/journals/', token=tok)
jlist = journals if isinstance(journals, list) else journals.get('results', [])
if jlist:
    img = jlist[0].get('image_url') or ''
    print(f'  image_url: {img[:80]}')
    if img:
        import urllib.request as u
        try:
            with u.urlopen(img, timeout=15) as r:
                print(f'  Image fetch: HTTP {r.status}, type={r.headers.get("Content-Type")}')
        except Exception as e:
            print(f'  Image fetch FAIL: {e}')

print('\n--- Click to\'lov process ---')
if tok:
    st, tx = req('POST', '/payments/transactions/', token=tok, data={
        'amount': 1000, 'currency': 'UZS', 'service_type': 'publication_fee'
    })
    print(f'  Create tx: HTTP {st}')
    if st in (200, 201) and tx.get('id'):
        st2, pay = req('POST', f'/payments/transactions/{tx["id"]}/process_payment/', token=tok, data={})
        print(f'  process_payment: HTTP {st2} -> {str(pay)[:200]}')

print('\n--- Operator AllRequests data ---')
if op:
    for p in ['/articles/doi/requests/', '/articles/article-sample/requests/', '/udc/requests/', '/translations/', '/articles/staff/']:
        st, d = req('GET', p, token=op)
        n = len(d) if isinstance(d, list) else len(d.get('results', [])) if isinstance(d, dict) else 0
        print(f'  {p} -> HTTP {st}, items={n}')
