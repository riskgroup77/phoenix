#!/usr/bin/env bash
# api.ilmiyfaoliyat.uz — ERR_CERT_COMMON_NAME_INVALID uchun:
# Let's Encrypt papkasi (masalan api.ilmiyfaoliyat.uz-0001) va nginx ssl_certificate yo'llarini moslashtirish.
#
# Ishlatish: sudo bash fix-api-ilmiyfaoliyat-ssl.sh
set -euo pipefail

if [[ ${EUID:-0} -ne 0 ]]; then
  echo "sudo bilan ishga tushiring"
  exit 1
fi

echo "=== Let's Encrypt: api domeni ==="
mapfile -t LE_DIRS < <(ls -d /etc/letsencrypt/live/api.ilmiyfaoliyat.uz* 2>/dev/null || true)
if [[ ${#LE_DIRS[@]} -eq 0 ]]; then
  echo "Sertifikat papkasi topilmadi. Avval:"
  echo "  certbot certonly --nginx -d api.ilmiyfaoliyat.uz"
  exit 1
fi
LE="${LE_DIRS[0]}"
echo "Papka: $LE"
test -f "$LE/fullchain.pem" && test -f "$LE/privkey.pem" || { echo "fullchain/privkey yo'q"; exit 1; }

echo "=== Nginx: api.ilmiyfaoliyat.uz konfig ==="
mapfile -t CFGS < <(grep -rl 'server_name api\.ilmiyfaoliyat\.uz' /etc/nginx/sites-enabled/ 2>/dev/null || true)
if [[ ${#CFGS[@]} -eq 0 ]]; then
  echo "sites-enabled da api.ilmiyfaoliyat.uz topilmadi."
  exit 1
fi
CFG="${CFGS[0]}"
echo "Fayl: $CFG"

echo "=== Hozirgi ssl_certificate ==="
grep -nE 'ssl_certificate|ssl_certificate_key' "$CFG" || true

BACK="${CFG}.bak.$(date +%Y%m%d%H%M%S)"
cp -a "$CFG" "$BACK"
echo "Zaxira: $BACK"

# Bitta zaxira yo'li: /etc/letsencrypt/live/api.ilmiyfaoliyat.uz-0001/ kabi
sed -i "s|/etc/letsencrypt/live/api\.ilmiyfaoliyat\.uz[^/]*/|${LE}/|g" "$CFG"

echo "=== Yangilangan ==="
grep -nE 'ssl_certificate|ssl_certificate_key' "$CFG" || true

nginx -t
systemctl reload nginx

echo ""
echo "Tekshirish (SAN/CN api.ilmiyfaoliyat.uz bo'lishi kerak):"
echo | openssl s_client -connect api.ilmiyfaoliyat.uz:443 -servername api.ilmiyfaoliyat.uz 2>/dev/null \
  | openssl x509 -noout -subject -ext subjectAltName 2>/dev/null || true
echo OK
