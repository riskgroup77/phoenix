# Dasturni kuchaytirish – takliflar

Quyidagi qadamlar bajarilsa platforma barqarorroq, tezroq va foydalanuvchilar uchun qulayroq bo‘ladi.

---

## 1. Xavfsizlik

| # | Taklif | Qisqa tavsif | Muhimlik |
|---|--------|--------------|----------|
| 1.1 | **Rate limiting** | Login, register, to‘lov so‘rovlari uchun daqiqada so‘rovlar sonini cheklash (Django throttle yoki nginx). Brute-force hujumlarni kamaytiradi. | Yuqori |
| 1.2 | **Refresh token** | JWT refresh token ishlatish (allaqachon SimpleJWT bor). Frontend’da token muddati tugagach avtomatik yangilash. | O‘rta |
| 1.3 | **Parol siyosati** | Parol: kamida 8 belgi, bitta katta harf, bitta raqam (serializer’da qattiqroq validation). | O‘rta |
| 1.4 | **API kalitni yashirish** | `settings.py` da GEMINI_API_KEY default qiymatini olib tashlash, faqat `.env` dan o‘qish. | Yuqori |
| 1.5 | **HTTPS / secure cookies** | Production’da faqat HTTPS, cookie’larda `Secure` va `SameSite`. | Yuqori |

---

## 2. Ishlash tezligi (performance)

| # | Taklif | Qisqa tavsif | Muhimlik |
|---|--------|--------------|----------|
| 2.1 | **Cache** | Django cache (Redis) – jurnal ro‘yxati, kategoriyalar kabi kam o‘zgaradigan ma’lumotlar. `@cache_page` yoki view’da cache. | Yuqori |
| 2.2 | **Frontend cache** | API javoblarini React Query yoki SWR bilan cache qilish – bir xil so‘rovlarni qayta-qayta yubormaslik. | O‘rta |
| 2.3 | **Pagination** | Ro‘yxatlar (maqolalar, tranzaksiyalar, foydalanuvchilar) uchun sahifalash. Backend’da `PAGE_SIZE` bor, frontend’da “Keyingi / Oldingi” tugmalari. | Yuqori |
| 2.4 | **Lazy load / virtual list** | Juda uzun ro‘yxatlarda faqat ko‘rinadigan qatorlarni render qilish (react-window yoki tanilgan virtual list). | Past |
| 2.5 | **Rasm/fayl optimizatsiya** | Yuklangan fayllar uchun max hajmlar, format tekshiruvi; kerak bo‘lsa thumbnail generatsiya. | O‘rta |

---

## 3. Barqarorlik va monitoring

| # | Taklif | Qisqa tavsif | Muhimlik |
|---|--------|--------------|----------|
| 3.1 | **Health check endpoint** | `/api/v1/health/` – DB ulanish, asosiy servislar (Click/Payme so‘rov emas) tekshiruvi. Nginx/load balancer uchun. | Yuqori |
| 3.2 | **Strukturali logging** | Barcha muhim amallar (login, to‘lov, maqola yuborish) uchun JSON formatda log (user_id, action, natija). Tahlil va debug osonlashadi. | O‘rta |
| 3.3 | **Xatolik monitoring** | Sentry yoki o‘xshash xizmat – frontend va backend xatoliklarini yig‘ish va bildirish. | O‘rta |
| 3.4 | **Backup** | DB (SQLite/PostgreSQL) va muhim fayllar uchun avtomatik backup (cron + skript). | Yuqori |
| 3.5 | **Graceful shutdown** | Gunicorn’da to‘g‘ri signal handling – yangi so‘rovlar qabul qilinmasin, mavjud so‘rovlar tugashi kutilsin. | O‘rta |

---

## 4. Foydalanuvchi tajribasi (UX)

| # | Taklif | Qisqa tavsif | Muhimlik |
|---|--------|--------------|----------|
| 4.1 | **Skeleton / loading** | Yuklanayotganda bo‘sh o‘rniga skeleton (card, jadval) ko‘rsatish. | O‘rta |
| 4.2 | **Offline / tarmoq** | Internet uzilganda yoki server javob bermaganda aniq xabar va “Qayta urinish” tugmasi. | O‘rta |
| 4.3 | **Bildirishnomalar** | To‘lov tasdiqlandi, maqola holati o‘zgardi kabi hodisalar uchun real-time yoki push (Web Push / Telegram bot). | O‘rta |
| 4.4 | **Qidiruv va filter** | Maqolalar, tranzaksiyalar, foydalanuvchilar sahifalarida kuchli qidiruv va filter (sana, status, jurnal). | Yuqori |
| 4.5 | **Export** | Tranzaksiyalar yoki maqolalar ro‘yxatini Excel/CSV ga yuklab olish. | Past |
| 4.6 | **PWA** | Service worker va manifest – mobil qurilmada “uygacha qo‘shish” va offline asosiy sahifa. | Past |

---

## 5. Yangi funksiyalar (qo‘shimcha qiymat)

