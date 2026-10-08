#!/usr/bin/env python3
"""
Har bir demo rol uchun login + sahifa API endpointlarini tekshirish.
Ishlatish: python scripts/qa_role_pages.py
"""
from __future__ import annotations

# Parollar muhitdan olinadi (PHONIX_QA_*_PASSWORD) — repoda saqlanmaydi.
import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Callable

BASE = "http://127.0.0.1:8000/api/v1"

USERS = [
    ("Super Admin", "901001001", os.environ.get("PHONIX_QA_SUPER_ADMIN_PASSWORD", ""), "super_admin"),
    ("Journal Admin", "901001002", os.environ.get("PHONIX_QA_JOURNAL_ADMIN_PASSWORD", ""), "journal_admin"),
    ("Reviewer", "901001003", os.environ.get("PHONIX_QA_REVIEWER_PASSWORD", ""), "reviewer"),
    ("Author", "901001004", os.environ.get("PHONIX_QA_AUTHOR_PASSWORD", ""), "author"),
    ("Accountant", "901001005", os.environ.get("PHONIX_QA_ACCOUNTANT_PASSWORD", ""), "accountant"),
    ("Operator", "901001007", os.environ.get("PHONIX_QA_OPERATOR_PASSWORD", ""), "operator"),
]

# page -> list of (label, path, method, expected_ok_roles or None=all authenticated)
PAGE_APIS: dict[str, list[tuple[str, str, str]]] = {
    "dashboard": [
        ("profile", "/auth/profile/", "GET"),
        ("notifications", "/notifications/", "GET"),
        ("journals", "/journals/journals/?page_size=50", "GET"),
        ("transactions", "/payments/transactions/", "GET"),
        ("articles_list", "/articles/?page_size=50", "GET"),
        ("articles_mine", "/articles/mine/", "GET"),
        ("articles_staff", "/articles/staff/", "GET"),
        ("users_stats", "/auth/stats/", "GET"),
        ("doi_requests", "/articles/doi/requests/", "GET"),
        ("article_sample", "/articles/article-sample/requests/", "GET"),
        ("translations", "/translations/", "GET"),
        ("udk_requests", "/udc/requests/", "GET"),
    ],
    "articles": [
        ("articles_mine", "/articles/mine/", "GET"),
        ("articles_staff", "/articles/staff/", "GET"),
        ("articles_list", "/articles/?page_size=200", "GET"),
        ("journals", "/journals/journals/?page_size=200", "GET"),
        ("translations", "/translations/", "GET"),
    ],
    "submit": [
        ("journals", "/journals/journals/?page_size=200", "GET"),
    ],
    "services": [
        ("journals", "/journals/journals/?page_size=20", "GET"),
    ],
    "my-collections": [
        ("issues", "/journals/issues/", "GET"),
        ("journals", "/journals/journals/", "GET"),
        ("articles", "/articles/?page_size=100", "GET"),
    ],
    "my-translations": [
        ("translations", "/translations/", "GET"),
    ],
    "arxiv": [
        ("archive", "/auth/archive/", "GET"),
    ],
    "author-publications": [
        ("my_pubs", "/journals/author-publications/my_publications/", "GET"),
        ("all_pubs", "/journals/author-publications/", "GET"),
        ("scientific_fields", "/journals/scientific-fields/?page_size=200", "GET"),
        ("pub_types", "/journals/author-publications/publication_types/", "GET"),
    ],
    "profile": [
        ("profile", "/auth/profile/", "GET"),
    ],
    "doi-requests": [
        ("doi", "/articles/doi/requests/", "GET"),
    ],
    "udk-requests": [
        ("udk", "/udc/requests/", "GET"),
    ],
    "journal-admin-panel": [
        ("journals", "/journals/journals/", "GET"),
        ("articles", "/articles/?page_size=200", "GET"),
    ],
    "published-articles": [
        ("issues", "/journals/issues/", "GET"),
        ("journals", "/journals/journals/", "GET"),
        ("articles", "/articles/?page_size=200", "GET"),
        ("users", "/auth/", "GET"),
    ],
    "users": [
        ("users", "/auth/", "GET"),
    ],
    "journal-management": [
        ("journals", "/journals/journals/", "GET"),
        ("categories", "/journals/categories/", "GET"),
        ("users", "/auth/", "GET"),
    ],
    "prices": [
        ("service_prices", "/udc/service-prices/", "GET"),
        ("journals", "/journals/journals/", "GET"),
    ],
    "financials": [
        ("transactions", "/payments/transactions/", "GET"),
        ("users", "/auth/", "GET"),
    ],
    "article-sample-requests": [
        ("samples", "/articles/article-sample/requests/", "GET"),
    ],
    "operator-dashboard": [
        ("udk", "/udc/requests/", "GET"),
        ("doi", "/articles/doi/requests/", "GET"),
        ("samples", "/articles/article-sample/requests/", "GET"),
        ("translations", "/translations/", "GET"),
        ("users", "/auth/", "GET"),
        ("transactions", "/payments/transactions/", "GET"),
        ("chat_inbox", "/articles/operator-chat-inbox/", "GET"),
    ],
    "all-requests": [
        ("udk", "/udc/requests/", "GET"),
        ("doi", "/articles/doi/requests/", "GET"),
        ("samples", "/articles/article-sample/requests/", "GET"),
        ("translations", "/translations/", "GET"),
        ("staff", "/articles/staff/", "GET"),
    ],
    "udk-olish": [
        ("udk_price", "/udc/price/", "GET"),
        ("udk_requests", "/udc/requests/", "GET"),
        ("certificates", "/udc/my-certificates/", "GET"),
    ],
    "translation-service": [
        ("translations", "/translations/", "GET"),
    ],
    "plagiarism-check": [
        ("journals", "/journals/journals/?page_size=500", "GET"),
    ],
    "maqola-namuna-olish": [
        ("sample_price", "/articles/article-sample/price/", "GET"),
    ],
}

