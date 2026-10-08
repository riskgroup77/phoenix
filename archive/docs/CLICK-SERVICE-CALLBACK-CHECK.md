# Click Service Callback URL Tekshirish

## Service'lar Ro'yxati

Sizda quyidagi service'lar mavjud:
- **82154** - Ilmiyfaoliyat.uz
- **88045** - PHOENIX
- **89248** - PHOENIX (asosiy)
- **82155** - Phoenix publication

## Har Bir Service Uchun Callback URL'larni Tekshirish

### Qadam 1: Service'ni Tahrirlash

1. `merchant.click.uz` ga kiring
2. **Список сервисов** (Services list) bo'limida
3. Har bir service'ning o'ng tomonidagi **qalam ikonka** (✏️) ni bosing

### Qadam 2: Callback URL'larni Tekshirish va To'g'rilash

Har bir service uchun quyidagi URL'lar bo'lishi kerak:

#### **Prepare URL (Адрес проверки):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
```

#### **Complete URL (Адрес результата):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/
```

### Qadam 3: Tekshirish

Har bir service uchun quyidagilarni tekshiring:

1. ✅ URL oxirida `/` borligi
2. ✅ `https://` ishlatilganligi (HTTP emas)
3. ✅ To'liq path: `/api/v1/payments/click/prepare/`
4. ✅ Har ikkala URL ham bir xil (prepare va complete)

### Qadam 4: Saqlash

Har bir service uchun:
1. URL'larni to'g'rilang (agar noto'g'ri bo'lsa)
2. **Сохранить** (Save) tugmasini bosing
3. Keyingi service'ga o'ting

## Tekshirish Script

Server'da quyidagi script'ni ishga tushiring:

```bash
cd /phonix/backend
chmod +x check-click-callback.sh
./check-click-callback.sh
```

## Click Xodimlariga Xabar

Barcha service'larda URL'larni to'g'rilagandan so'ng, Click xodimlariga quyidagi xabarni yuboring:

```
Здравствуйте!

Я проверил и настроил callback URL'ы для всех сервисов в merchant.click.uz:

- Service 82154 (Ilmiyfaoliyat.uz):
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/

- Service 88045 (PHOENIX):
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/

- Service 89248 (PHOENIX):
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/

- Service 82155 (Phoenix publication):
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/

Все URL'ы проверены через curl и доступны.

Однако, callback'и от Click не доходят до нашего сервера. 
В логах нет POST запросов на /api/v1/payments/click/prepare/ от Click.

Прошу проверить и активировать callback'и для всех этих сервисов.

Спасибо!
```

## Keyingi Qadamlar

1. Har bir service'ni ochib, callback URL'larni tekshiring
2. Agar noto'g'ri bo'lsa, to'g'rilang va saqlang
3. Click xodimlariga xabar bering
4. To'lov qilib, backend log'larni kuzating
