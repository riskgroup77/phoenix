# Click GET Request Fix

## ⚠️ Muammo
Click.uz merchant panel URL'ni validatsiya qilayotganda GET so'rov yuboradi, lekin bizning endpoint faqat POST so'rovlarni qabul qiladi. Bu "Пожалуйста введите правильный адрес" xatosiga olib kelmoqda.

## ✅ Yechim
`click_prepare_view` va `click_complete_view` endpoint'larini GET so'rovlarni ham qabul qilish uchun yangiladim.

## 📝 O'zgarishlar

### `backend/apps/payments/views.py`:

1. **click_prepare_view**: `@api_view(['POST'])` → `@api_view(['GET', 'POST'])`
2. **click_complete_view**: `@api_view(['POST'])` → `@api_view(['GET', 'POST'])`

GET so'rovlar uchun 200 OK va `{'status': 'ok', 'message': '...'}` qaytariladi.

## 🚀 Deploy Qilish

### 1. Local'da Git'ga Push:

```bash
cd E:\Phonix\backend
git add apps/payments/views.py
git commit -m "Fix: Click callback endpoints to accept GET requests for URL validation"
git push origin master
```

### 2. Server'da Deploy:

```bash
# Backend'ni yangilash
cd /phonix/backend
git pull origin master

# Service'ni qayta ishga tushirish
sudo systemctl restart phoenix-backend
sudo systemctl status phoenix-backend
```

### 3. Test Qilish:

```bash
# GET so'rov bilan test
curl https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
curl https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/

# POST so'rov bilan test (callback)
curl -X POST https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "click_trans_id=123&service_id=89248&merchant_trans_id=test&amount=1000&action=1&sign_time=1234567890&sign_string=test"
```

## ✅ Keyin Qilish

1. **Deploy qiling** (yuqoridagi qadamlarni bajaring)
2. **Click merchant panel'ga kiring** va URL'larni qayta saqlang
3. **Xatolik yo'qolishi kerak** - "Пожалуйста введите правильный адрес" ko'rinmaydi
4. **Click xodimlariga xabar bering** - URL'larni aktivlashtirish kerak
