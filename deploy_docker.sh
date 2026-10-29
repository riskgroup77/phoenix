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
    self_before=$(sha256sum deploy_docker.sh 2>/dev/null || true)
    git reset -q --hard "${PHOENIX_GIT_REF:-origin/main}" || error_exit "commit topilmadi: ${PHOENIX_GIT_REF:-}"
    # Skriptning o'zi yangilangan bo'lsa — yangi versiyasini ishga tushiramiz (bash eski nusxani o'qib qoladi)
    if [ "$self_before" != "$(sha256sum deploy_docker.sh)" ]; then
        echo "   deploy_docker.sh yangilandi — yangi versiyasi bilan davom etilmoqda"
        PHOENIX_SKIP_GIT=true exec bash "${PHOENIX_DIR}/deploy_docker.sh"
    fi
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

# Rejali vazifalar (eski serverdagi systemd timerlar o'rniga). Natija: /var/log/phoenix-cron.log
install_cron() {
    [ -d /etc/cron.d ] || return 0
    local run="cd ${PHOENIX_DIR} && docker compose -f docker-compose.prod.yml exec -T web python manage.py"
    local tmp
    tmp=$(mktemp)
    cat > "$tmp" <<CRON
# Phoenix — deploy_docker.sh yozadi, qo'lda o'zgartirmang
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Telegram fayl ombori: yuborilmaganlarni kanalga yuborish + TG_STORAGE_EVICT_DAYS kun ochilmaganlarni diskdan o'chirish
15 * * * * root flock -n /run/phoenix-tgstorage.lock bash -c '${run} tgstorage sync --evict' >> /var/log/phoenix-cron.log 2>&1
# Taqrizchilarga muddat eslatmalari
0 9 * * * root ${run} send_deadline_reminders >> /var/log/phoenix-cron.log 2>&1
# Kunlik baza zaxirasi: serverda (backend/backups) + shifrlangan holda Telegram kanali va foydalanuvchi chatlariga
0 3 * * * root flock -n /run/phoenix-backup.lock bash ${PHOENIX_DIR}/infrastructure/backup/phoenix-backup.sh daily >> /var/log/phoenix-backup.log 2>&1
CRON
    if ! cmp -s "$tmp" /etc/cron.d/phoenix; then
        install -m 644 "$tmp" /etc/cron.d/phoenix
        echo "   ⏰ /etc/cron.d/phoenix yangilandi"
    fi
    rm -f "$tmp"
}

install_cron

# Local Bot API server: api_id/api_hash shart. Bot local serverga o'tishdan oldin cloud Bot API'dan bir marta
# chiqarilishi kerak (logOut) — aks holda yangilanishlar ikki server orasida bo'linib, bot xabarlarni yo'qotadi.
prepare_tg_bot_api() {
    grep -qs "^TELEGRAM_API_ID=." backend/.env && grep -qs "^TELEGRAM_API_HASH=." backend/.env \
        || error_exit "backend/.env da TELEGRAM_API_ID / TELEGRAM_API_HASH yo'q (https://my.telegram.org)"
    mkdir -p backend/telegram-bot-api backend/tg-spool backend/media
    local marker=backend/telegram-bot-api/.cloud-logout-done token
    [ -f "$marker" ] && return 0
    token=$(grep "^TELEGRAM_BOT_TOKEN=" backend/.env | cut -d= -f2-)
    [ -n "$token" ] || return 0
    echo "   Bot cloud Bot API'dan chiqarilmoqda (bir marta, local serverga o'tish uchun)..."
    if curl -fsS -m 20 -o /dev/null "https://api.telegram.org/bot${token}/logOut"; then
        touch "$marker"
    else
        echo "   ⚠️  logOut bajarilmadi (allaqachon chiqarilgan bo'lishi mumkin) — keyingi deployda qayta urinadi"
    fi
}
prepare_tg_bot_api

# 3. Konteynerlar (kod o'zgarsa image qayta quriladi va konteyner almashtiriladi)
echo "🐳 Konteynerlar qurilmoqda va ishga tushirilmoqda..."
"${COMPOSE[@]}" up -d --build --remove-orphans
# Migratsiyadan oldin baza zaxirasi (xato bo'lsa ham deploy davom etadi — kunlik zaxira bor)
echo "💾 Deploy oldi zaxira..."
bash infrastructure/backup/phoenix-backup.sh pre-deploy || echo "   ⚠️  Deploy oldi zaxira olinmadi"
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
