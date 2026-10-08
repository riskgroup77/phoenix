#!/bin/bash
set -e
echo "=== ENV ==="
grep -E '^(API_BASE_URL|FRONTEND_BASE_URL|TELEGRAM_BOT_TOKEN)=' /phonix/backend/.env | sed 's/TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=***/'

echo ""
echo "=== SERVICES ==="
systemctl is-active phoenix-backend phoenix-telegram-bot || true

echo ""
echo "=== LOGIN loopback ==="
curl -sS -w "\nHTTP:%{http_code} TIME:%{time_total}\n" --max-time 25 \
  -X POST http://127.0.0.1:8050/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"phone":"998901001004","password":"Demo@author1"}' | head -c 400

echo ""
echo "=== LOGIN api.ilmiyfaoliyat.uz ==="
curl -sS -w "\nHTTP:%{http_code} TIME:%{time_total}\n" --max-time 25 \
  -X POST https://api.ilmiyfaoliyat.uz/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"phone":"998901001004","password":"Demo@author1"}' | head -c 400

echo ""
echo "=== BOT LOG ==="
journalctl -u phoenix-telegram-bot -n 20 --no-pager 2>/dev/null | tail -20
