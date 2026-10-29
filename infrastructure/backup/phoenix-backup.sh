#!/bin/bash
# Phoenix — ma'lumotlar bazasi va media fayllar zaxirasi.
#
#   phoenix-backup.sh daily        # kunlik (timer chaqiradi): baza + media ko'zgusi + (ixtiyoriy) bulutga
#   phoenix-backup.sh pre-deploy   # deploy_phonix.sh migratsiyadan oldin chaqiradi: faqat baza
#
# Sozlamalar (muhit o'zgaruvchilari yoki backend/.env):
#   PHONIX_DIR                               loyiha papkasi (default: skript joylashgan repo ildizi)
#   PHONIX_BACKUP_DIR                        zaxiralar papkasi (default: <repo>/backups; Docker'da <repo>/backend/backups
#                                            — web konteyneri ham ko'rishi uchun, u yerdan Telegram'ga yuboriladi)
# Docker (docker-compose.prod.yml) avtomatik aniqlanadi: baza — db konteyneri, manage.py — web konteyneri.
#   PHONIX_BACKUP_KEEP_DAILY=14              nechta kunlik dump saqlansin
#   PHONIX_BACKUP_KEEP_WEEKLY=8              nechta haftalik dump saqlansin
#   PHONIX_BACKUP_KEEP_PREDEPLOY=10          nechta deploy oldi dump saqlansin
#   PHONIX_BACKUP_RCLONE_REMOTE=gdrive:phoenix-backups   ixtiyoriy: rclone orqali boshqa joyga nusxa
#   PHONIX_BACKUP_EXCLUDE_ANTIPLAG_INDEX=true            antiplagiat barmoq izlari dumpga kirmaydi (eng katta jadval;
#                                                        tiklangach: python manage.py build_antiplag_index)
#   TG_STORAGE_BACKUP_ENABLED=true          kunlik dump shifrlanib Telegram kanaliga yuboriladi (apps/tgstorage);
#                                           serverda standart 3 ta kunlik / 3 ta deploy oldi dump qoladi
#   TG_STORAGE_MEDIA_ENABLED=true           media nusxasi Telegram'da — serverdagi media-mirror ko'zgusi yuritilmaydi
#   TELEGRAM_BOT_TOKEN + PHONIX_ALERT_CHAT_ID           ixtiyoriy: xato bo'lsa Telegram'ga xabar
#
# Tiklash: infrastructure/backup/phoenix-restore.sh <dump fayl>
set -Eeuo pipefail

MODE="${1:-daily}"
ROOT="${PHONIX_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
ENV_FILE="${ROOT}/backend/.env"
COMPOSE_PROD="${ROOT}/docker-compose.prod.yml"

# Docker: docker-compose.prod.yml bor va db konteyneri ishlayapti
DOCKER_DB=""
if [ -f "$COMPOSE_PROD" ] && command -v docker >/dev/null 2>&1; then
    DOCKER_DB="$(docker compose -f "$COMPOSE_PROD" ps -q db 2>/dev/null || true)"
fi

# .env dan qiymat o'qish (faylni bajarmasdan — xavfsiz)
env_get() {
    local key="$1" default="${2:-}" val=""
    if [ -f "$ENV_FILE" ]; then
        val=$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' -e 's/[[:space:]]*$//')
    fi
    echo "${val:-$default}"
}

if [ -n "$DOCKER_DB" ]; then DEF_BACKUP_ROOT="${ROOT}/backend/backups"; else DEF_BACKUP_ROOT="${ROOT}/backups"; fi
BACKUP_ROOT="${PHONIX_BACKUP_DIR:-$(env_get PHONIX_BACKUP_DIR "$DEF_BACKUP_ROOT")}"
TG_BACKUP="$(env_get TG_STORAGE_BACKUP_ENABLED false)"
TG_MEDIA="$(env_get TG_STORAGE_MEDIA_ENABLED false)"
is_true() { case "${1,,}" in 1|true|yes|on) return 0 ;; *) return 1 ;; esac; }
# Zaxiralar Telegram'da bo'lsa serverda ozroq nusxa yetadi (haftaliklar faqat kanalda)
if is_true "$TG_BACKUP"; then
    DEF_DAILY=3; DEF_WEEKLY=0; DEF_PREDEPLOY=3
else
    DEF_DAILY=14; DEF_WEEKLY=8; DEF_PREDEPLOY=10
