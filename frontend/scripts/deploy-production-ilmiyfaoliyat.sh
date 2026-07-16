#!/usr/bin/env bash
# Phoenix (phonixF) — production build va nginx static root.
# JSTI yoki boshqa loyiha /root/frontend/dist da qolgan bo'lsa, shu skript to'g'ri build bilan almashtiradi.
#
# Serverda (phonixF rootda):
#   bash scripts/deploy-production-ilmiyfaoliyat.sh
#
# Yoki:
#   export NGINX_FRONTEND_ROOT=/root/frontend/dist
#   export PHONIX_FRONTEND_REPO=/root/phonixF
#   bash /root/phonixF/scripts/deploy-production-ilmiyfaoliyat.sh
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DEFAULT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO="${PHONIX_FRONTEND_REPO:-$REPO_DEFAULT}"
WEBROOT="${NGINX_FRONTEND_ROOT:-/root/frontend/dist}"

if [[ ! -f "$REPO/package.json" ]]; then
  echo "XATO: $REPO/package.json yo'q."
  exit 1
fi

cd "$REPO"
git pull origin master
npm ci
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://api.ilmiyfaoliyat.uz/api/v1}"
export VITE_MEDIA_URL="${VITE_MEDIA_URL:-https://api.ilmiyfaoliyat.uz/media/}"
npm run build

install -d -m 755 "$WEBROOT"
rsync -a --delete "$REPO/dist/" "$WEBROOT/"

echo "Build joylandi: $WEBROOT"
head -25 "$WEBROOT/index.html" | grep -E '<title>|PINM|Phoenix|ilmiy' || true
sudo nginx -t && sudo systemctl reload nginx
echo OK
