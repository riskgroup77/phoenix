"""Frontend build + nginx + backend restart (backend allaqachon yangilangan bo'lishi mumkin)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from phonix_ssh import _load_deploy_credentials_files, connect_phonix

_load_deploy_credentials_files()
script = r"""
set -e
export PHONIX_FRONTEND_WEB_ROOT=/var/www/ilmiyfaoliyat
export VITE_API_BASE_URL=https://api.ilmiyfaoliyat.uz/api/v1
export VITE_MEDIA_URL=https://api.ilmiyfaoliyat.uz/media/
export NODE_OPTIONS=--max-old-space-size=3072

cd /phonix/frontend
echo "=== git ==="
git fetch origin master && git reset --hard origin/master

echo "=== npm build ==="
npm install --silent
npm run build

echo "=== static ==="
mkdir -p "$PHONIX_FRONTEND_WEB_ROOT"
rsync -a --delete dist/ "$PHONIX_FRONTEND_WEB_ROOT/"

echo "=== restart ==="
sudo systemctl restart phoenix-backend
sleep 2
systemctl is-active phoenix-backend
curl -sf --max-time 5 http://127.0.0.1:8050/health/ && echo " health OK" || echo " health FAIL"
nginx -t 2>/dev/null && sudo systemctl reload nginx && echo " nginx OK"
echo "=== DONE ==="
"""

client = connect_phonix()
try:
    _, stdout, stderr = client.exec_command(script, get_pty=True, timeout=3600)
    while True:
        line = stdout.readline()
        if not line:
            break
        sys.stdout.write(line)
        sys.stdout.flush()
    err = stderr.read().decode("utf-8", errors="replace")
    if err.strip():
        sys.stderr.write(err)
    code = stdout.channel.recv_exit_status()
    sys.exit(code)
finally:
    client.close()
