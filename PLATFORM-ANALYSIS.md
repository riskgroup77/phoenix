# Phoenix Scientific Platform - To'liq Tahlil

## 📋 Umumiy Ma'lumot

**Phoenix Scientific Platform** - Ilmiy maqolalar va nashrlar boshqaruvining to'liq ekosistemasi. Platforma mualliflar, muharrirlar, reviewerlarni birlashtiruvchi cloud-native yechim.

**Domain:** 
- Frontend: `https://ilmiyfaoliyat.uz`
- Backend API: `https://api.ilmiyfaoliyat.uz`
- Server IP: `167.71.53.238`

---

## 🏗️ Arxitektura

### Tech Stack

#### Backend
- **Framework:** Django 5.2.8
- **API:** Django REST Framework
- **Database:** PostgreSQL (production), SQLite (development)
- **Authentication:** JWT (Simple JWT)
- **Payment Gateway:** Click.uz
- **AI Integration:** Google Gemini API
- **Task Queue:** Celery (Redis)
- **Web Server:** Gunicorn
- **Static Files:** WhiteNoise

#### Frontend
- **Framework:** React 19
- **Language:** TypeScript
- **Build Tool:** Vite 6
- **Routing:** React Router DOM (HashRouter)
- **State Management:** React Context API
- **UI Library:** Tailwind CSS (CDN)
- **Icons:** Lucide React
- **Notifications:** React Toastify

---

## 📦 Modullar va Funksiyalar

### 1. **Users (Foydalanuvchilar)**

#### Rollar:
- `author` - Muallif
- `reviewer` - Reviewer
- `journal_admin` - Jurnal admini
- `super_admin` - Super admin
- `accountant` - Buxgalter

#### User Model Features:
- Telefon raqam orqali autentifikatsiya
- ORCID ID integratsiyasi
- Gamification (ballar, darajalar, nishonlar)
- Reviewer statistikasi (completion rate, average time)
- Telegram username (bildirishnomalar uchun)
- Avatar yuklash

#### API Endpoints:
- `POST /api/v1/auth/register/` - Ro'yxatdan o'tish
- `POST /api/v1/auth/login/` - Kirish
- `GET /api/v1/auth/profile/` - Profil ma'lumotlari
- `PUT /api/v1/auth/update_profile/` - Profil yangilash
- `GET /api/v1/auth/stats/` - Statistika

---

### 2. **Articles (Maqolalar)**

#### Maqola Statuslari:
1. `Draft` - Qoralama
2. `Yangi` - Yangi yuborilgan
3. `WithEditor` - Redaktorda
4. `QabulQilingan` - Qabul qilingan
5. `WritingInProgress` - Yozish jarayonida
6. `NashrgaYuborilgan` - Nashrga yuborilgan
7. `Revision` - Tahrirga qaytarilgan
8. `Accepted` - Qabul qilingan
9. `Rejected` - Rad etilgan
10. `Published` - Nashr etilgan

#### Features:
- **Versions:** Maqolaning versiyalari (version control)
- **Analytics:** Ko'rishlar, yuklab olishlar, sitatsiyalar
- **Plagiarism Check:** AI kontent va plagiat tekshiruvi (Gemini API)
- **Files:** PDF, qo'shimcha hujjatlar
- **Activity Log:** Barcha harakatlar log qilinadi
- **Fast Track:** Tezkor nashr qilish opsiyasi
- **Certificates:** Plagiat tekshiruv sertifikati, nashr sertifikati
- **DOI:** Digital Object Identifier

#### API Endpoints:
- `GET /api/v1/articles/` - Maqolalar ro'yxati
- `POST /api/v1/articles/` - Yangi maqola yaratish
- `GET /api/v1/articles/{id}/` - Maqola tafsilotlari
- `PUT /api/v1/articles/{id}/` - Maqola yangilash
- `POST /api/v1/articles/{id}/update_status/` - Status yangilash
- `POST /api/v1/articles/{id}/check_plagiarism/` - Plagiat tekshiruvi
- `POST /api/v1/articles/{id}/increment_views/` - Ko'rishlar sonini oshirish
- `POST /api/v1/articles/{id}/increment_downloads/` - Yuklab olishlar sonini oshirish

