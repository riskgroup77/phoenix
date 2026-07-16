#!/usr/bin/env python3
"""Faqat phoenix-backend ni qayta ishga tushirish + loopback tekshiruv."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from phonix_ssh import connect_phonix

_BACKEND_PORT = (os.environ.get("PHONIX_BACKEND_LOCAL_PORT") or "8050").strip() or "8050"

REMOTE = f"""set -e
sudo systemctl restart phoenix-backend
sleep 3
HTTP_CODE=$(curl -sS -o /dev/null -w "%{{http_code}}" --connect-timeout 2 --max-time 20 "http://127.0.0.1:{_BACKEND_PORT}/api/v1/auth/login/" || echo "000")
echo "Loopback /api/v1/auth/login/ HTTP ${{HTTP_CODE}}"
if [ "$HTTP_CODE" = "000" ]; then
  echo "--- journalctl (oxirgi 35 qator) ---"
  sudo journalctl -u phoenix-backend -n 35 --no-pager
  exit 1
fi
sudo systemctl reload nginx 2>/dev/null || true
curl -sS --max-time 3 http://127.0.0.1:{_BACKEND_PORT}/health/ || true
echo ""
echo "OK: phoenix-backend + nginx reload"
"""


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    client = connect_phonix()
    try:
        _, stdout, stderr = client.exec_command(REMOTE, get_pty=True, timeout=120)
        for line in iter(stdout.readline, ""):
            if line == "":
                break
            sys.stdout.write(line)
            sys.stdout.flush()
        err = stderr.read().decode("utf-8", "replace")
        if err.strip():
            sys.stderr.write(err)
        return int(stdout.channel.recv_exit_status())
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
