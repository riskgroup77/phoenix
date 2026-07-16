# Server'da Git Pull Xatolik Tuzatish

## ⚠️ Muammo

Frontend'da git pull xatolik berdi:
```
error: Your local changes to the following files would be overwritten by merge:
        dist/index.html
        package-lock.json
Please commit your changes or stash them before you merge.
```

## ✅ Yechim

Server'da quyidagi buyruqlarni bajarish kerak:

### Option 1: Git Stash (Tavsiya etiladi)
```bash
cd /phonix/frontend
git stash
git pull origin master
git stash pop  # Agar kerak bo'lsa
npm install --silent
export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1'
export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/'
npm run build
sudo systemctl reload nginx
```

### Option 2: Local O'zgarishlarni Discard Qilish
```bash
cd /phonix/frontend
git restore dist/index.html package-lock.json
git pull origin master
npm install --silent
export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1'
export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/'
npm run build
sudo systemctl reload nginx
```

### Option 3: Force Pull (Ehtiyotkorlik bilan)
```bash
cd /phonix/frontend
git fetch origin
git reset --hard origin/master
npm install --silent
export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1'
export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/'
npm run build
sudo systemctl reload nginx
```

---

## 📝 Eslatma

`dist/` va `package-lock.json` fayllari build jarayonida yaratiladi, shuning uchun ularni stash qilish yoki restore qilish xavfsiz.

---

*Yaratilgan: 2026-01-25*
