# Server'da Vite Permission Xatolik Tuzatish

## ⚠️ Muammo

Frontend build qilishda xatolik:
```
sh: 1: vite: Permission denied
```

## ✅ Yechimlar

### Option 1: npx ishlatish (Tavsiya etiladi)
```bash
cd /phonix/frontend
npx vite build
```

### Option 2: node_modules/.bin/vite faylini executable qilish
```bash
cd /phonix/frontend
chmod +x node_modules/.bin/vite
npm run build
```

### Option 3: node_modules'ni qayta o'rnatish
```bash
cd /phonix/frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Option 4: To'liq qayta o'rnatish (Agar yuqoridagilar ishlamasa)
```bash
cd /phonix/frontend
git stash
git pull origin master
rm -rf node_modules package-lock.json
npm install --silent
chmod +x node_modules/.bin/*
export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1'
export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/'
npx vite build
sudo systemctl reload nginx
```

---

## 📝 Eslatma

`package.json`'da build script endi `npx vite build` ishlatadi, shuning uchun kelajakda bu muammo takrorlanmaydi.

---

*Yaratilgan: 2026-01-25*
