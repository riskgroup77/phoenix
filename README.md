# Phoenix Ilmiy Nashrlar Markazi — ilmiyfaoliyat.uz

Ilmiy faoliyat platformasi: maqola va kitob topshirish, jurnallar, taqriz, antiplagiat tekshiruvi,
UDK / DOI xizmatlari, tarjima, Click / Payme to'lovlari va muallif Telegram boti.

| Qism | Texnologiya | Papka |
|---|---|---|
| Backend API | Django 5 + DRF, JWT, PostgreSQL, Redis, Celery | `backend/` |
| Frontend | React 19 + Vite + Tailwind (HashRouter) | `frontend/` |
| Telegram bot | python-telegram-bot (backend API orqali) | `backend/bot/` |
| Infratuzilma | nginx, systemd, Docker Compose, GitHub Actions | `infrastructure/`, `deploy/`, `.github/` |

Rollar: muallif, taqrizchi, jurnal admini, bosh admin, buxgalter, operator.

---

## Lokal ishga tushirish

### Backend

```bash
cd backend
python -m venv venv
venv/Scripts/activate          # Linux/macOS: source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env           # USE_SQLITE=True, DEBUG=True
python manage.py migrate
python manage.py setup_demo_and_admin   # demo hisoblar: 911111111 / muallif va h.k.
python manage.py runserver
```

Demo hisoblar ro'yxati: [DEMO_LOGIN.md](DEMO_LOGIN.md). Serverda faqat muallif, taqrizchi, jurnal admini va operator demo hisoblari yaratiladi (bosh admin va buxgalter — faqat lokal).

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

### Docker (ixtiyoriy)

`docker-compose.yml` — PostgreSQL, Redis, OpenSearch, Django (gunicorn) va Celery worker.

---

## Testlar

```bash
cd backend && pytest          # config/settings_test.py: Redis/Celery/OpenSearch/to'lov kalitlarisiz
cd frontend && npx tsc --noEmit && npx vitest run
```

CI (`.github/workflows/ci.yml`) har push'da shularni ishga tushiradi.

---

## Muhim tamoyillar

- **To'lov summasi har doim serverda hisoblanadi** (`backend/apps/payments/pricing.py`); Click / Payme
  callback'lari imzo va summa tekshiruvisiz qabul qilinmaydi.
- **Antiplagiat natijasi faqat haqiqatan topilgan mosliklarga asoslanadi** — qarang
  [docs/OPERATIONS.md](docs/OPERATIONS.md#antiplagiat).
- Maxfiy kalitlar faqat serverdagi `backend/.env` da; repoga yozilmaydi.

Server, deploy va ekspluatatsiya: **[docs/OPERATIONS.md](docs/OPERATIONS.md)**.
Eski hujjatlar va bir martalik skriptlar: `archive/` (ishga tushirmang).
