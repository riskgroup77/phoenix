# Ekspluatatsiya qo'llanmasi (server)

## 1. Deploy

- `main` branch'ga push → avval **CI** (backend testlari, `tsc`, `vitest`, `vite build`). Faqat CI muvaffaqiyatli
  o'tsa GitHub Actions (`.github/workflows/deploy-server.yml`, `workflow_run`) serverga SSH orqali kirib, aynan
  sinalgan commit (`PHONIX_GIT_REF`) bilan **`deploy_phonix.sh`** ni ishga tushiradi. Webhook varianti
  (`config/github_deploy_webhook.py`) ham faqat CI `success` hodisasida ishlaydi.
- Deploy: kod zaxirasi (`backups/code/`, oxirgi 5 tasi), **baza zaxirasi (`phoenix-backup.sh pre-deploy`) — olinmasa
  migratsiya bajarilmaydi**, `migrate`, `collectstatic`, frontend build, systemd unitlarini o'rnatish, xizmatlarni
  qayta ishga tushirish.
- Serverda qo'lda: `bash /phonix/deploy_server_now.sh`.
- GitHub secrets: `PHONIX_SSH_HOST`, `PHONIX_SSH_USER`, `PHONIX_SSH_PRIVATE_KEY` (yoki `PHONIX_SSH_PASSWORD`),
  ixtiyoriy `PHONIX_SSH_PORT` (standart 22).

Deploy demo hisoblarni (911111111/muallif …) yangilaydi — rasmiy ishga tushirishda `.env` ga
`PHONIX_DEMO_ENABLED=false` yozing (9-bo'limga qarang). Bosh admin / buxgalter demo hisoblari serverda hech qachon yaratilmaydi.

## 2. Xizmatlar (systemd)

| Xizmat | Namuna | Vazifa |
|---|---|---|
| `phoenix-backend` | `infrastructure/systemd/phoenix-backend.service.example` | gunicorn, `127.0.0.1:8050` |
| `phoenix-celery` | `infrastructure/systemd/phoenix-celery.service.example` | antiplagiat fon vazifalari |
| Telegram bot | `python bot/bot.py` (`backend/` dan) | muallif boti |
| `phoenix-reminders.timer` | `infrastructure/systemd/phoenix-reminders.{service,timer}.example` | har kuni 09:00 — taqrizchilarga muddat eslatmalari |
| `phoenix-backup.timer` | `infrastructure/systemd/phoenix-backup.{service,timer}.example` | har kuni 02:30 — baza (`pg_dump`) + media zaxirasi |
| `phoenix-uptime.timer` | `infrastructure/systemd/phoenix-uptime.{service,timer}.example` | har 5 daqiqada — sayt, disk, zaxira, xizmatlar, SSL; muammo bo'lsa Telegram |
| `phoenix-antiplag-index.timer` | `infrastructure/systemd/phoenix-antiplag-index.{service,timer}.example` | har kecha — antiplagiat indeksi, OAI yig'ish, vektor indeksi |

`deploy_phonix.sh` yetishmayotgan unitlarni avtomatik o'rnatadi (`User`/yo'llar `phoenix-backend` dan olinadi).
Mavjud unitlar ustidan yozilmaydi; yangilash uchun: `PHONIX_UPDATE_UNITS=true bash deploy_phonix.sh`.

Celery worker bo'lmasa antiplagiat thread rejimida ishlaydi, lekin gunicorn qayta ishga tushganda
tekshiruv uziladi (30 daqiqadan keyin "stalled" deb belgilanadi va qayta boshlash mumkin).

## 3. Muhim `.env` sozlamalari

Namuna: `backend/env.production.example`. Eng muhimlari:

