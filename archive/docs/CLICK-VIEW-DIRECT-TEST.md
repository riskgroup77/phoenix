# Click View Direct Test

## 🔍 Muammo
Django shell'da URL resolve qilinmoqda, lekin HTTP so'rovda 404 qaytaryapti.

## ✅ Test Qilish

Server'da quyidagilarni bajaring:

```bash
cd /phonix/backend
source venv/bin/activate
python manage.py shell << 'EOF'
from django.test import RequestFactory
from apps.payments.views import click_prepare_view
from django.http import HttpRequest

# RequestFactory bilan test
factory = RequestFactory()
request = factory.get('/api/v1/payments/click/prepare/')
print(f"Request method: {request.method}")
print(f"Request path: {request.path}")

# View'ni to'g'ridan-to'g'ri chaqirish
response = click_prepare_view(request)
print(f"Response status: {response.status_code}")
print(f"Response content: {response.content.decode()}")

# POST request bilan test
post_request = factory.post('/api/v1/payments/click/prepare/', {
    'click_trans_id': '123',
    'service_id': '89248',
    'merchant_trans_id': 'test',
    'amount': '1000',
    'action': '1',
    'sign_time': '1234567890',
    'sign_string': 'test'
})
print(f"\nPOST Request:")
response_post = click_prepare_view(post_request)
print(f"Response status: {response_post.status_code}")
print(f"Response content: {response_post.content.decode()}")
EOF
```

Yoki Django'ning URL routing'ini to'liq test qilish:

```bash
cd /phonix/backend
source venv/bin/activate
python manage.py shell << 'EOF'
from django.test import Client
from django.urls import resolve
from django.core.handlers.wsgi import WSGIRequest
from io import BytesIO

# WSGIRequest yaratish
environ = {
    'REQUEST_METHOD': 'GET',
    'PATH_INFO': '/api/v1/payments/click/prepare/',
    'SERVER_NAME': '127.0.0.1',
    'SERVER_PORT': '8000',
    'wsgi.version': (1, 0),
    'wsgi.url_scheme': 'http',
    'wsgi.input': BytesIO(),
}
request = WSGIRequest(environ)

# URL'ni resolve qilish
try:
    match = resolve(request.path_info)
    print(f"Resolved view: {match.func}")
    print(f"URL name: {match.url_name}")
    print(f"URL kwargs: {match.kwargs}")
    
    # View'ni chaqirish
    response = match.func(request, **match.kwargs)
    print(f"\nResponse status: {response.status_code}")
    print(f"Response content: {response.content.decode()}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
EOF
```