fi
KEEP_DAILY="${PHONIX_BACKUP_KEEP_DAILY:-$(env_get PHONIX_BACKUP_KEEP_DAILY $DEF_DAILY)}"
KEEP_WEEKLY="${PHONIX_BACKUP_KEEP_WEEKLY:-$(env_get PHONIX_BACKUP_KEEP_WEEKLY $DEF_WEEKLY)}"
KEEP_PREDEPLOY="${PHONIX_BACKUP_KEEP_PREDEPLOY:-$(env_get PHONIX_BACKUP_KEEP_PREDEPLOY $DEF_PREDEPLOY)}"
EXCLUDE_INDEX="${PHONIX_BACKUP_EXCLUDE_ANTIPLAG_INDEX:-$(env_get PHONIX_BACKUP_EXCLUDE_ANTIPLAG_INDEX true)}"
RCLONE_REMOTE="${PHONIX_BACKUP_RCLONE_REMOTE:-$(env_get PHONIX_BACKUP_RCLONE_REMOTE)}"
TG_TOKEN="${TELEGRAM_BOT_TOKEN:-$(env_get TELEGRAM_BOT_TOKEN)}"
TG_CHAT="${PHONIX_ALERT_CHAT_ID:-$(env_get PHONIX_ALERT_CHAT_ID)}"

DB_NAME="$(env_get DB_NAME phoenix_scientific)"
DB_USER="$(env_get DB_USER postgres)"
DB_PASSWORD="$(env_get DB_PASSWORD)"
DB_HOST="$(env_get DB_HOST localhost)"
DB_PORT="$(env_get DB_PORT 5432)"
PG_CONTAINER="${PHONIX_PG_CONTAINER:-${DOCKER_DB:-phoenix-postgres}}"
# Bot local Bot API serverda ishlaydi (Docker) — cloud API'ga so'rov uni u yerdan chiqarib yuboradi
if [ -n "$DOCKER_DB" ]; then TG_API="http://127.0.0.1:8081"; else TG_API="$(env_get TELEGRAM_API_BASE_URL https://api.telegram.org)"; fi

log() { echo "[$(date '+%F %T')] $*"; }

# Barmoq izlari (millionlab qator) build_antiplag_index bilan qayta quriladi — dumpga faqat jadval tuzilishi kiradi
PG_DUMP_ARGS=(-Fc --no-owner)
if is_true "$EXCLUDE_INDEX"; then
    PG_DUMP_ARGS+=(--exclude-table-data=articles_antiplagfingerprint --exclude-table-data=articles_antiplagindexeddocument)
fi

manage() {
    if [ -n "$DOCKER_DB" ]; then
        # Host yo'li (<repo>/backend/...) konteynerda /app/...
        local args=() a
        for a in "$@"; do args+=("${a/#${ROOT}\/backend\//\/app\/}"); done
        docker compose -f "$COMPOSE_PROD" exec -T web python manage.py "${args[@]}"
    else
        (cd "${ROOT}/backend" && DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings}" \
            "${ROOT}/backend/venv/bin/python" manage.py "$@")
    fi
}

alert() {
    local text="$1"
    if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ] && command -v curl >/dev/null 2>&1; then
        curl -fsS -m 15 "${TG_API}/bot${TG_TOKEN}/sendMessage" \
            --data-urlencode "chat_id=${TG_CHAT}" --data-urlencode "text=${text}" >/dev/null || true
    fi
}

on_error() {
    log "XATO: zaxira yakunlanmadi (${MODE})"
    find "${BACKUP_ROOT}/db" -name '*.dump.part' -delete 2>/dev/null || true
    alert "⚠️ Phoenix: ${MODE} zaxira XATO bilan tugadi ($(hostname), $(date '+%F %T')). journalctl -u phoenix-backup yoki /var/log/phoenix-backup.log ni tekshiring."
}
trap on_error ERR

use_container() {
    [ -n "$DOCKER_DB" ] && return 0
    command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"
}

pg_dump_to() {
    local out="$1"
    if use_container; then
        docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
            pg_dump -U "$DB_USER" -d "$DB_NAME" "${PG_DUMP_ARGS[@]}" > "$out"
    else
        PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "${PG_DUMP_ARGS[@]}" > "$out"
    fi
}

verify_dump() {
    local f="$1"
    [ -s "$f" ] || { log "Dump bo'sh: $f"; return 1; }
    # Dump ichidagi jadvallar ro'yxati o'qiladi — fayl buzilmaganini tekshiradi
    if use_container; then
        docker exec -i "$PG_CONTAINER" pg_restore --list < "$f" > /dev/null
    elif command -v pg_restore >/dev/null 2>&1; then
        pg_restore --list "$f" > /dev/null
    fi
}

