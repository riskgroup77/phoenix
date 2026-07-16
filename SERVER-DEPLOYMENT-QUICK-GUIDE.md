# 🚀 SERVER'DA DEPLOYMENT QILISH - TEZKOR QO'LLANMA

## 1️⃣ Server'ga SSH orqali kirish

```bash
# Linux/Mac
ssh root@YOUR_SERVER_IP

# Windows (PowerShell as Administrator)
# Faqat PowerShell terminal dan quyidagi commands'ni ishlating
```

---

## 2️⃣ Automatic Deployment (Tavsiya etiladi)

### Linux/Mac uchun:
```bash
# Phonix directory'ga o'tish
cd /var/www/phonix  # yoki sizda bo'lgan path

# Deployment script'ni download qilish va ishlating
bash -c "$(curl -fsSL https://raw.githubusercontent.com/aiziyrak-coder/phonixB/master/deploy-server.sh)"

# Yoki lokal file dan ishlating
sudo bash ./deploy-server.sh
```

### Windows (PowerShell as Administrator):
```powershell
# Phonix directory'ga o'tish
cd C:\phonix

# Deployment script'ni ishlating
powershell -ExecutionPolicy RemoteSigned -File .\deploy-server.ps1

# Yoki detailed output bilan:
.\deploy-server.ps1 -ProjectRoot "." -Verbose
```

---

## 3️⃣ Manual Step-by-Step Deployment

Agar automatic deployment ishlamasa, step-by-step qilish:

### A) Frontend Deploy

```bash
# Navigate
cd /var/www/phonix/frontend

# Latest code pull
git pull origin master

# Dependencies o'rnatish
npm install --legacy-peer-deps

# Build generation
npm run build

# Build fayllarini web server'ga copy
sudo cp -r dist/* /var/www/html/phonix/
# yoki
sudo cp -r dist/* /var/www/phonix/frontend/html/
```

### B) Backend Deploy

```bash
# Navigate
cd /var/www/phonix/backend

# Latest code pull
git pull origin master

# Virtual environment activate qilish
source venv/bin/activate
# Windows PowerShell da:
# .\venv\Scripts\Activate.ps1

# Dependencies
pip install -r requirements.txt

# Database migrations
python manage.py migrate

# Static files collect
python manage.py collectstatic --noinput

# Test users yaratish
python create_admin_editor_users.py

# Production check
python manage.py check --deploy
```

### C) Services Restart

```bash
# Nginx restart
sudo systemctl restart nginx

# Gunicorn restart
sudo systemctl restart gunicorn
# yoki
sudo systemctl restart phonix-gunicorn

# yoki Windows'da:
iisreset /restart
```

---

## 4️⃣ Verification Va Testing

### Frontend Test
```bash
# Browser dan ochish:
# https://ilmiyfaoliyat.uz
# yoki
curl -I https://ilmiyfaoliyat.uz/
# Expected: HTTP/1.1 200 OK
```

### Backend API Test
```bash
# Health check
curl http://localhost:8000/api/health/

# Authentication test (admin credentials)
curl -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"phone": "+998901001001", "password": "Admin@123456"}'
```

### Database Test
```bash
# Django shell'ga kirish
cd /var/www/phonix/backend
source venv/bin/activate
python manage.py shell

# User count check
from apps.users.models import User
print(f"Total users: {User.objects.count()}")

# Users ro'yxatini ko'rish
User.objects.all().values('phone', 'email', 'role', 'first_name')
```

---

## 5️⃣ Test Users Credentials

Успешно deployment'dan after, quyidagi users avtomatik yaratilaid:

| Role | Email | Phone | Password | URL |
|------|-------|-------|----------|-----|
| Admin | admin@ilmiyfaoliyat.uz | +998901001001 | Admin@123456 | https://ilmiyfaoliyat.uz/login |
| Editor | editor@ilmiyfaoliyat.uz | +998901001002 | Editor@123456 | https://ilmiyfaoliyat.uz/login |
| Reviewer 1 | reviewer1@ilmiyfaoliyat.uz | +998901001003 | Reviewer@123456 | https://ilmiyfaoliyat.uz/login |
| Reviewer 2 | reviewer2@ilmiyfaoliyat.uz | +998901001004 | Reviewer@123456 | https://ilmiyfaoliyat.uz/login |
| Author | author@ilmiyfaoliyat.uz | +998901001005 | Author@123456 | https://ilmiyfaoliyat.uz/login |
| Accountant | accountant@ilmiyfaoliyat.uz | +998901001006 | Accountant@123456 | https://ilmiyfaoliyat.uz/login |

---

## 6️⃣ Logs Checking

