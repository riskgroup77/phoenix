# Phoenix Ilmiy Nashrlar Markazi — Ilmiy faoliyat platformasi

Platforma: maqolalar, jurnallar, UDK ma'lumotnomalar, antiplagiat, nashr hisobotlari, to'lovlar.

---

## Tez ishga tushirish

### 1. Backend

```bash
cd backend
cp .env.example .env   # Sozlash kerak bo'lsa
pip install -r requirements.txt
python manage.py migrate
python manage.py setup_demo_and_admin   # Demo va Django admin hisoblar
python manage.py runserver
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env   # Sozlash kerak bo'lsa
npm install
npm run dev
```

### 3. Kirish ma'lumotlari

- **Demo (tizim):** [DEMO_LOGIN.md](DEMO_LOGIN.md) — 5 ta rol, telefon va parol.
- **Django admin:** telefon `998907863888`, parol `Admin123` — `/admin/`

---

## Loyiha tuzilishi

- `backend/` — Django (REST API, auth, maqolalar, jurnallar, UDK, to'lovlar)
- `frontend/` — React + Vite (login, dashboard, maqolalar, sertifikatlar, narxlar)
- `DEMO_LOGIN.md` — demo foydalanuvchilar va Django admin
- `backend/.env.example`, `frontend/.env.example` — muhit o'zgaruvchilari namuna

---

## Mijozga topshirish

1. Demo kirish va Django admin: **DEMO_LOGIN.md**
2. Parollarni qayta o'rnatish: `python manage.py setup_demo_and_admin`
3. Production: `DEBUG=False`, `SECRET_KEY` almashtirish, PostgreSQL (ixtiyoriy)
