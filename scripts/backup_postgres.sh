#!/usr/bin/env bash
# PostgreSQL zaxira: serverda cron bilan kuniga 1 marta ishga tushiring.
# Foydalanish: DB_NAME DB_USER export qiling yoki .env dan o'qing.
set -euo pipefail
: "${DB_NAME:=phoenix_scientific}"
: "${DB_USER:=postgres}"
: "${BACKUP_DIR:=/var/backups/phoenix}"
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"
pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$OUT"
echo "Backup yozildi: $OUT"
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +14 -delete 2>/dev/null || true
