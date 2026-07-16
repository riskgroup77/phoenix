#!/bin/bash
# Serverda frontend deploy (konflikt/unmerged bo'lsa ham - remote ga moslashtiradi)
set -e
cd "$(dirname "$0")"
git merge --abort 2>/dev/null || true
git fetch origin
git reset --hard origin/master
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://api.ilmiyfaoliyat.uz/api/v1}"
export VITE_MEDIA_URL="${VITE_MEDIA_URL:-https://api.ilmiyfaoliyat.uz/media/}"
npm install --silent
chmod -R u+x node_modules/.bin 2>/dev/null || true
npm run build
echo "Frontend build done. Restart backend: sudo systemctl restart phoenix-backend"
