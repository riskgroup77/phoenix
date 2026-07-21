#!/bin/bash
# Phoenix — birinchi marta server sozlash (boshqa nginx/dasturlarga tegmaydi)
set -euo pipefail

SUDO_PW="${SUDO_PW:?SUDO_PW kerak}"
sudo_cmd() { echo "$SUDO_PW" | sudo -S "$@"; }

REMOTE_DIR="${PHONIX_REMOTE_DIR:-/phonix}"
BACKEND_PORT="${PHONIX_BACKEND_PORT:-8050}"
MONO_REPO="https://github.com/riskgroup77/phoenix.git"
DEPLOY_USER="$(whoami)"

echo "=== Phoenix bootstrap: $REMOTE_DIR (user=$DEPLOY_USER) ==="

# 1. Papka
sudo_cmd mkdir -p "$REMOTE_DIR"
sudo_cmd chown -R "$DEPLOY_USER:$DEPLOY_USER" "$REMOTE_DIR"

# 2. Clone / pull monorepo
if [ -d "$REMOTE_DIR/.git" ]; then
  cd "$REMOTE_DIR"
  git fetch origin
  git reset --hard origin/main
else
  git clone "$MONO_REPO" "$REMOTE_DIR"
  cd "$REMOTE_DIR"
fi
chmod +x deploy_phonix.sh

# 3. PostgreSQL (alohida Docker konteyner — 5434, boshqa DB larga tegmaydi)
if ! sudo_cmd docker ps --format '{{.Names}}' | grep -qx phoenix-postgres; then
  echo "PostgreSQL konteyner yaratilmoqda (127.0.0.1:5434)..."
  sudo_cmd docker run -d --name phoenix-postgres \
    --restart unless-stopped \
    -e POSTGRES_USER=phoenix \
    -e POSTGRES_PASSWORD=phoenix_prod_2026 \
    -e POSTGRES_DB=phoenix_scientific \
    -p 127.0.0.1:5434:5432 \
    -v phoenix_pgdata:/var/lib/postgresql/data \
    postgres:16-alpine
  sleep 5
fi

# 4. Backend .env
cd "$REMOTE_DIR/backend"
if [ ! -f .env ]; then
  cp env.production.example .env
  SK=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
  sed -i "s/your-strong-secret-key-here-change-in-production-generate-with-django-secret-key-generator/$SK/" .env
  sed -i 's/ALLOWED_HOSTS=.*/ALLOWED_HOSTS=api.ilmiyfaoliyat.uz,ilmiyfaoliyat.uz,www.ilmiyfaoliyat.uz,87.192.230.208,localhost,127.0.0.1/' .env
  sed -i 's/DB_HOST=localhost/DB_HOST=127.0.0.1/' .env
  sed -i 's/DB_PORT=5432/DB_PORT=5434/' .env
  sed -i 's/DB_USER=postgres/DB_USER=phoenix/' .env
  sed -i 's/DB_PASSWORD=postgres/DB_PASSWORD=phoenix_prod_2026/' .env
  sed -i 's/USE_SQLITE=False/USE_SQLITE=False/' .env
  sed -i 's|REDIS_URL=redis://localhost:6379/0|REDIS_URL=redis://127.0.0.1:6379/2|' .env
  echo ".env yaratildi"
else
  echo ".env mavjud — saqlab qolindi"
fi

# 5. Systemd (faqat phoenix-backend)
sudo_cmd tee /etc/systemd/system/phoenix-backend.service > /dev/null <<EOF
[Unit]
Description=Phoenix Scientific Platform Backend (Gunicorn)
After=network.target docker.service

[Service]
Type=simple
User=$DEPLOY_USER
Group=$DEPLOY_USER
WorkingDirectory=$REMOTE_DIR/backend
Environment=PATH=$REMOTE_DIR/backend/venv/bin
Environment=DJANGO_SETTINGS_MODULE=config.settings
Environment=PYTHONUNBUFFERED=1
Environment=GUNICORN_BIND=127.0.0.1:$BACKEND_PORT
ExecStart=$REMOTE_DIR/backend/venv/bin/gunicorn -c gunicorn.conf.py config.wsgi:application
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo_cmd systemctl daemon-reload
sudo_cmd systemctl enable phoenix-backend

# 6. Nginx — faqat Phoenix konfiglari qo'shiladi
for conf in phoenix-ilmiyfaoliyat-frontend.conf phoenix-api-ilmiyfaoliyat.conf; do
  src="$REMOTE_DIR/infrastructure/nginx/$conf"
  if [ -f "$src" ]; then
    sudo_cmd cp "$src" "/etc/nginx/sites-available/$conf"
    sudo_cmd ln -sf "/etc/nginx/sites-available/$conf" "/etc/nginx/sites-enabled/$conf"
    echo "Nginx: $conf ulandi"
  fi
done

# Eski nginx (<1.25): http2 on; o'rniga listen ... http2
for conf in phoenix-ilmiyfaoliyat-frontend.conf phoenix-api-ilmiyfaoliyat.conf; do
  f="/etc/nginx/sites-available/$conf"
  if [ -f "$f" ]; then
    sudo_cmd sed -i '/^[[:space:]]*http2 on;/d' "$f"
    sudo_cmd sed -i 's/listen 443 ssl;$/listen 443 ssl http2;/' "$f"
    sudo_cmd sed -i 's/listen \[::\]:443 ssl;$/listen [::]:443 ssl http2;/' "$f"
  fi
done
sudo_cmd nginx -t
sudo_cmd systemctl reload nginx

# 7. SSL (faqat ilmiyfaoliyat domenlari)
if ! sudo_cmd test -f /etc/letsencrypt/live/ilmiyfaoliyat.uz/fullchain.pem; then
  echo "SSL: ilmiyfaoliyat.uz..."
  echo "$SUDO_PW" | sudo -S certbot certonly --nginx \
    -d ilmiyfaoliyat.uz -d www.ilmiyfaoliyat.uz \
    --non-interactive --agree-tos -m admin@ilmiyfaoliyat.uz 2>&1 | tail -15 || true
fi
if ! sudo_cmd test -f /etc/letsencrypt/live/api.ilmiyfaoliyat.uz/fullchain.pem; then
  echo "SSL: api.ilmiyfaoliyat.uz..."
  echo "$SUDO_PW" | sudo -S certbot certonly --nginx \
    -d api.ilmiyfaoliyat.uz \
    --non-interactive --agree-tos -m admin@ilmiyfaoliyat.uz 2>&1 | tail -15 || true
fi

# 8. Deploy
cd "$REMOTE_DIR"
export PHONIX_GIT_RESET=true
export PHONIX_BACKEND_PORT="$BACKEND_PORT"
bash deploy_phonix.sh

echo "=== Bootstrap tugadi ==="
