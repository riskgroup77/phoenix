# Click URL Validation Muammosini Hal Qilish

## Muammo
Click merchant panel'da URL kiritganda "Пожалуйста введите правильный адрес" (Please enter a correct address) xatosi ko'rsatilmoqda.

## Yechimlar

### Variant 1: Trailing Slash O'chirish

Click ba'zida trailing slash'ni qabul qilmaydi. Quyidagi URL'larni sinab ko'ring:

**Prepare URL:**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare
```

**Complete URL:**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete
```

### Variant 2: URL Format'ni O'zgartirish

Agar hali ham ishlamasa, quyidagi format'larni sinab ko'ring:

**Variant A (trailing slash bilan):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/
```

**Variant B (trailing slash'siz):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete
```

### Variant 3: Backend'da Ikkala Format'ni Qo'llab-quvvatlash

Backend'da trailing slash'siz URL'larni ham qo'llab-quvvatlash uchun URL pattern'ni yangilaymiz.

## Tekshirish

URL'larni kiritgandan keyin:

1. **Saqlash** tugmasini bosing
2. Agar xatolik bo'lsa, boshqa variant'ni sinab ko'ring
3. Agar saqlash muvaffaqiyatli bo'lsa, Click'ga xabar bering

## Backend URL Pattern Yangilash

Agar Click trailing slash'siz URL'larni talab qilsa, backend'da URL pattern'ni yangilashimiz kerak bo'ladi.
