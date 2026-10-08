# Click Payment Callback URLs - To'g'ri Sozlash

## ⚠️ MUHIM: Hozirgi URL lar NOTO'G'RI!

Rasmdan ko'rinib turibdiki, siz quyidagi URL larni kiritgansiz:
- ❌ `https://api.ilmiyfaoliyat.uz/click/prepare/`
- ❌ `https://api.ilmiyfaoliyat.uz/click/complete/`

Bu URL lar **noto'g'ri** chunki `/api/v1/payments/` qismi yo'q!

---

## ✅ TO'G'RI URL LAR

Click Merchant Panel'da (merchant.click.uz) quyidagi URL larni kiriting:

### 1. Prepare URL (Адрес проверки):
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
```

### 2. Complete URL (Адрес результата):
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/
```

---

## 📋 Qadam-baqadam Ko'rsatma

### 1. Merchant Panel'ga kirish:
- URL: https://merchant.click.uz
- Login va parol bilan kirish

### 2. Services bo'limiga o'tish:
- Chap menudan **"Сервисы"** (Services) ni tanlang

### 3. Service'ni tahrirlash:
- Service ro'yxatida o'z service'ingizni toping
- O'ng tomondagi **"Действие"** (Action) ustunida **qalam ikonka** ni bosing

### 4. URL larni kiritish:
**Prepare URL (Адрес проверки) maydoniga:**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
```

**Complete URL (Адрес результата) maydoniga:**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/
```

### 5. Saqlash:
- **"Сохранить"** (Save) tugmasini bosing

### 6. Click xodimlariga xabar berish:
URL larni kiritgandan so'ng, Click xodimlariga quyidagi xabarni yuboring:

```
Здравствуйте!

Я успешно прописал callback URL'ы в merchant.click.uz:

- Prepare URL: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
- Complete URL: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/

Прошу активировать мой сервис для реальных платежей.

Спасибо!
```

---

## 🔍 URL Struktura Tushuntirish

Backend URL struktura:
```
api/v1/payments/          <- Asosiy payments endpoint (config/urls.py)
    └── click/            <- Click integratsiya
        ├── prepare/      <- Prepare callback
        └── complete/     <- Complete callback
```

Shuning uchun to'liq URL:
- Base: `https://api.ilmiyfaoliyat.uz`
- Path: `/api/v1/payments/click/prepare/`
- Full: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/`

---

## ✅ Tekshirish

URL larni kiritgandan so'ng, quyidagi usullar bilan tekshirishingiz mumkin:

### 1. Browser'da tekshirish:
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
```
(405 Method Not Allowed ko'rsatishi kerak - bu normal, chunki POST so'rov kerak)

### 2. cURL bilan test:
```bash
curl -X POST https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/ \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### 3. Backend loglarini tekshirish:
```bash
sudo journalctl -u phoenix-backend -f
```

---

## ⚠️ Diqqat!

1. **Trailing slash muhim!** URL oxirida `/` bo'lishi kerak
2. **HTTPS ishlatish kerak!** HTTP emas
3. **To'liq path!** `/api/v1/payments/` qismini o'tkazib yubormang
4. **Click xodimlariga xabar bering!** URL larni kiritgandan so'ng ularni aktivlashtirish kerak

---

## 📞 Yordam

Agar muammo bo'lsa:
1. Backend loglarini tekshiring: `sudo journalctl -u phoenix-backend -f`
2. Nginx loglarini tekshiring: `sudo tail -f /var/log/nginx/error.log`
3. Click merchant panel'da URL larni qayta tekshiring
