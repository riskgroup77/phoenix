# Qolgan ishlar va takliflar

## 1. Ishlatilmayotgan / yetishmayotgan bo‘limlar

| Narsa | Holat | Tavsif |
|-------|--------|--------|
| **Maqola namuna so'rovlari (taqrizchi)** | ❌ Sahifa yo‘q | Muallif "Maqola namuna olish" orqali to‘lov qilgach taqrizchilarga bildirishnoma yuboriladi va link `/article-sample-requests` ko‘rsatiladi. Bu marshrut frontendda yo‘q edi — 404 yoki boshqa sahifaga yo‘naltirilardi. **Tuzatildi:** sahifa va API qo‘shildi. |
| **SuperAdmin narxlarni o‘zgartirish** | ⚠️ Qo‘lda | DOI, UDK, Maqola namuna va boshqa xizmatlar narxi hozir kodda konstantalar (masalan `DOI_AMOUNT = 0`). Superadmin ularni panel orqali o‘zgartirishi uchun sozlamalar jadvali (yoki env) kerak. |
| **Click to‘lov localhost’da** | ⚠️ Cheklov | Click prepare/complete callback’lari internetdan ochiq serverga yuboriladi. Lokalda test qilganda to‘lov tasdiqlanmaydi — faqat production (masalan api.ilmiyfaoliyat.uz) da ishlaydi. |

---

## 2. Ishlamayotgan yoki zaif joylar

| Joy | Muammo | Taklif |
|-----|--------|--------|
| **GET /articles/** | Avval 500 xatosi bo‘lardi | List uchun `ArticleListSerializer` joriy qilindi — hozir ishlashi kerak. |
| **Antiplagiat manbalar** | Mock manbalar ishlatilardi | Gemini orqali `sources` (linklar) qaytariladi va frontend API dan oladi. |
| **Arxiv (taqrizchi)** | Arxiv sahifasi “Faqat mualliflar uchun” deb chiqadi | Taqrizchi uchun maxsus arxiv (o‘z taqrizlari/DOI natijalari) kerak bo‘lsa, alohida blok qo‘shish mumkin. |
| **Bildirishnoma linklari** | Ba‘zi linklar hash yo‘lida (`/#/...`) bo‘lmasa redirect xato berishi mumkin | Barcha notification `link` lari `/#/path` formatida ekanligini tekshirish (frontend HashRouter ishlatadi). |

---

## 3. Xavfsizlik va production (post-deployment)

- `DEBUG=False`, `ALLOWED_HOSTS` to‘g‘ri sozlangan bo‘lishi
- HTTPS, SSL sertifikat
- Click merchant panelda Prepare/Complete URL’lar to‘g‘ri (CLICK-CALLBACK-CHECK.md)
- Telefon raqam formati: `998XXXXXXXXX` (12 ta raqam) — Click uchun majburiy

---

## 4. Qisqacha ro‘yxat (nimalarni qilish mumkin)

1. **Maqola namuna so'rovlari** — taqrizchi uchun sahifa va API qo‘shildi; bildirishnoma linki endi ishlaydi.
2. **Narxlarni boshqarish** — Superadmin uchun admin panelda yoki sozlamalar sahifasida DOI/UDK/Maqola namuna narxlarini o‘zgartirish.
3. **Taqrizchi arxivi** — taqrizchi bajargan taqrizlar / DOI natijalari ro‘yxati (ixtiyoriy).
4. **“Tez kunda” xizmatlar** — Tahrirlash, Adabiyotlarni formatlash va boshqalarni reja bo‘yicha yo‘lash.
5. **Production test** — Click to‘lovini haqiqiy serverda (internetdan ochiq) tekshirish.

---

*Ushbu fayl loyihadagi bo‘shliqlar va keyingi qadamlar uchun qisqa yo‘riqnoma.*
