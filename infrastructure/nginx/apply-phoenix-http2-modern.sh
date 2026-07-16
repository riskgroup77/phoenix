#!/usr/bin/env bash
# Faqat /etc/nginx/sites-available/phoenix-ilmiyfaoliyat-frontend — boshqa saytlarga tegmaydi.
# Serverda: sudo bash apply-phoenix-http2-modern.sh
set -euo pipefail
f=/etc/nginx/sites-available/phoenix-ilmiyfaoliyat-frontend
if [[ ! -f "$f" ]]; then
  echo "Fayl yo'q: $f"
  exit 1
fi
cp -a "$f" "${f}.bak.$(date +%Y%m%d%H%M%S)"
sed -i 's/listen 443 ssl http2;/listen 443 ssl;/g' "$f"
sed -i 's/listen \[::\]:443 ssl http2;/listen [::]:443 ssl;/g' "$f"
if ! grep -qE '^\s*http2 on;' "$f"; then
  sed -i '/listen \[::\]:443 ssl;/a\    http2 on;' "$f"
fi
nginx -t
systemctl reload nginx
echo "OK: $f yangilandi (backup: ${f}.bak.*)"
