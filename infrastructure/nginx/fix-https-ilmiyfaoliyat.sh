#!/usr/bin/env bash
# ilmiyfaoliyat.uz HTTPS — faqat Phoenix frontend (boshqa saytlar: tegmaymiz)
# Serverda: bash infrastructure/nginx/fix-https-ilmiyfaoliyat.sh
# yoki: sudo bash -c "$(curl -s ...)"  # faylni nusxalab ishlating
set -euo pipefail

LE_LIVE="/etc/letsencrypt/live/ilmiyfaoliyat.uz"
DHPARAM="/etc/letsencrypt/ssl-dhparams.pem"
FRONTEND_CONF="phoenix-ilmiyfaoliyat-frontend"
SITES_AVAIL="/etc/nginx/sites-available/${FRONTEND_CONF}"
SITES_EN="/etc/nginx/sites-enabled/${FRONTEND_CONF}"

echo "== 1) Nginx: ${FRONTEND_CONF} yo'q bo'lsa, loyihadagi faylni nusxalang =="
if [[ ! -f "$SITES_EN" ]]; then
  echo "XAT: $SITES_EN topilmadi. Quyidagilarni bajaring (nusxa yo'li sizniki bo'lishi mumkin):"
  echo "  sudo cp /path/to/Phonix/infrastructure/nginx/phoenix-ilmiyfaoliyat-frontend.conf $SITES_AVAIL"
  echo "  sudo ln -sf $SITES_AVAIL $SITES_EN"
  exit 1
fi

echo "== 2) ssl-dhparams (yo'q bo'lsa, bir marta yaratiladi) =="
if [[ ! -f "$DHPARAM" ]]; then
  echo "   $DHPARAM yaratilmoqda (1-2 daqiqa)..."
  sudo mkdir -p /etc/letsencrypt
  sudo openssl dhparam -out "$DHPARAM" 2048
fi

echo "== 3) Sertifikat: $LE_LIVE =="
if [[ ! -f "$LE_LIVE/fullchain.pem" ]]; then
  echo "Sertifikat topilmadi. Quyidagini bajaring (boshqa domenlarga tegmasdan, faqat shu domen):"
  echo "  sudo certbot certonly --nginx -d ilmiyfaoliyat.uz -d www.ilmiyfaoliyat.uz"
  echo "yoki interaktiv:"
  echo "  sudo certbot --nginx"
  exit 1
fi

sudo openssl x509 -in "$LE_LIVE/fullchain.pem" -noout -subject -dates

echo "== 4) Boshqa sayt 443 default_server bilan to'qnashuv (faqat tekshiruv) =="
sudo nginx -T 2>/dev/null | grep -E 'listen\s+\[?::\]?:443|default_server|server_name\s+ilmiyfaoliyat' || true

echo "== 5) nginx -t va reload =="
sudo nginx -t
sudo systemctl reload nginx

echo "OK. Tekshirish: curl -sI https://ilmiyfaoliyat.uz/ | head -20"
