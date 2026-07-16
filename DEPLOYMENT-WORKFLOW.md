# 🚀 Phoenix Deployment Workflow - To'liq Yo'riqnoma

## 📋 Umumiy Ko'rinish

Bu workflow sizga quyidagilarni ta'minlaydi:
1. ✅ Local'da backend va frontend'ni build qilish
2. ✅ Git'ga push qilish
3. ✅ Server'da yangilanishlarni olish
4. ✅ Server'da build qilish va restart
5. ✅ Boshqa dasturlarga tasir qilmaslik

---

## 🔄 1. Local Development - Build va Push

### Backend uchun:

```bash
# 1. Backend papkasiga o'tish
cd backend

# 2. O'zgarishlarni commit qilish
git add .
git commit -m "Your commit message"

# 3. Git'ga push qilish
git push origin master  # yoki main branch

# 4. Tekshirish
git status
```

### Frontend uchun:

```bash
# 1. Frontend papkasiga o'tish
cd frontend

# 2. O'zgarishlarni commit qilish
git add .
git commit -m "Your commit message"

# 3. Git'ga push qilish
git push origin master  # yoki main branch

# 4. Tekshirish
git status
```

**⚠️ Eslatma:** Frontend'ni local'da build qilish shart emas, chunki server'da build qilinadi.

---

## 🖥️ 2. Server'ga Deployment

### Server'ga ulanish:

```bash
ssh root@YOUR_SERVER_IP
```

### Deployment Script (Xavfsiz - Boshqa Dasturlarga Tasir Qilmaydi):

```bash
# Root papkasiga o'tish
cd /

# Deployment scriptini yuklab olish
wget -O deploy_phonix.sh https://raw.githubusercontent.com/aiziyrak-coder/phonixB/master/deploy_phonix.sh
chmod +x deploy_phonix.sh

# Scriptni ishga tushirish
./deploy_phonix.sh
```

**Yoki manual qadamlar:**

```bash
#!/bin/bash
# Phoenix Deployment Script - Xavfsiz versiya

set -e  # Xatolik bo'lsa to'xtatish

DEPLOY_DIR="/phonix"
BACKEND_REPO="https://github.com/aiziyrak-coder/phonixB.git"
FRONTEND_REPO="https://github.com/aiziyrak-coder/phonixF.git"
SERVICE_NAME="phoenix-backend"
PORT=8000  # Phoenix uchun port

echo "🚀 Starting Phoenix deployment..."

# 1. Backend yangilash
echo "📦 Updating backend..."
cd ${DEPLOY_DIR}/backend

# Git pull (mavjud o'zgarishlarni saqlab qolish)
if [ -d .git ]; then
    echo "Pulling latest changes..."
    git stash  # Local o'zgarishlarni saqlash
    git pull origin master || git pull origin main
    git stash pop || true  # O'zgarishlarni qaytarish
else
    echo "Backend not found, cloning..."
    cd ${DEPLOY_DIR}
    rm -rf backend
    git clone ${BACKEND_REPO} backend
    cd backend
fi

# Virtual environment
if [ ! -d venv ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt gunicorn -q

# .env faylini saqlab qolish (agar mavjud bo'lsa)
if [ -f .env ]; then
    cp .env .env.backup
fi

# Migrations
echo "🔄 Running migrations..."
python manage.py migrate --noinput

# Static files
echo "📦 Collecting static files..."
python manage.py collectstatic --noinput

deactivate

# 2. Frontend yangilash
echo "📦 Updating frontend..."
cd ${DEPLOY_DIR}/frontend

# Git pull
if [ -d .git ]; then
    echo "Pulling latest changes..."
    git stash
    git pull origin master || git pull origin main
    git stash pop || true
else
    echo "Frontend not found, cloning..."
    cd ${DEPLOY_DIR}
    rm -rf frontend
    git clone ${FRONTEND_REPO} frontend
    cd frontend
fi

# Dependencies va build
echo "📦 Building frontend..."
npm install --silent

# Production environment variables
export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1'
export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/'

npm run build

# 3. Service restart (Graceful - boshqa dasturlarga tasir qilmaydi)
echo "🔄 Restarting service..."

# Graceful restart - avval yangi process ishga tushadi, keyin eskisi to'xtatiladi
sudo systemctl reload ${SERVICE_NAME} 2>/dev/null || sudo systemctl restart ${SERVICE_NAME}

# Service status
echo "📊 Service status:"
sudo systemctl status ${SERVICE_NAME} --no-pager | head -10

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📝 Check logs: sudo journalctl -u ${SERVICE_NAME} -f"
```

---

## 🔒 3. Xavfsizlik - Boshqa Dasturlarga Tasir Qilmaslik

### Port va Service Izolatsiyasi:

```bash
# Phoenix service faqat o'z portida ishlaydi (8000)
# Boshqa dasturlar boshqa portlarda ishlaydi

# Service'lar ro'yxatini ko'rish
sudo systemctl list-units --type=service --state=running | grep -E "(phoenix|other-app)"

# Phoenix service'ni tekshirish
sudo systemctl status phoenix-backend

# Boshqa service'larni tekshirish (masalan)
sudo systemctl status other-app-backend
```

### Nginx Konfiguratsiya (Izolatsiya):

```bash
# Phoenix uchun alohida Nginx config
sudo nano /etc/nginx/sites-available/phoenix

# Boshqa dasturlar uchun alohida config'lar
# Masalan: /etc/nginx/sites-available/other-app
```

