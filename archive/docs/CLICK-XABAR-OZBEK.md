# Click Xodimlariga Xabar - O'zbek Tilida

## Xabar Matni

```
Assalomu alaykum!

Menda prepare callback'da signature verification muammosi bor.

Tafsilotlar:
- Service ID: 89248
- Merchant ID: 45730
- Click Trans ID: 3517234960
- Click Paydoc ID: 4796220426
- Merchant Trans ID: ad4cc80b-71ae-4162-9def-6369d25698de
- Amount: 1000
- Action: 0
- Sign Time: 2026-02-13 17:19:56
- Secret Key: <REDACTED_CLICK_SECRET> (ishlatilayotgan)

Click'dan kelgan signature: b647d4f5be1247e990bbc60900acf637

Men quyidagi formatlarni sinab ko'rdim, lekin hech biri mos kelmayapti:

1. md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
   Natija: 5e658dfd08077526360b1fcf5c2e1a10 ❌

2. md5(click_trans_id + service_id + click_paydoc_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
   Natija: 58a7a1ad6f7157257a052f7b4c0dacc3 ❌

3. md5(click_trans_id + service_id + merchant_trans_id + amount + action + sign_time + SECRET_KEY)
   Natija: a52d9bedbfa51f0fdd27083358be51b8 ❌

4. md5(click_trans_id + service_id + click_paydoc_id + merchant_trans_id + amount + action + sign_time + SECRET_KEY)
   Natija: 356a918c5b16855f4db35592635b72eb ❌

Iltimos, tekshiring:
1. Service 89248 uchun secret key to'g'riligini
2. Prepare callback'da signature generatsiya formulasi to'g'riligini
3. click_paydoc_id signature'ga kiritiladimi yoki yo'qmi?
4. Parametrlar tartibini aniq ko'rsating

Xatolik: -2041 (Signature verification failure)

Rahmat!
```

## Qisqa Variant

```
Assalomu alaykum!

Menda prepare callback'da signature muammosi bor.

Service ID: 89248
Click'dan kelgan signature: b647d4f5be1247e990bbc60900acf637
Ishlatilayotgan secret key: <REDACTED_CLICK_SECRET>

Men barcha mumkin bo'lgan signature formatlarini sinab ko'rdim, lekin hech biri mos kelmayapti.

Iltimos, service 89248 uchun to'g'ri secret key va signature generatsiya formulasi bilan yordam bering.

Xatolik: -2041

Rahmat!
```
