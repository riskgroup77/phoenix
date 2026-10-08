#!/usr/bin/env python3
import json, urllib.request, urllib.error
API = 'https://api.ilmiyfaoliyat.uz/api/v1'

def login(phone, pw):
    r = urllib.request.Request(f'{API}/auth/login/', json.dumps({'phone': phone[-9:], 'password': pw}).encode(),
        headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(r, timeout=20) as resp:
        d = json.loads(resp.read())
        return d['access'], d.get('user', {})

def patch(path, token, data):
    r = urllib.request.Request(f'{API}{path}', json.dumps(data).encode(),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}, method='PATCH')
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, json.loads(resp.read() or '{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or '{}')

author, u = login('998901001004', 'Demo@author1')
print(f'Author role: {u.get("role")}')
st, body = patch('/auth/update_profile/', author, {'role': 'super_admin'})
print(f'Role PATCH attempt: HTTP {st} -> {body}')

op, ou = login('998901001007', 'Operator@1234567890')
print(f'Operator login: role={ou.get("role")}')
st2, d2 = patch('/payments/transactions/', author, {'status': 'completed'})
print('(skip tx list)')

# get a tx id
r = urllib.request.Request(f'{API}/payments/transactions/', headers={'Authorization': f'Bearer {author}'})
with urllib.request.urlopen(r, timeout=20) as resp:
    txs = json.loads(resp.read())
items = txs if isinstance(txs, list) else txs.get('results', [])
if items:
    tx_id = items[0]['id']
    st3, b3 = patch(f'/payments/transactions/{tx_id}/', author, {'status': 'completed'})
    print(f'Tx PATCH: HTTP {st3} -> {b3}')

try:
    with urllib.request.urlopen('https://api.ilmiyfaoliyat.uz/health/ready/', timeout=15) as r:
        print(f'Health ready: {r.status} {r.read()[:120]}')
except urllib.error.HTTPError as e:
    print(f'Health ready: {e.code} {e.read()[:120]}')

try:
    with urllib.request.urlopen('https://ilmiyfaoliyat.uz/', timeout=15) as r:
        html = r.read().decode('utf-8', errors='replace')
        print(f'Tailwind CDN: {"cdn.tailwindcss.com" in html}')
except Exception as ex:
    print('Frontend error', ex)
