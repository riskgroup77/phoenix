#!/bin/bash
# Phoenix — Docker bilan deploy (server: /home/phoenix, docker-compose.prod.yml).
# GitHub Actions ("Deploy to server") ham shu skriptni ishlatadi. Qo'lda: bash /home/phoenix/deploy_docker.sh
#
# O'zgaruvchilar (ixtiyoriy):
#   PHOENIX_DIR            — loyiha papkasi (default /home/phoenix)
#   PHOENIX_GIT_REF        — aniq commit (CI dan o'tgan commit); bo'sh bo'lsa origin/main
#   PHOENIX_SKIP_GIT=true  — git yangilanmaydi (serverdagi joriy kod deploy qilinadi)
#   PHONIX_PREBUILT_DIST   — CI da build qilingan frontend papkasi (index.html bilan); bo'lmasa serverda build
set -euo pipefail

PHOENIX_DIR="${PHOENIX_DIR:-/home/phoenix}"
API_DOMAIN="api.ilmiyfaoliyat.uz"
COMPOSE=(docker compose -f docker-compose.prod.yml)

error_exit() { echo "❌ Xatolik: $1" >&2; exit 1; }

[ -d "${PHOENIX_DIR}/.git" ] || error_exit "${PHOENIX_DIR} da git repo yo'q"
cd "${PHOENIX_DIR}"
[ -f backend/.env ] || error_exit "backend/.env topilmadi"

# 1. Kod (backend/.env gitignore'da — reset unga tegmaydi)
if [ "${PHOENIX_SKIP_GIT:-false}" != "true" ]; then
    echo "📥 Git yangilanmoqda..."
    git fetch -q origin main || error_exit "git fetch xatolik"
    git reset -q --hard "${PHOENIX_GIT_REF:-origin/main}" || error_exit "commit topilmadi: ${PHOENIX_GIT_REF:-}"
fi
echo "   $(git log -1 --oneline)"

# 2. Nginx: repodagi konfiglar (yo'llar /home/phoenix). nginx -t dan o'tmasa — eskisi qaytariladi.
install_nginx() {
    command -v nginx >/dev/null 2>&1 || return 0
    local le=/etc/letsencrypt
    if [ ! -f "$le/live/ilmiyfaoliyat.uz/fullchain.pem" ] || [ ! -f "$le/live/api.ilmiyfaoliyat.uz/fullchain.pem" ] \
        || [ ! -f "$le/options-ssl-nginx.conf" ]; then
        echo "   ⚠️  SSL sertifikat yo'q — nginx konfiglari o'rnatilmadi. Avval:"
        echo "      certbot certonly --nginx -d ilmiyfaoliyat.uz -d www.ilmiyfaoliyat.uz"
        echo "      certbot certonly --nginx -d api.ilmiyfaoliyat.uz"
        return 0
    fi
    local avail=/etc/nginx/sites-available enabled=/etc/nginx/sites-enabled
    local backup changed=0 f dst new_links=""
    backup=$(mktemp -d)
    for f in phoenix-ilmiyfaoliyat-frontend.conf phoenix-api-ilmiyfaoliyat.conf snippets/phoenix-media.conf; do
        case "$f" in
            snippets/*) dst="/etc/nginx/$f" ;;
            *) dst="$avail/$f" ;;
        esac
        if ! cmp -s "infrastructure/nginx/$f" "$dst"; then
            mkdir -p "$(dirname "$backup/$f")" "$(dirname "$dst")"
            [ -f "$dst" ] && cp -a "$dst" "$backup/$f"
            install -m 644 "infrastructure/nginx/$f" "$dst"
            changed=1
        fi
    done
    for f in phoenix-ilmiyfaoliyat-frontend.conf phoenix-api-ilmiyfaoliyat.conf; do
        if [ ! -e "$enabled/$f" ]; then
            ln -s "$avail/$f" "$enabled/$f"
            new_links="$new_links $enabled/$f"
            changed=1
        fi
    done
    if [ "$changed" = "1" ]; then
        if nginx -t 2>/dev/null; then
            systemctl reload nginx
            echo "   ✅ Nginx konfiglari yangilandi"
        else
            echo "   ❌ Yangi nginx konfigi nginx -t dan o'tmadi — eskisi qaytarildi:"
            nginx -t 2>&1 | grep emerg || true
            # shellcheck disable=SC2086
            [ -n "$new_links" ] && rm -f $new_links
            (cd "$backup" && find . -type f) | while read -r f; do
                f="${f#./}"
                case "$f" in
                    snippets/*) cp -a "$backup/$f" "/etc/nginx/$f" ;;
                    *) cp -a "$backup/$f" "$avail/$f" ;;
                esac
            done
            rm -rf "$backup"
            return 0
        fi
    fi
    rm -rf "$backup"
    # Har safar qayta yuklanadi (graceful) — sertifikat yoki konfig qo'lda o'zgargan bo'lsa ham kuchga kirsin
    nginx -t 2>/dev/null && systemctl reload nginx
    # Snippet ulangan — himoyalangan media fayllarni nginx beradi (X-Accel-Redirect)
    grep -q "^MEDIA_ACCEL_REDIRECT=" backend/.env || echo "MEDIA_ACCEL_REDIRECT=true" >> backend/.env
}

install_nginx

# 3. Konteynerlar (kod o'zgarsa image qayta quriladi va konteyner almashtiriladi)
echo "🐳 Konteynerlar qurilmoqda va ishga tushirilmoqda..."
"${COMPOSE[@]}" up -d --build --remove-orphans
echo "🗄️  Migratsiyalar..."
"${COMPOSE[@]}" exec -T web python manage.py migrate --noinput
"${COMPOSE[@]}" exec -T web python manage.py collectstatic --noinput >/dev/null

# 4. Frontend
echo "🎨 Frontend..."
if [ -n "${PHONIX_PREBUILT_DIST:-}" ] && [ -f "${PHONIX_PREBUILT_DIST}/index.html" ]; then
    echo "   CI da build qilingan frontend ishlatilmoqda"
    rm -rf frontend/dist.new && cp -a "${PHONIX_PREBUILT_DIST}" frontend/dist.new
else
    echo "   Serverda build qilinmoqda (node:20 konteynerida)..."
    docker run --rm -v "${PHOENIX_DIR}/frontend:/app" -w /app \
        -e VITE_API_BASE_URL="https://${API_DOMAIN}/api/v1" \
        -e VITE_MEDIA_URL="https://${API_DOMAIN}/media/" \
        -e VITE_APP_VERSION="$(git rev-parse --short HEAD)" \
        node:20 sh -c "npm ci --no-audit --no-fund && npm run build -- --outDir dist.new --emptyOutDir" \
        || error_exit "Frontend build xatolik"
fi
# Almashtirish bir zumda — build paytida sayt eski versiyada ishlab turadi
rm -rf frontend/dist.old
[ -d frontend/dist ] && mv frontend/dist frontend/dist.old
mv frontend/dist.new frontend/dist
rm -rf frontend/dist.old

# 5. Tekshiruv
echo "🩺 Tekshirilmoqda..."
for i in $(seq 1 30); do
    if curl -fsS -o /dev/null -H 'X-Forwarded-Proto: https' http://127.0.0.1:8050/health/; then
        echo "✅ Deploy tugadi — backend ishlayapti"
        docker image prune -f >/dev/null 2>&1 || true
        exit 0
    fi
    sleep 2
done
"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs --tail=50 web
error_exit "backend /health/ javob bermadi"
