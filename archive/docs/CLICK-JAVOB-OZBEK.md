# Click Xodimlariga Javob - O'zbek Tilida

## Qisqa Tushuntirish

**Savol:** "To'lov linkini qanday generatsiya qilyapsiz?"

**Javob:**

Biz Click to'lov linkini quyidagicha yaratamiz:

### 1. To'g'ridan-to'g'ri URL yaratish

**Format:**
```
https://my.click.uz/services/pay?service_id={SERVICE_ID}&merchant_trans_id={TRANSACTION_ID}
```

**Misol:**
```
https://my.click.uz/services/pay?service_id=89248&merchant_trans_id=ee372781-2fc3-49e1-9f02-7bf6725c5556
```

**Qanday ishlaydi:**
1. User to'lov qilishni xohlaydi
2. Biz transaction yaratamiz va ID olamiz (masalan: `ee372781-2fc3-49e1-9f02-7bf6725c5556`)
3. Service ID ni olamiz (masalan: `89248`)
4. URL yaratamiz: `https://my.click.uz/services/pay?service_id=89248&merchant_trans_id=ee372781-2fc3-49e1-9f02-7bf6725c5556`
5. User bu linkga o'tadi va Click sahifasida karta ma'lumotlarini kiritadi
6. Click bizga callback yuboradi:
   - **Prepare**: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/`
   - **Complete**: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/`

### 2. Parametrlar

- **service_id**: Click'dan olingan service ID (89248, 82154, 82155, 88045)
- **merchant_trans_id**: Bizning tizimimizdagi transaction ID (UUID formatida)

### 3. Callback URL'lar

Callback URL'lar merchant.click.uz'da sozlangan:
- **Prepare**: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/`
- **Complete**: `https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/`

Barcha URL'lar tekshirilgan va ishlayapti (HTTP 200 OK).

---

## Click Xodimlariga Xabar (O'zbek tilida)

```
Assalomu alaykum!

Sizning savolingizga javob:

Biz to'lov linkini quyidagicha generatsiya qilamiz:

1. Transaction yaratamiz va ID olamiz (UUID formatida)
2. Service ID ni olamiz (masalan: 89248)
3. To'g'ridan-to'g'ri URL yaratamiz:
   https://my.click.uz/services/pay?service_id=89248&merchant_trans_id={transaction_id}

4. User bu linkga o'tadi va Click sahifasida karta ma'lumotlarini kiritadi
5. Click bizga callback yuboradi:
   - Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
   - Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/

Callback URL'lar merchant.click.uz'da sozlangan va ishlayapti.

Qo'shimcha savollar bo'lsa - javob beramiz.

Rahmat!
Phoenix Scientific Platform
```

---

## Qisqa Variant (Telegram yoki Email uchun)

```
Assalomu alaykum!

To'lov linkini quyidagicha yaratamiz:

https://my.click.uz/services/pay?service_id={SERVICE_ID}&merchant_trans_id={TRANSACTION_ID}

Bu yerda:
- service_id: Click'dan olingan service ID (89248, 82154, 82155, 88045)
- merchant_trans_id: Bizning tizimimizdagi transaction ID (UUID)

User bu linkga o'tadi, Click sahifasida karta ma'lumotlarini kiritadi, keyin Click bizga callback yuboradi.

Callback URL'lar:
- Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/
- Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/

Rahmat!
```
