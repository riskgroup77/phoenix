#!/usr/bin/env python3
"""Serverga muallif Telegram botini o'rnatish va ishga tushirish."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parent
if str(_SCRIPT) not in sys.path:
    sys.path.insert(0, str(_SCRIPT))

from phonix_ssh import connect_phonix, _load_deploy_credentials_files

ROOT = _SCRIPT.parent
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
if not TOKEN:
    env_path = ROOT / "backend" / ".env"
    if env_path.is_file():
        for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("TELEGRAM_BOT_TOKEN="):
                TOKEN = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

if not TOKEN:
    print("TELEGRAM_BOT_TOKEN topilmadi", file=sys.stderr)
    sys.exit(1)

REMOTE = os.environ.get("PHONIX_REMOTE_DIR", "/phonix").rstrip("/")
BACKEND_PORT = os.environ.get("PHONIX_BACKEND_LOCAL_PORT", "8050")

SETUP = f"""
set -e
cd {REMOTE}
git fetch origin main && git reset --hard origin/main
cd {REMOTE}/backend
source venv/bin/activate
pip install -q "python-telegram-bot>=21.10,<23.0.0"
python manage.py migrate --noinput

# .env ga token va ichki API (server loopback)
grep -q '^TELEGRAM_BOT_TOKEN=' .env 2>/dev/null && sed -i 's|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN={TOKEN}|' .env || echo 'TELEGRAM_BOT_TOKEN={TOKEN}' >> .env
grep -q '^API_BASE_URL=' .env 2>/dev/null && sed -i 's|^API_BASE_URL=.*|API_BASE_URL=http://127.0.0.1:{BACKEND_PORT}/api/v1|' .env || echo 'API_BASE_URL=http://127.0.0.1:{BACKEND_PORT}/api/v1' >> .env
grep -q '^FRONTEND_BASE_URL=' .env 2>/dev/null || echo 'FRONTEND_BASE_URL=https://ilmiyfaoliyat.uz' >> .env

cat > /etc/systemd/system/phoenix-telegram-bot.service << 'UNIT'
[Unit]
Description=Phoenix Author Telegram Bot
After=network.target phoenix-backend.service
Wants=phoenix-backend.service

[Service]
Type=simple
User=admin_root
WorkingDirectory={REMOTE}/backend
Environment=DJANGO_SETTINGS_MODULE=config.settings
EnvironmentFile=-{REMOTE}/backend/.env
ExecStart={REMOTE}/backend/venv/bin/python bot/bot.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

echo qazxsw123@! | sudo -S systemctl daemon-reload
echo qazxsw123@! | sudo -S systemctl enable phoenix-telegram-bot
echo qazxsw123@! | sudo -S systemctl restart phoenix-telegram-bot
sleep 2
echo qazxsw123@! | sudo -S systemctl status phoenix-telegram-bot --no-pager | head -20
"""


def main() -> int:
    _load_deploy_credentials_files()
    client = connect_phonix()
    try:
        print("[ssh] Telegram bot o'rnatilmoqda...")
        stdin, stdout, stderr = client.exec_command(SETUP.replace("{TOKEN}", TOKEN))
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        print(out)
        if err:
            print(err, file=sys.stderr)
        return 0 if stdout.channel.recv_exit_status() == 0 else 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
