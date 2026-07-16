# Click To'g'ridan-to'g'ri To'lov (Invoice Yaratmasdan)

## Muammo
- Invoice yaratishda telefon raqam muammosi
- User Click'da ro'yxatdan o'tgan, lekin invoice yaratib bo'lmayapti

## Yechim
Invoice yaratmasdan, to'g'ridan-to'g'ri payment URL yaratish.

## Qanday Ishlaydi

1. **Transaction yaratiladi** - odatdagidek
2. **Payment URL yaratiladi** - invoice yaratmasdan, to'g'ridan-to'g'ri
3. **User Click sahifasiga o'tadi** - u yerda karta ma'lumotlarini kiritadi
4. **Click callback orqali to'lov tasdiqlanadi**

## O'zgarishlar

### Backend (`services.py`)
- `create_direct_payment_url()` - invoice yaratmasdan, to'g'ridan-to'g'ri payment URL yaratadi
- `prepare_payment()` - endi `use_invoice=False` default (invoice yaratmasdan)

### Frontend (`ClickPayment.tsx`)
- Yangi sahifa: `/payment/click?transaction_id=...`
- Payment URL tayyor bo'lganda avtomatik ochiladi
- User Click sahifasida karta ma'lumotlarini kiritadi

## Foydalanish

```typescript
// Frontend'da
const response = await apiService.payments.processPayment(transactionId, 'click');
if (response.success && response.payment_url) {
    // User'ni Click sahifasiga yo'naltirish
    window.location.href = response.payment_url;
}
```

## Muhim Eslatma

**Click'da alohida sahifada karta ma'lumotlarini kiritish mumkin emas!**

Click'ning security siyasati tufayli, karta ma'lumotlarini faqat Click'ning rasmiy sahifasida kiritish mumkin. Shuning uchun:

1. Biz payment URL yaratamiz
2. User Click sahifasiga o'tadi
3. U yerda karta ma'lumotlarini kiritadi
4. Click callback orqali bizga qaytadi

Bu Click'ning standart ishlash tartibi.

## Deployment

```bash
cd /phonix/backend
git pull origin master
sudo systemctl restart phoenix-backend
```

Frontend'ni ham yangilash kerak (agar o'zgarishlar bo'lsa).
