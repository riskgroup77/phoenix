#!/usr/bin/env bash
#
# SERVERDA BIR MARTA: Phoenix API api.ilmiyfaoliyat.uz — SSL + symlink + nginx reload
#
# Muammo 1: api-ilmiyfaoliyat.conf sites-enabled da yo'q → boshqa saytning (ailab) sertifikati chiqadi.
# Muammo 2: ssl_certificate ba'zan ilmiyfaoliyat.uz papkasiga — API uchun api.ilmiyfaoliyat.uz LE papkasi kerak.
#
# Ishlatish:
#   sudo bash server-fix-api-ilmiyfaoliyat-complete.sh
#
set -euo pipefail

if [[ ${EUID:-0} -ne 0 ]]; then
  echo "sudo bilan ishga tushiring"
  exit 1
fi

AVAIL="/etc/nginx/sites-available/api-ilmiyfaoliyat.conf"
ENABLED="/etc/nginx/sites-enabled/api-ilmiyfaoliyat.conf"

echo "== 1) Sindilgan symlinklarni olib tashlash (phoenix-api bo'sh maqsad) =="
rm -f /etc/nginx/sites-enabled/phoenix-api-ilmiyfaoliyat 2>/dev/null || true

echo "== 2) api-ilmiyfaoliyat.conf mavjudligi =="
if [[ ! -f "$AVAIL" ]]; then
  echo "XATO: $AVAIL yo'q. Backupdan tiklang yoki phoenix-api namunasidan yarating."
  exit 1
fi

echo "== 3) Let's Encrypt: api uchun papka (SAN da api.ilmiyfaoliyat.uz bo'lishi kerak) =="
LE=""
for d in /etc/letsencrypt/live/api.ilmiyfaoliyat.uz /etc/letsencrypt/live/api.ilmiyfaoliyat.uz-0001; do
  if [[ -f "$d/fullchain.pem" ]] && openssl x509 -in "$d/fullchain.pem" -noout -text 2>/dev/null | grep -q "DNS:api.ilmiyfaoliyat.uz"; then
    LE="$d"
    break
  fi
done
if [[ -z "${LE:-}" ]]; then
  echo "XATO: api.ilmiyfaoliyat.uz uchun LE papka topilmadi."
  exit 1
fi
echo "LE_DIR=$LE"

echo "== 4) ssl_certificate yo'llari (ilmiyfaoliyat.uz → api papkasi) =="
cp -a "$AVAIL" "${AVAIL}.bak.$(date +%Y%m%d%H%M%S)"
# Noto'g'ri: frontend sertifikati bilan API blokini aralashtirish
sed -i 's|/etc/letsencrypt/live/ilmiyfaoliyat\.uz[^/]*/|'"${LE}"'/|g' "$AVAIL"
sed -i 's|/etc/letsencrypt/live/api\.ilmiyfaoliyat\.uz[^/]*/|'"${LE}"'/|g' "$AVAIL"

grep -nE 'ssl_certificate|ssl_certificate_key' "$AVAIL" || true

echo "== 5) sites-enabled ga symlink (ASOSIY TUZATISH) =="
mkdir -p /etc/nginx/sites-enabled
ln -sf "$AVAIL" "$ENABLED"
ls -la "$ENABLED"

echo "== 6) nginx -t va reload =="
nginx -t
systemctl reload nginx

echo "== 7) Tekshirish (ailab emas, api.ilmiyfaoliyat.uz bo'lishi kerak) =="
echo | openssl s_client -connect api.ilmiyfaoliyat.uz:443 -servername api.ilmiyfaoliyat.uz 2>/dev/null \
  | openssl x509 -noout -subject -ext subjectAltName

echo ""
echo "OK — brauzerda https://api.ilmiyfaoliyat.uz/api/v1/ ni yangilang."
