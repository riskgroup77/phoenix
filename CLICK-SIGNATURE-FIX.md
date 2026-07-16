# 🔧 Click "Invalid signature" Muammosini Hal Qilish

## ⚠️ MUAMMO

Click'dan kelgan callback'da:
```
[error] => -1
[error_note] => Invalid signature
```

**Sabab:** Click `service_id=82154` bilan callback yubormoqda, lekin biz `89248` ishlatmoqdamiz va secret key mos kelmayapti.

---

## ✅ YECHIM - QILINGAN ISHLAR

### 1. Service-specific Secret Keys

Endi backend **Click'dan kelgan service_id ga mos secret key** ishlatadi:

- **Service 82154** → `CLICK_SERVICE_82154_SECRET_KEY` ishlatiladi
- **Service 89248** → `CLICK_SERVICE_89248_SECRET_KEY` ishlatiladi

### 2. Kod O'zgarishlari

- ✅ `ClickPaymentService` ga `get_secret_key_for_service()` metodi qo'shildi
- ✅ `handle_prepare()` da Click'dan kelgan `service_id` ga mos secret key ishlatiladi
- ✅ `handle_complete()` da transaction'dan `service_id` olinadi va mos secret key ishlatiladi
- ✅ Transaction modeliga `click_service_id` field qo'shildi

---

## 🔧 SERVER'DA QILISH KERAK

### 1. Click'dan To'g'ri Secret Key Olish

**Click xodimlariga so'rang:**

> "Service ID 82154 uchun secret key nima? Prepare callback'da signature mismatch xatosi kelmoqda."

Yoki Click merchant panel'da ko'ring.

### 2. Backend'ni Yangilash

```bash
cd /phonix/backend
git pull origin master
```

### 3. .env Faylini Yangilash

```bash
nano .env
```

**Quyidagi qatorni toping va yangilang:**

```env
# Service 82154 uchun (Click'dan olgan to'g'ri secret key)
CLICK_SERVICE_82154_SECRET_KEY=TO'G'RI_SECRET_KEY_BURAYA
```

**⚠️ MUHIM:** `TO'G'RI_SECRET_KEY_BURAYA` o'rniga **Click'dan olgan to'g'ri secret key** ni kiriting!

**Saqlash:** `Ctrl+O`, `Enter`, `Ctrl+X`

### 4. Migration Qilish

```bash
source venv/bin/activate
python manage.py makemigrations
python manage.py migrate
deactivate
```

### 5. Backend Restart

```bash
sudo systemctl restart phoenix-backend
sudo systemctl status phoenix-backend
```

---

## 🧪 TEST QILISH

### 1. Backend Test

```bash
cd /phonix/backend
source venv/bin/activate
python << 'EOF'
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '/phonix/backend')
django.setup()

from apps.payments.services import ClickPaymentService

service = ClickPaymentService()

# Test 82154 service secret key
key_82154 = service.get_secret_key_for_service('82154')
print(f"Service 82154 secret key: {key_82154[:10]}...")

# Test 89248 service secret key
key_89248 = service.get_secret_key_for_service('89248')
print(f"Service 89248 secret key: {key_89248[:10]}...")

print("\n✅ Service-specific secret keys ishlayapti!")
EOF
deactivate
```

### 2. Real To'lov Test

1. Frontend'da to'lov yarating
2. Click sahifasiga o'ting
3. To'lovni amalga oshiring
4. Log'larni kuzating:

```bash
sudo tail -f /phonix/backend/logs/gunicorn-error.log | grep -i "signature\|service_id"
```

**Ko'rinishi kerak:**
```
Using secret key for service_id=82154
Expected signature: ..., Received signature: ...
✅ Signature match!
```

---

## 📊 LOG'LARNI TEKSHIRISH

```bash
# Signature log'larni ko'rish
sudo tail -100 /phonix/backend/logs/gunicorn-error.log | grep -A 5 "Prepare signature"

# Service ID log'larni ko'rish
sudo tail -100 /phonix/backend/logs/gunicorn-error.log | grep "service_id"
```

---

## ✅ NATIJA

Endi backend:
- ✅ Click'dan kelgan **har qanday service_id** uchun mos secret key ishlatadi
- ✅ Service 82154 uchun → `CLICK_SERVICE_82154_SECRET_KEY`
- ✅ Service 89248 uchun → `CLICK_SERVICE_89248_SECRET_KEY`
- ✅ Signature mismatch muammosi hal bo'ladi!

---

## 📞 CLICK BILAN BOG'LANISH

Agar secret key'ni bilmasangiz:

**Telegram:** @clicksupport  
**Email:** support@click.uz

**Xabar:**
```
Здравствуйте!

У меня проблема с signature в prepare callback.

Service ID: 82154
Merchant ID: 45730

Прошу сообщить secret key для service 82154.

Спасибо!
```

---

## 🎯 XULOSA

**Muammo hal qilindi!** Faqat Click'dan to'g'ri secret key olish va `.env` fayliga kiritish kerak.

**Keyin hammasi ishlaydi!** 🚀
