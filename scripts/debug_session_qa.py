#!/usr/bin/env python3
"""Debug session ac7877: production API verification for all conversation fixes."""
import json
import os
import time
import urllib.error
import urllib.request

BASE = os.environ.get("PHONIX_API_BASE", "https://api.ilmiyfaoliyat.uz/api/v1")
LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "debug-ac7877.log")
SESSION = "ac7877"


def log(hypothesis_id: str, location: str, message: str, data: dict | None = None, run_id: str = "prod-audit"):
    entry = {
        "sessionId": SESSION,
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data or {},
        "timestamp": int(time.time() * 1000),
    }
    path = os.path.abspath(LOG_PATH)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    print(f"[{hypothesis_id}] {message}", json.dumps(data or {}, ensure_ascii=False)[:120])


def req(method, path, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"detail": raw[:300]}


def login(phone, password):
    s, d = req("POST", "/auth/login/", body={"phone": phone, "password": password})
    if s != 200:
        log("AUTH", "login", "login failed", {"phone": phone[-4:], "status": s, "detail": d.get("detail", "")[:80]})
        return None
    return d.get("access")


def list_items(raw):
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        if isinstance(raw.get("results"), list):
            return raw["results"]
        if isinstance(raw.get("data"), list):
            return raw["data"]
        if isinstance(raw.get("items"), list):
            return raw["items"]
    return []


def main():
    import sys
    run_id = sys.argv[1] if len(sys.argv) > 1 else "prod-audit"
    # Clear is done externally; append fresh run
    log("META", "main", "production audit started", {"base": BASE}, run_id=run_id)

    users = {
        "author": ("998901001004", "Demo@author1"),
        "admin": ("998901001001", "Demo@admin1"),
        "operator": ("998901001007", "Operator@1234567890"),
        "accountant": ("998901001005", "Demo@account1"),
        "reviewer": ("998901001003", "Demo@review1"),
    }
    tokens = {}
    for role, (phone, pw) in users.items():
        tokens[role] = login(phone, pw)
        log("AUTH", "main", f"token for {role}", {"ok": bool(tokens[role])})

    # H1: Archive hides published article_pdf, keeps certificate
    if tokens["author"]:
        s, d = req("GET", "/auth/archive/", tokens["author"])
        items = list_items(d.get("items") if isinstance(d, dict) else d)
        pub_pdf = [i for i in items if i.get("type") == "article_pdf" and "nashr" in (i.get("label") or "").lower()]
        certs = [i for i in items if i.get("type") == "publication_certificate"]
        log("H1", "archive", "author archive items", {
            "status": s,
            "total": len(items),
            "published_article_pdf_rows": len(pub_pdf),
            "certificate_rows": len(certs),
            "pass": s == 200 and len(pub_pdf) == 0,
        })

    # H2: Admin blocked from operator-chat API
    if tokens["admin"]:
        s_art, arts = req("GET", "/articles/?page_size=5", tokens["admin"])
        art_list = list_items(arts)
        art_id = art_list[0]["id"] if art_list else None
        if art_id:
            s_chat, d_chat = req("GET", f"/articles/{art_id}/operator-chat/", tokens["admin"])
            log("H2", "operator-chat", "admin operator-chat access", {
                "article_id": str(art_id)[:8],
                "status": s_chat,
                "pass": s_chat == 403,
            })
        s_inbox, d_inbox = req("GET", "/articles/operator-chat-inbox/", tokens["admin"])
        log("H2", "operator-chat-inbox", "admin inbox access", {"status": s_inbox, "pass": s_inbox == 403})

    # H3: Operator can access inbox
    if tokens["operator"]:
        s_inbox, d_inbox = req("GET", "/articles/operator-chat-inbox/", tokens["operator"])
        inbox = list_items(d_inbox)
        log("H3", "operator-chat-inbox", "operator inbox", {"status": s_inbox, "count": len(inbox), "pass": s_inbox == 200})

    # H4: Accountant transactions include journal_name
    if tokens["accountant"]:
        s_tx, txs = req("GET", "/payments/transactions/", tokens["accountant"])
        tx_list = list_items(txs)[:20]
        with_journal = [t for t in tx_list if (t.get("journal_name") or "").strip()]
        pub_fee = [t for t in tx_list if t.get("service_type") == "publication_fee"]
        pub_with_j = [t for t in pub_fee if (t.get("journal_name") or "").strip()]
        log("H4", "financials", "transaction journal fields", {
            "status": s_tx,
            "sample_size": len(tx_list),
            "with_journal_name": len(with_journal),
            "publication_fee_count": len(pub_fee),
            "publication_fee_with_journal": len(pub_with_j),
            "sample": [
                {
                    "service": t.get("service_type"),
                    "journal": (t.get("journal_name") or "")[:40],
                    "title": (t.get("article_title") or "")[:40],
                }
                for t in tx_list[:3]
            ],
            "pass": s_tx == 200 and "journal_name" in (tx_list[0] if tx_list else {}),
        })

    # H5: Reviewer sees book articles ([KITOB])
    if tokens["reviewer"]:
        s_art, arts = req("GET", "/articles/", tokens["reviewer"])
        art_list = list_items(arts)
        books = [a for a in art_list if (a.get("title") or "").upper().startswith("[KITOB]")]
        log("H5", "reviewer-books", "reviewer article list", {
            "status": s_art,
            "total": len(art_list),
            "book_count": len(books),
            "book_titles": [(b.get("title") or "")[:50] for b in books[:3]],
        })

    # H6: Reviewer translations API
    if tokens["reviewer"]:
        s_tr, trs = req("GET", "/translations/", tokens["reviewer"])
        tr_list = list_items(trs)
        pending = [t for t in tr_list if t.get("status") in ("Yangi", "Jarayonda")]
        log("H6", "reviewer-translations", "reviewer translations", {
            "status": s_tr,
            "total": len(tr_list),
            "pending": len(pending),
        })

    # H7: Upload limit setting (indirect via settings not exposed — check health)
    s_h, h = req("GET", "/health/")
    log("H7", "health", "api health", {"status": s_h, "pass": s_h == 200})

    log("META", "main", "production audit finished", {}, run_id=run_id)
    print(f"\nLogs written to {os.path.abspath(LOG_PATH)}")


if __name__ == "__main__":
    main()
