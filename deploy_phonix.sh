#!/bin/bash

# Phoenix Scientific Platform - Xavfsiz Deployment Script
# Bu script faqat Phoenix dasturini yangilaydi va boshqa dasturlarga tasir qilmaydi
# GitHub: https://github.com/riskgroup77/phoenix (monorepo)
#
# MUHIM: Nginx konfiglarini avtomatik sed qilmaymiz — boshqa saytlar buzilishining oldini oladi.
#        API proxy port: PHONIX_BACKEND_PORT (default 8050) — systemd va nginx bilan moslang.

set -e  # Xatolik bo'lsa to'xtatish

# Masofadan deploy: SUDO_PW yoki PHONIX_SSH_PASSWORD (bootstrap bilan bir xil)
SUDO_PW="${SUDO_PW:-${PHONIX_SSH_PASSWORD:-}}"
sudo_cmd() {
    if [ -n "$SUDO_PW" ]; then
        echo "$SUDO_PW" | sudo -S "$@"
    else
        sudo "$@"
    fi
}

# ============================================
# KONFIGURATSIYA - Faqat Phoenix uchun
# ============================================
DEPLOY_DIR="/phonix"
MONO_REPO="https://github.com/riskgroup77/phoenix.git"
SERVICE_NAME="phoenix-backend"
# Loopback port — 8000 boshqa xizmatlar bilan to'qnashmasin; PHONIX_BACKEND_PORT bilan o'zgartirish mumkin
BACKEND_PORT="${PHONIX_BACKEND_PORT:-8050}"
FRONTEND_DOMAIN="ilmiyfaoliyat.uz"
API_DOMAIN="api.ilmiyfaoliyat.uz"
# PHONIX_GIT_RESET=true — fetch + reset --hard (masofadan deploy uchun tavsiya)

# ============================================
# FUNKTSIYALAR
# ============================================

git_update_monorepo() {
    if [ "${PHONIX_GIT_RESET:-false}" = "true" ]; then
        echo "   Git fetch + reset --hard (PHONIX_GIT_RESET)..."
        cp -a backend/.env /tmp/.env.phonix.bak 2>/dev/null || true
        # Asosiy branch — main (eski "master" qolgan bo'lsa ham u deploy qilinmaydi).
        # PHONIX_GIT_REF — aniq commit (CI dan o'tgan commit aynan shu chiqadi, oraliqdagi push emas).
        git fetch origin main || error_exit "git fetch xatolik"
        if [ -n "${PHONIX_GIT_REF:-}" ]; then
            git cat-file -e "${PHONIX_GIT_REF}^{commit}" 2>/dev/null || error_exit "Commit topilmadi: ${PHONIX_GIT_REF}"
            git reset --hard "${PHONIX_GIT_REF}"
        else
            git reset --hard origin/main
        fi
        if [ -f /tmp/.env.phonix.bak ]; then
            cp -a /tmp/.env.phonix.bak backend/.env
            echo "   backend/.env tiklandi"
        fi
    else
        echo "   Git pull qilinmoqda..."
        git stash 2>/dev/null || true
        git pull origin main || error_exit "Git pull xatolik"
        git stash pop 2>/dev/null || true
    fi
}

# Xatolikni ko'rsatish
error_exit() {
    echo "❌ Xatolik: $1" >&2
    exit 1
}

# PostgreSQL Docker konteyneri (127.0.0.1:5434) — to'xtagan bo'lsa login ishlamaydi
ensure_postgres_running() {
    if ! command -v docker >/dev/null 2>&1; then
        echo "⚠️  Docker topilmadi — PostgreSQL tekshiruvi o'tkazib yuborildi"
        return 0
    fi
    if docker ps --format '{{.Names}}' | grep -qx phoenix-postgres; then
        echo "✅ phoenix-postgres ishlayapti"
        return 0
    fi
    if docker ps -a --format '{{.Names}}' | grep -qx phoenix-postgres; then
        echo "🔄 phoenix-postgres to'xtagan — ishga tushirilmoqda..."
        docker start phoenix-postgres || error_exit "phoenix-postgres ishga tushmadi"
        docker update --restart=unless-stopped phoenix-postgres 2>/dev/null || true
        sleep 3
        echo "✅ phoenix-postgres qayta ishga tushirildi"
        return 0
    fi
    echo "⚠️  phoenix-postgres konteyneri yo'q — bootstrap_remote.sh orqali yaratish kerak"
}

