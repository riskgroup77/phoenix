# Click To'lov Muammosini Tekshirish

## ⚠️ Muammo
To'lov merchant panel'ga kelmoqda, lekin o'ng tarafda undovlar (sariq belgilar) ko'rsatilmoqda. Bu to'lov tugallanmaganligini bildiradi.

## 🔍 Tekshirish Qadamlar

### 1. Backend Logs'ni Tekshirish (Click Callback'lar):

```bash
# Click prepare callback'larini ko'rish
sudo tail -100 /phonix/backend/logs/gunicorn-access.log | grep -i "click/prepare"

# Click complete callback'larini ko'rish
sudo tail -100 /phonix/backend/logs/gunicorn-access.log | grep -i "click/complete"

# Yoki Django logs'ni ko'rish
sudo tail -100 /phonix/backend/logs/gunicorn-error.log | grep -i "click"
```

### 2. Backend'da Click Callback Endpoint'larini Test Qilish:

```bash
# Prepare endpoint'ni test qilish
curl -X POST https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/ \
  -H "Content-Type: application/json" \
  -d '{
    "click_trans_id": "123456789",
    "service_id": "89248",
    "merchant_trans_id": "test-trans-id",
    "amount": "1000.00",
    "action": "1",
    "sign_time": "1234567890",
    "sign_string": "test-sign"
  }'

# Complete endpoint'ni test qilish
curl -X POST https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/ \
  -H "Content-Type: application/json" \
  -d '{
    "click_trans_id": "123456789",
    "merchant_trans_id": "test-trans-id",
    "merchant_prepare_id": "test-trans-id",
    "error": "0",
    "sign_time": "1234567890",
    "sign_string": "test-sign"
  }'
```

### 3. Click Merchant Panel'da Callback URL'larini Tekshirish:

Merchant panel'ga kirib, quyidagi URL'lar to'g'ri kiritilganligini tekshiring:

**Prepare URL (Адрес проверки):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
```

**Complete URL (Адрес результата):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/
```

⚠️ **Muhim:** URL'lar oxirida `/` bo'lishi kerak!

### 4. Nginx Config'ni Tekshirish (Callback URL'lar uchun):

```bash
# Nginx config'ni ko'rish
sudo cat /etc/nginx/sites-available/phoenix-backend | grep -A 10 "click"

# Yoki to'liq config
sudo cat /etc/nginx/sites-available/phoenix-backend
```

### 5. Real Transaction ID bilan Test:

```bash
# Oxirgi transaction'ni topish
cd /phonix/backend
source venv/bin/activate
python manage.py shell

# Shell'da:
from apps.payments.models import Transaction
last_transaction = Transaction.objects.order_by('-created_at').first()
print(f"Last transaction ID: {last_transaction.id}")
print(f"Status: {last_transaction.status}")
print(f"Amount: {last_transaction.amount}")
exit()
```

---

## ✅ Muammo Hal Qilish

### Muammo 1: Callback URL'lar Noto'g'ri

Agar callback URL'lar noto'g'ri bo'lsa, merchant panel'da to'g'rilang:
1. merchant.click.uz ga kiring
2. "Сервисы" bo'limiga o'ting
3. Service'ni tahrirlang
4. Prepare URL va Complete URL'ni to'g'ri kiriting

### Muammo 2: Signature Verification Xatosi

Agar signature verification xatosi bo'lsa, `handle_complete` funksiyasida signature generation'ni tekshiring.

### Muammo 3: Transaction Topilmayapti

Agar transaction topilmayotgan bo'lsa, `merchant_trans_id` format'ini tekshiring.

---

## 🔧 Debug Script

```bash
#!/bin/bash
# Click payment debug script

echo "=== Backend Service Status ==="
sudo systemctl status phoenix-backend --no-pager | head -10

echo ""
echo "=== Recent Click Prepare Callbacks ==="
sudo tail -50 /phonix/backend/logs/gunicorn-access.log | grep "click/prepare" | tail -5

echo ""
echo "=== Recent Click Complete Callbacks ==="
sudo tail -50 /phonix/backend/logs/gunicorn-access.log | grep "click/complete" | tail -5

echo ""
echo "=== Recent Click Errors ==="
sudo tail -50 /phonix/backend/logs/gunicorn-error.log | grep -i "click" | tail -10

echo ""
echo "=== Last 5 Transactions ==="
cd /phonix/backend
source venv/bin/activate
python manage.py shell << EOF
from apps.payments.models import Transaction
from django.utils import timezone
transactions = Transaction.objects.order_by('-created_at')[:5]
for t in transactions:
    print(f"ID: {t.id}, Status: {t.status}, Amount: {t.amount}, Created: {t.created_at}")
EOF
deactivate
```
