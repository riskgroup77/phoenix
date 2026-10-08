#!/usr/bin/env python3
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from phonix_ssh import connect_phonix

cmd = r"""
cd /phonix/backend
if [ ! -f .env ]; then echo 'ENV_FILE=MISSING'; exit 0; fi
echo 'ENV_FILE=OK'
grep -E '^CLICK_MERCHANT_ID=|^CLICK_SERVICE_ID=|^CLICK_MERCHANT_USER_ID=' .env | sed 's/=.*/=***/'
for k in CLICK_SECRET_KEY CLICK_SERVICE_82154_SECRET_KEY; do
  v=$(grep -E "^${k}=" .env | cut -d= -f2- | tr -d '\r')
  if [ -n "$v" ]; then echo "${k}=SET(len=${#v})"; else echo "${k}=EMPTY"; fi
done
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings')
import sys; sys.path.insert(0,'/phonix/backend')
django.setup()
from django.conf import settings
from apps.payments.services import ClickPaymentService
s = ClickPaymentService()
keys = ['82154','82155','89248','88045']
print('DJANGO_CLICK_SERVICE_ID=', getattr(settings,'CLICK_SERVICE_ID', ''))
print('DJANGO_MERCHANT_ID=', getattr(settings,'CLICK_MERCHANT_ID', ''))
sk = (getattr(settings,'CLICK_SECRET_KEY','') or '').strip()
print('DJANGO_CLICK_SECRET_KEY=', 'SET' if sk else 'EMPTY')
s82154 = (getattr(settings,'CLICK_SERVICE_82154_SECRET_KEY','') or '').strip()
print('DJANGO_SERVICE_82154_KEY=', 'SET' if s82154 else 'EMPTY')
for sid in keys:
    k = s.get_secret_key_for_service(sid)
    print(f'secret_for_{sid}=', 'SET' if k else 'EMPTY')
" 2>/dev/null
curl -sf --max-time 5 http://127.0.0.1:8050/health/ready/ | head -c 120
echo
"""

client = connect_phonix()
_, stdout, stderr = client.exec_command(cmd, timeout=90)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print(out)
if err.strip():
    print(err, file=sys.stderr)
client.close()
