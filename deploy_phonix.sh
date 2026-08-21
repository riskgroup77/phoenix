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
        git fetch origin master 2>/dev/null || git fetch origin main
        git reset --hard origin/master 2>/dev/null || git reset --hard origin/main
        if [ -f /tmp/.env.phonix.bak ]; then
            cp -a /tmp/.env.phonix.bak backend/.env
            echo "   backend/.env tiklandi"
        fi
    else
        echo "   Git pull qilinmoqda..."
        git stash 2>/dev/null || true
        git pull origin master || git pull origin main || error_exit "Git pull xatolik"
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
create_backup() {
    echo "💾 Backup yaratish..."
    
    BACKUP_DIR="${DEPLOY_DIR}/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p ${BACKUP_DIR}
    
    # Backend backup
    if [ -d "${DEPLOY_DIR}/backend" ]; then
        echo "📦 Backend backup..."
        cp -r ${DEPLOY_DIR}/backend ${BACKUP_DIR}/backend 2>/dev/null || true
    fi
    
    # Frontend backup
    if [ -d "${DEPLOY_DIR}/frontend" ]; then
        echo "📦 Frontend backup..."
        cp -r ${DEPLOY_DIR}/frontend ${BACKUP_DIR}/frontend 2>/dev/null || true
    fi
    
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
else
    echo "   Monorepo clone qilinmoqda..."
    cd /
    [ -d "${DEPLOY_DIR}" ] && rm -rf "${DEPLOY_DIR}"
    git clone ${MONO_REPO} ${DEPLOY_DIR} || error_exit "Monorepo clone xatolik"
    cd ${DEPLOY_DIR}
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

# Migrations
echo "   Migrations ishga tushirilmoqda..."
python manage.py migrate --noinput || error_exit "Migrations xatolik"

# Demo foydalanuvchilar, operator va Django admin parollarini tiklash
echo "   Demo foydalanuvchilar va operator tiklanmoqda..."
python manage.py setup_demo_and_admin || echo "   ⚠️  setup_demo_and_admin xato (deploy davom etadi)"

echo "   Kitob nashr tranzaksiyalarini tiklash..."
python manage.py repair_book_publications || echo "   ⚠️  repair_book_publications xato (deploy davom etadi)"

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
    mkdir -p "${PHONIX_FRONTEND_WEB_ROOT}"
    rsync -a --delete dist/ "${PHONIX_FRONTEND_WEB_ROOT}/" || error_exit "rsync static xatolik"
    if command -v nginx >/dev/null 2>&1; then
        sudo_cmd nginx -t 2>/dev/null && sudo_cmd systemctl reload nginx 2>/dev/null || true
    fi
fi

echo "✅ Frontend yangilandi"
echo ""

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
