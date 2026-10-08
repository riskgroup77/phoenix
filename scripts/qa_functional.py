#!/usr/bin/env python3
"""Funksional QA: narx olish, profil, jurnallar, so'rov yaratish (xavfsiz)."""
# Parollar muhitdan olinadi (PHONIX_QA_*_PASSWORD) — repoda saqlanmaydi.
import os
import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api/v1"


def req(method, path, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"detail": raw[:200]}


def login(phone, password):
    s, d = req("POST", "/auth/login/", body={"phone": phone, "password": password})
    return d.get("access") if s == 200 else None


def main():
    results = []
    print("=== FUNKSIONAL QA ===\n")

    # Author
    tok = login("901001004", os.environ.get("PHONIX_QA_AUTHOR_PASSWORD", ""))
    tests = [
        ("Author", "GET profile", "GET", "/auth/profile/", tok, None),
        ("Author", "GET udk price", "GET", "/udc/price/", tok, None),
        ("Author", "GET sample price", "GET", "/articles/article-sample/price/", tok, None),
        ("Author", "GET doi price", "GET", "/articles/doi/price/", tok, None),
        ("Author", "GET journals count", "GET", "/journals/journals/?page_size=5", tok, None),
    ]
    if tok:
        s, j = req("GET", "/journals/journals/?page_size=1", tok)
        if s == 200 and j.get("results"):
            jid = j["results"][0]["id"]
            tests.append(("Author", "PATCH profile (safe field)", "PATCH", "/auth/profile/", tok, {"patronymic": "QA"}))

    for role, name, method, path, token, body in tests:
        if not token:
            results.append((role, name, "SKIP", "no token"))
            continue
        if method == "PATCH":
            headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
            data = json.dumps(body).encode()
            r = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method="PATCH")
            try:
                with urllib.request.urlopen(r, timeout=15) as resp:
                    ok = 200 <= resp.status < 300
                    results.append((role, name, "OK" if ok else f"HTTP {resp.status}", ""))
            except urllib.error.HTTPError as e:
                results.append((role, name, f"HTTP {e.code}", e.read().decode()[:80]))
        else:
            s, d = req(method, path, token, body)
            ok = 200 <= s < 300
            extra = ""
            if name == "GET journals count" and ok:
                extra = f"count={d.get('count', len(d) if isinstance(d, list) else '?')}"
            results.append((role, name, "OK" if ok else f"HTTP {s}", extra or str(d.get("detail", ""))[:80]))

    # Super admin stats
    tok_sa = login("901001001", os.environ.get("PHONIX_QA_SUPER_ADMIN_PASSWORD", ""))
    s, d = req("GET", "/auth/stats/", tok_sa)
    results.append(("SuperAdmin", "GET stats", "OK" if s == 200 else f"HTTP {s}", f"users={d.get('users',{}).get('total','?')}" if s == 200 else ""))

    # Operator inbox
    tok_op = login("901001007", os.environ.get("PHONIX_QA_OPERATOR_PASSWORD", ""))
    s, _ = req("GET", "/articles/operator-chat-inbox/", tok_op)
    results.append(("Operator", "GET chat inbox", "OK" if s == 200 else f"HTTP {s}", ""))

    # Journal admin published flow APIs
    tok_ja = login("901001002", os.environ.get("PHONIX_QA_JOURNAL_ADMIN_PASSWORD", ""))
    for label, path in [("issues", "/journals/issues/"), ("articles", "/articles/?page_size=10")]:
        s, _ = req("GET", path, tok_ja)
        results.append(("JournalAdmin", f"GET {label}", "OK" if s == 200 else f"HTTP {s}", ""))

    # Reviewer articles (paginated, not staff)
    tok_rev = login("901001003", os.environ.get("PHONIX_QA_REVIEWER_PASSWORD", ""))
    s, d = req("GET", "/articles/?page_size=10", tok_rev)
    results.append(("Reviewer", "GET articles list", "OK" if s == 200 else f"HTTP {s}", f"count={d.get('count','?')}" if s == 200 else ""))

    # Accountant financials
    tok_acc = login("901001005", os.environ.get("PHONIX_QA_ACCOUNTANT_PASSWORD", ""))
    s, d = req("GET", "/payments/transactions/", tok_acc)
    results.append(("Accountant", "GET transactions", "OK" if s == 200 else f"HTTP {s}", ""))

    fails = [r for r in results if r[2] not in ("OK", "SKIP")]
    for role, name, status, detail in results:
        mark = "OK" if status == "OK" else ("-" if status == "SKIP" else "X")
        print(f"  [{mark}] {role} / {name}: {status} {detail}")

    print(f"\nFunksional: {len(results) - len(fails)}/{len(results)} OK")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
