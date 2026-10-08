# Click Callback Muammosini Hal Qilish

## Muammo
Click to'lov sahifasida "Ошибка" (Error) ko'rsatilmoqda va `prepare` request pending holatda qolmoqda. Transaction'lar yaratilmoqda, lekin Click callback'lari backend'ga yetib bormayapti.

## Tekshirish

### 1. Backend Callback Endpoint'larini Test Qilish

```bash
# Prepare endpoint'ni test qilish
curl -X GET https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
# Natija: {"status": "ok", "message": "Prepare endpoint is active"}

# Complete endpoint'ni test qilish
curl -X GET https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/
# Natija: {"status": "ok", "message": "Complete endpoint is active"}
```

### 2. Click Merchant Panel'da Callback URL'lar

**MUHIM:** Click merchant panel'da (`merchant.click.uz`) quyidagi URL'lar to'g'ri kiritilganligini tekshiring:

**Service 89248 uchun:**
- **Prepare URL (Адрес проверки):** `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/`
- **Complete URL (Адрес результата):** `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/`

**Service 82154 uchun (Ilmiyfaoliyat.uz):**
- **Prepare URL:** `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/`
- **Complete URL:** `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/`

**Service 82155 uchun (Phoenix publication):**
- **Prepare URL:** `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/`
- **Complete URL:** `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/`

### 3. Nginx Routing Tekshirish

```bash
# Nginx config'ni tekshirish
sudo nginx -t

# Nginx log'larni ko'rish
sudo tail -50 /var/log/nginx/access.log | grep "click"
sudo tail -50 /var/log/nginx/error.log | grep "click"
```

### 4. Backend Log'larni Real-time Kuzatish

```bash
# Access log'ni kuzatish
sudo tail -f /phonix/backend/logs/gunicorn-access.log | grep -i "click"

# Error log'ni kuzatish
sudo tail -f /phonix/backend/logs/gunicorn-error.log | grep -i "click"
```

## Yechim

### Qadam 1: Click Merchant Panel'da URL'larni Tekshirish

1. `merchant.click.uz` ga kiring
2. Service'lar bo'limiga o'ting
3. Har bir service (89248, 82154, 82155) uchun callback URL'larni tekshiring
4. Agar noto'g'ri bo'lsa, to'g'rilang va saqlang

### Qadam 2: Click Xodimlariga Xabar Berish

URL'larni to'g'rilagandan so'ng, Click xodimlariga quyidagi xabarni yuboring:

```
Здравствуйте!

Я проверил callback URL'ы в merchant.click.uz для всех сервисов:
- Service 89248: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
- Service 82154: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
- Service 82155: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/

Все URL'ы настроены правильно. Прошу проверить, почему callback'и не доходят до нашего сервера.

Спасибо!
```

### Qadam 3: Backend'ni Tekshirish

```bash
cd /phonix/backend
source venv/bin/activate

# Callback endpoint'larni test qilish
python manage.py shell << 'EOF'
from django.test import Client
client = Client()

# Prepare endpoint test
response = client.get('/api/v1/payments/click/prepare/')
print(f"Prepare GET: {response.status_code} - {response.json()}")

# Complete endpoint test
response = client.get('/api/v1/payments/click/complete/')
print(f"Complete GET: {response.status_code} - {response.json()}")
EOF
```

## Tekshirish

To'lov qilgandan keyin:

1. Browser Network tab'da `prepare` request'ning status'ini ko'ring
2. Backend log'larda Click callback'larini qidiring
3. Transaction'da `click_trans_id` va `click_service_id` to'ldirilganligini tekshiring