| O'zgaruvchi | Izoh |
|---|---|
| `SECRET_KEY`, `DEBUG=False` | Majburiy |
| `CLICK_SECRET_KEY` (yoki `CLICK_SERVICE_<id>_SECRET_KEY`) | Click kabinetidagi kalit. Bo'sh bo'lsa callback'lar rad etiladi |
| `PAYME_MERCHANT_ID`, `PAYME_MERCHANT_KEY` (`PAYME_TEST_KEY`, `PAYME_IS_TEST`) | Bo'sh bo'lsa Payme callback'lari rad etiladi |
| `NUM_PROXIES` | Mijoz IP aniqlash uchun proksilar soni (standart 1 — nginx) |
| `ANTIPLAG_OPENSEARCH_ENABLED`, `ANTIPLAG_OPENSEARCH_URL` | Parafraz va tez fragment qidiruv |
| `ANTIPLAG_CORE_API_KEY`, `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX` yoki `BING_SEARCH_API_KEY` | CORE va internet qidiruv modullari (bo'lmasa ular ro'yxatda ko'rinmaydi) |
| `TELEGRAM_BOT_TOKEN` | Bot tokeni. Backend ham shu token bilan bildirishnomalarni botga yuboradi (bo'sh bo'lsa yuborilmaydi) |
| `TELEGRAM_BOT_USERNAME` | Bot nomi `@`siz — profil sahifasidagi «Botni ochish» havolasi uchun |
| `FRONTEND_BASE_URL`, `PUBLIC_SITE_URL` | `https://ilmiyfaoliyat.uz` — Telegram xabaridagi havola, QR kodlar, ochiq maqola sahifalari |
| `CROSSREF_USERNAME`, `CROSSREF_PASSWORD`, `CROSSREF_DOI_PREFIX`, `CROSSREF_DEPOSITOR_EMAIL` | Crossref DOI depoziti. Login bo'lmasa XML faqat yuklab olinadi |
| `SCHOLAR_EXPOSE_PDF` | `true` (standart) — ochiq maqola sahifasida PDF havolasi (Google Scholar uchun) |
| `SLA_ARTICLE_DAYS`, `SLA_ARTICLE_FAST_DAYS`, `SLA_DOI_DAYS`, `SLA_UDK_DAYS`, `SLA_TRANSLATION_DAYS`, `SLA_SAMPLE_DAYS`, `SLA_PEER_REVIEW_DAYS` | Taqrizchi ishlari muddati, kun (standart: 7, 3, 3, 2, 5, 7, 14) |
| `PHONIX_ALERT_CHAT_ID` | Monitoring: server 500 xatolari, brauzer xatolari, zaxira xatosi, sayt uzilishi shu Telegram chatga |
| `JWT_USE_HTTPONLY_COOKIES` | `true` (DEBUG=False da standart) — refresh token faqat HttpOnly cookie'da |
| `MEDIA_PROTECTION_ENABLED`, `MEDIA_URL_TTL_SECONDS`, `MEDIA_ACCEL_REDIRECT` | Shaxsiy fayllar faqat imzoli havola orqali (standart 6 soat); nginx snippet ulangach `MEDIA_ACCEL_REDIRECT=true` |
| `PHONE_VERIFICATION_REQUIRED` | `true` — Telegram orqali raqamini tasdiqlamagan muallif maqola yubora / to'lov qila olmaydi |
| `TERMS_ACCEPTANCE_REQUIRED`, `LEGAL_TERMS_VERSION` | Ro'yxatdan o'tishda oferta roziligi va qaysi tahrirga rozilik berilgani |
| `PHONIX_DEMO_ENABLED` | `false` — demo hisoblar deployda qayta yaratilmaydi |
| `PHONIX_DATA_LOCATION=UZ` | Server O'zbekistonda ekani tasdiqlangan (`launch_check` uchun) |
| `PHONIX_BACKUP_DIR`, `PHONIX_BACKUP_RCLONE_REMOTE` | Zaxira papkasi va (ixtiyoriy) tashqi nusxa uchun rclone manzili |
| `ANTIPLAG_LOCAL_VECTORS_ENABLED` | Parafraz va tarjima plagiati (OpenSearch'siz, ~0.5 GB RAM) |

## 4. Boshqaruv buyruqlari (`backend/` dan)

| Buyruq | Vazifa |
|---|---|
| `python manage.py rotate_demo_passwords [--apply]` | Ochiq bo'lgan demo / admin parollarini tasodifiy qiymatga almashtirish |
| `python manage.py audit_payments [--verify-click]` | Imzosiz tasdiqlangan yoki arzon to'lovlarni topish (faqat o'qiydi) |
| `python manage.py list_legacy_antiplag_reports [--csv f.csv]` | Eski (4.0 dan oldingi) antiplagiat natijalari ro'yxati |
| `python manage.py regenerate_udk_pdfs [--apply]` | PDF'siz qolgan UDK ma'lumotnomalari uchun PDF yaratish |
| `python manage.py index_antiplag_opensearch --recreate [--with-embeddings]` | OpenSearch indeksini qayta qurish |
| `python manage.py import_antiplag_corpus <fayl.json>` | Arxiv hujjatlarini ichki korpusga import qilish |
| `python manage.py send_deadline_reminders [--dry-run]` | Taqrizchilarga muddati yaqin/o'tgan ishlar, bosh adminga kechikishlar hisoboti (kuniga bir marta) |
| `python scripts/build_antiplag_templates.py` (repo ildizidan, Windows) | Antiplagiat sertifikati/hisobot JPG shablonlari va koordinatalarini qayta yaratish |
| `python manage.py launch_check [--strict] [--json]` | **Ishga tushirishdan oldingi tekshiruv**: DEBUG, kalitlar (sizib chiqqanlari ham), demo, zaxira, xizmatlar, monitoring, oferta |
| `python manage.py seed_demo_data [--purge [--logins]]` | Demo ma'lumotlar; `--purge --logins` — demo hisoblar bilan birga o'chirish |
| `python manage.py build_antiplag_vectors [--rebuild]` | Parafraz/tarjima plagiati uchun lokal vektor indeksi |

## 5. Xavfsizlik tekshiruv ro'yxati

GitHub repozitoriy **ochiq (public)** va quyidagi qiymatlar uning git tarixida bor — **almashtirilishi shart**.
Tarixni tozalash yetarli emas (nusxalar allaqachon olingan bo'lishi mumkin). `python manage.py launch_check`
serverdagi joriy kalit sizib chiqqanlardan biri bo'lsa FAIL beradi (`config/leaked_secrets.py` — faqat SHA-256 izlar).

- [ ] Click secret key (Click merchant kabineti → server `.env`)
- [ ] Gemini API kalitlari (Google AI Studio / Cloud Console — eskisini o'chiring)
- [ ] PostgreSQL paroli (`ALTER USER phoenix WITH PASSWORD '...'` + `.env` dagi `DB_PASSWORD`)
- [ ] **Telegram bot tokeni** (@BotFather → `/revoke`, yangi token `.env` ga)
- [ ] **Django `SECRET_KEY`** (barcha sessiyalar va imzoli havolalar bekor bo'ladi — bu kerakli)
- [ ] Demo / Django admin parollari: `python manage.py rotate_demo_passwords --apply`
- [ ] Repozitoriyni **private** qilish (GitHub → Settings → Danger zone). Deploy bunga bog'liq emas
      (serverga deploy key kerak — 9.6 ga qarang).

## 6. Antiplagiat

Algoritm 5.0 (`backend/apps/articles/antiplagiat_engine.py`, `antiplagiat_real_scan.py`):

- Manbalar: ichki baza (jurnalga yuborilgan maqolalar + import/OAI arxivlar), OpenAlex, Crossref,
  Semantic Scholar, (sozlansa) CORE, OpenSearch parafraz va internet qidiruv.
- **Barmoq izlari indeksi** (`antiplagiat_index.py`, jadvallar `AntiplagIndexedDocument`, `AntiplagFingerprint`):
  hujjat normallashtiriladi (kirill → lotin, apostroflar, qo'shimchalar, yordamchi so'zlar, kichik sinonimlar
  lug'ati — `antiplagiat_normalize.py`), 4 so'zli bo'laklar xeshlanadi va winnowing bilan saqlanadi.
  Tekshiruvda BUTUN hujjat butun indeks bilan solishtiriladi (avval ko'pi bilan 220 gap): 8+ mazmunli so'zli
  har qanday umumiy qism kafolatli topiladi; so'z tartibi/sinonim bilan o'zgartirilgan gaplar alohida
  aniqlanadi (`match_subtype='reordered'`, «Parafraz» ko'rsatkichiga qo'shiladi).
- Indeks (va undan keyin OAI arxivlari) har deploydan keyin fon rejimida avtomatik yangilanadi (`deploy_phonix.sh`, log: `/tmp/phonix_antiplag_index.log`)
  va tungi taymer bilan. Qo'lda:

  ```bash
  python manage.py build_antiplag_index            # o'zgarganlar; qayta ishga tushirish xavfsiz
  python manage.py build_antiplag_index --stats
  python manage.py build_antiplag_index --rebuild --prune
  ```

  To'liq o'tish tugamaguncha tekshiruvlar eski usulda (korpus xotirada) ishlaydi — chala indeks ishlatilmaydi.
  Keyin yangi/o'zgargan maqolalar va arxiv hujjatlari signal orqali avtomatik indekslanadi
  (`ANTIPLAG_AUTO_INDEX=true`). Normalizatsiya qoidalari o'zgarsa (`NORMALIZE_VERSION`) — `build_antiplag_index`
  o'zgargan hujjatlarni o'zi qayta yozadi.
- **OAI-PMH yig'uvchi (bepul)** — O'zbekiston jurnallari arxivlarini ichki bazaga qo'shish. Standart ro'yxat
  (`antiplagiat_oai.DEFAULT_OAI_SOURCES`, 2026-10-08 da tekshirilgan, jami ~218 ming yozuv): inLibrary.uz,
  in-academy.uz, phoenixpublication.net, journals.nuu.uz (SSL zanjiri to'liq emas → `|insecure`),
  openscience.uz, universaljournal.uz, journals.uznauka.uz. `.env` dagi `ANTIPLAG_OAI_SOURCES` uni almashtiradi.

  ```bash
  python manage.py harvest_oai --all                        # birinchi marta uzoq (soatlab); keyin faqat yangilari
  python manage.py harvest_oai --all --fill-full-text 500   # + 500 ta yozuvning PDF to'liq matni
  python manage.py harvest_oai --status                     # har manba/jurnal bo'yicha holat
  python manage.py harvest_oai https://<jurnal>/index.php/<jur>/oai --full
  ```

  OJS'ning umumiy endpoint'i (`…/index.php/index/oai`) jurnal-jurnal (set) bo'yicha yig'iladi; har set uchun
  oxirgi sana `AntiplagHarvestState` da saqlanadi. PDF matni `citation_pdf_url` / OJS galereya havolasi orqali
  olinadi; har tungi ishga tushirishda bir qismi (`--fill-full-text`), muvaffaqiyatsizlari qayta urinilmaydi.
  Tungi yangilash: `infrastructure/systemd/phoenix-antiplag-index.{service,timer}.example`.
- **Bepul ochiq API'lar (kalitsiz)**: OpenAlex, Crossref, Semantic Scholar, **DOAJ**, **Vikipediya** (gap tiliga
  qarab uz/ru/en; topilgan maqola to'liq solishtiriladi), **arXiv** va **Europe PMC** (faqat ingliz tilidagi
  gaplar). CORE uchun bepul kalit: https://core.ac.uk/services/api → `ANTIPLAG_CORE_API_KEY`.
- **Aldashga qarshi** (`antiplagiat_tricks.py`): ko'rinmas belgilar (U+200B, soft hyphen…), lotin↔kirill o'xshash
  harflar, DOCX/PDF dagi oq / ≤1pt / hidden matn olib tashlanib, tekshiruv ko'rinadigan matn bo'yicha o'tkaziladi;
  hisobotda `bypass_attempts` va qizil ogohlantirish, xavf darajasi «yuqori».
- **Adabiyotlar ro'yxati** («Foydalanilgan adabiyotlar», «Список литературы», «References»…) hujjatning ikkinchi
  yarmida topilsa — tekshiruvdan va foiz hisobidan chiqariladi (`excluded_bibliography_chars`).
- Indeksda ko'p hujjatlarda uchraydigan bo'laklar (shablon iboralar) nomzod tanlashda hisobga olinmaydi
  (`ANTIPLAG_COMMON_SHINGLE_MIN_DOCS`, standart 30 yoki hujjatlarning 1%).
- **Ochiq API'lar**: har modulga alohida limit (`ANTIPLAG_OPEN_API_QUERIES_PER_MODULE`, standart 30), so'rovlar
  hujjat bo'ylab eng «o'ziga xos» gaplardan, modullar parallel. Topilgan har bir ishning annotatsiyasi butun
  hujjat bilan solishtiriladi; ochiq PDF'i borlarining (`ANTIPLAG_FULLTEXT_MAX_DOCS`, standart 6) to'liq matni ham.
  Web qidiruv: har gapga bitta so'rov (modullar navbat bilan), eng mos `ANTIPLAG_WEB_FETCH_PAGES` sahifa to'liq o'qiladi.
- Mustaqil tekshiruv hujjatlarini (matnsiz, faqat barmoq izlari) indekslash: `ANTIPLAG_INDEX_PRIVATE_CHECKS=true`
  (standart o'chiq — foydalanuvchi shartlariga kiritilgach yoqing). Ular keyingi tekshiruvlarda
  «nashr etilmagan hujjat» sifatida, mazmuni ko'rsatilmasdan topiladi.
- Sezgirlikni tekshirish: `python manage.py antiplag_benchmark` (eski 4.0 va yangi 5.0 taqqoslanadi, bazaga yozmaydi).
- **O'zlashtirish** — begona manbalarda topilgan gaplar ulushi; har bir gap bir marta sanaladi.
  **Iqtibos** — iqtibos belgisi bor gaplar. **O'z-o'ziga iqtibos** — muallifning o'z ishlari.
- Korpusga mustaqil tekshiruvga yuklangan hujjatlar, taqriz matnlari va adabiyotlar ro'yxati kirmaydi.
  Nashr etilmagan manbalarning nomi va matni hisobotda yashiriladi.
- Foydalanuvchiga faqat joriy sozlamalarda haqiqatan ishlaydigan modullar ko'rsatiladi
  (`GET /api/v1/articles/antiplagiat-modules/`); sertifikatda faqat tekshirilgan bazalar yoziladi.
- Sertifikat QR kodi: `https://ilmiyfaoliyat.uz/#/verify/<kod>` → `GET /api/v1/articles/verify/<kod>/`.
  QR kodlar server va brauzerda lokal yaratiladi (tashqi QR xizmatiga hujjat raqami yuborilmaydi).
  Kodlar: `<raqam>` antiplagiat, `QBL-…` qabul, `UDK-…`, `HSB-…` nashrlar hisoboti, `CHK-…` to'lov cheki.
- Hisobotda `annotated_document[].segments` — gaplar va mos manba raqami (matnni manbalar rangida ko'rsatish uchun).

4.0 dan oldingi natijalar uydirma manbalar va hash asosidagi foizlarni o'z ichiga olgan —
ro'yxat: `list_legacy_antiplag_reports`.

## 7. Maqola holati tarixi, xabarnomalar, analitika

- **Holat tarixi** — `articles.ArticleStatusEvent`: maqola holati har o'zgarganda signal orqali yoziladi (kim, qachon,
  izoh). Maqola sahifasida vaqt chizig'i; muallifga xodim ismi emas, vazifasi ko'rsatiladi. Migratsiya `0015`
  eski `ActivityLog` yozuvlaridan tarixni tiklaydi.
- **Telegram** — har bir `Notification` botga ham yuboriladi (foydalanuvchi botga kirgan bo'lsa, profil
  sozlamasi `telegram_notifications` yoqiq bo'lsa). Yuborish fon oqimida, so'rovni sekinlashtirmaydi.
- **To'lov cheki** — `GET /api/v1/payments/transactions/<id>/receipt/` (PDF, faqat yakunlangan to'lov),
  jami: `GET /api/v1/payments/transactions/summary/`. Frontend: «To'lovlarim» (`/#/payments`).
- **Analitika** — `GET /api/v1/analytics/overview/?months=12` (bosh admin: hammasi; buxgalter: moliya;
  jurnal admini: o'z jurnallari). Taqrizchi navbati va muddatlar: `GET /api/v1/analytics/workload/`.
- **Qidiruv (Ctrl+K)** — `GET /api/v1/search/?q=` (maqolalar rolga mos, foydalanuvchilar faqat admin/operator).
- **Ochiq bosh sahifa** — `GET /api/v1/analytics/public/` (5 daqiqa keshlanadi).

## 8. Google Scholar va Crossref

- Nashr etilgan maqola uchun server tomonida tayyor sahifa: `/p/article/<uuid>/` (Highwire `citation_*`,
  Dublin Core, Open Graph, JSON-LD), PDF: `/p/article/<uuid>/pdf/`, sayt xaritasi `/sitemap.xml`, `/robots.txt`.
- API domenida (`api.ilmiyfaoliyat.uz`) darhol ishlaydi. Asosiy domenda ishlashi uchun
  `infrastructure/nginx/phoenix-ilmiyfaoliyat-frontend.conf` dagi `/p/`, `/sitemap.xml`, `/robots.txt`
  bloklarini server nginx'iga qo'shing va `sudo nginx -t && sudo systemctl reload nginx`.
  So'ng Google Search Console'da `https://ilmiyfaoliyat.uz/sitemap.xml` ni yuboring.
- Crossref: maqola sahifasi → «Indekslash va DOI» → «Depozit XML» (qo'lda yuklash uchun) yoki login sozlangan
  bo'lsa «Crossref'ga yuborish». API: `GET|POST /api/v1/articles/<id>/crossref/` (bosh admin / jurnal admini).
- ORCID iD profil va ro'yxatdan o'tishda nazorat raqami bilan tekshiriladi; Crossref XML'da muallif ORCID'i yoziladi.

## 9. Ishga tushirish (launch) tartibi

1. Kalitlarni almashtiring (5-bo'lim) va `python manage.py launch_check` — FAIL qolmasin.
2. **Zaxira**: `sudo systemctl start phoenix-backup.service`, keyin `ls /phonix/backups/db/daily/`.
   Tiklashni bir marta sinab ko'ring (sinov serverida): `sudo bash infrastructure/backup/phoenix-restore.sh <dump>`.
   Boshqa joyga nusxa: `rclone config` → `.env` ga `PHONIX_BACKUP_RCLONE_REMOTE=remote:phoenix-backups`.
3. **Monitoring**: botga admin chatdan yozing, chat ID ni `.env` ga `PHONIX_ALERT_CHAT_ID=...`.
   Sinash: `sudo systemctl start phoenix-uptime.service` (muammo bo'lmasa xabar kelmaydi).
4. **Media himoyasi**: API nginx konfigida eski `location /media/` o'rniga
   `include /etc/nginx/snippets/phoenix-media.conf;` (snippet deployda o'rnatiladi) → `sudo nginx -t && sudo systemctl reload nginx`.
   Keyingi deploy `.env` ga `MEDIA_ACCEL_REDIRECT=true` ni o'zi qo'shadi.
5. **Oferta**: `frontend/.env.production` ga `VITE_LEGAL_NAME`, `VITE_LEGAL_INN`, `VITE_LEGAL_ADDRESS`, `VITE_LEGAL_BANK`,
   `VITE_LEGAL_ACCOUNT`, `VITE_LEGAL_MFO`, `VITE_LEGAL_DIRECTOR`. Matnlar (`pages/Oferta.tsx`, `pages/Privacy.tsx`)
   qoralama — yuristga ko'rsating. Matn o'zgarsa `LEGAL_VERSION` (frontend) va `LEGAL_TERMS_VERSION` (backend) ni yangilang.
6. **Shaxsga doir ma'lumotlar**: server O'zbekistonda bo'lishi shart (O'RQ-547, 27¹-modda). Tekshirgach
   `.env` ga `PHONIX_DATA_LOCATION=UZ`. Ma'lumotlar bazasini davlat reyestrida ro'yxatdan o'tkazing.
7. **Demo**: `.env` ga `PHONIX_DEMO_ENABLED=false`, keyin `python manage.py seed_demo_data --purge --logins`.
8. Foydalanuvchilar odatlangach: `PHONE_VERIFICATION_REQUIRED=true`.

### 9.1 Kirish va sessiyalar
Refresh token faqat HttpOnly cookie'da, access token xotirada (localStorage'da token yo'q — XSS dan himoya).
Cookie bilan autentifikatsiya qilingan POST/PUT/DELETE so'rovlarida `X-Requested-With` sarlavhasi majburiy (CSRF himoyasi).

### 9.2 Telefonni tasdiqlash va parolni tiklash (bepul, SMS'siz)
Sayt `t.me/<bot>?start=v_<kod>` havolasini beradi; bot «📱 Raqamni ulashish» tugmasi bilan kontakt so'raydi va faqat
foydalanuvchining **o'z** kontaktini qabul qiladi (`contact.user_id == telegram_id`). Parolni tiklash: `/#/forgot-password`
yoki botda «🔑 Parolni tiklash» → bir martalik havola (30 daqiqa) → yangi parol, eski sessiyalar bekor qilinadi.
`TELEGRAM_BOT_USERNAME` bo'lmasa bu funksiyalar o'chiq.

### 9.3 Fayllar himoyasi
Avatar, jurnal muqovasi va nashr sertifikatlari ochiq. Qolgan fayllar (maqolalar, cheklar, tarjimalar, DOI so'rovlari)
faqat imzoli, muddatli havola orqali (`?e=&s=`, HMAC); nashr etilgan maqolaning yakuniy PDF i ochiq.

### 9.4 Monitoring
- Server 500 xatolari va brauzerdagi ushlanmagan JS xatolari (`/api/v1/client-errors/`) → Telegram (30 daqiqada bir xil xato bir marta).
- `phoenix-uptime.sh`: sayt/API, disk ≥90%, oxirgi zaxira >36 soat, `phoenix-backend`/`phoenix-celery`, SSL <14 kun.
  Holat o'zgarganda xabar, muammo davom etsa har 6 soatda eslatma.
- Ixtiyoriy: `SENTRY_DSN` (backend) va `VITE_SENTRY_DSN` (frontend).

### 9.5 Ma'lumotlar bo'yicha foydalanuvchi huquqlari
Profil → Sozlamalar → «Shaxsiy ma'lumotlar»: JSON eksport (`/api/v1/auth/my-data/`) va hisobni o'chirish so'rovi
(`/api/v1/auth/delete-request/` — super adminlarga bildirishnoma + Telegram). Hisob avtomatik o'chirilmaydi:
to'lov yozuvlari qonun bo'yicha saqlanadi, qolganini admin 10 ish kuni ichida hal qiladi.

### 9.6 Repozitoriy private bo'lsa
`deploy-server.yml` deploy skriptini avval serverdagi git'dan (`git show <commit>:deploy_phonix.sh`) oladi, bo'lmasa
ochiq raw URL dan. Private repoda serverga faqat o'qish huquqli **deploy key** qo'shing (GitHub → Settings → Deploy keys).

## 10. PWA va frontend yuklanishi
- Sahifalar alohida chunklarda (`React.lazy`) — birinchi yuklanish ~650 KB, gzip ~200 KB (avval ~2 MB). xlsx/docx/recharts faqat kerakli sahifada.
- Deploydan keyin eski chunk topilmasa sahifa bir marta avtomatik yangilanadi (`utils/lazyPage.ts`).
- PWA: `public/manifest.webmanifest`, `public/sw.js` (faqat production). API, `/media`, `/p/` keshlanmaydi.
  Frontend nginx konfigida `location = /sw.js` (no-cache) bo'lishi kerak — `infrastructure/nginx/phoenix-ilmiyfaoliyat-frontend.conf`.
  Favqulodda o'chirish: `VITE_DISABLE_SW=true` bilan build (mavjud SW o'zini o'chiradi).

## 11. Antiplagiat: parafraz va tarjima plagiati
OpenSearch bo'lmasa ham ishlaydi: `ANTIPLAG_LOCAL_VECTORS_ENABLED=true` → `python manage.py build_antiplag_vectors`.
Indeks matnlari ko'p tilli E5 modeli bilan vektorlanadi (`backend/antiplag_vectors/`, float16, memmap).
Bir xil tilda leksik o'xshashlik past + ma'no yaqin → «parafraz»; manba boshqa tilda (ru/en) + ma'no juda yaqin
(`ANTIPLAG_CROSSLINGUAL_THRESHOLD`, standart 0.84) → «tarjima». Modul nomi: «Parafraz va tarjima».
Kechki timer indeksni yangilaydi (o'zgarmagan hujjatlar qayta hisoblanmaydi).

## 12. Muallif AI yordamchisi (`/ai`)
Muallif kirgach AI ish maydoniga tushadi (`Klassik ko'rinish` tugmasi eski panelga qaytaradi, tanlov brauzerda eslab qolinadi).
- **Chap**: suhbatlar tarixi (`apps/assistant` — `AssistantConversation`, `AssistantMessage`). **O'rta**: chat. **O'ng**: haqiqiy xizmat
  sahifasi (UDK, DOI, antiplagiat, tarjima, kitob, maqola namunasi, maqola yuborish) AI to'ldirgan qiymatlar bilan.
- **Xavfsizlik**: yordamchi hech narsani o'zi to'lamaydi va yubormaydi. U faqat muallifning o'z ma'lumotlarini o'qiydi va formani
  to'ldiradi; narx, to'lov va tekshiruvlar odatdagi sahifa/API orqali, muallif tasdiqlaganda bajariladi.
- **Fayl**: chatga tashlangan fayl serverda saqlanmaydi — matni o'qiladi (sarlavha, annotatsiya, kalit so'zlar, so'zlar soni) va o'chiriladi;
  asl fayl brauzerdan formaga beriladi.
- **Tushunish**: bepul qoidalar (uz lotin/kirill, ru, en). Gemini (`GEMINI_API_KEY`) bo'lsa faqat qoidalar tushunmagan yoki erkin matndan
  maydon olish kerak bo'lganda chaqiriladi; `ASSISTANT_LLM_ENABLED=false` bilan o'chiriladi, `ASSISTANT_LLM_DAILY_LIMIT` (standart 60) —
  bitta muallif uchun kunlik chaqiruvlar.
- `SUPPORT_PHONE`, `SUPPORT_EMAIL` — yordamchi operator haqida so'ralganda ko'rsatadigan kontaktlar.
