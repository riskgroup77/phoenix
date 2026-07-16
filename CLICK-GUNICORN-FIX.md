# Click Gunicorn Fix

## 🔍 Muammo
Django shell'da view to'g'ri ishlayapti (200), lekin HTTP so'rovda (curl) 404 qaytaryapti. Bu gunicorn yoki WSGI application muammosini ko'rsatadi.

## ✅ Yechim

### 1. Gunicorn'ni To'liq Qayta Ishga Tushirish:

```bash
# Service'ni to'xtatish
sudo systemctl stop phoenix-backend

# Port'ni tozalash
sudo lsof -ti:8000 | xargs sudo kill -9 2>/dev/null || true

# Service'ni qayta ishga tushirish
sudo systemctl start phoenix-backend
sudo systemctl status phoenix-backend
```

### 2. Django'ning WSGI Application'ini Test Qilish:

```bash
cd /phonix/backend
source venv/bin/activate
python manage.py shell << 'EOF'
from django.core.handlers.wsgi import WSGIHandler
from django.core.handlers.wsgi import WSGIRequest
from io import BytesIO

# WSGI application'ni yaratish
application = WSGIHandler()

# Test request
environ = {
    'REQUEST_METHOD': 'GET',
    'PATH_INFO': '/api/v1/payments/click/prepare/',
    'SERVER_NAME': '127.0.0.1',
    'SERVER_PORT': '8000',
    'wsgi.version': (1, 0),
    'wsgi.url_scheme': 'http',
    'wsgi.input': BytesIO(),
    'HTTP_HOST': '127.0.0.1:8000',
}

# WSGI application'ni chaqirish
def start_response(status, headers):
    print(f"Status: {status}")
    print(f"Headers: {headers}")

response = application(environ, start_response)
print(f"Response: {b''.join(response).decode()}")
EOF
```

### 3. Gunicorn'ni Qo'lda Test Qilish:

```bash
# Service'ni to'xtatish
sudo systemctl stop phoenix-backend

# Port'ni tozalash
sudo lsof -ti:8000 | xargs sudo kill -9 2>/dev/null || true

# Gunicorn'ni qo'lda ishga tushirish
cd /phonix/backend
source venv/bin/activate
gunicorn --workers 1 --bind 127.0.0.1:8000 --timeout 300 --log-level debug config.wsgi:application

# Yana bir terminal'da test qilish:
curl -v http://127.0.0.1:8000/api/v1/payments/click/prepare/
```
