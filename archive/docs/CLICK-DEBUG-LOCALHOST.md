# Click Endpoint Debug - Localhost Test

## 🔍 Muammo
GET so'rovlar hali ham 400 Bad Request qaytaryapti. Keling, to'g'ridan-to'g'ri localhost'da test qilamiz.

## ✅ Test Qilish

### 1. To'g'ridan-to'g'ri Backend'ga (localhost):

```bash
# Service'ni to'xtatish (test uchun)
sudo systemctl stop phoenix-backend

# To'g'ridan-to'g'ri gunicorn'ni ishga tushirish
cd /phonix/backend
source venv/bin/activate
gunicorn --workers 1 --bind 127.0.0.1:8000 --timeout 300 config.wsgi:application

# Yana bir terminal'da test qilish:
curl http://127.0.0.1:8000/api/v1/payments/click/prepare/
curl http://127.0.0.1:8000/api/v1/payments/click/complete/
```

### 2. Backend Logs'ni Ko'rish:

```bash
# Error logs
sudo tail -50 /phonix/backend/logs/gunicorn-error.log

# Access logs
sudo tail -50 /phonix/backend/logs/gunicorn-access.log | grep click
```

### 3. Django Shell'da Test:

```bash
cd /phonix/backend
source venv/bin/activate
python manage.py shell << EOF
from django.test import Client
from django.test import RequestFactory

# Test GET request
factory = RequestFactory()
request = factory.get('/api/v1/payments/click/prepare/')
print(f"Request method: {request.method}")
print(f"Request path: {request.path}")

# Test with Client
client = Client()
response = client.get('/api/v1/payments/click/prepare/')
print(f"Response status: {response.status_code}")
print(f"Response content: {response.content}")
EOF
```

### 4. Views.py'ni To'g'ridan Tekshirish:

```bash
# Views faylini ko'rish
cat /phonix/backend/apps/payments/views.py | grep -A 20 "def click_prepare_view"
```