# Redis Docker konteyneri (127.0.0.1:6379) — to'xtagan bo'lsa /health/ready 503
ensure_redis_running() {
    if ! command -v docker >/dev/null 2>&1; then
        echo "⚠️  Docker topilmadi — Redis tekshiruvi o'tkazib yuborildi"
        return 0
    fi
    if docker ps --format '{{.Names}}' | grep -qx phoenix-redis; then
        echo "✅ phoenix-redis ishlayapti"
        return 0
    fi
    if docker ps -a --format '{{.Names}}' | grep -qx phoenix-redis; then
        echo "🔄 phoenix-redis to'xtagan — ishga tushirilmoqda..."
        docker start phoenix-redis || error_exit "phoenix-redis ishga tushmadi"
        docker update --restart=unless-stopped phoenix-redis 2>/dev/null || true
        sleep 2
        echo "✅ phoenix-redis qayta ishga tushirildi"
        return 0
    fi
    echo "🔄 phoenix-redis yaratilmoqda (127.0.0.1:6379)..."
    docker run -d --name phoenix-redis \
        --restart unless-stopped \
        -p 127.0.0.1:6379:6379 \
        redis:7-alpine || error_exit "phoenix-redis yaratilmadi"
    sleep 2
    echo "✅ phoenix-redis yaratildi va ishga tushirildi"
}

# Tekshirish - boshqa service'lar ishlayaptimi?
check_other_services() {
    echo "🔍 Boshqa service'larni tekshirish..."
    
    # Phoenix service'ni tekshirish
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        echo "✅ ${SERVICE_NAME} ishlayapti"
    else
        echo "⚠️  ${SERVICE_NAME} ishlamayapti"
    fi
    
    # Port tekshirish
    if netstat -tlnp 2>/dev/null | grep -q ":${BACKEND_PORT} "; then
        echo "✅ Port ${BACKEND_PORT} ishlatilmoqda"
    else
        echo "⚠️  Port ${BACKEND_PORT} bo'sh"
    fi
}