| # | Taklif | Qisqa tavsif | Muhimlik |
|---|--------|--------------|----------|
| 5.1 | **Parolni unutdim** | Telefon orqali kod yuborish (SMS yoki Telegram) va parolni tiklash sahifasi. | Yuqori |
| 5.2 | **2FA (ikki bosqichli)** | Ixtiyoriy TOTP (Google Authenticator) – admin va hisobdorlar uchun. | Past |
| 5.3 | **To‘lov tarixi** | Profil yoki alohida sahifada foydalanuvchi to‘lovlari ro‘yxati va holati. | Yuqori |
| 5.4 | **Maqola holati bildirishnoma** | Status o‘zgarganda (qabul qilindi, rad etildi, nashr etildi) email yoki tizim ichidagi bildirishnoma. | O‘rta |
| 5.5 | **Dashboard widget’lar** | Rol bo‘yicha: “So‘nggi maqolalar”, “Kutilayotgan to‘lovlar”, “Bugungi statistika”. | O‘rta |
| 5.6 | **Qisqa link / slug** | Maqolalar uchun o‘qilishi oson URL (masalan `/articles/slug-123`). | Past |

---

## 6. Kod sifati va test

| # | Taklif | Qisqa tavsif | Muhimlik |
|---|--------|--------------|----------|
| 6.1 | **Unit testlar** | Backend: serializer validation, to‘lov signature hisoblash, login. Frontend: kritik util (formatPhone, getErrorMessage). | O‘rta |
| 6.2 | **API testlar** | Pytest + DRF test client – login, maqola yaratish, tranzaksiya yaratish. CI’da har commit’da ishlashi. | O‘rta |
| 6.3 | **E2E (ixtiyoriy)** | Playwright/Cypress – login → maqola yuborish → to‘lov modali. Muhim flow’lar uchun. | Past |
| 6.4 | **TypeScript qat’iy** | `strict: true`, kerak joylarda `any` o‘rniga aniq type. | O‘rta |
| 6.5 | **CI/CD** | GitHub Actions: lint, test, build. Branch’dan merge’dan keyin avtomatik test. | O‘rta |

---

## 7. Backend yaxshilanishlar

| # | Taklif | Qisqa tavsif | Muhimlik |
|---|--------|--------------|----------|
| 7.1 | **Celery** | Uzun vazifalar: email yuborish, PDF generatsiya, antiplagiat tahlilini Celery task qilish. Request tez tugaydi. | O‘rta |
| 7.2 | **PostgreSQL** | Production’da SQLite o‘rniga PostgreSQL – concurrent yozuvlar va backup uchun yaxshiroq. | Yuqori |
| 7.3 | **Read replica** | Juda katta yukda o‘qish so‘rovlari uchun alohida DB (keyinchalik). | Past |
| 7.4 | **Idempotent to‘lov** | Bir xil `merchant_trans_id` uchun complete callback bir necha marta kelsa ham xavfsiz qayta ishlash. | Yuqori |
| 7.5 | **Admin audit log** | Django admin’da kim, qachon, qanday o‘zgartirish qilgani (django-auditlog yoki custom). | Past |

---

## 8. Frontend yaxshilanishlar

| # | Taklif | Qisqa tavsif | Muhimlik |
|---|--------|--------------|----------|
| 8.1 | **Error boundary** | React Error Boundary – bir komponent xato bersa butun sahifa o‘rniga xato bloki va “Qayta yuklash”. | O‘rta |
| 8.2 | **Route guard** | Rol bo‘yicha: faqat super_admin `/users` ga kira olsin. Noto‘g‘ri URL’da 403 sahifa. | O‘rta |
| 8.3 | **Form library** | React Hook Form + Zod – validatsiya va xatolik ko‘rsatish bitta joyda, kam kod. | Past |
| 8.4 | **i18n (til)** | O‘zbek / Rus tillarini qo‘llab-quvvatlash (i18next). Kontent va UI matnlari. | Past |
| 8.5 | **Accessibility** | Tugmalar va formada `aria-label`, fokus boshqaruvi, kontrast. | Past |

---

## 9. Amaliy tartib (qaysi birinchi)

**Birinchi bosqich (tez va muhim):**
1. Health check endpoint (3.1)
2. GEMINI_API_KEY default olib tashlash (1.4)
3. To‘lov tarixi sahifasi / profil ichida (5.3)
4. Rate limiting login/register (1.1)
5. Pagination frontend’da ro‘yxatlar uchun (2.3)

**Ikkinchi bosqich:**
6. Cache – jurnallar/kategoriyalar (2.1)
7. Parolni unutdim (5.1)
8. Backup skripti (3.4)
9. Idempotent complete callback (7.4)
10. Error boundary (8.1)

**Uchinchi bosqich:**
11. React Query yoki SWR (2.2)
12. Skeleton loading (4.1)
13. Unit/API testlar (6.1, 6.2)
14. Celery (7.1)
15. PostgreSQL production (7.2)

---

*Ushbu hujjat AUDIT-TODO.md ga qo‘shimcha. Birorta bandni amalga oshirishda avvalo xavfsizlik va barqarorlikni hisobga oling.*
