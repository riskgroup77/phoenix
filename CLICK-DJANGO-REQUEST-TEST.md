# Click Django Request Test

## 🔍 Muammo
Django shell'da URL resolve qilinmoqda, lekin HTTP so'rovda 404 qaytaryapti.

## ✅ Test Qilish

Server'da quyidagilarni bajaring:

```bash
cd /phonix/backend
source venv/bin/activate
python manage.py shell << 'EOF'
from django.test import Client
from django.urls import resolve
from django.core.handlers.wsgi import WSGIRequest
from io import BytesIO
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Django'ni to'liq initialize qilish
import django
django.setup()

# Client bilan test
client = Client()
response = client.get('/api/v1/payments/click/prepare/')
print(f"Client GET status: {response.status_code}")
print(f"Client GET content: {response.content.decode()[:200]}")

# WSGIRequest bilan test
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
request = WSGIRequest(environ)

# URL'ni resolve qilish
match = resolve(request.path_info)
print(f"\nResolved view: {match.func}")
print(f"URL name: {match.url_name}")

# View'ni to'g'ridan-to'g'ri chaqirish
from apps.payments.views import click_prepare_view
response = click_prepare_view(request)
print(f"\nDirect view call status: {response.status_code}")
print(f"Direct view call content: {response.content.decode()}")
EOF
```

Yoki Django'ning URL routing'ini to'liq tekshirish:

```bash
cd /phonix/backend
source venv/bin/activate
python manage.py show_urls 2>/dev/null | grep click || python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.urls import get_resolver
resolver = get_resolver()
for pattern in resolver.url_patterns:
    if hasattr(pattern, 'url_patterns'):
        for sub_pattern in pattern.url_patterns:
            if 'click' in str(sub_pattern.pattern):
                print(f'{pattern.pattern} -> {sub_pattern.pattern}')
"
```
