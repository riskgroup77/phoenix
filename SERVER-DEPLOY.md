# Server'ga Deployment - Qisqa Yo'riqnoma

## Server'ga Ulanish va Deployment

### 1. Server'ga ulanish:
```bash
ssh root@YOUR_SERVER_IP
# Parolni repoga yozmang — SSH kalit yoki vault ishlating.
```

### 2. Scriptni yuklab olish va ishga tushirish:

**Master branch uchun (to'g'ri):**
```bash
cd / && wget -O update_phonix.sh https://raw.githubusercontent.com/aiziyrak-coder/phonixB/master/update_phonix.sh && chmod +x update_phonix.sh && ./update_phonix.sh
```

**Yoki alohida qadamlarda:**
```bash
cd /
wget -O update_phonix.sh https://raw.githubusercontent.com/aiziyrak-coder/phonixB/master/update_phonix.sh
chmod +x update_phonix.sh
ls -la update_phonix.sh  # Fayl yuklangani tekshirish
./update_phonix.sh
```

**Agar wget ishlamasa, fayl yuklanmagan bo'lsa:**
```bash
# To'g'ridan-to'g'ri GitHub'dan clone qilib olish
cd /
git clone https://github.com/aiziyrak-coder/phonixB.git temp-backend
cp temp-backend/update_phonix.sh ./
chmod +x update_phonix.sh
rm -rf temp-backend
./update_phonix.sh
```

## Script Nimalar Qiladi?

1. ✅ System dependencies o'rnatadi (Python, Node, Nginx, PostgreSQL)
2. ✅ Backend va Frontend repository'larini GitHub'dan clone/update qiladi
3. ✅ Backend virtual environment yaratadi va dependencies o'rnatadi
4. ✅ Database migrations ishga tushiradi
5. ✅ Static files collect qiladi
6. ✅ Frontend build qiladi (production API URL'lar bilan)
7. ✅ PostgreSQL database yaratadi
8. ✅ Nginx konfiguratsiyalarini sozlaydi
9. ✅ SSL sertifikatlarni o'rnatadi (birinchi marta)
10. ✅ Systemd service yaratadi va ishga tushiradi

## Keyingi Qadamlar (MAJURIY!)

### 1. Backend .env faylini sozlash:
```bash
nano /phonix/backend/.env
```

**Quyidagilarni to'ldiring:**
```env
SECRET_KEY=your-very-strong-secret-key-here-minimum-50-characters
DEBUG=False
ALLOWED_HOSTS=api.ilmiyfaoliyat.uz,167.71.53.238,localhost

DB_NAME=phoenix_scientific
DB_USER=postgres
DB_PASSWORD=your-database-password
DB_HOST=localhost
DB_PORT=5432
USE_SQLITE=False

CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://ilmiyfaoliyat.uz

CLICK_MERCHANT_ID=45730
CLICK_SERVICE_ID=89248
CLICK_SECRET_KEY=<REDACTED_CLICK_SECRET>
CLICK_MERCHANT_USER_ID=72021

GEMINI_API_KEY=your-gemini-api-key-here
```

### 2. Service'ni qayta ishga tushirish:
```bash
sudo systemctl restart phoenix-backend
sudo systemctl status phoenix-backend
```

### 3. Tekshirish:
```bash
# Service status
sudo systemctl status phoenix-backend

# Logs
sudo journalctl -u phoenix-backend -f

# Test endpoints
curl https://api.ilmiyfaoliyat.uz/api/v1/
curl https://ilmiyfaoliyat.uz/
```

## Click Payment Callbacks Sozlash

Click merchant panel'da (https://merchant.click.uz/):
- **Prepare URL**: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/`
- **Complete URL**: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/`
- **Server IP Whitelist**: `167.71.53.238`
