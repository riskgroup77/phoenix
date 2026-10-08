# Click Error Code -2041 Hal Qilish

## Muammo

Click'dan error code **-2041** kelmoqda:
```
Произошла ошибка во время оплаты. Пожалуйста, попробуйте ещё раз. (-2041)
```

**Sabab:** Signature verification failure - Click'da signature tekshiruvi o'tmayapti.

## Muammo Tahlili

1. **URL format:** Biz `transaction_param={uuid}` yuboramiz
2. **Callback:** Click `merchant_trans_id` sifatida shu UUID ni yuboradi
3. **Signature:** Signature'da `merchant_trans_id` ishlatilmoqda
4. **Muammo:** Signature mos kelmayapti

## Yechim

### 1. Log'larni Tekshirish

```bash
cd /phonix/backend

# So'nggi prepare callback log'larini ko'rish
sudo tail -200 /phonix/backend/logs/gunicorn-access.log | grep -i "click/prepare"

# Signature debug log'larini ko'rish
sudo tail -200 /phonix/backend/logs/django.log | grep -A 10 "SIGNATURE DEBUG"

# Xatoliklarni ko'rish
sudo tail -200 /phonix/backend/logs/gunicorn-error.log | grep -i "signature\|2041\|error"
```

### 2. Transaction Topilmayotgan Muammo

Muammo shundaki, Click'dan kelgan `merchant_trans_id` bizning database'dagi transaction ID ga mos kelmayapti.

**Tekshirish:**
```bash
cd /phonix/backend
source venv/bin/activate
python manage.py shell << 'EOF'
from apps.payments.models import Transaction
from django.utils import timezone
from datetime import timedelta

# So'nggi 10 daqiqadagi transaction'lar
recent = timezone.now() - timedelta(minutes=10)
txs = Transaction.objects.filter(created_at__gte=recent).order_by('-created_at')[:5]

print("So'nggi transaction'lar:")
for tx in txs:
    print(f"ID: {tx.id}")
    print(f"Merchant Trans ID: {tx.merchant_trans_id}")
    print(f"Amount: {tx.amount}")
    print(f"Status: {tx.status}")
    print("---")
EOF
```

### 3. Signature Muammosini Hal Qilish

Click'dan kelgan `merchant_trans_id` bizning `transaction.id` ga mos kelishi kerak. Lekin agar URL'da `transaction_param` sifatida yuborilgan bo'lsa, Click uni `merchant_trans_id` sifatida qaytaradi.

**Muammo:** Signature'da `merchant_trans_id` ishlatilmoqda, lekin bu qiymat database'da topilmayapti.

**Yechim:** Transaction'ni topishda `merchant_trans_id` field'ini ham tekshirish kerak.

### 4. Click Xodimlariga Xabar

Error code -2041 signature muammosi. Click xodimlariga quyidagi xabarni yuboring:

```
Здравствуйте!

У меня возникла ошибка при оплате через Click.

Ошибка: -2041 (Signature verification failure)

Детали:
- Service ID: 82154 (yoki 89248)
- Merchant ID: 45730
- Transaction ID: {transaction_id}

URL формат:
https://my.click.uz/services/pay?merchant_id=45730&service_id=82154&transaction_param={uuid}&amount=1000.00

Callback'da merchant_trans_id kelmoqda, lekin signature tekshiruvi o'tmayapti.

Прошу проверить:
1. Правильность secret key для service 82154
2. Правильность signature generation
3. Соответствие transaction_param и merchant_trans_id

Спасибо!
```

## Tekshirish

1. **Transaction topilayotganini tekshiring:**
```bash
sudo tail -100 /phonix/backend/logs/django.log | grep -i "Transaction not found\|merchant_trans_id"
```

2. **Signature log'larini ko'rish:**
```bash
sudo tail -100 /phonix/backend/logs/django.log | grep -A 5 "Expected signature"
```

3. **Callback'lar kelayotganini tekshiring:**
```bash
sudo tail -100 /phonix/backend/logs/gunicorn-access.log | grep -i "click/prepare\|click/complete"
```

## Keyingi Qadamlar

1. Log'larni tekshiring va muammoni aniqlang
2. Transaction topilayotganini tekshiring
3. Signature'ni tekshiring
4. Click xodimlariga murojaat qiling
