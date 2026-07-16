#!/usr/bin/env python3
"""Serverda api-ilmiyfaoliyat.conf: eski upstreamlarni 127.0.0.1:8050 ga (phoenix-backend)."""
from __future__ import annotations

import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from phonix_ssh import connect_phonix

_PHOENIX_LOOPBACK = "127.0.0.1"
_PHOENIX_PORT = "8050"

REMOTE = f"""set -e
CFG=/etc/nginx/sites-available/api-ilmiyfaoliyat.conf
if [ ! -f "$CFG" ]; then
  echo "No $CFG — skip"
  exit 0
fi
sed -i 's/{_PHOENIX_LOOPBACK}:8003/{_PHOENIX_LOOPBACK}:{_PHOENIX_PORT}/g; s/{_PHOENIX_LOOPBACK}:8000/{_PHOENIX_LOOPBACK}:{_PHOENIX_PORT}/g' "$CFG"
echo "api upstream -> {_PHOENIX_LOOPBACK}:{_PHOENIX_PORT} (api-ilmiyfaoliyat.conf)"
nginx -t
systemctl reload nginx
echo OK
"""


def main() -> int:
    c = connect_phonix()
    try:
        _, o, e = c.exec_command(REMOTE, get_pty=True, timeout=60)
        sys.stdout.write(o.read().decode("utf-8", "replace"))
        sys.stderr.write(e.read().decode("utf-8", "replace"))
        return int(o.channel.recv_exit_status())
    finally:
        c.close()


if __name__ == "__main__":
    raise SystemExit(main())
