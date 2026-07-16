# ✅ SERVER DEPLOYMENT CHECKLIST

## Pre-Deployment Checklist

### 1. GitHub Push ✅
- [x] Frontend code pushed to GitHub
- [x] Backend code pushed to GitHub
- [x] All changes committed with clear messages

### 2. Server Requirements Check
- [ ] Server has Internet connection
- [ ] SSH access working (Linux/Mac)
- [ ] RDP/WinRM access working (Windows)
- [ ] Git installed on server
- [ ] Python 3.9+ installed (for backend)
- [ ] Node.js 18+ installed (for frontend)
- [ ] PostgreSQL running
- [ ] Redis running (for Celery)
- [ ] Nginx or Apache configured
- [ ] Gunicorn/uWSGI installed

### 3. Environment Files
- [ ] `.env` file created in backend with production settings
- [ ] Database credentials configured
- [ ] Gemini API key set correctly
- [ ] Click.uz payment keys configured
- [ ] Frontend `.env` with correct API URL

---

## Deployment Steps (Linux/Mac)

### SSH Connection
```bash
ssh root@YOUR_SERVER_IP
cd /var/www/phonix  # or your project directory
```

### Option A: Automated Deployment (Recommended)
```bash
# Download and run deployment script
curl https://raw.githubusercontent.com/aiziyrak-coder/phonixB/master/deploy-server.sh > /tmp/deploy.sh
chmod +x /tmp/deploy.sh
sudo /tmp/deploy.sh
```

### Option B: Manual Step-by-Step

#### 1. Frontend
```bash
cd /var/www/phonix/frontend
git pull origin master
npm install
npm run build
sudo cp -r dist/* /var/www/html/phonix/
```

#### 2. Backend
```bash
cd /var/www/phonix/backend
source venv/bin/activate
git pull origin master
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python create_admin_editor_users.py
```

#### 3. Services
```bash
sudo systemctl restart nginx
sudo systemctl restart gunicorn
```

---

## Deployment Steps (Windows)

### PowerShell as Administrator
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
cd C:\phonix

# Run deployment script
.\deploy-server.ps1 -ProjectRoot "."
```

### Manual Steps
```powershell
# Frontend
cd .\frontend
git pull origin master
npm install
npm run build
Copy-Item -Path "dist/*" -Destination "C:\inetpub\wwwroot\phonix\" -Recurse -Force

# Backend
cd ..\backend
.\venv\Scripts\Activate.ps1
git pull origin master
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python create_admin_editor_users.py

# Reset IIS
iisreset /restart
```

---

## Post-Deployment Verification

### 1. Frontend Testing
```bash
# Check if frontend is accessible
curl -I https://ilmiyfaoliyat.uz/
# Expected: HTTP/1.1 200 OK

# Or open in browser
# https://ilmiyfaoliyat.uz
```

### 2. Backend API Testing
```bash
# Check API health
curl http://localhost:8000/api/health/

# Test authentication
curl -X POST http://localhost:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"phone": "+998901001001", "password": "Admin@123456"}'

# List users
curl http://localhost:8000/api/users/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Database Testing
```bash
# Check database connection
python manage.py dbshell
# Type: \l (PostgreSQL) or SHOW TABLES; (MySQL)

# Check users created
python manage.py shell
from apps.users.models import User
User.objects.all().values('phone', 'email', 'role')
```

### 4. Payment Testing
```bash
# Test Click payment callback
curl -X POST http://localhost:8000/api/payments/click/prepare/ \
  -H "Content-Type: application/json" \
  -d '{
    "click_trans_id": "1234567890",
    "service_id": "82154",
    "amount": 50000,
    "sign_time": "2024-01-01T12:00:00",
    "sign_string": "hash_value"
  }'
```

### 5. Logs Verification
```bash
# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Gunicorn logs
sudo journalctl -u gunicorn -f

# Django logs (if using syslog)
sudo tail -f /var/log/syslog | grep django

# Application logs
tail -f /var/www/phonix/backend/logs/django.log
```

---

## Test Users

After deployment, the following users are automatically created:

