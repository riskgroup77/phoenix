#!/bin/bash
echo "=== 301 redirect check ==="
curl -sSI --max-time 5 -X POST http://127.0.0.1:8050/api/v1/auth/login/ \
  -H 'Content-Type: application/json' -d '{}' | head -20

echo ""
echo "=== GET api root loopback ==="
curl -sSI --max-time 5 http://127.0.0.1:8050/api/v1/ | head -15

echo ""
echo "=== GET api root main domain ==="
curl -sSI --max-time 10 https://ilmiyfaoliyat.uz/api/v1/ | head -15

echo ""
echo "=== LISTEN ports ==="
ss -tlnp 2>/dev/null | grep -E '8050|:443|:80 ' || netstat -tlnp 2>/dev/null | grep -E '8050|443|80 '

echo ""
echo "=== SECURE_SSL in .env ==="
grep -i SECURE /phonix/backend/.env || echo "(no SECURE vars)"

echo ""
echo "=== nginx sites ==="
ls -la /etc/nginx/sites-enabled/ 2>/dev/null
