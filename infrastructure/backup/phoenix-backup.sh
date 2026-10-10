#!/bin/bash
# Phoenix — ma'lumotlar bazasi va media fayllar zaxirasi.
#
#   phoenix-backup.sh daily        # kunlik (timer chaqiradi): baza + media ko'zgusi + (ixtiyoriy) bulutga
#   phoenix-backup.sh pre-deploy   # deploy_phonix.sh migratsiyadan oldin chaqiradi: faqat baza
#
# Sozlamalar (muhit o'zgaruvchilari yoki backend/.env):
#   PHONIX_DIR=/phonix                       loyiha papkasi
#   PHONIX_BACKUP_DIR=/phonix/backups        zaxiralar papkasi (boshqa diskda bo'lsa yanada yaxshi)
#   PHONIX_BACKUP_KEEP_DAILY=14              nechta kunlik dump saqlansin
#   PHONIX_BACKUP_KEEP_WEEKLY=8              nechta haftalik dump saqlansin
#   PHONIX_BACKUP_KEEP_PREDEPLOY=10          nechta deploy oldi dump saqlansin
#   PHONIX_BACKUP_RCLONE_REMOTE=gdrive:phoenix-backups   ixtiyoriy: rclone orqali boshqa joyga nusxa
#   TELEGRAM_BOT_TOKEN + PHONIX_ALERT_CHAT_ID           ixtiyoriy: xato bo'lsa Telegram'ga xabar
#
# Tiklash: infrastructure/backup/phoenix-restore.sh <dump fayl>
set -Eeuo pipefail

MODE="${1:-daily}"
ROOT="${PHONIX_DIR:-/phonix}"
ENV_FILE="${ROOT}/backend/.env"

# .env dan qiymat o'qish (faylni bajarmasdan — xavfsiz)
env_get() {
    local key="$1" default="${2:-}" val=""
    if [ -f "$ENV_FILE" ]; then
        val=$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' -e 's/[[:space:]]*$//')
    fi
    echo "${val:-$default}"
}

BACKUP_ROOT="${PHONIX_BACKUP_DIR:-$(env_get PHONIX_BACKUP_DIR "${ROOT}/backups")}"
KEEP_DAILY="${PHONIX_BACKUP_KEEP_DAILY:-$(env_get PHONIX_BACKUP_KEEP_DAILY 14)}"
KEEP_WEEKLY="${PHONIX_BACKUP_KEEP_WEEKLY:-$(env_get PHONIX_BACKUP_KEEP_WEEKLY 8)}"
KEEP_PREDEPLOY="${PHONIX_BACKUP_KEEP_PREDEPLOY:-$(env_get PHONIX_BACKUP_KEEP_PREDEPLOY 10)}"
RCLONE_REMOTE="${PHONIX_BACKUP_RCLONE_REMOTE:-$(env_get PHONIX_BACKUP_RCLONE_REMOTE)}"
TG_TOKEN="${TELEGRAM_BOT_TOKEN:-$(env_get TELEGRAM_BOT_TOKEN)}"
TG_CHAT="${PHONIX_ALERT_CHAT_ID:-$(env_get PHONIX_ALERT_CHAT_ID)}"

DB_NAME="$(env_get DB_NAME phoenix_scientific)"
DB_USER="$(env_get DB_USER postgres)"
DB_PASSWORD="$(env_get DB_PASSWORD)"
DB_HOST="$(env_get DB_HOST localhost)"
DB_PORT="$(env_get DB_PORT 5432)"
PG_CONTAINER="${PHONIX_PG_CONTAINER:-phoenix-postgres}"

log() { echo "[$(date '+%F %T')] $*"; }

alert() {
    local text="$1"
    if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ] && command -v curl >/dev/null 2>&1; then
        curl -fsS -m 15 "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
            --data-urlencode "chat_id=${TG_CHAT}" --data-urlencode "text=${text}" >/dev/null || true
    fi
}

on_error() {
    log "XATO: zaxira yakunlanmadi (${MODE})"
    find "${BACKUP_ROOT}/db" -name '*.dump.part' -delete 2>/dev/null || true
    alert "⚠️ Phoenix: ${MODE} zaxira XATO bilan tugadi ($(hostname), $(date '+%F %T')). journalctl -u phoenix-backup ni tekshiring."
}
trap on_error ERR

use_container() {
    command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"
}

pg_dump_to() {
    local out="$1"
    if use_container; then
        docker exec -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
            pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner > "$out"
    else
        PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner > "$out"
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
        if [ "$(date +%u)" = "7" ]; then
            mkdir -p "${BACKUP_ROOT}/db/weekly"
            cp -p "$LAST_DUMP" "${BACKUP_ROOT}/db/weekly/"
            rotate "${BACKUP_ROOT}/db/weekly" "$KEEP_WEEKLY"
        fi
        # Media: o'chirilgan fayllar ham 30 kun saqlanadi (--backup), tasodifiy o'chirishdan himoya
        if [ -d "${ROOT}/backend/media" ] && command -v rsync >/dev/null 2>&1; then
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
            rclone sync "${BACKUP_ROOT}/media-mirror" "${RCLONE_REMOTE}/media"
        fi
        ;;
    *)
        echo "Foydalanish: $0 [daily|pre-deploy]" >&2
        exit 2
        ;;
esac

log "Zaxira yakunlandi (${MODE})"