rotate() {
    local dir="$1" keep="$2"
    [ -d "$dir" ] || return 0
    # Eng yangilari qoladi
    ls -1t "$dir"/*.dump 2>/dev/null | tail -n +"$((keep + 1))" | while read -r old; do
        rm -f -- "$old"
        log "O'chirildi (eski): $old"
    done
}

dump_db() {
    local sub="$1" keep="$2"
    local dir="${BACKUP_ROOT}/db/${sub}"
    mkdir -p "$dir"
    chmod 700 "${BACKUP_ROOT}" "${BACKUP_ROOT}/db" "$dir" 2>/dev/null || true
    local file="${dir}/phoenix_$(date +%Y%m%d_%H%M%S).dump"
    log "Baza zaxiralanmoqda: ${DB_NAME} → ${file}"
    pg_dump_to "${file}.part"
    verify_dump "${file}.part"
    mv "${file}.part" "$file"
    chmod 600 "$file"
    log "Tayyor: $(du -h "$file" | cut -f1)"
    rotate "$dir" "$keep"
    LAST_DUMP="$file"
}

mkdir -p "$BACKUP_ROOT"

case "$MODE" in
    pre-deploy)
        dump_db pre-deploy "$KEEP_PREDEPLOY"
        ;;
    daily)
        dump_db daily "$KEEP_DAILY"
        # Yakshanba — haftalik nusxa (uzoqroq saqlanadi)
        LABEL=daily
        if [ "$(date +%u)" = "7" ]; then
            LABEL=weekly
            if [ "$KEEP_WEEKLY" -gt 0 ]; then
                mkdir -p "${BACKUP_ROOT}/db/weekly"
                cp -p "$LAST_DUMP" "${BACKUP_ROOT}/db/weekly/"
                rotate "${BACKUP_ROOT}/db/weekly" "$KEEP_WEEKLY"
            fi
        fi
        # Telegram kanaliga (shifrlangan, 2 GB dan katta bo'lsa bo'laklab). Xato bo'lsa — lokal dump baribir bor
        if is_true "$TG_BACKUP"; then
            log "Telegram'ga yuborilmoqda (${LABEL})..."
            if manage tgstorage backup-upload "$LAST_DUMP" --label "$LABEL"; then
                manage tgstorage backup-prune || true
            else
                log "XATO: zaxira Telegram'ga yuborilmadi"
                alert "⚠️ Phoenix: zaxira Telegram kanaliga yuborilmadi ($(hostname), $(date '+%F %T')). Lokal nusxa: ${LAST_DUMP}."
            fi
        fi
        # Media: Telegram'da saqlansa server ko'zgusi kerak emas — faqat yuborilmaganlar yuboriladi
        if is_true "$TG_MEDIA"; then
            log "Media: Telegram bilan sinxronlash..."
            manage tgstorage sync || alert "⚠️ Phoenix: media Telegram bilan sinxronlanmadi ($(hostname))"
        # Media: o'chirilgan fayllar ham 30 kun saqlanadi (--backup), tasodifiy o'chirishdan himoya
        elif [ -d "${ROOT}/backend/media" ] && command -v rsync >/dev/null 2>&1; then
            log "Media ko'zgusi yangilanmoqda..."
            mkdir -p "${BACKUP_ROOT}/media-mirror" "${BACKUP_ROOT}/media-deleted"
            rsync -a --delete --backup --backup-dir="${BACKUP_ROOT}/media-deleted/$(date +%Y%m%d)" \
                "${ROOT}/backend/media/" "${BACKUP_ROOT}/media-mirror/"
            find "${BACKUP_ROOT}/media-deleted" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true
        elif [ -d "${ROOT}/backend/media" ]; then
            # rsync o'rnatilmagan bo'lsa — yangi/o'zgargan fayllar nusxalanadi (o'chirilganlar ko'zguda qoladi)
            log "Media ko'zgusi (cp) yangilanmoqda... (rsync o'rnatsangiz tezroq: sudo apt install rsync)"
            mkdir -p "${BACKUP_ROOT}/media-mirror"
            cp -a -u "${ROOT}/backend/media/." "${BACKUP_ROOT}/media-mirror/"
        fi
        # Boshqa joyga nusxa (server diski buzilsa ham ma'lumot qoladi)
        if [ -n "$RCLONE_REMOTE" ] && command -v rclone >/dev/null 2>&1; then
            log "Bulutga nusxa: ${RCLONE_REMOTE}"
            rclone copy "${BACKUP_ROOT}/db" "${RCLONE_REMOTE}/db" --max-age 48h
            if ! is_true "$TG_MEDIA" && [ -d "${BACKUP_ROOT}/media-mirror" ]; then
                rclone sync "${BACKUP_ROOT}/media-mirror" "${RCLONE_REMOTE}/media"
            fi
        fi
        ;;
    *)
        echo "Foydalanish: $0 [daily|pre-deploy]" >&2
        exit 2
        ;;
esac

log "Zaxira yakunlandi (${MODE})"
