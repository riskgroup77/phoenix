# Click Signature Muammosi - Error Code -2041

## Muammo

Click'dan kelgan callback'da signature mos kelmayapti:

**Click'dan kelgan signature:** `379c96d5bb86b44e0dc1b6eaeb0926b7`  
**Bizning generatsiya qilgan:** `9a6c1bbbe4a39fc80c76dd441b626a6b`

## Click'dan Kelgan Ma'lumotlar

```
click_trans_id: 3517223615
service_id: 89248
click_paydoc_id: 4796201440
merchant_trans_id: 0b77bc26-da83-4c52-95ac-e832aeacf641
amount: 1000
action: 0
sign_time: 2026-02-13 17:14:41
error: 0
error_note: Success
sign_string: 379c96d5bb86b44e0dc1b6eaeb0926b7
```

## Bizning Signature Generatsiya

**Format:** `md5(click_trans_id + service_id + click_paydoc_id + merchant_trans_id + amount + action + sign_time + secret_key)`

**Sign string:**
```
35172236158924847962014400b77bc26-da83-4c52-95ac-e832aeacf641100002026-02-13 17:14:41<REDACTED_CLICK_SECRET>
```

**MD5:** `9a6c1bbbe4a39fc80c76dd441b626a6b`

## Sinab Ko'rilgan Variantlar

1. ✅ UUID bilan tire (`-`) - `9a6c1bbbe4a39fc80c76dd441b626a6b` (bizning)
2. ❌ UUID tire'siz - `6e08f344c8c1308e2bedcb7b88896404`
3. ❌ Parametrlar tartibi o'zgartirilgan - `b51f49130e85def0565c4e8089752e2f`
4. ❌ Amount float formatida - `5809ffddd4eb37f452b87ae0e92b1edb`
5. ❌ Error parametri bilan - `1b5dd45e25009730322f4e2b468a937c`
6. ❌ Error_note parametri bilan - `0b79d00358c8348161753491b4181958`

**Hech biri Click'dan kelgan signature ga mos kelmayapti!**

## Muammo

1. **Secret key noto'g'ri bo'lishi mumkin** - Service 89248 uchun secret key `<REDACTED_CLICK_SECRET>` to'g'ri emas
2. **Signature generatsiya tartibi noto'g'ri** - Click'da boshqa tartib ishlatilmoqda
3. **Boshqa parametrlar ishlatilmoqda** - Click'da boshqa parametrlar signature'ga kiritilmoqda

## Click Xodimlariga Xabar

```
Здравствуйте!

У меня проблема с signature verification в prepare callback.

Детали:
- Service ID: 89248
- Merchant ID: 45730
- Click Trans ID: 3517223615
- Click Paydoc ID: 4796201440
- Merchant Trans ID: 0b77bc26-da83-4c52-95ac-e832aeacf641
- Amount: 1000
- Action: 0
- Sign Time: 2026-02-13 17:14:41
- Secret Key: <REDACTED_CLICK_SECRET> (используемый)

Click'дан kelgan signature: 379c96d5bb86b44e0dc1b6eaeb0926b7
Bizning generatsiya qilgan: 9a6c1bbbe4a39fc80c76dd441b626a6b

Signature generatsiya format:
md5(click_trans_id + service_id + click_paydoc_id + merchant_trans_id + amount + action + sign_time + secret_key)

Sign string:
35172236158924847962014400b77bc26-da83-4c52-95ac-e832aeacf641100002026-02-13 17:14:41<REDACTED_CLICK_SECRET>

Прошу проверить:
1. Правильность secret key для service 89248
2. Правильность signature generation formula
3. Правильность параметров, используемых в signature

Ошибка: -2041 (Signature verification failure)

Спасибо!
```

## Tekshirish

1. **Secret key to'g'riligini tekshiring:**
```bash
cd /phonix/backend
source venv/bin/activate
python manage.py shell << 'EOF'
from django.conf import settings
print("CLICK_SERVICE_89248_SECRET_KEY:", settings.CLICK_SERVICE_89248_SECRET_KEY)
print("CLICK_SECRET_KEY:", settings.CLICK_SECRET_KEY)
EOF
```

2. **Click merchant panel'da secret key ni tekshiring:**
   - merchant.click.uz → Services → Service 89248 → Secret Key

3. **Click xodimlariga murojaat qiling:**
   - Telegram: @clicksupport
   - Email: support@click.uz
