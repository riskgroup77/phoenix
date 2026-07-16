Phoenix production nginx (boshqa saytlarga tegmaydi)
======================================================

Prinsip: faqat yangi fayllar qo'shing; default.conf yoki boshqa loyiha
fayllarini o'zgartirmang. Faqat `nginx -t` va `reload`.

Frontend SSL bloki Nginx 1.25.1+ uchun `listen 443 ssl` + `http2 on` —
bir nechta virtual host bir 443 da bo'lsa "listen ... http2 deprecated" ogohlantirishini kamaytirish.

1) Frontend — ilmiyfaoliyat.uz
   Fayl: phoenix-ilmiyfaoliyat-frontend.conf
   Serverda masalan:
     sudo cp phoenix-ilmiyfaoliyat-frontend.conf /etc/nginx/sites-available/phoenix-ilmiyfaoliyat-frontend
     sudo ln -sf /etc/nginx/sites-available/phoenix-ilmiyfaoliyat-frontend /etc/nginx/sites-enabled/
   root: /phonix/frontend/dist (yoki PHONIX_FRONTEND_WEB_ROOT ga rsync qilgan bo'lsangiz, shu yo'l)
   SSL: /etc/letsencrypt/live/ilmiyfaoliyat.uz/ (certbot yo'li bilan moslang)

2) API — api.ilmiyfaoliyat.uz
   Fayl: phoenix-api-ilmiyfaoliyat.conf
   Upstream nomi noyob: phoenix_upstream_ilmiyfaoliyat (boshqa upstream bilan to'qnashmaydi)
   proxy_pass: 127.0.0.1:8050 — systemd da GUNICORN_BIND shu portga mos bo'lishi kerak
   Serverda masalan:
     sudo cp phoenix-api-ilmiyfaoliyat.conf /etc/nginx/sites-available/phoenix-api-ilmiyfaoliyat
     sudo ln -sf /etc/nginx/sites-available/phoenix-api-ilmiyfaoliyat /etc/nginx/sites-enabled/
   Eski nom bilan fayl bo'lsa (api-ilmiyfaoliyat.conf), ichki mazmunni shu namunaga moslab
   qo'ling; avtomatik sed ishlatmang — deploy skript nginxni o'zgartirmaydi.

3) Tekshiruv
   sudo nginx -t && sudo systemctl reload nginx

4) Systemd namuna
   infrastructure/systemd/phoenix-backend.service.example

5) Masofadan deploy
   scripts/remote_deploy.py — parolni repoga yozmaymiz; muhit o'zgaruvchilari yoki SSH kalit.

6) HTTPS muammosi (faqat ilmiyfaoliyat.uz — boshqa virtual hostlarga tegmang)
   Sindilgan symlink / nginx emerg: SERVER-BROKEN-SYMLINK-FIX.txt (darhol tuzatish)

   ilmiyfaoliyat ochilsa boshqa sayt (aidoktor va h.k.) ko'rinadi: DEBUG-WRONG-SITE-ILMIYFAOLIYAT.txt

7) HTTPS muammosi (davomi)
   - Yangilangan frontend konf: infrastructure/nginx/phoenix-ilmiyfaoliyat-frontend.conf
   - Avtomatik tekshiruv (dhparam + sert + nginx reload): bash infrastructure/nginx/fix-https-ilmiyfaoliyat.sh
   - Sertifikat yo'q bo'lsa (faqat shu domenlar):
       sudo certbot certonly --nginx -d ilmiyfaoliyat.uz -d www.ilmiyfaoliyat.uz
     API alohida: api.ilmiyfaoliyat.uz uchun phoenix-api-ilmiyfaoliyat.conf va alohida LE papkasi.
   - NET::ERR_CERT_*: boshqa saytning default_server 443 da turganini tekshiring:
       sudo nginx -T | grep -E 'listen.*443|server_name'
     Bu sayt uchun server_name aniq ilmiyfaoliyat.uz bo'lishi kerak (default.conf ni olib tashlash emas — faqat Phoenix faylni to'g'rilang).
   - options-ssl-nginx.conf yo'q: sudo apt install -y python3-certbot-nginx