```bash
# Frontend errors
sudo tail -f /var/log/nginx/error.log

# Frontend access
sudo tail -f /var/log/nginx/access.log

# Backend errors
sudo journalctl -u gunicorn -f

# Django application logs
tail -f /var/www/phonix/backend/logs/django.log

# Real-time monitoring (barcha logs)
tail -f /var/log/syslog | grep -E 'gunicorn|nginx|django'
```

---

## 7️⃣ Common Errors Va Fix

### Error: "git pull" fails
```bash
git status
git remote -v
git remote set-url origin https://github.com/aiziyrak-coder/phonixB.git
git pull origin master
```

### Error: "npm install" fails
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
```

### Error: "migrate" fails
```bash
python manage.py showmigrations
python manage.py migrate --fake-initial
# yoki specific app
python manage.py migrate apps.users
```

### Error: "Permission denied"
```bash
sudo chown -R www-data:www-data /var/www/phonix/
sudo chmod -R 755 /var/www/phonix/
chmod +x venv/bin/python
```

### Error: "Gunicorn not found"
```bash
source venv/bin/activate
pip install gunicorn
gunicorn config.wsgi:application --bind 0.0.0.0:8000
```

### Error: "Database connection error"
```bash
# PostgreSQL check
sudo systemctl status postgresql
sudo su - postgres
psql
\l  # Databases
\dt # Tables
exit

# Retry migration
python manage.py migrate
```

---

## 8️⃣ Performance Optimization (Opsional)

```bash
# Gunicorn workers increase (4 CPU cores uchun)
# /etc/systemd/system/gunicorn.service ozgartirish:
# ExecStart=/path/to/venv/bin/gunicorn config.wsgi:application \
#   --workers 4 \
#   --worker-class sync \
#   --bind 127.0.0.1:8000

# Nginx caching enable
# /etc/nginx/sites-available/phonix ozgartirish:
# proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=phonix:10m;
# proxy_cache phonix;
# proxy_cache_valid 200 10m;

sudo systemctl restart nginx gunicorn
```

---

## 9️⃣ Monitoring Setup (Opsional)

```bash
# Check disk space
df -h /var/www/phonix

# Check memory
free -h

# Check active processes
ps aux | grep gunicorn
ps aux | grep nginx

# Database size
sudo -u postgres psql -d phonix_db -c "SELECT pg_size_pretty(pg_database_size('phonix_db'));"
```

---

## 🔟 Security Checklist

- [ ] DEBUG=False (production'da)
- [ ] SECRET_KEY secure (random va long)
- [ ] ALLOWED_HOSTS to'g'ri configured
- [ ] Database password secure
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Regular backups enabled
- [ ] Logs monitored

---

## 📌 Qo'shimcha Resources

- [SERVER-DEPLOYMENT-STEPS.md](SERVER-DEPLOYMENT-STEPS.md) - Detailed steps
- [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) - Full checklist
- [ADMIN_EDITOR_USERS.md](backend/ADMIN_EDITOR_USERS.md) - User creation details
- [FINAL-AUDIT-REPORT.md](FINAL-AUDIT-REPORT.md) - System audit report

---

## ⚡ Quick Commands (Copy-Paste Ready)

### Linux/Mac
```bash
cd /var/www/phonix/backend && \
source venv/bin/activate && \
git pull origin master && \
pip install -r requirements.txt && \
python manage.py migrate && \
python create_admin_editor_users.py && \
sudo systemctl restart gunicorn && \
echo "✅ Backend deployment complete!"
```

### Windows PowerShell
```powershell
cd C:\phonix\backend ; `
.\venv\Scripts\Activate.ps1 ; `
git pull origin master ; `
pip install -r requirements.txt ; `
python manage.py migrate ; `
python create_admin_editor_users.py ; `
Write-Host "✅ Backend deployment complete!"
```

---

## ✅ Deployment Muvaffaqiyatli Tugashi

Barcha steps muvaffaqiyatli tugagandan so'ng:

1. ✅ Frontend: https://ilmiyfaoliyat.uz ishlab turadi
2. ✅ Backend API: http://api.ilmiyfaoliyat.uz/api/health/ 200 OK qaytaradi
3. ✅ Users: 6 ta test users yaratilgan
4. ✅ Payments: Click.uz integration ishlaydi
5. ✅ Admin panel: https://ilmiyfaoliyat.uz/admin accessible

**Congratulations! 🎉 The Phonix platform is live!**

---

**Savol bo'lsa, logs'ni tekshirib, GitHub issues'da post qiling:**
- Frontend issues: https://github.com/aiziyrak-coder/AdvokatF/issues
- Backend issues: https://github.com/aiziyrak-coder/phonixB/issues
