#!/usr/bin/env bash
# Phoenix frontend — production build va nginx root ga joylash.
# Muammo: /root/frontend/dist da boshqa loyiha (masalan JSTI) bo'lsa — shu skript phonixF kodidan qayta build qiladi.
#
# Serverda (phonixF klon yo'lini o'zingizga moslang):
#   export PHONIX_FRONTEND_REPO=/root/phonixF
#   export NGINX_FRONTEND_ROOT=/root/frontend/dist
#   bash infrastructure/deploy-frontend-ilmiyfaoliyat.sh
#
set -euo pipefail
REPO="${PHONIX_FRONTEND_REPO:-/root/phonixF}"
WEBROOT="${NGINX_FRONTEND_ROOT:-/root/frontend/dist}"

if [[ ! -f "$REPO/package.json" ]]; then
  echo "XATO: $REPO/package.json yo'q. phonixF reponi klonlang yoki PHONIX_FRONTEND_REPO ni to'g'rilang."
  echo "  Masalan: git clone https://github.com/aiziyrak-coder/phonixF.git /root/phonixF"
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
echo "Tekshirish: head -20 $WEBROOT/index.html | grep -i title"
sudo nginx -t && sudo systemctl reload nginx
echo OK
