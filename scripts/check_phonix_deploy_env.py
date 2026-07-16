#!/usr/bin/env python3
"""
Lokal `python scripts/remote_deploy.py` uchun autentifikatsiya bor-yo‘qligini tekshiradi.
Chiqish: 0 = Paramiko ulanishi mumkin, 1 = sozlash kerak.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from phonix_ssh import _load_deploy_credentials_files


def main() -> int:
    _load_deploy_credentials_files()
    pw = (os.environ.get("PHONIX_SSH_PASSWORD") or "").strip()
    pw_file = (os.environ.get("PHONIX_SSH_PASSWORD_FILE") or "").strip()
    key = (os.environ.get("PHONIX_SSH_KEY") or "").strip()
    agent = os.environ.get("PHONIX_SSH_USE_AGENT", "").lower() in ("1", "true", "yes", "on")

    ok = False
    if pw:
        ok = True
        print("[ok] PHONIX_SSH_PASSWORD muhitda o‘rnatilgan")
    if pw_file and Path(pw_file).is_file():
        ok = True
        print(f"[ok] PHONIX_SSH_PASSWORD_FILE mavjud: {pw_file}")
    elif pw_file:
        print(f"[yo‘q] PHONIX_SSH_PASSWORD_FILE ko‘rsatilgan, lekin fayl yo‘q: {pw_file}")
    if key and Path(key).is_file():
        ok = True
        print(f"[ok] PHONIX_SSH_KEY mavjud: {key}")
    elif key:
        print(f"[yo‘q] PHONIX_SSH_KEY ko‘rsatilgan, lekin fayl yo‘q: {key}")
    if agent:
        print(
            "[info] PHONIX_SSH_USE_AGENT=1 — faqat agentda kalit bo‘lsa ishlaydi; "
            "tekshiruv uchun kalit fayli yoki parol fayli ishonchliroq."
        )

    root_env = _SCRIPT_DIR.parent / ".phonix_deploy.env"
    home_env = Path.home() / ".phonix_deploy.env"
    if root_env.is_file():
        print(f"[info] yuklandi: {root_env}")
    if home_env.is_file():
        print(f"[info] yuklandi: {home_env}")

    if ok:
        print("\nKeyingi qadam: python scripts/remote_deploy.py")
        return 0

    print(
        "\n[xato] Hech qanday usul topilmadi. Quyidagilardan bittasini qiling:\n"
        "  1) GitHub: phonixB → Settings → Secrets → PHONIX_SSH_HOST, PHONIX_SSH_USER, PHONIX_SSH_PRIVATE_KEY\n"
        "     → Actions → 'Deploy to server' → Run workflow\n"
        "  2) Lokal: .phonix_deploy.env yoki ~/.phonix_deploy.env (namuna: .phonix_deploy.env.example)\n"
        "     — PHONIX_SSH_KEY yoki PHONIX_SSH_PASSWORD_FILE\n",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
