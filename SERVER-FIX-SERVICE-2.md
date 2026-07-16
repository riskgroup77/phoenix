# Service Muammosini Hal Qilish - Qadam 2

## ⚠️ Muammo
Service yana `activating (auto-restart)` holatida. Frontend build qilindi, lekin backend service ishlamayapti.

## 🔍 Tekshirish

### 1. Eng So'nggi Logs'ni Ko'rish:

```bash
sudo journalctl -u phoenix-backend -n 50 --no-pager | tail -30
```

### 2. Gunicorn'ni Qo'lda Test Qilish:

```bash
# Service'ni to'xtatish
sudo systemctl stop phoenix-backend

# Port tekshirish
sudo netstat -tlnp | grep 8000
# Agar port ishlatilmoqda bo'lsa, process'ni to'xtating:
sudo kill -9 $(sudo lsof -t -i:8000)

# Backend papkasiga o'tish
cd /phonix/backend
source venv/bin/activate

# Gunicorn'ni qo'lda ishga tushirish
gunicorn --workers 1 --bind 127.0.0.1:8000 --timeout 300 config.wsgi:application
```

### 3. Service Config'ni Tekshirish:

```bash
sudo cat /etc/systemd/system/phoenix-backend.service
```

### 4. Working Directory va Permissions:

```bash
# Working directory tekshirish
ls -la /phonix/backend

# Permissions to'g'rilash
sudo chown -R root:root /phonix/backend
sudo chmod -R 755 /phonix/backend
```

---

## ✅ To'liq Yechim Script

```bash
#!/bin/bash
# Service muammosini hal qilish

# 1. Service'ni to'xtatish
sudo systemctl stop phoenix-backend

# 2. Port'ni tozalash
sudo lsof -ti:8000 | xargs sudo kill -9 2>/dev/null || true

# 3. Backend papkasiga o'tish
cd /phonix/backend

# 4. Virtual environment tekshirish
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# 5. Dependencies
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt gunicorn -q

# 6. .env tekshirish
if [ ! -f .env ]; then
    echo "⚠️  .env fayli topilmadi!"
    exit 1
fi

# 7. Django check
python manage.py check

# 8. Migrations
python manage.py migrate --noinput

# 9. Static files
python manage.py collectstatic --noinput

deactivate

# 10. Permissions
sudo chown -R root:root /phonix/backend
sudo chmod -R 755 /phonix/backend

# 11. Service config'ni tekshirish
echo "Service config:"
sudo cat /etc/systemd/system/phoenix-backend.service | grep -E "(User|WorkingDirectory|ExecStart)"

# 12. Service'ni qayta ishga tushirish
sudo systemctl daemon-reload
sudo systemctl restart phoenix-backend
sleep 3
sudo systemctl status phoenix-backend --no-pager | head -20
```

---

## 🔧 Eng Muhim: Service Config

Service config'da User va WorkingDirectory to'g'ri bo'lishi kerak:

```bash
sudo nano /etc/systemd/system/phoenix-backend.service
```

Quyidagilar to'g'ri bo'lishi kerak:
- `User=root` (yoki sizning user'ingiz)
- `WorkingDirectory=/phonix/backend`
- `ExecStart=/phonix/backend/venv/bin/gunicorn ...`