# Backup yaratish
# Kod zaxirasi: faqat kod (venv, node_modules, media, build — kirmaydi; ular katta va qayta tiklanadi).
# Avval butun backend/ (venv va media bilan) har deployda nusxalanar va hech qachon o'chirilmasdi — disk to'lardi.
# Baza va media alohida: infrastructure/backup/phoenix-backup.sh (kunlik timer + migratsiyadan oldin).
CODE_BACKUP_KEEP="${PHONIX_CODE_BACKUP_KEEP:-5}"
create_backup() {
    echo "💾 Kod zaxirasi..."
    BACKUP_DIR="${DEPLOY_DIR}/backups/code/$(date +%Y%m%d_%H%M%S)"
    mkdir -p ${BACKUP_DIR}
    local excludes="--exclude=venv --exclude=node_modules --exclude=media --exclude=test_media --exclude=staticfiles --exclude=dist --exclude=__pycache__ --exclude=*.sqlite3 --exclude=logs"
    for part in backend frontend; do
        if [ -d "${DEPLOY_DIR}/${part}" ]; then
            tar -czf "${BACKUP_DIR}/${part}.tar.gz" ${excludes} -C "${DEPLOY_DIR}" "${part}" 2>/dev/null || true
        fi
    done
    # Avvalgi (eski formatdagi) to'liq nusxalar backups/<sana>/ — eng oxirgisi qoladi, qolganlari diskni tejash uchun o'chiriladi
    ls -1dt "${DEPLOY_DIR}"/backups/20*/ 2>/dev/null | tail -n +2 | xargs -r rm -rf
    # Faqat oxirgi N ta kod zaxirasi qoladi
    ls -1dt "${DEPLOY_DIR}"/backups/code/*/ 2>/dev/null | tail -n +"$((CODE_BACKUP_KEEP + 1))" | xargs -r rm -rf
    # .env backup
    if [ -f "${DEPLOY_DIR}/backend/.env" ]; then
        echo "📦 .env backup..."
        cp ${DEPLOY_DIR}/backend/.env ${BACKUP_DIR}/.env
    fi
    
    echo "✅ Backup yaratildi: ${BACKUP_DIR}"
}

# ============================================
# ASOSIY DEPLOYMENT
# ============================================

echo "🚀 Phoenix Deployment boshlandi..."
echo "📅 Vaqt: $(date)"
echo ""

# 1. Tekshirishlar
check_other_services
ensure_postgres_running
ensure_redis_running
echo ""

# 2. Backup
create_backup
echo ""

# 3. Monorepo yangilash
echo "📦 Loyiha (monorepo) yangilanmoqda..."
cd ${DEPLOY_DIR}

if [ -d ".git" ]; then
    git_update_monorepo
elif [ -z "$(ls -A "${DEPLOY_DIR}" 2>/dev/null | grep -v '^backups$')" ]; then
    echo "   Monorepo clone qilinmoqda (bo'sh papkaga)..."
    git clone ${MONO_REPO} "${DEPLOY_DIR}.clone" || error_exit "Monorepo clone xatolik"
    cp -a "${DEPLOY_DIR}.clone/." "${DEPLOY_DIR}/" && rm -rf "${DEPLOY_DIR}.clone"
    cd ${DEPLOY_DIR}
else
    # Avval bu yerda butun ${DEPLOY_DIR} (media, .env, zaxiralar bilan) o'chirilib qayta klonlanardi — xavfli
    error_exit "${DEPLOY_DIR} da .git yo'q, lekin fayllar bor (media/.env). Avtomatik o'chirilmaydi — qo'lda tekshiring."
fi

# 4. Backend
echo "📦 Backend sozlanmoqda..."
cd ${DEPLOY_DIR}/backend

# Virtual environment
if [ ! -d "venv" ]; then
    echo "   Virtual environment yaratilmoqda..."
    python3 -m venv venv
fi

echo "   Dependencies o'rnatilmoqda..."
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings
pip install --upgrade pip -q
pip install -r requirements.txt gunicorn -q || error_exit "Dependencies o'rnatish xatolik"

# .env faylini saqlab qolish / birinchi marta yaratish
if [ ! -f .env ]; then
    if [ -f "${BACKUP_DIR}/.env" ]; then
        echo "   .env fayli restore qilinmoqda..."
        cp ${BACKUP_DIR}/.env .env
    elif [ -f env.production.example ]; then
        echo "   .env env.production.example dan yaratilmoqda..."
        cp env.production.example .env
    fi
fi

# Migratsiyadan oldin baza zaxirasi — xato migratsiyadan keyin tiklash mumkin bo'lsin.
# Zaxira olinmasa deploy to'xtaydi (ataylab o'tkazib yuborish: PHONIX_SKIP_DB_BACKUP=true).
if [ "${PHONIX_SKIP_DB_BACKUP:-false}" != "true" ]; then
    echo "   Baza zaxiralanmoqda (migratsiyadan oldin)..."
    PHONIX_DIR="${DEPLOY_DIR}" bash "${DEPLOY_DIR}/infrastructure/backup/phoenix-backup.sh" pre-deploy \
        || error_exit "Baza zaxirasi olinmadi — migratsiya bajarilmadi (PHONIX_SKIP_DB_BACKUP=true bilan o'tkazib yuborish mumkin)"
fi

# Migrations
echo "   Migrations ishga tushirilmoqda..."
python manage.py migrate --noinput || error_exit "Migrations xatolik"

# Demo hisoblar (911111111/muallif, 922222222/taqrizchi, 933333333/muharrir, 955555555/operator).
# Productionda bosh admin / buxgalter demo hisoblari YARATILMAYDI; shu raqamli haqiqiy userlarga tegilmaydi.
echo "   Demo hisoblar yangilanmoqda..."
python manage.py setup_demo_and_admin || echo "   ⚠️  setup_demo_and_admin xato (deploy davom etadi)"

echo "   Kitob nashr tranzaksiyalarini tiklash..."
python manage.py repair_book_publications || echo "   ⚠️  repair_book_publications xato (deploy davom etadi)"

# Antiplagiat barmoq izlari indeksi — fon rejimida (deployni kutdirmaydi; o'zgarmagan hujjatlar tez o'tadi).
# To'liq qurilmaguncha tekshiruvlar eski usulda ishlaydi. flock — bir vaqtda faqat bitta nusxa.
# Indeksdan keyin bepul O'zbekiston jurnallari arxivlari (OAI) yig'iladi — birinchi marta soatlab, keyin faqat yangilari.
echo "   Antiplagiat indeksi va OAI arxivlari fon rejimida yangilanmoqda (log: /tmp/phonix_antiplag_index.log)..."
ANTIPLAG_BG="'$(pwd)/venv/bin/python' manage.py build_antiplag_index && '$(pwd)/venv/bin/python' manage.py harvest_oai --all --fill-full-text 300"
if command -v flock >/dev/null 2>&1; then
    nohup flock -n /tmp/phonix_antiplag_index.lock nice -n 10 sh -c "$ANTIPLAG_BG" >> /tmp/phonix_antiplag_index.log 2>&1 &
else
    nohup nice -n 10 sh -c "$ANTIPLAG_BG" >> /tmp/phonix_antiplag_index.log 2>&1 &
fi

# Static files
echo "   Static files collect qilinmoqda..."
python manage.py collectstatic --noinput || error_exit "Collectstatic xatolik"

deactivate
echo "✅ Backend yangilandi"
echo ""

# 5. Frontend
echo "📦 Frontend yangilanmoqda..."
cd ${DEPLOY_DIR}/frontend

# Dependencies va build
echo "   Dependencies o'rnatilmoqda..."
npm install --silent || error_exit "npm install xatolik"

echo "   Frontend build qilinmoqda..."
export VITE_API_BASE_URL="https://${API_DOMAIN}/api/v1"
export VITE_MEDIA_URL="https://${API_DOMAIN}/media/"

npm run build || error_exit "Frontend build xatolik"

# Nginx static (ixtiyoriy): PHONIX_FRONTEND_WEB_ROOT=/var/www/ilmiyfaoliyat shaklida
if [ -n "${PHONIX_FRONTEND_WEB_ROOT:-}" ] && [ -d "dist" ]; then
    echo "   Static fayllar nginx papkasiga nusxalanmoqda: ${PHONIX_FRONTEND_WEB_ROOT}"
    sudo_cmd mkdir -p "${PHONIX_FRONTEND_WEB_ROOT}"
    sudo_cmd rsync -a --delete dist/ "${PHONIX_FRONTEND_WEB_ROOT}/" || error_exit "rsync static xatolik"
    if command -v nginx >/dev/null 2>&1; then
        sudo_cmd nginx -t 2>/dev/null && sudo_cmd systemctl reload nginx 2>/dev/null || true
    fi
fi

# Nginx frontend konfig (index.html cache yo'q — yangi dizayn tez ko'rinsin)
NGINX_FRONTEND_CONF="${DEPLOY_DIR}/infrastructure/nginx/phoenix-ilmiyfaoliyat-frontend.conf"
NGINX_FRONTEND_TARGET="/etc/nginx/sites-available/phoenix-ilmiyfaoliyat-frontend.conf"
if [ -f "${NGINX_FRONTEND_CONF}" ] && [ -d /etc/nginx/sites-available ]; then
    echo "   Nginx frontend konfig yangilanmoqda (index.html no-cache)..."
    sudo_cmd cp "${NGINX_FRONTEND_CONF}" "${NGINX_FRONTEND_TARGET}" 2>/dev/null || true
    if command -v nginx >/dev/null 2>&1; then
        sudo_cmd nginx -t 2>/dev/null && sudo_cmd systemctl reload nginx 2>/dev/null || true
    fi
fi

# Media himoyasi snippeti (api server bloki "include /etc/nginx/snippets/phoenix-media.conf;" qilsa ishlaydi)
NGINX_MEDIA_SNIPPET="${DEPLOY_DIR}/infrastructure/nginx/snippets/phoenix-media.conf"
if [ -f "${NGINX_MEDIA_SNIPPET}" ] && [ -d /etc/nginx ]; then
    sudo_cmd mkdir -p /etc/nginx/snippets
    sudo_cmd install -m 644 "${NGINX_MEDIA_SNIPPET}" /etc/nginx/snippets/phoenix-media.conf
    if grep -qs "phoenix-media.conf" /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf 2>/dev/null; then
        sudo_cmd nginx -t 2>/dev/null && sudo_cmd systemctl reload nginx 2>/dev/null || true
        # Nginx internal joy tayyor — fayllarni nginx bersin (Django oqimini band qilmasin)
        if [ -f "${DEPLOY_DIR}/backend/.env" ] && ! grep -q "^MEDIA_ACCEL_REDIRECT=" "${DEPLOY_DIR}/backend/.env"; then
            echo "MEDIA_ACCEL_REDIRECT=true" >> "${DEPLOY_DIR}/backend/.env"
        fi
        echo "   ✅ Media himoyasi nginx da yoqilgan"
    else
        echo "   ⚠️  Media himoyasi nginx da hali ULANMAGAN: api konfigidagi 'location /media/ {...}' o'rniga"
        echo "      'include /etc/nginx/snippets/phoenix-media.conf;' yozing (docs/OPERATIONS.md, 9-bo'lim)"
    fi
fi

echo "✅ Frontend yangilandi"
echo ""

# Fon xizmatlari (systemd): Celery worker, kunlik zaxira, antiplagiat indeksi, eslatmalar, monitoring.
# Yo'q bo'lsa o'rnatiladi va yoqiladi; mavjudiga (siz sozlagan bo'lishingiz mumkin) tegilmaydi.
# Hammasini repodagi namunaga qayta yozish: PHONIX_UPDATE_UNITS=true
install_phoenix_units() {
    [ -d /etc/systemd/system ] || return 0
    local svc_user svc_group changed=0
    svc_user=$(systemctl show -p User --value "${SERVICE_NAME}" 2>/dev/null || true)
    [ -n "$svc_user" ] || svc_user=$(stat -c %U "${DEPLOY_DIR}/backend" 2>/dev/null || echo deploy)
    svc_group=$(id -gn "$svc_user" 2>/dev/null || echo "$svc_user")
    for unit in phoenix-celery.service \
                phoenix-backup.service phoenix-backup.timer \
                phoenix-antiplag-index.service phoenix-antiplag-index.timer \
                phoenix-reminders.service phoenix-reminders.timer \
                phoenix-uptime.service phoenix-uptime.timer; do
        local src="${DEPLOY_DIR}/infrastructure/systemd/${unit}.example" dst="/etc/systemd/system/${unit}"
        [ -f "$src" ] || continue
        if [ -f "$dst" ] && [ "${PHONIX_UPDATE_UNITS:-false}" != "true" ]; then
            continue
        fi
        local tmp
        tmp=$(mktemp)
        sed -e "s#^User=.*#User=${svc_user}#" -e "s#^Group=.*#Group=${svc_group}#" \
            -e "s#/phonix/#${DEPLOY_DIR}/#g" "$src" > "$tmp"
        sudo_cmd install -m 644 "$tmp" "$dst"
        rm -f "$tmp"
        echo "   🔧 ${unit} o'rnatildi"
        changed=1
    done
    if [ "$changed" = "1" ]; then
        sudo_cmd systemctl daemon-reload
        for t in phoenix-backup.timer phoenix-antiplag-index.timer phoenix-reminders.timer phoenix-uptime.timer; do
            [ -f "/etc/systemd/system/$t" ] && sudo_cmd systemctl enable --now "$t" >/dev/null 2>&1 || true
        done
        [ -f /etc/systemd/system/phoenix-celery.service ] && sudo_cmd systemctl enable phoenix-celery >/dev/null 2>&1 || true
    fi
}
echo "🔧 Fon xizmatlari tekshirilmoqda..."
install_phoenix_units

# 6. Service restart (Graceful)
echo "🔄 Service restart qilinmoqda..."

# Graceful restart - avval reload, agar ishlamasa restart
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo "   Service reload qilinmoqda..."
    sudo_cmd systemctl reload ${SERVICE_NAME} 2>/dev/null || sudo_cmd systemctl restart ${SERVICE_NAME}
else
    echo "   Service start qilinmoqda..."
    sudo_cmd systemctl start ${SERVICE_NAME}
fi

# Celery worker (antiplagiat) — unit o'rnatilgan bo'lsa yangi kod bilan qayta ishga tushiriladi.
# O'rnatish: infrastructure/systemd/phoenix-celery.service.example
CELERY_SERVICE="phoenix-celery"
if systemctl list-unit-files 2>/dev/null | grep -q "^${CELERY_SERVICE}.service"; then
    echo "   Celery worker qayta ishga tushirilmoqda..."
    sudo_cmd systemctl restart ${CELERY_SERVICE} || echo "   ⚠️  ${CELERY_SERVICE} restart xato"
    sleep 3
    systemctl is-active --quiet ${CELERY_SERVICE} && echo "   ✅ Celery worker ishlayapti" \
        || echo "   ⚠️  Celery worker ishga tushmadi: journalctl -u ${CELERY_SERVICE} -n 50"
else
    echo "   ⚠️  ${CELERY_SERVICE} o'rnatilmagan — antiplagiat thread rejimida ishlaydi"
fi

# Service status
sleep 2
echo ""
echo "📊 Service status:"
sudo_cmd systemctl status ${SERVICE_NAME} --no-pager | head -15

# 6. Tekshirish
echo ""
echo "🔍 Tekshirishlar:"

# Service status
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo "✅ Service ishlayapti"
else
    echo "❌ Service ishlamayapti"
    error_exit "Service ishlamayapti"
fi

# Port tekshirish
if netstat -tlnp 2>/dev/null | grep -q ":${BACKEND_PORT} "; then
    echo "✅ Port ${BACKEND_PORT} ishlatilmoqda"
else
    echo "⚠️  Port ${BACKEND_PORT} bo'sh (service ishlamayotgan bo'lishi mumkin)"
fi

# API test
echo "   API test qilinmoqda..."
if curl -s -o /dev/null -w "%{http_code}" "https://${API_DOMAIN}/api/v1/" | grep -q "200\|404\|405"; then
    echo "✅ API javob berayapti"
else
    echo "⚠️  API javob bermayapti (Nginx yoki service muammosi bo'lishi mumkin)"
fi

# Health (loopback)
echo "   Health tekshiruvi (127.0.0.1:${BACKEND_PORT})..."
if curl -sf --max-time 5 "http://127.0.0.1:${BACKEND_PORT}/health/" >/dev/null; then
    echo "✅ /health/ OK"
else
    echo "⚠️  /health/ javob bermadi (port yoki gunicorn)"
fi
if code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:${BACKEND_PORT}/health/ready/"); then
    if [ "$code" = "200" ]; then
        echo "✅ /health/ready/ 200"
    else
        echo "⚠️  /health/ready/ HTTP $code (DB yoki Redis muammosi bo'lishi mumkin)"
    fi
else
    echo "⚠️  /health/ready/ so'rovi xato"
fi

# ============================================
# YAKUNIY XABAR
# ============================================

echo ""
echo "✅ Deployment muvaffaqiyatli yakunlandi!"
echo ""
echo "📝 Keyingi qadamlar:"
echo "   1. Logs tekshirish: sudo journalctl -u ${SERVICE_NAME} -f"
echo "   2. API test: curl https://${API_DOMAIN}/api/v1/"
echo "   3. Frontend test: curl https://${FRONTEND_DOMAIN}/"
echo "   4. Loopback port ${BACKEND_PORT}: phoenix-backend.service (gunicorn --bind) va nginx api proxy_pass mos kelishi kerak"
echo ""
echo "💾 Backup joylashuvi: ${DEPLOY_DIR}/backups/"
echo ""
