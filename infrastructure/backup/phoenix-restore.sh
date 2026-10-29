#!/bin/bash
# Phoenix — bazani zaxiradan tiklash.
#
#   phoenix-restore.sh /phonix/backups/db/daily/phoenix_20261010_023000.dump
#   phoenix-restore.sh tg:daily/phoenix_20261010_023000.dump.enc   # Telegram kanalidan (ro'yxat: tgstorage backup-list)
#
# DIQQAT: joriy bazadagi ma'lumotlar zaxiradagi holat bilan ALMASHTIRILADI.
# Tiklashdan oldin joriy holat ham avtomatik zaxiralanadi (pre-deploy papkasiga).
set -Eeuo pipefail

DUMP="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="${PHONIX_DIR:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
ENV_FILE="${ROOT}/backend/.env"
COMPOSE_PROD="${ROOT}/docker-compose.prod.yml"
# Docker (docker-compose.prod.yml): baza — db konteyneri, manage.py — web konteyneri, zaxiralar — backend/backups
DOCKER_DB=""
if [ -f "$COMPOSE_PROD" ] && command -v docker >/dev/null 2>&1; then
    DOCKER_DB="$(docker compose -f "$COMPOSE_PROD" ps -q db 2>/dev/null || true)"
fi
PG_CONTAINER="${PHONIX_PG_CONTAINER:-${DOCKER_DB:-phoenix-postgres}}"
if [ -n "$DOCKER_DB" ]; then DEF_BACKUP_ROOT="${ROOT}/backend/backups"; else DEF_BACKUP_ROOT="${ROOT}/backups"; fi
BACKUP_ROOT="${PHONIX_BACKUP_DIR:-$DEF_BACKUP_ROOT}"

# Telegram'dagi zaxira: avval yuklab olinadi va deshifrlanadi (TG_BACKUP_PASSPHRASE_FILE kerak)
if [[ "$DUMP" == tg:* ]]; then
    TG_NAME="${DUMP#tg:}"
    OUT="${BACKUP_ROOT}/db/restored/$(basename "${TG_NAME%.enc}")"
    echo "Telegram'dan yuklab olinmoqda: ${TG_NAME}"
    if [ -n "$DOCKER_DB" ]; then
        mkdir -p "$(dirname "$OUT")"
        docker compose -f "$COMPOSE_PROD" exec -T web python manage.py tgstorage backup-download "$TG_NAME" \
            "${OUT/#${ROOT}\/backend\//\/app\/}"
    else
        (cd "${ROOT}/backend" && DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-config.settings}" \
            "${ROOT}/backend/venv/bin/python" manage.py tgstorage backup-download "$TG_NAME" "$OUT")
    fi
    DUMP="$OUT"
fi

if [ -z "$DUMP" ] || [ ! -s "$DUMP" ]; then
    echo "Foydalanish: $0 <dump fayl>" >&2
    echo "Mavjud zaxiralar:" >&2
    ls -1t "${BACKUP_ROOT}"/db/*/*.dump 2>/dev/null | head -n 15 >&2 || true
    echo "Telegram'dagilar: python manage.py tgstorage backup-list" >&2
    exit 2
fi

env_get() {
    local key="$1" default="${2:-}" val=""
    [ -f "$ENV_FILE" ] && val=$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//')
    echo "${val:-$default}"
}
DB_NAME="$(env_get DB_NAME phoenix_scientific)"
DB_USER="$(env_get DB_USER postgres)"
DB_PASSWORD="$(env_get DB_PASSWORD)"
DB_HOST="$(env_get DB_HOST localhost)"
DB_PORT="$(env_get DB_PORT 5432)"

echo "Baza: ${DB_NAME}"
echo "Zaxira: ${DUMP} ($(du -h "$DUMP" | cut -f1))"
read -r -p "Joriy ma'lumotlar zaxiradagi holat bilan almashtiriladi. Davom etish uchun 'TIKLASH' deb yozing: " answer
[ "$answer" = "TIKLASH" ] || { echo "Bekor qilindi."; exit 1; }

echo "1/3 Joriy holat zaxiralanmoqda..."
bash "${SCRIPT_DIR}/phoenix-backup.sh" pre-deploy

echo "2/3 Backend to'xtatilmoqda..."
if [ -n "$DOCKER_DB" ]; then
    docker compose -f "$COMPOSE_PROD" stop web celery bot
else
    sudo systemctl stop phoenix-backend phoenix-celery 2>/dev/null || true
fi

echo "3/3 Tiklanmoqda..."
if [ -n "$DOCKER_DB" ] || { command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; }; then
    docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
        pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner < "$DUMP"
else
    PGPASSWORD="$DB_PASSWORD" pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --clean --if-exists --no-owner "$DUMP"
fi

if [ -n "$DOCKER_DB" ]; then
    docker compose -f "$COMPOSE_PROD" start web celery bot
else
    sudo systemctl start phoenix-backend 2>/dev/null || true
    sudo systemctl start phoenix-celery 2>/dev/null || true
fi
echo "✅ Tiklandi. Saytni tekshiring."
echo "ℹ️  Antiplagiat barmoq izlari zaxiraga kirmaydi — indeksni qayta quring (fonda, uzoq davom etadi):"
if [ -n "$DOCKER_DB" ]; then
    echo "   cd ${ROOT} && docker compose -f docker-compose.prod.yml exec -d web python manage.py build_antiplag_index"
else
    echo "   cd ${ROOT}/backend && nohup venv/bin/python manage.py build_antiplag_index > /tmp/phonix_antiplag_index.log 2>&1 &"
fi