---

### 3. **Journals (Jurnallar)**

#### Features:
- **Categories:** Jurnal kategoriyalari
- **Issues:** Jurnal sonlari
- **Payment Models:**
  - `pre-payment` - Oldindan to'lov
  - `post-payment` - Keyin to'lov
- **Pricing Types:**
  - `fixed` - Belgilangan narx
  - `per-page` - Sahifa bo'yicha narx
- **Additional Documents:** Qo'shimcha hujjatlar so'ralishi mumkin
- **Rules:** Jurnal qoidalari

#### API Endpoints:
- `GET /api/v1/journals/categories/` - Kategoriyalar
- `GET /api/v1/journals/journals/` - Jurnallar ro'yxati
- `POST /api/v1/journals/journals/` - Yangi jurnal yaratish
- `GET /api/v1/journals/journals/{id}/` - Jurnal tafsilotlari
- `GET /api/v1/journals/issues/` - Jurnal sonlari

---

### 4. **Payments (To'lovlar)**

#### Service Types:
- `fast-track` - Tezkor nashr
- `publication_fee` - Nashr haqi
- `language_editing` - Til tahriri
- `top_up` - Balans to'ldirish
- `book_publication` - Kitob nashr qilish
- `translation` - Tarjima xizmati

#### Transaction Statuses:
- `pending` - Kutilmoqda
- `completed` - Tugallangan
- `failed` - Xatolik
- `cancelled` - Bekor qilingan

#### Click.uz Integration:
- **Merchant ID:** 45730
- **Service ID:** 89248
- **Merchant User ID:** 72021
- **API:** Click Merchant API v2

#### Payment Flow:
1. Transaction yaratiladi
2. `prepare_payment` - Click'ga so'rov yuboriladi
3. Payment URL olinadi
4. Foydalanuvchi Click'da to'laydi
5. `complete` callback qabul qilinadi
6. Transaction status yangilanadi

#### API Endpoints:
- `GET /api/v1/payments/transactions/` - Tranzaksiyalar ro'yxati
- `POST /api/v1/payments/transactions/` - Yangi tranzaksiya
- `POST /api/v1/payments/transactions/{id}/process_payment/` - To'lov jarayonini boshlash
- `POST /api/v1/payments/transactions/{id}/prepare_payment/` - To'lov tayyorlash
- `POST /api/v1/payments/transactions/{id}/check_status/` - To'lov holatini tekshirish
- `POST /api/v1/payments/click/prepare/` - Click prepare callback
- `POST /api/v1/payments/click/complete/` - Click complete callback

---

### 5. **Translations (Tarjimalar)**

#### Statuses:
- `Yangi` - Yangi so'rov
- `Jarayonda` - Tarjima qilinmoqda
- `Bajarildi` - Tugallangan
- `BekorQilindi` - Bekor qilingan

#### Features:
- Source va target tillar
- Word count hisoblash
- Narx hisoblash
- Reviewer tayinlash
- File upload/download

#### API Endpoints:
- `GET /api/v1/translations/` - Tarjima so'rovlari
- `POST /api/v1/translations/` - Yangi so'rov
- `GET /api/v1/translations/{id}/` - So'rov tafsilotlari
- `PUT /api/v1/translations/{id}/` - So'rov yangilash

---

### 6. **Reviews (Reviewlar)**

