# Server'da Service Muammosini Hal Qilish

## ⚠️ Muammo
Service `activating (auto-restart)` holatida va `exit-code` bilan to'xtayapti.

## 🔍 Tekshirish Qadamlar

### 1. Logs'ni Ko'rish:

```bash
sudo journalctl -u phoenix-backend -n 50 --no-pager
```

### 2. Service'ni To'xtatish va Qo'lda Test Qilish:

```bash
# Service'ni to'xtatish
sudo systemctl stop phoenix-backend

# Backend papkasiga o'tish
cd /phonix/backend

# Virtual environment aktivlashtirish
source venv/bin/activate

# Gunicorn'ni qo'lda ishga tushirish (xatolarni ko'rish uchun)
gunicorn --workers 4 --bind 127.0.0.1:8000 --timeout 300 config.wsgi:application
```

### 3. Eng Keng Tarqalgan Muammolar:

#### A. .env fayli yo'q yoki noto'g'ri:
```bash
cd /phonix/backend
ls -la .env
# Agar yo'q bo'lsa:
nano .env
# Quyidagilarni to'ldiring:
```

#### B. Database muammosi:
```bash
# Database'ga ulanishni tekshirish
cd /phonix/backend
source venv/bin/activate
python manage.py check --database default
```

#### C. Dependencies muammosi:
```bash
cd /phonix/backend
source venv/bin/activate
pip install -r requirements.txt
```

#### D. Port allaqachon ishlatilmoqda:
```bash
sudo netstat -tlnp | grep 8000
# Agar port ishlatilmoqda bo'lsa, boshqa port ishlating yoki process'ni to'xtating
```

### 4. Service Config'ni Tekshirish:

```bash
sudo cat /etc/systemd/system/phoenix-backend.service
```

### 5. Working Directory va Permissions:

```bash
# Working directory mavjudligini tekshirish
ls -la /phonix/backend

# Permissions tekshirish
sudo chown -R $(whoami):$(whoami) /phonix/backend
```

---

## ✅ To'liq Yechim Script

```bash
#!/bin/bash
# Service muammosini hal qilish

cd /phonix/backend

# 1. Service'ni to'xtatish
sudo systemctl stop phoenix-backend

# 2. Virtual environment tekshirish
if [ ! -d "venv" ]; then
    echo "Virtual environment yaratilmoqda..."
    python3 -m venv venv
fi

# 3. Dependencies o'rnatish
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt gunicorn

# 4. .env faylini tekshirish
if [ ! -f .env ]; then
    echo "⚠️  .env fayli topilmadi! Yaratish kerak."
    echo "nano /phonix/backend/.env"
    exit 1
fi

# 5. Database tekshirish
python manage.py check --database default

# 6. Migrations
python manage.py migrate --noinput

# 7. Static files
python manage.py collectstatic --noinput

# 8. Gunicorn'ni test qilish
echo "Gunicorn test qilinmoqda..."
timeout 5 gunicorn --workers 1 --bind 127.0.0.1:8000 config.wsgi:application || echo "Gunicorn xatolik!"

deactivate

# 9. Service'ni qayta ishga tushirish
sudo systemctl daemon-reload
sudo systemctl restart phoenix-backend
sudo systemctl status phoenix-backend
```

---

## 🔧 Qo'lda Test

Service'ni qo'lda ishga tushirib, xatolarni ko'rish:

```bash
cd /phonix/backend
source venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

Agar bu ishlasa, muammo Gunicorn yoki service config'da.
