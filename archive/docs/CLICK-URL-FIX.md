# Click URL Format To'g'rilash

## Muammo

Click xodimlari bizga to'g'ri URL formatini ko'rsatib berishdi. Hozirgi kodimizda faqat `service_id` va `merchant_trans_id` ishlatilmoqda, lekin Click quyidagi parametrlarni talab qilmoqda:

## Click Talab Qilgan Parametrlar

### Majburiy Parametrlar:
1. **merchant_id** - ID поставщика (bizda: 45730)
2. **service_id** - ID Сервиса (bizda: 89248, 82154, 82155, 88045)
3. **transaction_param** - ID заказа (bu bizning transaction.id yoki merchant_trans_id)
4. **amount** - Сумма транзакции (format: N.NN, masalan: 1000.00)

### Ixtiyoriy Parametrlar:
5. **return_url** - Ссылка после оплаты
6. **card_type** - Тип карты (uzcard, humo)

## To'g'ri URL Format

**Eski format (noto'g'ri):**
```
https://my.click.uz/services/pay?service_id=89248&merchant_trans_id={uuid}
```

**Yangi format (to'g'ri):**
```
https://my.click.uz/services/pay?merchant_id=45730&service_id=89248&transaction_param={uuid}&amount=1000.00
```

## O'zgarishlar

### `backend/apps/payments/services.py`

`create_direct_payment_url()` funksiyasida URL generatsiya qismi yangilandi:

```python
# Eski kod (noto'g'ri):
payment_url = f"https://my.click.uz/services/pay?service_id={service_id_int}&merchant_trans_id={str(transaction.id)}"

# Yangi kod (to'g'ri):
merchant_id_int = int(self.merchant_id)
transaction_param = str(transaction.id)
amount_formatted = f"{float(transaction.amount):.2f}"

payment_url = (
    f"https://my.click.uz/services/pay"
    f"?merchant_id={merchant_id_int}"
    f"&service_id={service_id_int}"
    f"&transaction_param={transaction_param}"
    f"&amount={amount_formatted}"
)
```

## Signature Muammosi

Signature muammosi ham hal qilindi. Click'dan kelgan callback'da:
- `merchant_trans_id` = `transaction_param` (Click'da shunday ataladi)
- Test to'lovlar uchun ham signature tekshiruvi qo'shildi

## Test Qilish

1. Backend'ni yangilash:
```bash
cd /phonix/backend
git pull origin master
sudo systemctl restart phoenix-backend
```

2. To'lov qilish va URL'ni tekshirish:
- URL'da `merchant_id`, `service_id`, `transaction_param`, `amount` parametrlari bo'lishi kerak
- Format: `https://my.click.uz/services/pay?merchant_id=45730&service_id=89248&transaction_param={uuid}&amount=1000.00`

## Click Dokumentatsiya

- URL: https://docs.click.uz/click-button/
- Majburiy parametrlar: merchant_id, service_id, transaction_param, amount
- Ixtiyoriy parametrlar: return_url, card_type

## Deployment

```bash
cd /phonix/backend
git add apps/payments/services.py
git commit -m "Fix: Update Click payment URL format according to Click documentation"
git push origin master
sudo systemctl restart phoenix-backend
```
