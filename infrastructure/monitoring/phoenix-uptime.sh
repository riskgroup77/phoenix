#!/bin/bash
# Phoenix — monitoring (har 5 daqiqada phoenix-uptime.timer chaqiradi).
# Muammo topilsa yoki tiklansa — Telegram'ga xabar (bir xil ogohlantirish takrorlanmaydi, 6 soatda eslatma).
#
# backend/.env:
#   TELEGRAM_BOT_TOKEN=...          (bot allaqachon bor)
#   PHONIX_ALERT_CHAT_ID=...        xabar boradigan chat/guruh ID (botga /start yozib, @userinfobot dan ID oling)
#   PHONIX_MONITOR_URLS=https://api.ilmiyfaoliyat.uz/health/ready/,https://ilmiyfaoliyat.uz/   (ixtiyoriy)
#   PHONIX_MONITOR_DISK_PCT=90      disk band ulushi chegarasi (%)
#   PHONIX_MONITOR_BACKUP_HOURS=36  oxirgi kunlik zaxira shu soatdan eski bo'lsa — ogohlantirish
#   PHONIX_MONITOR_CERT_DAYS=14     SSL sertifikati tugashiga shu kun qolsa — ogohlantirish
set -uo pipefail

ROOT="${PHONIX_DIR:-/phonix}"
ENV_FILE="${ROOT}/backend/.env"
STATE_DIR="${PHONIX_MONITOR_STATE:-/var/tmp/phoenix-monitor}"
mkdir -p "$STATE_DIR"

env_get() {
    local key="$1" default="${2:-}" val=""
    [ -f "$ENV_FILE" ] && val=$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' -e 's/[[:space:]]*$//')
    echo "${val:-$default}"
}

TG_TOKEN="$(env_get TELEGRAM_BOT_TOKEN)"
TG_CHAT="$(env_get PHONIX_ALERT_CHAT_ID)"
URLS="$(env_get PHONIX_MONITOR_URLS 'https://api.ilmiyfaoliyat.uz/health/ready/,https://ilmiyfaoliyat.uz/')"
DISK_PCT="$(env_get PHONIX_MONITOR_DISK_PCT 90)"
BACKUP_HOURS="$(env_get PHONIX_MONITOR_BACKUP_HOURS 36)"
CERT_DAYS="$(env_get PHONIX_MONITOR_CERT_DAYS 14)"
BACKUP_ROOT="$(env_get PHONIX_BACKUP_DIR "${ROOT}/backups")"
HOST="$(hostname)"

send() {
    if [ -n "$TG_TOKEN" ] && [ -n "$TG_CHAT" ]; then
        curl -fsS -m 15 "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
            --data-urlencode "chat_id=${TG_CHAT}" --data-urlencode "text=$1" >/dev/null 2>&1 || true
    fi
    echo "$1"
}

# check <kalit> <muammo matni yoki bo'sh>
check() {
    local key="$1" problem="$2" f="${STATE_DIR}/${1}.down"
    if [ -n "$problem" ]; then
        if [ ! -f "$f" ] || [ "$(find "$f" -mmin +360 2>/dev/null)" ]; then
            send "🔴 Phoenix (${HOST}): ${problem}"
            echo "$problem" > "$f"
        fi
    elif [ -f "$f" ]; then
        send "🟢 Phoenix (${HOST}): tiklandi — $(cat "$f")"
        rm -f "$f"
    fi
}

# 1) Sayt va API javob beryaptimi (2 urinish — qisqa uzilishlarda yolg'on signal bermasin)
IFS=',' read -r -a url_list <<< "$URLS"
for url in "${url_list[@]}"; do
    url="$(echo "$url" | xargs)"
    [ -n "$url" ] || continue
    key="url_$(echo "$url" | md5sum | cut -c1-10)"
    code=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$url" || echo 000)
    if [ "$code" != "200" ]; then
        sleep 15
        code=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$url" || echo 000)
    fi
    [ "$code" = "200" ] && check "$key" "" || check "$key" "${url} javob bermayapti (HTTP ${code})"
done

# 2) Disk
used=$(df -P "$ROOT" 2>/dev/null | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ -n "$used" ] && [ "$used" -ge "$DISK_PCT" ]; then
    check disk "disk ${used}% band (${ROOT}). Eski zaxira/loglarni tozalang."
else
    check disk ""
fi

# 3) Oxirgi kunlik zaxira
latest=$(ls -1t "${BACKUP_ROOT}"/db/daily/*.dump 2>/dev/null | head -n 1)
if [ -z "$latest" ]; then
    check backup "kunlik baza zaxirasi topilmadi (${BACKUP_ROOT}/db/daily). phoenix-backup.timer ishlayaptimi?"
elif [ "$(find "$latest" -mmin +"$((BACKUP_HOURS * 60))" 2>/dev/null)" ]; then
    check backup "oxirgi baza zaxirasi ${BACKUP_HOURS} soatdan eski: $(basename "$latest")"
else
    check backup ""
fi

# 4) Xizmatlar
for svc in phoenix-backend phoenix-celery; do
    if systemctl list-unit-files 2>/dev/null | grep -q "^${svc}.service"; then
        systemctl is-active --quiet "$svc" && check "svc_${svc}" "" || check "svc_${svc}" "${svc} xizmati ishlamayapti"
    fi
done

# 5) SSL sertifikatlari
for url in "${url_list[@]}"; do
    hostpart=$(echo "$url" | sed -E 's#^https://([^/:]+).*#\1#')
    [[ "$url" == https://* ]] || continue
    end=$(echo | timeout 15 openssl s_client -servername "$hostpart" -connect "${hostpart}:443" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    [ -n "$end" ] || continue
    days=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))
    if [ "$days" -lt "$CERT_DAYS" ]; then
        check "cert_${hostpart}" "${hostpart} SSL sertifikati ${days} kunda tugaydi (certbot renew)"
    else
        check "cert_${hostpart}" ""
    fi
done

exit 0
