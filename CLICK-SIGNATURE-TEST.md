# Click Signature Test

## Test Ma'lumotlari

```
click_trans_id: 3517223615
service_id: 89248
click_paydoc_id: 4796201440
merchant_trans_id: 0b77bc26-da83-4c52-95ac-e832aeacf641
amount: 1000
action: 0
sign_time: 2026-02-13 17:14:41
secret_key: <REDACTED_CLICK_SECRET>
```

## Click'dan Kelgan Signature

```
379c96d5bb86b44e0dc1b6eaeb0926b7
```

## Sinab Ko'rilgan Variantlar

### 1. Eski Format (click_paydoc_id bilan):
```
md5(click_trans_id + service_id + click_paydoc_id + merchant_trans_id + amount + action + sign_time + secret_key)
Result: 9a6c1bbbe4a39fc80c76dd441b626a6b ❌
```

### 2. Yangi Format (Click dokumentatsiyasiga ko'ra):
```
md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
Result: ???
```

## Tekshirish

Server'da quyidagi buyruqni bajaring:

```bash
cd /phonix/backend
source venv/bin/activate
python manage.py shell << 'EOF'
import hashlib

click_trans_id = '3517223615'
service_id = '89248'
merchant_trans_id = '0b77bc26-da83-4c52-95ac-e832aeacf641'
amount = '1000'
action = '0'
sign_time = '2026-02-13 17:14:41'
secret_key = '<REDACTED_CLICK_SECRET>'

# Yangi format (Click dokumentatsiyasiga ko'ra)
sign_string = click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time
signature = hashlib.md5(sign_string.encode('utf-8')).hexdigest()

print("Sign string:", sign_string)
print("MD5:", signature)
print("Expected:", '379c96d5bb86b44e0dc1b6eaeb0926b7')
print("Match:", signature == '379c96d5bb86b44e0dc1b6eaeb0926b7')
EOF
```

Agar mos kelmasa, Click xodimlariga murojaat qiling va to'g'ri signature generatsiya tartibini so'rang.
