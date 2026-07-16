# Server'da Frontend Yangilash

## ✅ Service Ishlamoqda!

Service endi `active (running)` holatida. Endi frontend'ni yangilash kerak.

## 🚀 Frontend Yangilash va Build

### 1. Frontend'ni Git'dan Yangilash:

```bash
cd /phonix/frontend

# Git pull
git pull origin master
# yoki
git pull origin main
```

### 2. Dependencies va Build:

```bash
# Dependencies o'rnatish
npm install

# Production environment variables
export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1'
export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/'

# Build qilish
npm run build
```

### 3. Nginx Restart (agar kerak bo'lsa):

```bash
sudo systemctl restart nginx
```

### 4. Tekshirish:

```bash
# Frontend test
curl https://ilmiyfaoliyat.uz/

# API test
curl https://api.ilmiyfaoliyat.uz/api/v1/
```

---

## 🔄 To'liq Script (Bir Qatorda):

```bash
cd /phonix/frontend && \
git pull origin master && \
npm install && \
export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1' && \
export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/' && \
npm run build && \
echo "✅ Frontend yangilandi va build qilindi!"
```

---

## 📝 Eslatma

- Frontend'ni yangilashdan oldin service ishlayotganini tekshiring
- Build jarayoni bir necha daqiqa davom etishi mumkin
- Build'dan keyin Nginx restart qilish shart emas (lekin tavsiya etiladi)
