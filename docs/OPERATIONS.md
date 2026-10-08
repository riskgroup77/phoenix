# Ekspluatatsiya qo'llanmasi (server)

## 1. Deploy

- `main` branch'ga push → GitHub Actions (`.github/workflows/deploy-server.yml`) serverga SSH orqali kirib,
  repo ildizidagi **`deploy_phonix.sh`** ni ishga tushiradi (git yangilash, `migrate`, `collectstatic`,
  frontend build, `phoenix-backend` va `phoenix-celery` ni qayta ishga tushirish).
- Serverda qo'lda: `bash /phonix/deploy_server_now.sh`.
- GitHub secrets: `PHONIX_SSH_HOST`, `PHONIX_SSH_USER`, `PHONIX_SSH_PRIVATE_KEY` (yoki `PHONIX_SSH_PASSWORD`),
  ixtiyoriy `PHONIX_SSH_PORT` (standart 22).

Deploy demo foydalanuvchilarni **yaratmaydi** (`setup_demo_and_admin` productionda bloklangan).

## 2. Xizmatlar (systemd)

| Xizmat | Namuna | Vazifa |
|---|---|---|
| `phoenix-backend` | `infrastructure/systemd/phoenix-backend.service.example` | gunicorn, `127.0.0.1:8050` |
| `phoenix-celery` | `infrastructure/systemd/phoenix-celery.service.example` | antiplagiat fon vazifalari |
| Telegram bot | `python bot/bot.py` (`backend/` dan) | muallif boti |
| `phoenix-reminders.timer` | `infrastructure/systemd/phoenix-reminders.{service,timer}.example` | har kuni 09:00 — taqrizchilarga muddat eslatmalari |

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

## 5. Xavfsizlik tekshiruv ro'yxati

Quyidagi qiymatlar ilgari repoda ochiq bo'lgan — **almashtirilgan bo'lishi shart** (git tarixida qoladi):

- [ ] Click secret key (Click merchant kabineti → server `.env`)
- [ ] Gemini API kalitlari (Google Cloud Console)
- [ ] PostgreSQL paroli (`ALTER USER phoenix WITH PASSWORD '...'` + `.env` dagi `DB_PASSWORD`)
- [ ] Demo / Django admin parollari: `python manage.py rotate_demo_passwords --apply`
- [ ] Shubha bo'lsa `SECRET_KEY` ni almashtirish (barcha sessiyalar bekor bo'ladi)

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
