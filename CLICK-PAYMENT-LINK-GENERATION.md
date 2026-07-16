# Click To'lov Linkini Generatsiya Qilish - Tushuntirish

## Savol
Click xodimlaridan: "To'lov linkini qanday generatsiya qilyapsiz?"

## Javob

Biz Click to'lov linkini **ikkita usul** bilan generatsiya qilamiz:

---

## 1. To'g'ridan-to'g'ri Payment URL (Direct Payment URL)

### Qanday Ishlaydi:
Biz Click'ning rasmiy URL formatidan foydalanib, to'g'ridan-to'g'ri payment URL yaratamiz:

```
https://my.click.uz/services/pay?service_id={SERVICE_ID}&merchant_trans_id={TRANSACTION_ID}
```

### Kodda Qanday:
```python
# backend/apps/payments/services.py

def create_direct_payment_url(self, transaction, use_invoice=False):
    """Create direct payment URL without invoice"""
    
    # Service ID ni olish (masalan: 89248, 82154, 82155, 88045)
    service_id_int = int(self.service_id)
    
    # Transaction ID ni olish (UUID formatida)
    merchant_trans_id = str(transaction.id)
    
    # To'g'ridan-to'g'ri payment URL yaratish
    payment_url = f"https://my.click.uz/services/pay?service_id={service_id_int}&merchant_trans_id={merchant_trans_id}"
    
    return {
        'error_code': 0,
        'payment_url': payment_url,
        'service_id': service_id_int,
        'merchant_trans_id': merchant_trans_id,
        'direct_payment': True  # Invoice yaratilmadi
    }
```

### Parametrlar:
- **service_id**: Click'dan olingan service ID (masalan: 89248, 82154, 82155, 88045)
- **merchant_trans_id**: Bizning tizimimizdagi transaction ID (UUID formatida)

### Qachon Ishlatiladi:
- `use_invoice=False` bo'lganda (default)
- Invoice yaratishda muammo bo'lganda
- User telefon raqami bo'lmasa

---

## 2. Invoice Orqali Payment URL

### Qanday Ishlaydi:
Avval Click API orqali invoice yaratamiz, keyin invoice URL ni olamiz:

### Kodda Qanday:
```python
# backend/apps/payments/services.py

def create_invoice(self, service_id, amount, phone_number, merchant_trans_id):
    """Create invoice via Click API"""
    
    url = "https://api.click.uz/v2/merchant/invoice/create"
    
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Auth': self.generate_auth_header()  # Merchant user ID + SHA1 digest
    }
    
    data = {
        'service_id': service_id_int,
        'amount': float(amount),
        'phone_number': formatted_phone,  # 998XXXXXXXXX formatida
        'merchant_trans_id': str(merchant_trans_id)
    }
    
    # Click API ga POST so'rov yuborish
    response = requests.post(url, json=data, headers=headers)
    result = response.json()
    
    # Invoice yaratilgandan keyin payment URL olinadi
    if result.get('error_code') == 0:
        payment_url = result.get('invoice_url') or result.get('payment_url')
        # Yoki manual yaratiladi:
        if not payment_url:
            payment_url = f"https://my.click.uz/services/pay?service_id={service_id_int}&merchant_trans_id={merchant_trans_id}&invoice_id={invoice_id}"
    
    return result
```

### Parametrlar:
- **service_id**: Click service ID
- **amount**: To'lov summasi
- **phone_number**: User telefon raqami (998XXXXXXXXX formatida)
- **merchant_trans_id**: Transaction ID

### Qachon Ishlatiladi:
- `use_invoice=True` bo'lganda
- User telefon raqami bo'lsa va invoice yaratish mumkin bo'lsa

---

## Hozirgi Holat

**Hozir biz asosan 1-usulni (Direct Payment URL) ishlatamiz:**

