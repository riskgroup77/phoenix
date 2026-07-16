# 🚀 SERVER DEPLOYMENT INSTRUCTIONS

## Server Deployment Steps

### Step 1: SSH Server'ga kirish
```bash
ssh root@SERVER_IP
```

### Step 2: Phonix Directory'ni tekshirish va pull qilish

```bash
# Frontend uchun
cd /path/to/phonix/frontend
git pull origin master

# Backend uchun
cd /path/to/phonix/backend
git pull origin master
```

### Step 3: Frontend Build qilish va Deploy

```bash
cd /path/to/phonix/frontend

# Dependencies o'rnatish
npm install

# Build yaratish
npm run build

# Build fayllarini Nginx'ga copy qilish
sudo cp -r dist/* /var/www/html/phonix/
# yoki
sudo cp -r dist/* /var/www/phonix/frontend/

# Nginx restart qilish
sudo systemctl restart nginx
```

### Step 4: Backend Setup va Migrations

```bash
cd /path/to/phonix/backend

# Python venv aktivlashtirish
source venv/bin/activate
# yoki Windows'da:
# venv\Scripts\activate

# Dependencies o'rnatish
pip install -r requirements.txt

# Migrations qo'llash
python manage.py migrate

# Static files collect qilish
python manage.py collectstatic --noinput
```

### Step 5: Test Users Yaratish

```bash
cd /path/to/phonix/backend

# Option 1: Admin va Editor users yaratish
python create_admin_editor_users.py

# Option 2: Django management command ishlatish
python manage.py create_test_users

# Option 3: SQL bilan direct insert (agar qolgan tanaga o'rnatilgan bo'lsa)
python manage.py dbshell < create_users.sql
```

### Step 6: Gunicorn Restart

```bash
# Gunicorn service restart qilish
sudo systemctl restart gunicorn

# yoki direct command ishlatish:
sudo systemctl restart phonix-gunicorn
# yoki
sudo systemctl restart phonix
```

### Step 7: Server Test qilish

```bash
# Backend API test
curl -X GET http://API_SERVER:8000/api/health/
curl -X GET http://API_SERVER:8000/api/users/

# Frontend load test
curl -I https://ilmiyfaoliyat.uz/

# Payment callback test
curl -X POST http://API_SERVER:8000/api/payments/click/prepare/ \
  -H "Content-Type: application/json" \
  -d '{"click_trans_id": "1234567890", "service_id": "82154"}'
```

### Step 8: Logs tekshirish

```bash
# Gunicorn logs
sudo journalctl -u gunicorn -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Django logs (agar systemd service bo'lsa)
sudo journalctl -u phonix -f
```

---

## Quick Deployment Commands (Barcha qadamlar bir yo'lakda)

```bash
#!/bin/bash

# SSH'ga kirish va deployment qilish
ssh root@SERVER_IP << 'EOF'

# Frontend
cd /path/to/frontend
git pull origin master
npm install
npm run build
sudo cp -r dist/* /var/www/html/phonix/

# Backend
cd /path/to/backend
source venv/bin/activate
git pull origin master
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python create_admin_editor_users.py

# Services restart
sudo systemctl restart nginx
sudo systemctl restart gunicorn

# Test
curl -X GET http://localhost:8000/api/health/

EOF
```

---

## Environment Variables Server'da

Backend `.env` faylida qo'llang:

```env
# Django
DEBUG=False
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=ilmiyfaoliyat.uz,api.ilmiyfaoliyat.uz,localhost,127.0.0.1

# Database (Production)
DATABASE_URL=postgresql://user:password@localhost:5432/phonix_db
DB_ENGINE=django.db.backends.postgresql
DB_NAME=phonix_db
DB_USER=postgres
DB_PASSWORD=your-db-password
DB_HOST=localhost
DB_PORT=5432

# Gemini API
GEMINI_API_KEY=<GEMINI_KEY_FROM_GOOGLE_AI_STUDIO>

# Click.uz Payment
CLICK_SERVICE_ID=82154
CLICK_MERCHANT_ID=your-merchant-id
CLICK_SECRET_KEY=your-secret-key

# Frontend URL
FRONTEND_URL=https://ilmiyfaoliyat.uz

# Redis
REDIS_URL=redis://localhost:6379/0
```

---

## Troubleshooting

### Migrations error
```bash
python manage.py showmigrations
python manage.py migrate --fake-initial  # Agar zarur bo'lsa
```

### Permission errors
```bash
sudo chown -R www-data:www-data /var/www/html/phonix/
sudo chmod -R 755 /var/www/html/phonix/
```

### Gunicorn not found
```bash
source venv/bin/activate
pip install gunicorn
```

### Database connection error
```bash
# PostgreSQL'ni tekshirish
sudo su - postgres
psql
\l  # Databases ro'yxati
\du # Users ro'yxati
CREATE DATABASE phonix_db;
CREATE USER phonix WITH PASSWORD 'password';
GRANT ALL ON DATABASE phonix_db TO phonix;
```

---

## Health Check Commands

```bash
# Backend API
curl http://localhost:8000/api/health/

# Frontend
curl https://ilmiyfaoliyat.uz/

# Database connection
python manage.py dbshell

# Users ro'yxati
python manage.py shell
from apps.users.models import User
print(User.objects.all())
```

---

## Test Users Credentials (default)

| Role | Email | Phone | Password |
|------|-------|-------|----------|
| Admin | admin@ilmiyfaoliyat.uz | 998901001001 | Admin@123456 |
| Editor | editor@ilmiyfaoliyat.uz | 998901001002 | Editor@123456 |
| Reviewer 1 | reviewer1@ilmiyfaoliyat.uz | 998901001003 | Reviewer@123456 |
| Reviewer 2 | reviewer2@ilmiyfaoliyat.uz | 998901001004 | Reviewer@123456 |
| Author | author@ilmiyfaoliyat.uz | 998901001005 | Author@123456 |
| Accountant | accountant@ilmiyfaoliyat.uz | 998901001006 | Accountant@123456 |

---

**✅ Deployment muvaffaqiyat bilan tugashi kerak!**
