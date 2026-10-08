# Click Callback Tekshirish

**Muhim:** QR skanerlab to‘lov qilganda «To'lov bekor qilindi» chiqmasligi uchun:
- Backend **internetdan ochiq** bo‘lishi kerak (masalan `https://api.ilmiyfaoliyat.uz`). Localhost’da Click serveri prepare/complete callback’larni yubora olmaydi.
- **Tranzaksiya va callback bir xil backend’da bo‘lishi kerak:** to‘lov yaratiladigan server (frontend qaysi API’ga so‘rov yuborsa) va Click callback qiladigan URL bir xil serverga yo‘naltirilgan bo‘lishi kerak. Masalan: frontend `api.ilmiyfaoliyat.uz` ga ulansa, Prepare/Complete ham `api.ilmiyfaoliyat.uz` da bo‘lsin; localhost’da test qilsangiz, Click localhost’ga yetolmaydi.
- Click merchant panelda Prepare va Complete URL’lar to‘g‘ri (yuqoridagi kabi) bo‘lishi kerak.
- Backend: transaction qidiruv UUID (har qanday registr) va `merchant_trans_id` orqali; amount so‘m yoki tiyinda qabul qilinadi.

## 🔍 1. Backend Logs'ni Ko'rish

```bash
# Click callback'larini ko'rish (access log)
sudo tail -100 /phonix/backend/logs/gunicorn-access.log | grep -i "click"

# Click xatolarini ko'rish (error log)
sudo tail -100 /phonix/backend/logs/gunicorn-error.log | grep -i "click"

# Yoki Django logs (agar mavjud bo'lsa)
sudo journalctl -u phoenix-backend -n 100 --no-pager | grep -i "click"
```

## 🔍 2. Nginx Access Logs'ni Ko'rish

```bash
# Nginx access log'ni ko'rish
sudo tail -100 /var/log/nginx/api-ilmiyfaoliyat.access.log | grep -i "click"

# Yoki error log
sudo tail -100 /var/log/nginx/api-ilmiyfaoliyat.error.log | grep -i "click"
```

## 🔍 3. Real Transaction'larni Ko'rish

```bash
cd /phonix/backend
source venv/bin/activate
python manage.py shell << EOF
from apps.payments.models import Transaction
from django.utils import timezone
from datetime import timedelta

# Oxirgi 10 ta transaction
transactions = Transaction.objects.order_by('-created_at')[:10]
print("=== Oxirgi 10 ta Transaction ===")
for t in transactions:
    print(f"ID: {t.id}")
    print(f"  Status: {t.status}")
    print(f"  Amount: {t.amount}")
    print(f"  Created: {t.created_at}")
    print(f"  Click Trans ID: {t.click_trans_id or 'N/A'}")
    print(f"  Merchant Trans ID: {t.merchant_trans_id or 'N/A'}")
    print("---")
EOF
deactivate
```

## 🔍 4. Click Merchant Panel'da Callback URL'larini Tekshirish

Merchant panel'ga kirib, quyidagi URL'lar to'g'ri kiritilganligini tekshiring:

**Prepare URL (Адрес проверки):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
```

**Complete URL (Адрес результата):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/
```

⚠️ **Muhim:**
- URL'lar oxirida `/` bo'lishi kerak
- `https://` ishlatilishi kerak (HTTP emas)
- To'liq path: `/api/v1/payments/click/complete/`

## 🔍 5. Endpoint'ni To'g'ridan-to'g'ri Test Qilish

```bash
# Backend'ga to'g'ridan-to'g'ri (localhost)
curl -X POST http://127.0.0.1:8000/api/v1/payments/click/complete/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "click_trans_id=123&merchant_trans_id=test&merchant_prepare_id=test&error=0&sign_time=1234567890&sign_string=test"

# Nginx orqali (production)
curl -X POST https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "click_trans_id=123&merchant_trans_id=test&merchant_prepare_id=test&error=0&sign_time=1234567890&sign_string=test"
```

## ✅ To'liq Debug Script

```bash
#!/bin/bash
echo "=== Backend Service Status ==="
sudo systemctl status phoenix-backend --no-pager | head -5

echo ""
echo "=== Recent Click Callbacks (Backend Access Log) ==="
sudo tail -50 /phonix/backend/logs/gunicorn-access.log | grep -i "click" | tail -10

echo ""
echo "=== Recent Click Errors (Backend Error Log) ==="
sudo tail -50 /phonix/backend/logs/gunicorn-error.log | grep -i "click" | tail -10

echo ""
echo "=== Recent Click Callbacks (Nginx Access Log) ==="
sudo tail -50 /var/log/nginx/api-ilmiyfaoliyat.access.log | grep -i "click" | tail -10

echo ""
echo "=== Recent Click Errors (Nginx Error Log) ==="
sudo tail -50 /var/log/nginx/api-ilmiyfaoliyat.error.log | grep -i "click" | tail -10

echo ""
echo "=== Last 5 Transactions ==="
cd /phonix/backend
source venv/bin/activate
python manage.py shell << EOF
from apps.payments.models import Transaction
transactions = Transaction.objects.order_by('-created_at')[:5]
for t in transactions:
    print(f"ID: {t.id}, Status: {t.status}, Amount: {t.amount}, Created: {t.created_at}")
EOF
deactivate
```
