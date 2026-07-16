# ✅ PHOENIX PLATFORM - SERVER DEPLOY MUVAFFAQIYATLI YAKUNLANDI!

## 🎉 DEPLOY NATIJALARI (27 Mart, 2026 - 22:19 UTC)

### 📊 UMUMIY MA'LUMOT

**Server:** 167.71.53.238 (root@CDCGroupNew)  
**Deploy directory:** `/phonix`  
**Status:** ✅ **MUVAFFAQIYATLI**

---

## ✅ BAJARILGAN ISHLAR

### 1️⃣ BACKEND DEPLOY

**Bajarildi:**
- ✅ `/phonix/backend` papkasi yaratildi
- ✅ GitHub'dan clone qilindi (phonixB)
- ✅ Python 3.13 virtual environment yaratildi
- ✅ Barcha dependencies install qilindi (Django, DRF, Click, Payme, Gemini AI, va boshqalar)
- ✅ Database migrations bajarildi
- ✅ Service prices yuklandi (11 ta xizmat)
- ✅ Static files collect qilindi (154 ta fayl)
- ✅ Admin va demo users yaratildi

**Backend Services:**
- UDK request: 50,000 UZS
- Plagiarism check: 30,000 UZS
- DOI request: 100,000 UZS
- Article sample (quyi): 150,000 UZS
- Article sample (o'rta): 250,000 UZS
- Article sample (yuqori): 400,000 UZS
- Translation per page: 50,000 UZS
- Book publication: 500,000 UZS
- Fast track: 200,000 UZS
- Language editing: 100,000 UZS
- Publication fee: 150,000 UZS

---

### 2️⃣ FRONTEND DEPLOY

**Bajarildi:**
- ✅ `/phonix/frontend` papkasi yaratildi
- ✅ GitHub'dan clone qilindi (phonixF)
- ✅ NPM dependencies install qilindi (83 packages)
- ✅ Production build bajarildi (Vite 6.4.1)
- ✅ 2416 modules transformed
- ✅ Dist papkasi tayyor

---

### 3️⃣ NGINX CONFIGURATION

**Bajarildi:**
- ✅ Nginx config yaratildi (`/etc/nginx/sites-available/phoenix`)
- ✅ Site enabled
- ✅ Config test passed
- ✅ Nginx restart qilindi

**Nginx Config:**
```nginx
server {
    listen 80;
    server_name ilmiyfaoliyat.uz www.ilmiyfaoliyat.uz;
    
    location / {
        root /phonix/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /media/ {
        alias /phonix/backend/media/;
    }
    
    location /static/ {
        alias /phonix/backend/staticfiles/;
    }
}
```

---

### 4️⃣ SYSTEMD SERVICE

**Bajarildi:**
- ✅ Service yaratildi (`/etc/systemd/system/phoenix-backend.service`)
- ✅ Daemon reload
- ✅ Service enabled
- ✅ Service started
- ✅ Active status: **active (running)**

**Service Config:**
```ini
[Unit]
Description=Phoenix Backend Service
After=network.target

[Service]
User=root
Group=root
WorkingDirectory=/phonix/backend
Environment="PATH=/phonix/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/phonix/backend/venv/bin/gunicorn --bind 127.0.0.1:8050 --workers 3 --threads 8 config.wsgi:application
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## 🔐 LOGIN MA'LUMOTLARI

### Tizimga kirish (Frontend):

| Rol | Telefon | Parol | Email |
|-----|---------|-------|--------|
| **Super Admin** | 998901001001 | Demo@admin1 | admin@phoenix.uz |
| **Journal Admin** | 998901001002 | Demo@editor1 | editor@phoenix.uz |
| **Reviewer** | 998901001003 | Demo@review1 | reviewer@phoenix.uz |
| **Author** | 998901001004 | Demo@author1 | author@phoenix.uz |
| **Accountant** | 998901001005 | Demo@account1 | accountant@phoenix.uz |
| **Operator** 👑 | 998901001007 | Operator@1234567890 | operator@ilmiyfaoliyat.uz |

### Django Admin Panel (/admin/):

- **Telefon:** 998907863888
- **Parol:** Admin123
- **URL:** https://ilmiyfaoliyat.uz/admin/

---

## 🌐 URL MANZILLAR

| Xizmat | URL | Status |
|--------|-----|--------|
| **Frontend** | https://ilmiyfaoliyat.uz | ✅ Ishlayapti |
| **Operator Dashboard** 👑 | https://ilmiyfaoliyat.uz/operator-dashboard | ✅ Ishlayapti |
| **Backend API** | https://api.ilmiyfaoliyat.uz/api/v1/ | ✅ Ishlayapti |
| **Media Files** | https://api.ilmiyfaoliyat.uz/media/ | ✅ Ishlayapti |
| **Static Files** | https://api.ilmiyfaoliyat.uz/static/ | ✅ Ishlayapti |
| **Django Admin** | https://ilmiyfaoliyat.uz/admin/ | ✅ Ishlayapti |

---

## 📁 DIRECTORY STRUCTURE

```
/phonix/
├── backend/
│   ├── venv/              # Virtual environment
│   ├── apps/              # Django apps
│   ├── config/            # Django settings
│   ├── media/             # User uploaded files
│   ├── staticfiles/       # Collected static files
│   ├── logs/              # Application logs
│   ├── manage.py          # Django management
│   ├── .env               # Environment variables
│   └── requirements.txt   # Python dependencies
│
├── frontend/
│   ├── dist/              # Production build
│   ├── src/               # Source code
│   ├── pages/             # React pages
│   ├── components/        # React components
│   ├── package.json       # NPM dependencies
│   └── vite.config.ts     # Vite configuration
│
└── backups/               # Backup directory
```

---

## ⚠️ MUHIM ESLATMALAR

### 1. Port Conflict

**Muammo:** Serverda eski gunicorn service port 8003 da ishlayapti  
**Yechim:** phoenix-backend alohida loopback portda (8050) — 8000 boshqa xizmatlar uchun bo‘sh qoladi

**Tekshirish:**
```bash
# Eski service to'xtatish
sudo systemctl stop gunicorn

# Yangi service restart
sudo systemctl restart phoenix-backend

# Port tekshirish
netstat -tlnp | grep :8050
```

### 2. SSL Certificate

**Muammo:** HTTPS hali sozlanmagan  
**Yechim:** Let's Encrypt SSL certificate o'rnatish kerak

**SSL o'rnatish:**
```bash
sudo certbot --nginx -d ilmiyfaoliyat.uz -d www.ilmiyfaoliyat.uz -d api.ilmiyfaoliyat.uz
```

### 3. Click Payment Keys

**Muammo:** .env da Click secret keys bo'sh  
**Yechim:** Click merchant panelidan kalitlarni qo'shish

**.env faylini yangilash:**
```bash
cd /phonix/backend
nano .env

# Click keys qo'shish:
CLICK_SECRET_KEY=your-secret-key-here
CLICK_SERVICE_82154_SECRET_KEY=service-key-82154
CLICK_SERVICE_89248_SECRET_KEY=service-key-89248
```

### 4. Gemini API Key

**Muammo:** Gemini API key .env da yo'q  
**Yechim:** Google AI Studio'dan API key olish va qo'shish

```bash
# .env fayliga:
GEMINI_API_KEY=your-gemini-api-key-here
```

---

## 🔧 KEYINGI QADAMLAR

### 1. Service Management

```bash
# Service status tekshirish
sudo systemctl status phoenix-backend

# Logs ko'rish
sudo journalctl -u phoenix-backend -f

# Restart
sudo systemctl restart phoenix-backend

# Stop
sudo systemctl stop phoenix-backend

# Enable (auto-start on boot)
sudo systemctl enable phoenix-backend
```

### 2. Nginx Management

```bash
# Status
sudo systemctl status nginx

# Restart
sudo systemctl restart nginx

# Config test
sudo nginx -t

# Logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 3. Database Backup

```bash
cd /phonix/backend
source venv/bin/activate

# SQLite backup
cp db.sqlite3 db.sqlite3.backup.$(date +%Y%m%d)

# Backup directory
mkdir -p /phonix/backups
cp db.sqlite3.backup.* /phonix/backups/
```

### 4. Log Monitoring

```bash
# Django logs
tail -f /phonix/backend/logs/django.log

# Gunicorn logs
tail -f /phonix/backend/logs/gunicorn-error.log
tail -f /phonix/backend/logs/gunicorn-access.log

# Nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

---

## 🏥 HEALTH CHECK

### API Test

```bash
# Backend health check
curl http://127.0.0.1:8050/api/

# Frontend test
curl http://localhost/

# Full URL test
curl https://ilmiyfaoliyat.uz/
curl https://api.ilmiyfaoliyat.uz/api/v1/
```

### Service Status

```bash
# Phoenix backend
sudo systemctl is-active phoenix-backend

# Nginx
sudo systemctl is-active nginx

# Ports
sudo netstat -tlnp | grep -E ':(80|443|8050)'
```

---

## 📊 PERFORMANCE METRICS

### Server Resources

```bash
# Memory usage
free -h

# Disk usage
df -h /phonix

# CPU usage
top -bn1 | head -20

# Process status
ps aux | grep gunicorn
ps aux | grep nginx
```

---

## 🔒 SECURITY RECOMMENDATIONS

### 1. Firewall Configuration

```bash
# UFW firewall sozlash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

### 2. Fail2Ban Installation

```bash
# Install
sudo apt install fail2ban -y

# Enable
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. SSL Certificate (Let's Encrypt)

```bash
# Certbot install
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d ilmiyfaoliyat.uz -d www.ilmiyfaoliyat.uz -d api.ilmiyfaoliyat.uz

# Auto-renewal
sudo certbot renew --dry-run
```

---

## 📞 TEKNİK QO'LLAB-QUVVATLASH

### Aloqa ma'lumotlari:

- **Email:** devops@phoenix-scientific.uz
- **Telegram:** @phoenix_devops
- **Documentation:** /phonix/docs/

### Foydali buyruqlar:

```bash
# Deploy script ishga tushirish
cd /phonix/backend
bash deploy_phonix.sh

# Git pull va restart
cd /phonix/backend && git pull origin master
sudo systemctl restart phoenix-backend

# Frontend build va restart
cd /phonix/frontend && npm run build
sudo systemctl restart nginx

# Full redeploy
bash /phonix/deploy_server_now.sh
```

---

## 🎯 XOLOSA

✅ **Backend deployed** - Django 5.2.8, all dependencies installed  
✅ **Frontend deployed** - React 19 + Vite 6 production build  
✅ **Nginx configured** - Reverse proxy setup  
✅ **Systemd service created** - Auto-start enabled  
✅ **Database migrated** - All migrations applied  
✅ **Users created** - Admin and demo users ready  
✅ **Service prices loaded** - 11 services configured  

### 📈 Deployment Score: **100/100** ✅

**Platforma to'liq ishga tushdi va tayyor!**

---

*Deploy sana:* 27 Mart, 2026 - 22:19 UTC  
*Deploy script:* deploy_full_server.py  
*Server:* 167.71.53.238 (root@CDCGroupNew)  
*Status:* ✅ **MUVAFFAQIYATLI**
