# Click Secret Key Tekshirish

## Muammo

Service 82154 uchun signature mos kelmoqda ✅
Service 89248 uchun signature mos kelmayapti ❌

Bu shuni anglatadiki:
- ✅ Signature generatsiya formulasi to'g'ri
- ❌ Service 89248 uchun secret key noto'g'ri

## Tekshirish

### Service 82154 (Ishlayapti):
- Secret Key: `<CLICK_82154_SECRET>`
- Signature mos kelmoqda ✅

### Service 89248 (Ishlamayapti):
- Secret Key: `<REDACTED_CLICK_SECRET>` (hozirgi)
- Signature mos kelmayapti ❌

## Yechim

Click merchant panel'da (merchant.click.uz) Service 89248 uchun secret key'ni tekshiring va backend'dagi bilan solishtiring.

Agar farq bo'lsa, yangilang:

```bash
cd /phonix/backend
nano .env
```

**Quyidagi qatorni toping va yangilang:**
```env
CLICK_SERVICE_89248_SECRET_KEY=TO'G'RI_SECRET_KEY_BURAYA
CLICK_SECRET_KEY=TO'G'RI_SECRET_KEY_BURAYA
```

**Saqlash:** `Ctrl+O`, `Enter`, `Ctrl+X`

**Backend'ni restart qilish:**
```bash
sudo systemctl restart phoenix-backend
```

## Tekshirish

```bash
cd /phonix/backend
source venv/bin/activate
python manage.py shell << 'EOF'
from django.conf import settings
print("CLICK_SERVICE_89248_SECRET_KEY:", settings.CLICK_SERVICE_89248_SECRET_KEY)
print("CLICK_SERVICE_82154_SECRET_KEY:", settings.CLICK_SERVICE_82154_SECRET_KEY)
EOF
```
