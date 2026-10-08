# 🎉 Payme To'lov Tizimi Integratsiyasi - To'liq Yo'riqnoma

## 📋 Umumiy Ma'lumot

Payme to'lov tizimi muvaffaqiyatli qo'shildi! Bu yo'riqnomada Payme'ni qanday sozlash va ishlatish kerakligini tushuntiramiz.

---

## ✅ QILINGAN ISHLAR

### 1. Backend Integratsiyasi
- ✅ `payme_service.py` - Payme payment service
- ✅ Transaction model'ga Payme fieldlari qo'shildi
- ✅ Payme callback view yaratildi (JSON-RPC 2.0)
- ✅ URL routing qo'shildi (`/api/v1/payments/payme/`)
- ✅ Settings va environment variables

### 2. Payme Metodlari
- ✅ `CheckPerformTransaction` - To'lov amalga oshirish mumkinligini tekshirish
- ✅ `CreateTransaction` - Tranzaksiya yaratish
- ✅ `PerformTransaction` - To'lovni tasdiqlash
- ✅ `CancelTransaction` - To'lovni bekor qilish
- ✅ `CheckTransaction` - Tranzaksiya holatini tekshirish
- ✅ `GetStatement` - Tranzaksiyalar hisoboti

---

## 🔧 SOZLASH BO'YICHA QO'LLANMA

### 1. Payme Merchant Account Yaratish

1. **Payme Business'ga kiring:**
   - URL: https://business.payme.uz
   - Ro'yxatdan o'ting yoki login qiling

2. **Merchant Account Yarating:**
   - Kompaniya ma'lumotlarini kiriting
   - Hujjatlarni yuklang (STIR, raxbar pasporti, va h.k.)
   - Tasdiqlang

3. **API Credentials Oling:**
   - **Merchant ID** - Sizning merchant ID'ingiz
   - **Merchant Key** - Secret key (production)
   - **Test Key** - Test uchun key

---

### 2. Backend'da Sozlash

#### A. `.env` Faylini Yangilash

Server'da va local'da `.env` faylini yangilang:

```bash
cd /phonix/backend
nano .env
```

Quyidagi qatorlarni qo'shing (yoki mavjud bo'lsa yangilang):

```env
# Payme Payment
PAYME_MERCHANT_ID=YOUR_MERCHANT_ID_HERE
PAYME_MERCHANT_KEY=YOUR_PRODUCTION_KEY_HERE
PAYME_TEST_KEY=YOUR_TEST_KEY_HERE
PAYME_IS_TEST=True
PAYME_ENDPOINT=https://checkout.paycom.uz
```

