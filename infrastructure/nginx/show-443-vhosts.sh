#!/usr/bin/env bash
# Qaysi server {} qanday root va server_name — tez ko'rish (o'qish uchun).
set -euo pipefail
echo "=== default_server 443 ==="
sudo nginx -T 2>/dev/null | grep -E 'listen\s+(\[::\]:)?443|default_server|server_name' | head -80
echo ""
echo "=== phoenix fayl (root) ==="
sudo grep -nE 'root |server_name|listen 443' /etc/nginx/sites-available/phoenix-ilmiyfaoliyat-frontend 2>/dev/null || echo "(fayl yo'q)"
