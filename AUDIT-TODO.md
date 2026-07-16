# Phoenix Platform – Umumiy audit va TODO

## 1. Kod tuzilishi

| # | Vazifa | Status | Izoh |
|---|--------|--------|------|
| 1.1 | Frontend papkalar: `pages/`, `components/`, `services/`, `contexts/`, `utils/` | ✅ | Tuzilishi to'g'ri |
| 1.2 | Backend: `apps/*/views.py`, `serializers.py`, `models.py`, `urls.py` | ✅ | Django app tuzilishi |
| 1.3 | Types: `types.ts` – barcha interface/enum ishlatilishi | ✅ | Role, PaymentModel, User, Journal, ... |
| 1.4 | API: `apiService.ts` – bitta base URL, token, error handling | ✅ | getUserFriendlyError, 401 redirect |
| 1.5 | Eski/keraksiz fayllar: `*.old.tsx`, `*.backup.tsx` | ✅ | O'chirildi: Register.old, Login.old, SubmitArticle.backup |

---

## 2. Autentifikatsiya

| # | Vazifa | Status | Izoh |
|---|--------|--------|------|
| 2.1 | Login: telefon + parol, token saqlash | ✅ | LoginSimple, AuthContext |
| 2.2 | Register: telefon, parol, tasdiq | ✅ | RegisterSimple |
| 2.3 | ProtectedRoute: token yo'qsa /login | ✅ | App.tsx |
| 2.4 | Profile yuklanish: getProfile, role mapping | ✅ | AuthContext loadUser |
| 2.5 | Logout: token tozalash, redirect | ✅ | AuthContext |
| 2.6 | 401: token muddati tugasa redirect | ✅ | apiFetch |

---

## 3. Sahifalar va tugmalar

| Sahifa | Asosiy tugma/funksiya | Status |
|--------|------------------------|--------|
| Dashboard | Statistika, StatCard linklar | ✅ |
| Articles | Ro'yxat, status yangilash, filter | ✅ |
| ArticleDetail | Yuklash, ko'rish, status | ✅ |
| SubmitArticle | Wizard, PrePayment to'lov modali, yuborish | ✅ |
| SubmitBook | Kalkulyator, to'lov, yuborish | ✅ |
| Profile | Profil tahrir, test to'lov | ✅ |
| Services | Xizmatlar kartochkasi, linklar | ✅ |
| PlagiarismCheck | Fayl tanlash, to'lov, tekshirish | ✅ |
| TranslationService | Fayl, tahlil, to'lov, yuborish | ✅ |
| MyTranslations | Ro'yxat | ✅ |
| TranslationDetail | Qabul qilish, tugatish | ✅ |
| JournalManagement | CRUD jurnallar (journal_admin/super_admin) | ✅ |
| JournalAdminPanel | Maqolalar boshqaruv | ✅ |
| UserManagement | Foydalanuvchilar (super_admin) | ✅ |
| UdkRequests | UDK so'rovlari | ✅ |
| Financials | Tranzaksiyalar | ✅ |
| PublishedArticles | Nashr etilganlar, son yaratish | ✅ |
| MyCollections | To'plamlar | ✅ |
| ClickPayment | transaction_id bo'yicha to'lov URL | ✅ |
| PaymentTest | Test to'lov | ✅ |

---

## 4. To'lov (Click)

| # | Vazifa | Status |
|---|--------|--------|
| 4.1 | Tranzaksiya yaratish: amount, service_type, article/translation_request | ✅ |
| 4.2 | process_payment → payment_url | ✅ |
| 4.3 | Redirect Click sahifasiga | ✅ |
| 4.4 | Prepare/Complete callback (backend) | ✅ |
| 4.5 | Maqola: PrePayment – modal, PostPayment – bevosita yuborish | ✅ |
| 4.6 | Kitob: to'lov modali, keyin yuborish | ✅ |
| 4.7 | Tarjima: so'rov yaratish → to'lov modali | ✅ |
| 4.8 | Antiplagiat: to'lov modali → tekshirish | ✅ |

---

## 5. Xatolik va foydalanuvchi tajribasi

