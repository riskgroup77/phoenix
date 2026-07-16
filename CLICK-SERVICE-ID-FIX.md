# Click Service ID Fix - KRITIK MUAMMO HAL QILINDI

## ⚠️ TOPILGAN MUAMMO

Backend **NOTO'G'RI** Click Service ID ishlatayotgan edi:
- ❌ Eski Service ID: **82154**
- ✅ To'g'ri Service ID: **89248** (PHOENIX service)

## 🔧 O'ZGARISHLAR

### `.env` fayli yangilandi:

**Eski qiymatlar:**
```
CLICK_SERVICE_ID=82154
CLICK_SECRET_KEY=<CLICK_82154_SECRET>
CLICK_MERCHANT_USER_ID=63536
```

**Yangi qiymatlar:**
```
CLICK_SERVICE_ID=89248
CLICK_SECRET_KEY=<REDACTED_CLICK_SECRET>
CLICK_MERCHANT_USER_ID=72021
```

## 📋 SERVER'DA QILISH KERAK

1. Git pull qiling:
```bash
cd /phonix/backend
git pull origin master
```

2. Backend'ni restart qiling:
```bash
sudo systemctl restart phoenix-backend
sudo systemctl status phoenix-backend
```

3. Yangi settings'ni tekshiring:
```bash
source venv/bin/activate
python << 'EOF'
from apps.payments.services import ClickPaymentService
service = ClickPaymentService()
print(f"Service ID: {service.service_id}")
assert service.service_id == '89248', "XATO! Hali ham eski Service ID!"
print("✅ TO'G'RI! PHOENIX service (89248) ishlatilmoqda!")
EOF
deactivate
```

## ✅ NATIJA

Endi to'lovlar **PHOENIX service (89248)** orqali amalga oshadi va Click callback'lar to'g'ri ishlaydi.

---
*Fixed: 2026-02-07*
