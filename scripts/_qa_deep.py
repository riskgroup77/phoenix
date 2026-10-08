#!/usr/bin/env python3
"""Chuqur QA: login, maqola/jurnal, to'lov, so'rovlar."""
import json
import urllib.error
import urllib.request

API = 'https://api.ilmiyfaoliyat.uz/api/v1'
FINDINGS = []


def note(severity, role, area, msg):
    FINDINGS.append({'severity': severity, 'role': role, 'area': area, 'msg': msg})


def req(method, path, token=None, data=None, multipart=None):
    url = f'{API}{path}'
    if multipart:
        boundary = '----PhonixQA'
        body = multipart.encode() if isinstance(multipart, str) else multipart
        headers = {'Content-Type': f'multipart/form-data; boundary={boundary}'}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        r = urllib.request.Request(url, data=body, headers=headers, method=method)
    else:
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        body = json.dumps(data).encode() if data is not None else None
        r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            try:
                return resp.status, json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                return resp.status, {'_raw': raw[:400]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', errors='replace')
        try:
            return e.code, json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            return e.code, {'_raw': raw[:400]}
    except Exception as e:
        return 0, {'error': str(e)}


def login(phone, password):
    for p in (phone, phone.replace('998', ''), phone[-9:]):
        st, d = req('POST', '/auth/login/', data={'phone': p, 'password': password})
        if st == 200 and d.get('access'):
            return d['access'], d.get('user', {})
    return None, d


def main():
    print('=== CHUQUR PRODUCTION QA ===\n')

    # Health
    try:
        with urllib.request.urlopen('https://api.ilmiyfaoliyat.uz/health/', timeout=15) as r:
            h = json.loads(r.read())
            print('Health:', h)
    except Exception as e:
        note('CRITICAL', 'all', 'infra', f'API health ishlamaydi: {e}')

    try:
        with urllib.request.urlopen('https://ilmiyfaoliyat.uz/', timeout=15) as r:
            html = r.read().decode('utf-8', errors='replace')[:3000]
            has_cdn = 'cdn.tailwindcss.com' in html
            print('Frontend HTTP:', r.status, '| Tailwind CDN:', has_cdn)
            if has_cdn:
                note('MEDIUM', 'all', 'frontend', 'Production frontend hali Tailwind CDN ishlatmoqda (yangi build deploy qilinmagan)')
    except Exception as e:
        note('CRITICAL', 'all', 'frontend', f'ilmiyfaoliyat.uz ochilmaydi: {e}')

    users = [
        ('Super Admin', '998901001001', 'Demo@admin1'),
        ('Journal Admin', '998901001002', 'Demo@editor1'),
        ('Reviewer', '998901001003', 'Demo@review1'),
        ('Author', '998901001004', 'Demo@author1'),
        ('Accountant', '998901001005', 'Demo@account1'),
        ('Operator', '998901001007', 'Operator@1234567890'),
    ]

    author_token = None
    journal_id = None

    for label, phone, pw in users:
        print(f'\n===== {label} =====')
        token, user = login(phone, pw)
        if not token:
            note('CRITICAL', label, 'login', f'Login ishlamadi: {user}')
            print('  LOGIN FAIL', user)
            continue
        role = user.get('role', '?')
        print(f'  Login OK | role={role} | {user.get("first_name")} {user.get("last_name")}')

        # Role-specific checks
        if label == 'Author':
            author_token = token
            st, journals = req('GET', '/journals/journals/', token=token)
            jlist = journals if isinstance(journals, list) else journals.get('results', [])
            print(f'  Journals: {len(jlist)} ta')
            if jlist:
                journal_id = jlist[0].get('id')
                jname = jlist[0].get('name', '')[:50]
                print(f'  Birinchi jurnal: {jname}')

            # Article create JSON (no file) — validation error kutiladi, 500 bo'lmasligi kerak
            st, art = req('POST', '/articles/', token=token, data={
                'title': 'QA Test Article',
                'journal': str(journal_id) if journal_id else '',
                'abstract': 'Test abstract for QA',
                'keywords': ['qa', 'test'],
                'page_count': 5,
                'submitted_author_name': 'QA Muallif',
            })
            print(f'  POST article (JSON, faylsiz): HTTP {st}')
            if st == 500:
                note('CRITICAL', label, 'maqola yuborish', f'Maqola yaratish 500: {art}')
            elif st >= 400:
                print(f'    (kutilgan validatsiya xatosi: {str(art)[:120]})')

            st, udc_price = req('GET', '/udc/price/', token=token)
            print(f'  UDK price: HTTP {st}')

            st, doi_price = req('GET', '/articles/doi/price/', token=token)
            print(f'  DOI price: HTTP {st}')

            st, sample_price = req('GET', '/articles/article-sample/price/', token=token)
            print(f'  Article sample price: HTTP {st}')

        if label == 'Operator':
            st, inbox = req('GET', '/articles/operator-chat-inbox/', token=token)
            print(f'  Operator chat inbox: HTTP {st}')
            if st == 403:
                note('HIGH', label, 'operator', 'Operator chat inbox 403 — ruxsat muammosi')

            for ep, name in [
                ('/articles/doi-requests/', 'DOI requests'),
                ('/articles/article-sample-requests/', 'Article sample'),
                ('/udc/requests/', 'UDK requests'),
                ('/translations/', 'Translations'),
                ('/articles/staff/', 'Staff articles'),
            ]:
                st, data = req('GET', ep, token=token)
                count = len(data) if isinstance(data, list) else len(data.get('results', [])) if isinstance(data, dict) else 0
                print(f'  {name}: HTTP {st}, count~={count}')
                if st >= 500:
                    note('CRITICAL', label, name, f'HTTP {st}: {str(data)[:100]}')

        if label == 'Super Admin':
            st, users_list = req('GET', '/users/', token=token)
            print(f'  Users list: HTTP {st}')
            st, fin = req('GET', '/payments/transactions/', token=token)
            txs = fin if isinstance(fin, list) else fin.get('results', [])
            print(f'  Transactions: HTTP {st}, count={len(txs) if isinstance(txs, list) else "?"}')

            # PATCH transaction status — security test
            if isinstance(txs, list) and txs:
                tx_id = txs[0].get('id')
                st2, patched = req('PATCH', f'/payments/transactions/{tx_id}/', token=token, data={'status': 'completed'})
                print(f'  SECURITY PATCH tx status: HTTP {st2}')
                if st2 == 200:
                    note('CRITICAL', label, 'xavfsizlik', 'Transaction status PATCH muvaffaqiyatli — to\'lovsiz xizmat ochish xavfi!')

            st, prof = req('PATCH', '/auth/update_profile/', token=token, data={'role': 'super_admin'})
            # Try with author token later

        if label == 'Reviewer':
            st, udk = req('GET', '/udc/requests/', token=token)
            print(f'  UDK requests (reviewer): HTTP {st}')

        if label == 'Journal Admin':
            st, arts = req('GET', '/articles/staff/', token=token)
            print(f'  Staff articles: HTTP {st}')
            st, pub = req('GET', '/journals/journals/', token=token)
            jlist = pub if isinstance(pub, list) else pub.get('results', [])
            print(f'  Managed journals: {len(jlist)}')

        if label == 'Accountant':
            st, txs = req('GET', '/payments/transactions/', token=token)
            print(f'  Transactions: HTTP {st}')

    # Author privilege escalation test
    if author_token:
        st, esc = req('PATCH', '/auth/update_profile/', token=author_token, data={'role': 'super_admin'})
        print(f'\nSECURITY: Author role PATCH: HTTP {st}')
        if st == 200:
            note('CRITICAL', 'Author', 'xavfsizlik', 'Muallif o\'zini super_admin qila oladi!')

    # Click keys / payment
    st, _ = req('POST', '/payments/transactions/', token=author_token, data={
        'amount': 1000,
        'currency': 'UZS',
        'service_type': 'publication_fee',
    }) if author_token else (0, {})
    if author_token:
        print(f'\nPayment transaction create: HTTP {st}')

    print('\n\n========== TOPILMALAR ==========')
    for f in FINDINGS:
        print(f"[{f['severity']}] {f['role']} / {f['area']}: {f['msg']}")
    if not FINDINGS:
        print('Avtomatik tekshiruvda kritik topilma yo\'q (lekin UI qo\'lda ham tekshirilishi kerak).')

    # Write JSON report
    with open(r'C:\Users\User\Desktop\Phonix\scripts\_qa_report.json', 'w', encoding='utf-8') as out:
        json.dump(FINDINGS, out, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
