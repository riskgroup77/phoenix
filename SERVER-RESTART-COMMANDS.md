# Server Restart Commands - Backend va Frontend

## 🚀 Server'ga Ulanish

```bash
ssh root@YOUR_SERVER_IP
```

---

## 📦 Backend Restart

### 1. Backend papkasiga o'tish:
```bash
cd /phonix/backend
```

### 2. Git'dan yangi o'zgarishlarni olish:
```bash
git pull origin master
```

### 3. Virtual environment aktivlashtirish:
```bash
source venv/bin/activate
```

### 4. Dependencies yangilash (agar kerak bo'lsa):
```bash
pip install -r requirements.txt -q
```

### 5. Migrations tekshirish:
```bash
python manage.py migrate --noinput
```

### 6. Static files collect qilish:
```bash
python manage.py collectstatic --noinput
```

### 7. Service restart:
```bash
sudo systemctl restart phoenix-backend
```

### 8. Service status tekshirish:
```bash
sudo systemctl status phoenix-backend
```

---

## 🎨 Frontend Restart

### 1. Frontend papkasiga o'tish:
```bash
cd /phonix/frontend
```

### 2. Git'dan yangi o'zgarishlarni olish:
```bash
git pull origin master
```

### 3. Dependencies yangilash:
```bash
npm install --silent
```

### 4. Production environment variables sozlash:
```bash
export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1'
export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/'
```

### 5. Build qilish:
```bash
npm run build
```

### 6. Nginx reload (frontend static files uchun):
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔄 To'liq Restart (Bitta Buyruq)

### Option 1: Deployment Script Ishlatish
```bash
cd /
./deploy_phonix.sh
```

### Option 2: Manual Restart
```bash
# Backend
cd /phonix/backend
git pull origin master
source venv/bin/activate
pip install -r requirements.txt -q
python manage.py migrate --noinput
python manage.py collectstatic --noinput
deactivate
sudo systemctl restart phoenix-backend

# Frontend
cd /phonix/frontend
git pull origin master
npm install --silent
export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1'
export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/'
npm run build

# Nginx reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📊 Tekshirish

### Backend tekshirish:
```bash
# Service status
sudo systemctl status phoenix-backend

# Logs ko'rish
sudo journalctl -u phoenix-backend -f --lines=50

# API test
curl https://api.ilmiyfaoliyat.uz/api/v1/
```

### Frontend tekshirish:
```bash
# Nginx status
sudo systemctl status nginx

# Frontend test
curl https://ilmiyfaoliyat.uz/

# Build fayllarini tekshirish
ls -lh /phonix/frontend/dist/
```

---

## ⚠️ Muhim Eslatmalar

1. **Backend restart** - Service restart qilish kifoya, lekin yangi o'zgarishlar uchun git pull kerak
2. **Frontend restart** - Build qilish va Nginx reload kerak
3. **Database migrations** - Yangi migration'lar bo'lsa, migrate qilish kerak
4. **Static files** - collectstatic qilish kerak

---

## 🔍 Xatoliklar Tuzatish

### Agar service ishlamasa:
```bash
# Logs ko'rish
sudo journalctl -u phoenix-backend -n 100

# Service restart
sudo systemctl restart phoenix-backend

# Port tekshirish
sudo netstat -tlnp | grep 8000
```

### Agar build xatolik bersa:
```bash
# Node modules tozalash
cd /phonix/frontend
rm -rf node_modules
npm install

# Build qayta qilish
npm run build
```

---

*Yaratilgan: 2026-01-25*
