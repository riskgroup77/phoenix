#!/usr/bin/env python3
"""Birinchi marta server sozlash: clone, systemd, nginx (faqat Phoenix), certbot."""
from __future__ import annotations

import os
import shlex
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from phonix_ssh import connect_phonix

ROOT = _SCRIPT_DIR.parent
REMOTE_DIR = (os.environ.get("PHONIX_REMOTE_DIR") or "/phonix").rstrip("/")
BACKEND_PORT = (os.environ.get("PHONIX_BACKEND_LOCAL_PORT") or "8050").strip() or "8050"
MONO_REPO = "https://github.com/riskgroup77/phoenix.git"


def run(client, cmd: str, *, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n>>> {cmd}\n")
    _, stdout, stderr = client.exec_command(cmd, get_pty=True, timeout=timeout)
    out_lines = []
    for line in iter(stdout.readline, ""):
        if line == "":
            break
        out_lines.append(line)
        sys.stdout.write(line)
        sys.stdout.flush()
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    return code, "".join(out_lines), err


def main() -> int:
    client = connect_phonix()
    try:
        # 1. Server holati
        run(client, "whoami && uname -a")
        run(client, "ss -tlnp | head -40 || netstat -tlnp | head -40")
        run(client, "systemctl list-units --type=service --state=running | head -30")
        run(client, "ls -la /etc/nginx/sites-enabled/ 2>/dev/null || ls -la /etc/nginx/conf.d/ 2>/dev/null || true")
        run(client, f"ss -tlnp | grep ':{BACKEND_PORT} ' || echo 'Port {BACKEND_PORT} bo\\'sh'")

        # 2. Kerakli paketlar
        run(
            client,
            "command -v git >/dev/null && command -v python3 >/dev/null && command -v node >/dev/null && command -v npm >/dev/null && echo 'Asosiy paketlar OK' || "
            "(sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git python3 python3-venv python3-pip nodejs npm nginx rsync curl certbot python3-certbot-nginx postgresql postgresql-contrib redis-server 2>&1 | tail -5)",
            timeout=900,
        )

        # 3. Clone monorepo
        run(client, f"sudo mkdir -p {REMOTE_DIR} && sudo chown -R $(whoami):$(whoami) {REMOTE_DIR}")
        clone_cmd = (
            f"if [ -d {REMOTE_DIR}/.git ]; then cd {REMOTE_DIR} && git fetch origin && git reset --hard origin/main; "
            f"else git clone {MONO_REPO} {REMOTE_DIR}; fi"
        )
        run(client, clone_cmd, timeout=300)

        # 4. Backend .env (birinchi marta)
        secret_key_cmd = (
            f"cd {REMOTE_DIR}/backend && "
            f"if [ ! -f .env ]; then "
            f"cp env.production.example .env && "
            f"SK=$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())' 2>/dev/null || openssl rand -base64 48) && "
            f"sed -i \"s/your-strong-secret-key-here-change-in-production-generate-with-django-secret-key-generator/$SK/\" .env && "
            f"sed -i 's/ALLOWED_HOSTS=.*/ALLOWED_HOSTS=api.ilmiyfaoliyat.uz,ilmiyfaoliyat.uz,www.ilmiyfaoliyat.uz,87.192.230.208,localhost,127.0.0.1/' .env && "
            f"echo '.env yaratildi'; else echo '.env mavjud'; fi"
        )
        run(client, secret_key_cmd)

        # 5. PostgreSQL DB (agar yo'q bo'lsa)
        run(
            client,
            "sudo -u postgres psql -tc \"SELECT 1 FROM pg_database WHERE datname='phoenix_scientific'\" | grep -q 1 || "
            "(sudo -u postgres psql -c \"CREATE USER phoenix WITH PASSWORD 'phoenix_prod_2026';\" 2>/dev/null || true; "
            "sudo -u postgres psql -c \"CREATE DATABASE phoenix_scientific OWNER phoenix;\" 2>/dev/null || true; "
            "echo 'PostgreSQL DB tayyor')",
        )
        run(
            client,
            f"grep -q 'DB_USER=phoenix' {REMOTE_DIR}/backend/.env || "
            f"(sed -i 's/DB_USER=postgres/DB_USER=phoenix/' {REMOTE_DIR}/backend/.env; "
            f"sed -i 's/DB_PASSWORD=postgres/DB_PASSWORD=phoenix_prod_2026/' {REMOTE_DIR}/backend/.env; "
            f"sed -i 's/USE_SQLITE=False/USE_SQLITE=False/' {REMOTE_DIR}/backend/.env)",
        )

        # 6. Systemd service (faqat phoenix-backend)
        systemd_unit = f"""[Unit]
Description=Phoenix Scientific Platform Backend (Gunicorn)
After=network.target postgresql.service

[Service]
Type=simple
User={os.environ.get('PHONIX_SSH_USER', 'admin_root')}
Group={os.environ.get('PHONIX_SSH_USER', 'admin_root')}
WorkingDirectory={REMOTE_DIR}/backend
Environment=PATH={REMOTE_DIR}/backend/venv/bin
Environment=DJANGO_SETTINGS_MODULE=config.settings
Environment=PYTHONUNBUFFERED=1
Environment=GUNICORN_BIND=127.0.0.1:{BACKEND_PORT}
ExecStart={REMOTE_DIR}/backend/venv/bin/gunicorn -c gunicorn.conf.py config.wsgi:application
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
        unit_b64 = __import__("base64").b64encode(systemd_unit.encode()).decode()
        run(
            client,
            f"echo {shlex.quote(unit_b64)} | base64 -d | sudo tee /etc/systemd/system/phoenix-backend.service > /dev/null && "
            "sudo systemctl daemon-reload && sudo systemctl enable phoenix-backend",
        )

        # 7. Nginx — faqat Phoenix konfiglari (boshqalarga tegmaymiz)
        for conf_name in ("phoenix-ilmiyfaoliyat-frontend.conf", "phoenix-api-ilmiyfaoliyat.conf"):
            src = f"{REMOTE_DIR}/infrastructure/nginx/{conf_name}"
            run(
                client,
                f"sudo cp {src} /etc/nginx/sites-available/{conf_name} && "
                f"sudo ln -sf /etc/nginx/sites-available/{conf_name} /etc/nginx/sites-enabled/{conf_name} && "
                f"echo 'Nginx: {conf_name} ulandi'",
            )

        # Upstream port mosligi
        run(
            client,
            f"grep -q '127.0.0.1:{BACKEND_PORT}' /etc/nginx/sites-available/phoenix-api-ilmiyfaoliyat.conf && echo 'Upstream port OK' || "
            f"sudo sed -i 's/127.0.0.1:[0-9]\\+/127.0.0.1:{BACKEND_PORT}/' /etc/nginx/sites-available/phoenix-api-ilmiyfaoliyat.conf",
        )

        # 8. SSL sertifikatlar (mavjud bo'lmasa certbot)
        run(
            client,
            "sudo certbot certificates 2>/dev/null | head -30 || true",
        )
        run(
            client,
            "sudo test -f /etc/letsencrypt/live/ilmiyfaoliyat.uz/fullchain.pem || "
            "sudo certbot certonly --nginx -d ilmiyfaoliyat.uz -d www.ilmiyfaoliyat.uz --non-interactive --agree-tos -m admin@ilmiyfaoliyat.uz 2>&1 | tail -10 || true",
            timeout=300,
        )
        run(
            client,
            "sudo test -f /etc/letsencrypt/live/api.ilmiyfaoliyat.uz/fullchain.pem || "
            "sudo certbot certonly --nginx -d api.ilmiyfaoliyat.uz --non-interactive --agree-tos -m admin@ilmiyfaoliyat.uz 2>&1 | tail -10 || true",
            timeout=300,
        )

        # Nginx test — faqat reload, boshqa konfiglarga tegmaymiz
        run(client, "sudo nginx -t && sudo systemctl reload nginx")

        # 9. Deploy
        deploy_cmd = (
            f"cd {REMOTE_DIR} && chmod +x deploy_phonix.sh && "
            f"PHONIX_GIT_RESET=true PHONIX_BACKEND_PORT={BACKEND_PORT} bash deploy_phonix.sh"
        )
        code, _, _ = run(client, deploy_cmd, timeout=1200)
        return code
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
