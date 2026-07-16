# Git Push va Server Deployment - Ko'rsatma

## 📋 O'zgarishlar Ro'yxati

Quyidagi fayllar o'zgartirildi:

### Frontend:
1. ✅ `frontend/services/paymentService.ts` - CSP muammosini hal qilish uchun redirect usuli yaxshilandi
2. ✅ `frontend/pages/SubmitBook.tsx` - handlePay funksiyasi yaxshilandi
3. ✅ `frontend/pages/SubmitArticle.tsx` - handlePay funksiyasi yaxshilandi

### Qo'shimcha fayllar:
4. ✅ `deploy_phonix.sh` - Server deployment script
5. ✅ `deploy-local.sh` - Local deployment script
6. ✅ `DEPLOYMENT-WORKFLOW.md` - To'liq deployment yo'riqnomasi
7. ✅ `CSP-ERROR-FIX.md` - CSP xatolik yechimi
8. ✅ `CLICK-URLS-CONFIG.md` - Click URL sozlash

---

## 🚀 Qadam-baqadam: Git Push

### 1. Frontend'ni Push Qilish:

```bash
# Frontend papkasiga o'tish
cd E:\Phonix\frontend

# O'zgarishlarni ko'rish
git status

# Barcha o'zgarishlarni qo'shish
git add .

# Commit qilish
git commit -m "Fix: CSP xatolik va to'lov redirect muammosini hal qilish

- redirectToPayment funksiyasini yaxshilash (window.location.replace ishlatish)
- CSP muammolarini kamaytirish uchun body tozalash
- handlePay funksiyalarida event handling yaxshilash
- Modal yopish va redirect ishlashini ta'minlash"

# Push qilish
git push origin master
# yoki
git push origin main
```

### 2. Backend'ni Push Qilish (agar o'zgarishlar bo'lsa):

```bash
# Backend papkasiga o'tish
cd E:\Phonix\backend

# O'zgarishlarni ko'rish
git status

# Agar o'zgarishlar bo'lsa
git add .
git commit -m "Update: Deployment script va dokumentatsiya qo'shildi"
git push origin master
```

---

## 🖥️ Server'da Deployment

### 1. Server'ga Ulanish:

```bash
ssh root@YOUR_SERVER_IP
# Parolni repoga yozmang.
```

### 2. Deployment Scriptni Ishga Tushirish:

**Variant 1: GitHub'dan yuklab olish (agar script push qilingan bo'lsa):**

```bash
cd /
wget -O deploy_phonix.sh https://raw.githubusercontent.com/aiziyrak-coder/phonixB/master/deploy_phonix.sh
chmod +x deploy_phonix.sh
./deploy_phonix.sh
```

**Variant 2: To'g'ridan-to'g'ri yaratish (tavsiya etiladi):**