| Role | Email | Phone | Password |
|------|-------|-------|----------|
| Super Admin | admin@ilmiyfaoliyat.uz | +998901001001 | Admin@123456 |
| Journal Admin (Editor) | editor@ilmiyfaoliyat.uz | +998901001002 | Editor@123456 |
| Reviewer 1 | reviewer1@ilmiyfaoliyat.uz | +998901001003 | Reviewer@123456 |
| Reviewer 2 | reviewer2@ilmiyfaoliyat.uz | +998901001004 | Reviewer@123456 |
| Author | author@ilmiyfaoliyat.uz | +998901001005 | Author@123456 |
| Accountant | accountant@ilmiyfaoliyat.uz | +998901001006 | Accountant@123456 |

**Login Test:**
```bash
# Using curl
curl -X POST http://api.ilmiyfaoliyat.uz/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+998901001001",
    "password": "Admin@123456"
  }'
```

---

## Troubleshooting

### Issue: "git pull" fails
**Solution:**
```bash
# Check git configuration
git config --list

# Update remote URL
git remote set-url origin https://github.com/aiziyrak-coder/phonixB.git

# Try pull again
git pull origin master
```

### Issue: "npm install" fails
**Solution:**
```bash
# Clear cache and retry
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# Or use legacy peer deps
npm install --legacy-peer-deps
```

### Issue: "python manage.py migrate" fails
**Solution:**
```bash
# Check migrations status
python manage.py showmigrations

# Run specific migration
python manage.py migrate apps.users

# Or fake initial migration (if database exists)
python manage.py migrate --fake-initial
```

### Issue: "permission denied" errors
**Solution:**
```bash
# Fix directory permissions
sudo chown -R www-data:www-data /var/www/phonix/
sudo chmod -R 755 /var/www/phonix/

# Or for specific directories
chmod +x /var/www/phonix/backend/manage.py
```

### Issue: Gunicorn not restarting
**Solution:**
```bash
# Check service status
sudo systemctl status gunicorn

# View error logs
sudo journalctl -u gunicorn -n 100

# Manually start gunicorn
cd /var/www/phonix/backend
source venv/bin/activate
gunicorn config.wsgi:application --bind 127.0.0.1:8000
```

### Issue: Database connection error
**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U postgres -h localhost -d phonix_db

# Create database if not exists
sudo -u postgres createdb phonix_db
sudo -u postgres createuser phonix
sudo -u postgres psql -c "ALTER ROLE phonix WITH PASSWORD 'password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE phonix_db TO phonix;"
```

---

## Rollback Plan

If deployment fails:

```bash
# Stop services
sudo systemctl stop nginx gunicorn

# Revert code
cd /var/www/phonix/frontend
git reset --hard HEAD~1
cd ../backend
git reset --hard HEAD~1

# Restart services
sudo systemctl start nginx gunicorn
```

---

## Performance Optimization

After successful deployment:

```bash
# Enable Gunicorn workers
# Edit /etc/systemd/system/gunicorn.service
# Change: ExecStart=/path/to/venv/bin/gunicorn config.wsgi:application --workers 4 --bind 127.0.0.1:8000

# Enable Nginx caching
# Add to /etc/nginx/sites-available/phonix
# proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=phonix_cache:10m;

# Enable Redis for sessions
# Redis should be running: redis-server

# Restart
sudo systemctl restart nginx gunicorn
```

---

## Monitoring

Set up monitoring for:

- [ ] Disk space: `df -h`
- [ ] Memory usage: `free -h`
- [ ] Process status: `ps aux | grep gunicorn`
- [ ] Error logs: `tail -f /var/log/nginx/error.log`
- [ ] Database size: `SELECT pg_size_pretty(pg_database_size('phonix_db'));`

---

## Maintenance Tasks

### Weekly
- [ ] Check logs for errors
- [ ] Monitor disk space
- [ ] Backup database

### Monthly
- [ ] Update dependencies: `npm update`, `pip list --outdated`
- [ ] Review analytics
- [ ] Check payment transactions

### Quarterly
- [ ] Security audit
- [ ] Performance tuning
- [ ] Database optimization

---

## Contact & Support

- **Admin Email:** admin@ilmiyfaoliyat.uz
- **Support:** support@ilmiyfaoliyat.uz
- **Issues:** https://github.com/aiziyrak-coder/phonixB/issues

---

**Deployment completed successfully! 🎉**
