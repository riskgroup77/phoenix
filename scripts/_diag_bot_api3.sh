#!/bin/bash
echo "=== LOGIN with X-Forwarded-Proto ==="
curl -sS -w "\nHTTP:%{http_code} TIME:%{time_total}\n" --max-time 25 \
  -X POST http://127.0.0.1:8050/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -H 'X-Forwarded-Proto: https' \
  -d '{"phone":"998901001004","password":"Demo@author1"}'

echo ""
echo "=== LOGIN without redirect follow ==="
curl -sS -L --max-redirs 0 -w "\nHTTP:%{http_code}\n" --max-time 5 \
  -X POST http://127.0.0.1:8050/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"phone":"998901001004","password":"Demo@author1"}' | head -c 300