**Phoenix Nginx Config:**
```nginx
server {
    listen 80;
    server_name api.ilmiyfaoliyat.uz;
    
    # Phoenix backend
    location /api/v1/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Phoenix frontend
    location / {
        root /phonix/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

### Database Izolatsiyasi:

```bash
# Phoenix uchun alohida database
# Database nomi: phoenix_scientific

# Boshqa dasturlar uchun boshqa database'lar
# Masalan: other_app_db

# Database'lar ro'yxatini ko'rish
sudo -u postgres psql -l
```

---

## 📝 4. Tekshirish va Monitoring

### Service Status:

```bash
# Phoenix service status
sudo systemctl status phoenix-backend

# Boshqa service'lar status
sudo systemctl status other-app-backend  # misol
```

### Logs:

```bash
# Phoenix logs
sudo journalctl -u phoenix-backend -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Port Tekshirish:

```bash
# Port 8000 (Phoenix) tekshirish
sudo netstat -tlnp | grep 8000

# Boshqa portlar
sudo netstat -tlnp | grep -E "(3000|5000|9000)"  # boshqa dasturlar
```

### API Test:

```bash
# Phoenix API test
curl https://api.ilmiyfaoliyat.uz/api/v1/
curl https://api.ilmiyfaoliyat.uz/api/v1/auth/login/

# Frontend test
curl https://ilmiyfaoliyat.uz/
```

---

## 🛠️ 5. Qo'shimcha Utility Script'lar

### Quick Deploy Script (Local'dan):

**`deploy.sh`** - Local mashinada ishlatish:

```bash
#!/bin/bash
# Local deployment script

echo "🚀 Starting deployment..."

# Backend
cd backend
git add .
read -p "Backend commit message: " backend_msg
git commit -m "$backend_msg"
git push origin master
cd ..

# Frontend
cd frontend
git add .
read -p "Frontend commit message: " frontend_msg
git commit -m "$frontend_msg"
git push origin master
cd ..

echo "✅ Pushed to Git!"
echo ""
echo "📝 Next step: SSH to server and run deployment script"
echo "   ssh root@YOUR_SERVER_IP"
echo "   cd / && ./deploy_phonix.sh"
```

### Server Rollback Script:

**`rollback.sh`** - Server'da:

```bash
#!/bin/bash
# Rollback to previous version

DEPLOY_DIR="/phonix"
SERVICE_NAME="phoenix-backend"

echo "⚠️  Rolling back..."

# Backend rollback
cd ${DEPLOY_DIR}/backend
git log --oneline -5  # Show last 5 commits
read -p "Enter commit hash to rollback to: " commit_hash
git checkout $commit_hash

# Restart service
sudo systemctl restart ${SERVICE_NAME}

echo "✅ Rollback completed!"
```

---

## ⚠️ 6. Muhim Eslatmalar

### ✅ Qilish kerak:

1. **Git'ga push qilishdan oldin test qiling**
2. **.env faylini Git'ga push qilmang** (`.gitignore` da bo'lishi kerak)
3. **Database backup oling** muhim o'zgarishlardan oldin
4. **Service'ni graceful restart qiling** (reload yoki restart)
5. **Logs'ni kuzatib boring** deployment'dan keyin

### ❌ Qilmaslik kerak:

1. **Production'da `DEBUG=True` qo'ymang**
2. **Database'ni to'g'ridan-to'g'ri o'zgartirmang** (migration ishlating)
3. **Boshqa dasturlar portlarini ishlatmang**
4. **Root user bilan service'ni ishga tushirmang**
5. **.env faylini Git'ga commit qilmang**

---

## 🔄 7. To'liq Deployment Workflow (Qadam-baqadam)

### Step 1: Local Development

```bash
# 1. O'zgarishlarni qilish
# 2. Test qilish
# 3. Commit qilish
cd backend && git add . && git commit -m "Update" && git push
cd ../frontend && git add . && git commit -m "Update" && git push
```

### Step 2: Server Deployment

```bash
# 1. Server'ga ulanish
ssh root@YOUR_SERVER_IP

# 2. Deployment script ishga tushirish
cd / && ./deploy_phonix.sh

# 3. Tekshirish
sudo systemctl status phoenix-backend
curl https://api.ilmiyfaoliyat.uz/api/v1/
```

### Step 3: Verification

```bash
# 1. Service status
sudo systemctl status phoenix-backend

# 2. Logs
sudo journalctl -u phoenix-backend -f

# 3. API test
curl https://api.ilmiyfaoliyat.uz/api/v1/

# 4. Frontend test
curl https://ilmiyfaoliyat.uz/
```

---

## 📞 Yordam

Agar muammo bo'lsa:

1. **Service logs:** `sudo journalctl -u phoenix-backend -f`
2. **Nginx logs:** `sudo tail -f /var/log/nginx/error.log`
3. **Port conflict:** `sudo netstat -tlnp | grep 8000`
4. **Database:** `sudo -u postgres psql -d phoenix_scientific`

---

## 📚 Qo'shimcha Ma'lumotlar

- **Backend README:** `backend/README.md`
- **Frontend README:** `frontend/README.md`
- **Server Commands:** `SERVER-COMMANDS.md`
- **Server Deploy:** `SERVER-DEPLOY.md`