#### Review Types:
- `open` - Ochiq review
- `single_blind` - Yashirin (muallif ko'rmaydi)
- `double_blind` - Ikki tomonlama yashirin

#### Statuses:
- `pending` - Kutilmoqda
- `accepted` - Qabul qilingan
- `declined` - Rad etilgan
- `completed` - Tugallangan

#### Features:
- Rating tizimi
- Review content
- Assignment va completion tracking

#### API Endpoints:
- `GET /api/v1/reviews/` - Reviewlar ro'yxati
- `POST /api/v1/reviews/` - Yangi review
- `PUT /api/v1/reviews/{id}/` - Review yangilash

---

### 7. **Notifications (Bildirishnomalar)**

#### Features:
- Real-time bildirishnomalar
- Read/unread tracking
- Link bilan bildirishnomalar
- User-specific notifications

#### API Endpoints:
- `GET /api/v1/notifications/` - Bildirishnomalar ro'yxati
- `POST /api/v1/notifications/{id}/mark_read/` - O'qilgan deb belgilash
- `POST /api/v1/notifications/mark_all_read/` - Barchasini o'qilgan deb belgilash
- `GET /api/v1/notifications/unread_count/` - O'qilmaganlar soni

---

## 🎨 Frontend Struktura

### Pages (Sahifalar):
1. **Login** - Kirish
2. **Register** - Ro'yxatdan o'tish
3. **Dashboard** - Bosh sahifa
4. **Articles** - Maqolalar ro'yxati
5. **ArticleDetail** - Maqola tafsilotlari
6. **SubmitArticle** - Maqola yuborish
7. **SubmitBook** - Kitob yuborish
8. **PublishedArticles** - Nashr etilgan maqolalar
9. **MyCollections** - Mening kolleksiyalarim
10. **MyTranslations** - Mening tarjimalarim
11. **TranslationService** - Tarjima xizmati
12. **TranslationDetail** - Tarjima tafsilotlari
13. **PlagiarismCheck** - Plagiat tekshiruvi
14. **Services** - Xizmatlar
15. **Profile** - Profil
16. **UserManagement** - Foydalanuvchilar boshqaruvi (admin)
17. **JournalManagement** - Jurnallar boshqaruvi
18. **JournalAdminPanel** - Jurnal admin paneli
19. **UdkRequests** - UDK so'rovlari
20. **Financials** - Moliyaviy hisobotlar
21. **PaymentTest** - To'lov test sahifasi

### Components:
- **Layout** - Asosiy layout
- **Header** - Header komponenti
- **Sidebar** - Sidebar navigatsiya
- **BottomNavBar** - Pastki navigatsiya (mobile)
- **AuthLayout** - Autentifikatsiya layout
- **Certificate** - Sertifikat komponenti
- **CertificateElements** - Sertifikat elementlari
- **SubmissionCertificate** - Yuborish sertifikati
- **AuthorArticleReport** - Muallif maqola hisoboti
- **ScrollingBanner** - Scroll qilinadigan banner
- **Button** - Button komponenti (UI)
- **Card** - Card komponenti (UI)

### Services:
- **apiService** - API so'rovlari
- **paymentService** - To'lov xizmatlari
- **geminiService** - Gemini AI integratsiyasi

### Contexts:
- **AuthContext** - Autentifikatsiya va foydalanuvchi ma'lumotlari
  - User state
  - Login/logout
  - Notifications management

---

## 🔐 Autentifikatsiya va Xavfsizlik

### JWT Authentication:
- **Access Token:** 1 kun
- **Refresh Token:** 7 kun
- **Token Rotation:** Enabled
- **Blacklist:** Enabled

### CORS:
- Production: `https://ilmiyfaoliyat.uz`
- Development: `http://localhost:5173`, `http://127.0.0.1:5173`

### File Upload:
- Max size: 10MB
- Allowed types: PDF, images, documents

---

## 💾 Database Struktura

### Asosiy Jadvalar:
1. **users_user** - Foydalanuvchilar
2. **articles_article** - Maqolalar
3. **articles_articleversion** - Maqola versiyalari
4. **articles_activitylog** - Faollik loglari
5. **journals_journal** - Jurnallar
6. **journals_journalcategory** - Jurnal kategoriyalari
7. **journals_issue** - Jurnal sonlari
8. **payments_transaction** - Tranzaksiyalar
9. **translations_translationrequest** - Tarjima so'rovlari
10. **reviews_peerreview** - Peer reviewlar
11. **notifications_notification** - Bildirishnomalar

### Relationships:
- User → Articles (One-to-Many)
- User → Journals (One-to-Many, journal_admin)
- Article → Journal (Many-to-One)
- Article → Transactions (One-to-Many)
- Article → PeerReviews (One-to-Many)
- Article → ActivityLogs (One-to-Many)
- Transaction → TranslationRequest (Optional One-to-One)
- User → Notifications (One-to-Many)

---

## 🚀 Deployment

### Server:
- **IP:** 167.71.53.238
- **User:** (SSH — repoda yozilmaydi)
- **Directory:** `/phonix`
- **Service:** `phoenix-backend`
- **Port:** 8000

### Deployment Process:
1. Local'da o'zgarishlarni commit qilish
2. Git'ga push qilish
3. Server'ga SSH orqali ulanish
4. `deploy_phonix.sh` script ishga tushirish
5. Service restart

### Nginx Configuration:
- Backend: `api.ilmiyfaoliyat.uz/api/v1/` → `127.0.0.1:8000`
- Frontend: `ilmiyfaoliyat.uz/` → `/phonix/frontend/dist`

---

## 🔧 Konfiguratsiya

### Environment Variables (Backend):
```env
SECRET_KEY=...
DEBUG=False
DATABASE_URL=...
CLICK_MERCHANT_ID=45730
CLICK_SERVICE_ID=89248
CLICK_SECRET_KEY=...
CLICK_MERCHANT_USER_ID=72021
GEMINI_API_KEY=...
CORS_ALLOWED_ORIGINS=...
```

### Environment Variables (Frontend):
```env
VITE_API_BASE_URL=https://api.ilmiyfaoliyat.uz/api/v1
VITE_MEDIA_URL=https://api.ilmiyfaoliyat.uz/media/
VITE_GEMINI_API_KEY=...
```

---

## 📊 Asosiy Workflow'lar

### 1. Maqola Yuborish Workflow:
1. Author maqola yaratadi (Draft)
2. Maqolani jurnalga yuboradi (Yangi)
3. Editor ko'rib chiqadi (WithEditor)
4. Plagiat tekshiruvi o'tkaziladi
5. Reviewer'larga yuboriladi (QabulQilingan)
6. Reviewlar to'planadi
7. Qabul/Rad qilinadi
8. Nashrga tayyorlanadi (NashrgaYuborilgan)
9. Nashr etiladi (Published)

### 2. To'lov Workflow:
1. Transaction yaratiladi
2. Click.uz'ga so'rov yuboriladi
3. Payment URL olinadi
4. Foydalanuvchi to'laydi
5. Callback qabul qilinadi
6. Transaction status yangilanadi
7. Xizmat aktivlashtiriladi

### 3. Tarjima Workflow:
1. Author tarjima so'rovi yaratadi
2. Reviewer tayinlanadi
3. Tarjima bajariladi
4. Foydalanuvchi to'laydi
5. Tarjima fayli yuklanadi
6. Status "Bajarildi" ga o'zgaradi

---

## 🎮 Gamification

### Features:
- **Points System:** Har bir harakat uchun ball
- **Levels:** Beginner, Intermediate, Advanced, Expert
- **Badges:** Turli xil nishonlar
- **Statistics:** Reviewer statistikasi

### Points Sources:
- Maqola yuborish
- Review bajarish
- Maqola nashr qilish
- Tarjima bajarish

---

## 🔍 AI Integratsiyasi

### Gemini API:
- **Plagiarism Detection:** Plagiat va AI kontent aniqlash
- **Content Analysis:** Kontent tahlili
- **Translation Assistance:** Tarjima yordamchisi

---

## 📱 Mobile Support

- Responsive design (Tailwind CSS)
- Bottom navigation bar (mobile)
- Touch-friendly interface

---

## 🔄 Version Control

### Article Versions:
- Har bir maqola versiyalari saqlanadi
- Digital hash bilan imzolash
- Version history tracking

---

## 📈 Analytics

### Article Analytics:
- Views count
- Downloads count
- Citations count

### User Analytics:
- Reviews completed
- Average review time
- Acceptance rate

---

## 🛡️ Xavfsizlik Xususiyatlari

1. **JWT Authentication** - Token-based auth
2. **CORS Protection** - Cross-origin protection
3. **CSRF Protection** - Django CSRF middleware
4. **File Upload Validation** - Size va type tekshiruvi
5. **Role-based Access Control** - Rollar asosida ruxsatlar
6. **Input Validation** - Serializer validation
7. **SQL Injection Protection** - Django ORM
8. **XSS Protection** - Django template escaping

---

## 📝 Muhim Eslatmalar

### Development:
- Frontend: `npm run dev` (port 5173)
- Backend: `python manage.py runserver` (port 8000)
- Database: SQLite (dev), PostgreSQL (prod)

### Production:
- Gunicorn ishlatiladi
- WhiteNoise static files
- Nginx reverse proxy
- Systemd service management

### Testing:
- Payment test sahifasi mavjud
- API connection test sahifalari
- Localhost test konfiguratsiyasi

---

## 🔗 Integratsiyalar

1. **Click.uz** - To'lov tizimi
2. **Google Gemini** - AI xizmatlari
3. **PostgreSQL** - Database
4. **Redis** - Celery broker
5. **Nginx** - Web server
6. **Gunicorn** - WSGI server

---

## 📚 Qo'shimcha Ma'lumotlar

### Documentation Files:
- `DEPLOYMENT-WORKFLOW.md` - Deployment yo'riqnomasi
- `SERVER-COMMANDS.md` - Server buyruqlari
- `CLICK-*.md` - Click integratsiyasi hujjatlari
- `CSP-ERROR-FIX.md` - CSP xatolari tuzatish

### Git Repositories:
- Backend: `https://github.com/aiziyrak-coder/phonixB.git`
- Frontend: `https://github.com/aiziyrak-coder/phonixF.git`

---

## 🎯 Platformaning Asosiy Maqsadlari

1. **Ilmiy nashr jarayonini soddalashtirish**
2. **Transparency** - Shaffof jarayonlar
3. **Efficiency** - Samarali workflow
4. **Quality Control** - Sifat nazorati
5. **Digital Transformation** - Raqamlashtirish
6. **AI Integration** - Sun'iy intellekt integratsiyasi
7. **Gamification** - O'yinlashtirish
8. **Analytics** - Tahlil va statistika

---

## ✅ Xulosa

Phoenix Scientific Platform - bu to'liq funksional, zamonaviy va kengaytirilishi mumkin bo'lgan ilmiy nashr boshqaruv tizimi. Platforma mualliflar, muharrirlar, reviewerlarni birlashtirib, ilmiy nashr jarayonini raqamlashtirish va soddalashtirishga qaratilgan.

**Asosiy Xususiyatlar:**
- ✅ To'liq maqola boshqaruvi
- ✅ To'lov integratsiyasi (Click.uz)
- ✅ AI-powered plagiat tekshiruvi
- ✅ Tarjima xizmatlari
- ✅ Review tizimi
- ✅ Gamification
- ✅ Real-time bildirishnomalar
- ✅ Analytics va reporting
- ✅ Mobile-responsive design
- ✅ Cloud-native arxitektura

---

*Hujjat yaratilgan sana: 2026-01-25*
*Platforma versiyasi: Phoenix Scientific 8*