```bash
cd /
cat > deploy_phonix.sh << 'SCRIPT_END'
#!/bin/bash

# Phoenix Scientific Platform - Xavfsiz Deployment Script
set -e

DEPLOY_DIR="/phonix"
BACKEND_REPO="https://github.com/aiziyrak-coder/phonixB.git"
FRONTEND_REPO="https://github.com/aiziyrak-coder/phonixF.git"
SERVICE_NAME="phoenix-backend"
BACKEND_PORT=8000
FRONTEND_DOMAIN="ilmiyfaoliyat.uz"
API_DOMAIN="api.ilmiyfaoliyat.uz"

error_exit() {
    echo "❌ Xatolik: $1" >&2
    exit 1
}

echo "🚀 Phoenix Deployment boshlandi..."
echo "📅 Vaqt: $(date)"
echo ""

# Backup
BACKUP_DIR="${DEPLOY_DIR}/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p ${BACKUP_DIR}
if [ -d "${DEPLOY_DIR}/backend" ]; then
    echo "💾 Backup yaratilmoqda..."
    cp -r ${DEPLOY_DIR}/backend ${BACKUP_DIR}/backend 2>/dev/null || true
fi
if [ -f "${DEPLOY_DIR}/backend/.env" ]; then
    cp ${DEPLOY_DIR}/backend/.env ${BACKUP_DIR}/.env
fi

# Backend
echo "📦 Backend yangilanmoqda..."
cd ${DEPLOY_DIR}
if [ -d "backend/.git" ]; then
    cd backend
    git stash 2>/dev/null || true
    git pull origin master || git pull origin main || error_exit "Git pull xatolik"
    git stash pop 2>/dev/null || true
else
    [ -d "backend" ] && rm -rf backend
    git clone ${BACKEND_REPO} backend || error_exit "Backend clone xatolik"
    cd backend
fi

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt gunicorn -q || error_exit "Dependencies xatolik"

if [ ! -f .env ] && [ -f "${BACKUP_DIR}/.env" ]; then
    cp ${BACKUP_DIR}/.env .env
fi

python manage.py migrate --noinput || error_exit "Migrations xatolik"
python manage.py collectstatic --noinput || error_exit "Collectstatic xatolik"
deactivate
echo "✅ Backend yangilandi"
echo ""

# Frontend
echo "📦 Frontend yangilanmoqda..."
cd ${DEPLOY_DIR}
if [ -d "frontend/.git" ]; then
    cd frontend
    git stash 2>/dev/null || true
    git pull origin master || git pull origin main || error_exit "Git pull xatolik"
    git stash pop 2>/dev/null || true
else
    [ -d "frontend" ] && rm -rf frontend
    git clone ${FRONTEND_REPO} frontend || error_exit "Frontend clone xatolik"
    cd frontend
fi

npm install --silent || error_exit "npm install xatolik"
export VITE_API_BASE_URL="https://${API_DOMAIN}/api/v1"
export VITE_MEDIA_URL="https://${API_DOMAIN}/media/"
npm run build || error_exit "Frontend build xatolik"
echo "✅ Frontend yangilandi"
echo ""

# Service restart
echo "🔄 Service restart qilinmoqda..."
if systemctl is-active --quiet ${SERVICE_NAME}; then
    sudo systemctl reload ${SERVICE_NAME} 2>/dev/null || sudo systemctl restart ${SERVICE_NAME}
else
    sudo systemctl start ${SERVICE_NAME}
fi

sleep 2
echo ""
echo "📊 Service status:"
sudo systemctl status ${SERVICE_NAME} --no-pager | head -15

echo ""
echo "✅ Deployment muvaffaqiyatli yakunlandi!"
echo "📝 Logs: sudo journalctl -u ${SERVICE_NAME} -f"
SCRIPT_END

chmod +x deploy_phonix.sh
./deploy_phonix.sh
```

### 3. Tekshirish:

```bash
# Service status
sudo systemctl status phoenix-backend

# Logs
sudo journalctl -u phoenix-backend -f

# API test
curl https://api.ilmiyfaoliyat.uz/api/v1/

# Frontend test
curl https://ilmiyfaoliyat.uz/
```

---

## ✅ Tekshirish Ro'yxati

Deployment'dan keyin quyidagilarni tekshiring:

1. ✅ Service ishlayaptimi: `sudo systemctl status phoenix-backend`
2. ✅ API javob berayaptimi: `curl https://api.ilmiyfaoliyat.uz/api/v1/`
3. ✅ Frontend yuklanayaptimi: Browser'da `https://ilmiyfaoliyat.uz/` oching
4. ✅ To'lov jarayoni: Test to'lov qiling va CSP xatolikni tekshiring
5. ✅ Logs: `sudo journalctl -u phoenix-backend -f`

---

## 🐛 Muammo Bo'lsa

Agar muammo bo'lsa:

1. **Logs tekshiring:**
   ```bash
   sudo journalctl -u phoenix-backend -f
   ```

2. **Service restart:**
   ```bash
   sudo systemctl restart phoenix-backend
   ```

3. **Nginx restart:**
   ```bash
   sudo systemctl restart nginx
   ```

4. **Backup'dan restore:**
   ```bash
   cd /phonix/backups
   ls -la  # Eng so'nggi backup'ni toping
   # Keyin restore qiling
   ```

---

## 📝 Eslatma

- Frontend'ni push qilish **majburiy** - chunki `paymentService.ts` o'zgartirildi
- Backend'ni push qilish **ixtiyoriy** - agar o'zgarishlar bo'lsa
- Server'da deployment script **avtomatik** Git'dan yangi kodlarni oladi
- CSP xatolik **Click sahifasida** - bizning kodimiz to'g'ri ishlaydi
