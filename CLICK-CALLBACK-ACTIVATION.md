# Click Callback Aktivlashtirish

## Muammo
Transaction yaratilmoqda, lekin Click'ning prepare callback'i backend'ga yetib bormayapti. Log'larda `POST.*click/prepare` request'lari yo'q.

## Yechim

### Qadam 1: Click Merchant Panel'da Callback URL'larni Tekshirish

Har bir service (82154, 88045, 89248, 82155) uchun:

1. `merchant.click.uz` ga kiring
2. Service'ni oching (qalam ikonka)
3. Quyidagi URL'larni tekshiring:

**Prepare URL (Адрес проверки):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare
```

**Complete URL (Адрес результата):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete
```

**MUHIM:**
- Trailing slash'siz kiriting (agar validation xatosi bo'lsa)
- Yoki trailing slash bilan: `/prepare/` va `/complete/`

### Qadam 2: Click Xodimlariga Xabar Berish

URL'larni to'g'rilagandan so'ng, Click xodimlariga quyidagi xabarni yuboring:

```
Здравствуйте!

Я настроил callback URL'ы для всех сервисов в merchant.click.uz:

- Service 82154 (Ilmiyfaoliyat.uz):
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete

- Service 88045 (PHOENIX):
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete

- Service 89248 (PHOENIX):
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete

- Service 82155 (Phoenix publication):
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete

Все URL'ы проверены через curl и доступны (HTTP 200).

Однако, callback'и от Click не доходят до нашего сервера. 
В логах нет POST запросов на /api/v1/payments/click/prepare/ от Click.

Прошу:
1. Проверить, активны ли callback'и для этих сервисов
2. Активировать callback'и, если они неактивны
3. Проверить правильность настроек на стороне Click

Спасибо!
```

### Qadam 3: Tekshirish

Click'ga xabar bergandan keyin:

1. To'lov qiling
2. Backend log'larni kuzating:
```bash
sudo tail -f /phonix/backend/logs/gunicorn-access.log | grep -i "click"
```
3. Click'ning POST callback'larini qidiring

## Muhim Eslatmalar

1. **Callback URL'lar Click tomonidan aktivlashtirilishi kerak** - faqat URL'larni kiritish yetarli emas
2. **Click xodimlariga xabar berish kerak** - callback'larni aktivlashtirish uchun
3. **Backend log'larni kuzatish** - callback'lar kelayotganini tekshirish uchun