```python
# backend/apps/payments/views.py

@action(detail=True, methods=['post'])
def process_payment(self, request, pk=None):
    """Process payment - creates payment URL"""
    
    service = ClickPaymentService()
    transaction.payment_provider = 'click'
    transaction.save()
    
    # Direct payment URL yaratish (invoice yaratmasdan)
    payment_result = service.prepare_payment(transaction, use_invoice=False)
    
    return Response({
        'success': True,
        'payment_url': payment_result['payment_url'],
        'service_id': payment_result['service_id'],
        'merchant_trans_id': payment_result['merchant_trans_id']
    })
```

---

## To'liq Flow

1. **User to'lov qilishni xohlaydi**
   - Frontend: `/api/v1/payments/transactions/{transaction_id}/process_payment/?provider=click`

2. **Backend payment URL yaratadi**
   - `create_direct_payment_url()` chaqiriladi
   - URL: `https://my.click.uz/services/pay?service_id=89248&merchant_trans_id={uuid}`

3. **Frontend user'ni Click sahifasiga yo'naltiradi**
   - User Click sahifasida karta ma'lumotlarini kiritadi

4. **Click callback yuboradi**
   - **Prepare**: `/api/v1/payments/click/prepare/` - to'lovni tayyorlash
   - **Complete**: `/api/v1/payments/click/complete/` - to'lovni yakunlash

---

## Signature Generatsiya

Click callback'larda signature tekshiriladi:

### Prepare Callback:
```python
# Signature generatsiya
sign_string = md5(
    click_trans_id + 
    service_id + 
    merchant_trans_id + 
    amount + 
    action + 
    sign_time + 
    secret_key
)
```

### Complete Callback:
```python
# Signature generatsiya
sign_string = md5(
    click_trans_id + 
    merchant_trans_id + 
    merchant_prepare_id + 
    error + 
    sign_time + 
    secret_key
)
```

---

## Muhim Eslatmalar

1. **Service ID**: Har bir service uchun alohida service_id va secret_key ishlatiladi:
   - Service 82154: `<CLICK_82154_SECRET>`
   - Service 82155: `<CLICK_82155_SECRET>`
   - Service 89248: `<REDACTED_CLICK_SECRET>`
   - Service 88045: `<REDACTED_CLICK_SECRET>`

2. **Merchant Trans ID**: Bizning tizimimizdagi transaction ID (UUID formatida)

3. **Callback URL'lar**: Click merchant panel'da sozlangan:
   - Prepare: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/`
   - Complete: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/`

---

## Click Xodimlariga Javob (Rus tilida)

```
Здравствуйте!

Отвечаю на ваш вопрос: "Как вы генерируете ссылку на оплату?"

Мы генерируем ссылку на оплату двумя способами:

1. **Прямая ссылка (Direct Payment URL)** - используется сейчас:
   Формат: https://my.click.uz/services/pay?service_id={SERVICE_ID}&merchant_trans_id={TRANSACTION_ID}
   
   Где:
   - service_id: ID сервиса из Click (например: 89248, 82154, 82155, 88045)
   - merchant_trans_id: ID транзакции в нашей системе (UUID формат)

2. **Через Invoice** - альтернативный способ:
   Сначала создаем invoice через Click API:
   POST https://api.click.uz/v2/merchant/invoice/create
   
   Затем используем invoice_url из ответа или формируем ссылку вручную.

**Текущий метод:**
Мы используем прямой метод (без invoice), так как он проще и не требует телефонного номера пользователя.

**Callback URL'ы настроены в merchant.click.uz:**
- Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
- Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/

Все URL'ы проверены и работают (HTTP 200 OK).

Если нужны дополнительные детали или есть вопросы - готов ответить!

С уважением,
Phoenix Scientific Platform Team
```

---

## Kod Manbasi

- **Backend**: `backend/apps/payments/services.py` - `create_direct_payment_url()`
- **Backend**: `backend/apps/payments/views.py` - `process_payment()`
- **Frontend**: `frontend/pages/ClickPayment.tsx` - Payment sahifasi
