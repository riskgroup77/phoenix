# Click Callback URL Tekshirish va To'g'rilash

## Muammo
Click to'lov sahifasida "Ошибка" (Error) ko'rsatilmoqda va `prepare` request pending holatda qolmoqda. Backend log'larda Click'ning POST callback'lari ko'rsatilmayapti.

## Tekshirish

### 1. Backend Endpoint'lar Ishlamoqda ✅
```bash
curl -X GET https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
# Natija: {"status": "ok", "message": "Prepare endpoint is active"}
```

### 2. Click Merchant Panel'da Callback URL'lar

**MUHIM:** Click merchant panel'da (`merchant.click.uz`) har bir service uchun callback URL'lar to'g'ri kiritilganligini tekshiring.

#### Service 89248 (Phoenix) uchun:
1. `merchant.click.uz` ga kiring
2. **Сервисы** (Services) bo'limiga o'ting
3. Service **89248** ni toping va tahrirlash
4. Quyidagi URL'larni kiriting:

**Prepare URL (Адрес проверки):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
```

**Complete URL (Адрес результата):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/
```

#### Service 82154 (Ilmiyfaoliyat.uz) uchun:
Xuddi shu URL'lar:
- Prepare: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/`
- Complete: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/`

#### Service 82155 (Phoenix publication) uchun:
Xuddi shu URL'lar:
- Prepare: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/`
- Complete: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/`

### 3. Click Xodimlariga Xabar Berish

URL'larni to'g'rilagandan so'ng, Click xodimlariga quyidagi xabarni yuboring:

```
Здравствуйте!

Я проверил callback URL'ы в merchant.click.uz для всех сервисов:
- Service 89248: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
- Service 82154: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
- Service 82155: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/

Все URL'ы настроены правильно и доступны (проверено через curl).

Однако, callback'и от Click не доходят до нашего сервера. 
В логах нет POST запросов на /api/v1/payments/click/prepare/ от Click.

Прошу проверить:
1. Активны ли callback'и для этих сервисов?
2. Правильно ли настроены callback URL'ы на стороне Click?
3. Есть ли какие-то ограничения или блокировки?

Спасибо!
```

## Tekshirish

URL'larni to'g'rilagandan va Click'ga xabar bergandan keyin:

1. To'lov qiling
2. Backend log'larni kuzating:
```bash
sudo tail -f /phonix/backend/logs/gunicorn-access.log | grep -i "click"
```
3. Click'ning POST callback'larini qidiring

## Muhim Eslatmalar

1. **URL oxirida `/` bo'lishi kerak!**
2. **HTTPS ishlatish kerak** (HTTP emas)
3. **To'liq path:** `/api/v1/payments/click/prepare/` (click/prepare/ emas!)
4. **Har bir service uchun alohida URL'lar** kiritilishi kerak