**⚠️ MUHIM:**
- `YOUR_MERCHANT_ID_HERE` - Payme'dan olgan Merchant ID'ingizni kiriting
- `YOUR_PRODUCTION_KEY_HERE` - Production key
- `YOUR_TEST_KEY_HERE` - Test key
- `PAYME_IS_TEST=True` - Test rejimda ishlash uchun (production'da `False`)

#### B. Migration Qilish

```bash
cd /phonix/backend
source venv/bin/activate

# Migration yaratish
python manage.py makemigrations

# Migration qo'llash
python manage.py migrate

deactivate
```

#### C. Backend'ni Restart Qilish

```bash
sudo systemctl restart phoenix-backend
sudo systemctl status phoenix-backend
```

---

### 3. Payme Merchant Panel Sozlash

1. **Payme Business'ga kiring:** https://business.payme.uz

2. **API Endpoint'ni Kiriting:**
   - Service yaratish yoki tahrirlash
   - **Endpoint URL:**
     ```
     https://api.ilmiyfaoliyat.uz/api/v1/payments/payme/
     ```
   - **HTTP Method:** POST
   - **Protocol:** JSON-RPC 2.0

3. **Test Qilish:**
   - Payme test rejimida to'lovlarni sinab ko'ring

---

## 🧪 TEST QILISH

### 1. Backend Test

```bash
cd /phonix/backend
source venv/bin/activate
python << 'EOF'
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '/phonix/backend')
django.setup()

from apps.payments.models import Transaction
from apps.payments.payme_service import PaymeService
from apps.users.models import User

# Test user
user = User.objects.first()

# Test transaction yaratish
transaction = Transaction.objects.create(
    user=user,
    amount=5000,
    currency='UZS',
    service_type='top_up',
    status='pending'
)

print(f"Transaction created: {transaction.id}")

# Payme payment link yaratish
service = PaymeService()
result = service.generate_pay_link(transaction)

print("=" * 80)
print("PAYME PAYMENT LINK:")
print("=" * 80)
print(f"Payment URL: {result['payment_url']}")
print(f"Merchant ID: {result['merchant_id']}")
print(f"Amount (tiyin): {result['amount']}")
print(f"Transaction ID: {result['transaction_id']}")
EOF
deactivate
```

### 2. Frontend Test

Frontend'da to'lov qilayotganda `provider=payme` parametrini qo'shing:

```javascript
// Frontend'da
const response = await apiService.payments.processPayment(
    transactionId,
    'payme'  // provider
);
```

---

## 📊 PAYME vs CLICK - FARQLAR

| Xususiyat | Click | Payme |
|-----------|-------|-------|
| **API Format** | REST API | JSON-RPC 2.0 |
| **Authorization** | Signature (MD5) | Basic Auth |
| **Callback'lar** | prepare, complete | 6 ta metod |
| **Amount Format** | UZS | Tiyin (1 UZS = 100 tiyin) |
| **Payment Flow** | Invoice → Payment | CheckPerform → Create → Perform |

---

## 🔄 TO'LOV JARAYONI (PAYME)

```
1. User to'lov qiladi
   ↓
2. Backend Payme payment link yaratadi
   ↓
3. User Payme sahifasiga yo'naltiriladi
   ↓
4. Payme CheckPerformTransaction chaqiradi (backend'ga)
   ↓
5. User karta ma'lumotlarini kiritadi
   ↓
6. Payme CreateTransaction chaqiradi (backend'ga)
   ↓
7. User to'lovni tasdiqlaydi
   ↓
8. Payme PerformTransaction chaqiradi (backend'ga)
   ↓
9. Transaction status 'completed' ga o'zgaradi
   ↓
10. User dashboard'ga qaytadi
```

---

## 🚀 FRONTEND INTEGRATSIYASI

### 1. Payment Service Yangilash

`frontend/services/paymentService.ts` faylini yangilang:

```typescript
async processPayment(
    transactionId: string, 
    provider: 'click' | 'payme' = 'click'
): Promise<ProcessPaymentResponse> {
    const response = await apiService.payments.processPayment(
        transactionId,
        provider
    );
    return response;
}
```

### 2. API Service Yangilash

`frontend/services/apiService.ts` faylini yangilang:

```typescript
processPayment: (id: string, provider: string = 'click') =>
    apiFetch(`/payments/transactions/${id}/process_payment/?provider=${provider}`, {
        method: 'POST',
    }),
```

### 3. UI'da Provider Tanlash

To'lov sahifasida provider tanlash qo'shing:

```tsx
<select onChange={(e) => setProvider(e.target.value)}>
    <option value="click">Click</option>
    <option value="payme">Payme</option>
</select>
```

---

## 🔒 XAVFSIZLIK

### 1. Authorization Check

Payme har bir callback'da Basic Auth yuboradi:
```
Authorization: Basic base64(merchant_id:key)
```

Backend buni tekshiradi va noto'g'ri bo'lsa `-32504` xatosi qaytaradi.

### 2. Amount Verification

Har bir callback'da amount tekshiriladi. Agar amount noto'g'ri bo'lsa, xatolik qaytariladi.

### 3. Transaction State

Transaction holati boshqariladi:
- Created (1)
- Completed (2)
- Cancelled (-1)
- Cancelled after complete (-2)

---

## 📋 PRODUCTION CHECKLIST

- [ ] Payme merchant account yaratildi
- [ ] Merchant ID va keys olindi
- [ ] `.env` faylida credentials to'g'ri kiritildi
- [ ] `PAYME_IS_TEST=False` (production uchun)
- [ ] Migration qo'llandi
- [ ] Backend restart qilindi
- [ ] Payme merchant panel'da endpoint URL kiritildi
- [ ] Test to'lovlar muvaffaqiyatli amalga oshirildi
- [ ] Frontend'da provider tanlash qo'shildi
- [ ] Log monitoring sozlandi

---

## 🐛 MUAMMOLARNI BARTARAF ETISH

### 1. "Invalid authorization" xatosi

**Sabab:** Merchant ID yoki key noto'g'ri

**Yechim:**
```bash
# Settings'ni tekshirish
cd /phonix/backend
source venv/bin/activate
python << 'EOF'
from django.conf import settings
print(f"PAYME_MERCHANT_ID: {settings.PAYME_MERCHANT_ID}")
print(f"PAYME_IS_TEST: {settings.PAYME_IS_TEST}")
EOF
deactivate
```

### 2. "Transaction not found" xatosi

**Sabab:** Transaction ID noto'g'ri yoki transaction yo'q

**Yechim:** Transaction yaratilganligini tekshiring

### 3. "Invalid amount" xatosi

**Sabab:** Amount tiyin formatida emas

**Yechim:** Amount * 100 qiling (1 UZS = 100 tiyin)

---

## 📞 PAYME SUPPORT

**Website:** https://help.paycom.uz  
**Telegram:** @PaymeSupport  
**Email:** support@paycom.uz  
**Telefon:** +998 78 113 60 60

---

## 📚 PAYME DOKUMENTATSIYA

**Rasmiy dokumentatsiya:** https://developer.help.paycom.uz/  
**JSON-RPC 2.0 Spec:** https://www.jsonrpc.org/specification

---

*Integratsiya amalga oshirildi: 2026-02-07*  
*Muallif: AI Assistant*