ROLE_PAGES: dict[str, list[str]] = {
    "author": [
        "dashboard", "articles", "submit", "services", "my-collections",
        "my-translations", "arxiv", "author-publications", "profile",
        "udk-olish", "translation-service", "plagiarism-check", "maqola-namuna-olish",
    ],
    "reviewer": [
        "dashboard", "articles", "doi-requests", "udk-requests", "profile",
    ],
    "journal_admin": [
        "dashboard", "journal-admin-panel", "articles", "published-articles",
        "author-publications", "profile",
    ],
    "super_admin": [
        "dashboard", "users", "articles", "journal-management", "prices",
        "financials", "author-publications", "article-sample-requests",
        "doi-requests", "udk-requests", "profile",
    ],
    "operator": [
        "operator-dashboard", "articles", "all-requests", "doi-requests",
        "udk-requests", "article-sample-requests", "profile",
    ],
    "accountant": [
        "dashboard", "financials", "profile",
    ],
}

# Role-restricted pages (frontend RoleRoute) — other roles should get 403 on some APIs
ROLE_ONLY_PAGES = {
    "published-articles": {"journal_admin", "super_admin"},
    "users": {"super_admin"},
    "journal-management": {"super_admin"},
    "prices": {"super_admin"},
    "financials": {"super_admin", "accountant"},
    "all-requests": {"operator"},
    "operator-dashboard": {"operator"},
    "udk-requests": {"super_admin", "reviewer", "operator"},
}


@dataclass
class Result:
    role: str
    page: str
    label: str
    path: str
    status: int
    ok: bool
    detail: str = ""


def login(phone: str, password: str) -> str | None:
    body = json.dumps({"phone": phone, "password": password}).encode()
    req = urllib.request.Request(
        f"{BASE}/auth/login/",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
            return data.get("access")
    except urllib.error.HTTPError as e:
        print(f"LOGIN FAIL {phone}: {e.code} {e.read().decode()[:200]}")
        return None


def api_get(token: str, path: str, method: str = "GET") -> tuple[int, str]:
    req = urllib.request.Request(
        f"{BASE}{path}",
        headers={"Authorization": f"Bearer {token}"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, ""
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:300]
        detail = body
        try:
            j = json.loads(body)
            detail = j.get("detail") or str(j)[:200]
        except Exception:
            pass
        return e.code, detail
    except Exception as ex:
        return 0, str(ex)


def main() -> int:
    all_results: list[Result] = []
    seen: set[tuple[str, str, str]] = set()

    print("=" * 72)
    print("PHONIX — TO'LIQ ROL BO'YICHA SAHIFA/API QA")
    print("=" * 72)

    for display, phone, password, role in USERS:
        print(f"\n### {display} ({role}) — login {phone}")
        token = login(phone, password)
        if not token:
            all_results.append(Result(role, "login", "login", "/auth/login/", 0, False, "login failed"))
            continue
        print("  Login OK")

        pages = ROLE_PAGES.get(role, [])
        for page in pages:
            apis = PAGE_APIS.get(page, [])
            for label, path, method in apis:
                key = (role, page, path)
                if key in seen:
                    continue
                seen.add(key)
                status, detail = api_get(token, path, method)
                # 403 is OK for role-restricted endpoints when role not in allowed set
                restricted = ROLE_ONLY_PAGES.get(page)
                if restricted and role not in restricted:
                    ok = status in (200, 403)
                elif label == "articles_staff":
                    ok = status == 200 or (role == "author" and status == 403)
                elif label == "users_stats":
                    ok = status == 200 or (role != "super_admin" and status in (403, 404))
                elif label == "users" and role not in ("super_admin", "journal_admin", "operator", "accountant"):
                    ok = status in (200, 403)
                else:
                    ok = 200 <= status < 300
                mark = "OK" if ok else "FAIL"
                print(f"  [{mark}] {page}/{label}: {status} {path}")
                if not ok and detail:
                    print(f"         -> {detail[:120]}")
                all_results.append(Result(role, page, label, path, status, ok, detail))

    fails = [r for r in all_results if not r.ok]
    oks = [r for r in all_results if r.ok]

    print("\n" + "=" * 72)
    print(f"JAMI: {len(all_results)} tekshiruv | OK: {len(oks)} | FAIL: {len(fails)}")
    print("=" * 72)

    if fails:
        print("\nXATOLIKLAR:")
        by_role: dict[str, list[Result]] = {}
        for f in fails:
            by_role.setdefault(f.role, []).append(f)
        for role, items in by_role.items():
            print(f"\n  [{role}]")
            for f in items:
                print(f"    - {f.page}/{f.label} -> HTTP {f.status}: {f.detail[:100]}")

    # Write JSON report
    report_path = "scripts/qa_role_pages_report.json"
    with open(report_path, "w", encoding="utf-8") as fp:
        json.dump(
            [{"role": r.role, "page": r.page, "label": r.label, "path": r.path,
              "status": r.status, "ok": r.ok, "detail": r.detail} for r in all_results],
            fp, ensure_ascii=False, indent=2,
        )
    print(f"\nHisobot: {report_path}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
