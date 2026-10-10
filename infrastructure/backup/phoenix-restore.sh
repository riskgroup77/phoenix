#!/bin/bash
# Phoenix — bazani zaxiradan tiklash.
#
#   phoenix-restore.sh /phonix/backups/db/daily/phoenix_20261010_023000.dump
#
# DIQQAT: joriy bazadagi ma'lumotlar zaxiradagi holat bilan ALMASHTIRILADI.
# Tiklashdan oldin joriy holat ham avtomatik zaxiralanadi (pre-deploy papkasiga).
set -Eeuo pipefail

DUMP="${1:-}"
ROOT="${PHONIX_DIR:-/phonix}"
ENV_FILE="${ROOT}/backend/.env"
PG_CONTAINER="${PHONIX_PG_CONTAINER:-phoenix-postgres}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "$DUMP" ] || [ ! -s "$DUMP" ]; then
    echo "Foydalanish: $0 <dump fayl>" >&2
    echo "Mavjud zaxiralar:" >&2
    ls -1t "${PHONIX_BACKUP_DIR:-${ROOT}/backups}"/db/*/*.dump 2>/dev/null | head -n 15 >&2 || true
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
sudo systemctl stop phoenix-backend phoenix-celery 2>/dev/null || true

echo "3/3 Tiklanmoqda..."
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
    docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$PG_CONTAINER" \
        pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner < "$DUMP"
else
    PGPASSWORD="$DB_PASSWORD" pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --clean --if-exists --no-owner "$DUMP"
fi

sudo systemctl start phoenix-backend 2>/dev/null || true
sudo systemctl start phoenix-celery 2>/dev/null || true
echo "✅ Tiklandi. Saytni tekshiring."
