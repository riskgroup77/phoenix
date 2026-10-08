# Click Callback Faollashtirish

## Muammo
Transaction yaratilmoqda, lekin Click'ning prepare callback'i backend'ga yetib bormayapti. Log'larda `POST.*click/prepare` request'lari yo'q.

## Yechim

### Qadam 1: Click Merchant Panel'da Callback URL'larni Tekshirish

Har bir service (82154, 88045, 89248, 82155) uchun:

1. `merchant.click.uz` ga kiring
2. Service'ni oching (qalam ikonka ✏️)
3. Quyidagi URL'larni kiriting:

**Prepare URL (Адрес проверки):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare
```

**Complete URL (Адрес результата):**
```
https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete
```

**MUHIM:**
- Trailing slash'siz kiriting (agar validation xatosi bo'lsa)
- Yoki trailing slash bilan: `/prepare/` va `/complete/`
- Har bir service uchun alohida kiriting

### Qadam 2: Click Xodimlariga Xabar Berish

URL'larni to'g'rilagandan so'ng, Click xodimlariga quyidagi xabarni yuboring:

```
Ассалому алейкум!

Мен merchant.click.uz'da барча сервислар учун callback URL'ларни киритдим:

- Service 82154 (Ilmiyfaoliyat.uz):
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete

- Service 88045 (PHOENIX):
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete

- Service 89248 (PHOENIX):
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete

- Service 82155 (Phoenix publication):
  Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare
  Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete

Барча URL'лар curl орқали текширилди ва муваффақиятли ишламоқда (HTTP 200).

Лекин, Click томонидан callback'лар бизнинг серверга етиб бормаяпти. 
Лог'ларда /api/v1/payments/click/prepare/ учун POST сўровлар йўқ.

Илтимос:
1. Барча сервислар учун callback'ларни текширинг
2. Агар callback'лар фаол бўлмаса, фаоллаштиринг
3. Click томонидаги сўзламаларни текширинг

Раҳмат!
```

### Qadam 3: Tekshirish

Click'ga xabar bergandan keyin:

1. To'lov qiling
2. Backend log'larni kuzating:
```bash
sudo tail -f /phonix/backend/logs/gunicorn-access.log | grep -i "click"
```
3. Click'ning POST callback'larini qidiring

## Muhim Eslatmalar

1. **Callback URL'lar Click tomonidan aktivlashtirilishi kerak** - faqat URL'larni kiritish yetarli emas
2. **Click xodimlariga xabar berish kerak** - callback'larni aktivlashtirish uchun
3. **Backend log'larni kuzatish** - callback'lar kelayotganini tekshirish uchun
4. **Har bir service uchun alohida URL'lar** kiritilishi kerak

## Tekshirish

URL'larni kiritgandan va Click'ga xabar bergandan keyin:

1. To'lov qiling
2. Backend log'larni kuzating
3. Click'ning POST callback'larini qidiring

Agar callback'lar kelayotgan bo'lsa, log'larda quyidagilar ko'rinadi:
```
POST /api/v1/payments/click/prepare/ HTTP/1.1" 200
```