| # | Vazifa | Status |
|---|--------|--------|
| 5.1 | Markaziy error: `getUserFriendlyError`, `getErrorMessage` | ✅ |
| 5.2 | Tarmoq xatosi: "Serverga ulanib bo'lmadi" | ✅ |
| 5.3 | 401: "Sessiya tugadi, qayta kiring" | ✅ |
| 5.4 | To'lov xatolari: error_note, user_message | ✅ |
| 5.5 | Loading: tugmalarda loading/disabled | ✅ |
| 5.6 | ProtectedRoute loading: "Yuklanmoqda..." | ✅ |

---

## 6. Navigatsiya va rol

| Rol | Sidebar linklar | Status |
|-----|-----------------|--------|
| Author | dashboard, articles, submit, my-collections, my-translations, services, profile | ✅ |
| Reviewer | dashboard, articles, profile | ✅ |
| JournalAdmin | dashboard, journal-admin-panel, articles, published-articles | ✅ |
| SuperAdmin | dashboard, users, articles, journal-management, financials, udk-requests, profile | ✅ |
| Accountant | dashboard, financials, profile | ✅ |

Barcha route'lar `App.tsx` da: submit, submit-book, payment/click, payment-test, translations/:id, articles/:id va boshqalar.

---

## 7. Backend qisqacha

| # | Vazifa | Status |
|---|--------|--------|
| 7.1 | JWT auth, permissions (IsAuthenticated) | ✅ |
| 7.2 | Payments: Transaction CRUD, process_payment, Click prepare/complete | ✅ |
| 7.3 | Articles: create (file upload), check_plagiarism | ✅ |
| 7.4 | Journals: payment_model, pricing | ✅ |
| 7.5 | Users: login, register, profile | ✅ |
| 7.6 | Serializers: CreateTransactionSerializer (article, translation_request optional) | ✅ |

---

## 8. Test va build

| # | Vazifa | Qanday tekshirish | Natija |
|---|--------|-------------------|--------|
| 8.1 | Frontend build | `npm run build` xatosiz | ✅ |
| 8.2 | Lint | `ReadLints` asosiy fayllar uchun | ✅ |
| 8.3 | Kritik flow | Login → Dashboard → Submit (PrePayment) → To'lov modali → Redirect | Qo'lda test |

### Test rejasi (qo'lda)
1. **Auth:** Login (telefon + parol) → Dashboard ko'rinadi.
2. **Maqola:** Submit → Jurnal tanlash (PrePayment) → Wizard tugagach "To'lov va Yuborish" → Modal ochiladi → To'lovni Amalga Oshirish → Click redirect.
3. **Kitob:** Submit Book → To'lovga o'tish va Yuborish → Modal → To'lash.
4. **Profil:** Profil sahifa, Test to'lov (1000 so'm).
5. **Rol:** SuperAdmin bilan kirish → Sidebar'da Moliya, Jurnallar, Foydalanuvchilar.

---

## 9. Mukammallashtirish (bajarilgan)

| # | Vazifa | Status |
|---|--------|--------|
| 9.1 | Eski fayllar o'chirildi | ✅ Register.old.tsx, Login.old.tsx, SubmitArticle.backup.tsx |
| 9.2 | Barcha xatolik sarlavhalari o'zbekcha | ✅ "Xatolik", "Qayta urinish" (Dashboard, Articles, UserManagement, …) |
| 9.3 | Xatolik xabarlari o'zbekcha | ✅ setError(...) barcha sahifalarda o'zbekcha matn |
| 9.4 | API response massiv format | ✅ MyCollections toArray, boshqa sahifalar results/data/array |
| 9.5 | ProtectedRoute loading UI | ✅ Spinner + "Yuklanmoqda..." |
| 9.6 | Production'da API debug log | ✅ apiService – faqat development'da log |
| 9.7 | PlagiarismCheck xatolik | ✅ getUserFriendlyError ishlatiladi |
| 9.8 | Articles "Qayta urinish" | ✅ setError(null); fetchData() – sahifa reloadsiz |

---

## 10. Qolgan ixtiyoriy yaxshilanishlar

- PaymentTest sahifasi faqat admin uchun (sidebar'da ko'rinmasligi mumkin).
- Production build'da `console.log` / `console.info` / `console.debug` allaqachon terser orqali o'chiriladi (vite.config.ts).

---

*Audit to'liq yakunlandi. Barcha asosiy funksiyalar, xatolik ko'rsatish, loading va o'zbekcha matnlar tekshirildi va kerak joylar tuzatildi.*
