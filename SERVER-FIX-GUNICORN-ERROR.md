# Gunicorn Error Log Tekshirish

## ⚠️ Muammo
Service `status=1/FAILURE` bilan to'xtayapti. Gunicorn error log'ni tekshirish kerak.

## 🔍 Tekshirish

### 1. Gunicorn Error Log'ni Ko'rish:

```bash
# Error log'ni ko'rish
sudo cat /phonix/backend/logs/gunicorn-error.log

# Yoki eng so'nggi qatorlarni
sudo tail -50 /phonix/backend/logs/gunicorn-error.log
```

### 2. Access Log'ni Ko'rish:

```bash
sudo tail -20 /phonix/backend/logs/gunicorn-access.log
```

### 3. Logs Papkasini Tekshirish:

```bash
# Logs papkasi mavjudligini tekshirish
ls -la /phonix/backend/logs/

# Agar papka yo'q bo'lsa, yarating:
sudo mkdir -p /phonix/backend/logs
sudo chown -R root:root /phonix/backend/logs
sudo chmod -R 755 /phonix/backend/logs
```

### 4. Gunicorn'ni Qo'lda Test Qilish:

```bash
# Service'ni to'xtatish
sudo systemctl stop phoenix-backend

# Port'ni tozalash
sudo lsof -ti:8000 | xargs sudo kill -9 2>/dev/null || true

# Backend papkasiga o'tish
cd /phonix/backend
source venv/bin/activate

# Gunicorn'ni qo'lda ishga tushirish (xatolarni ko'rish uchun)
gunicorn --workers 1 --bind 127.0.0.1:8000 --timeout 300 --log-level debug config.wsgi:application
```

Bu xatolarni to'g'ridan-to'g'ri ko'rsatadi.

---

## ✅ To'liq Yechim

```bash
# 1. Service'ni to'xtatish
sudo systemctl stop phoenix-backend

# 2. Port'ni tozalash
sudo lsof -ti:8000 | xargs sudo kill -9 2>/dev/null || true

# 3. Logs papkasini yaratish
sudo mkdir -p /phonix/backend/logs
sudo chown -R root:root /phonix/backend/logs
sudo chmod -R 755 /phonix/backend/logs

# 4. Backend papkasiga o'tish
cd /phonix/backend

# 5. Virtual environment
source venv/bin/activate

# 6. Django check
python manage.py check

# 7. Gunicorn'ni test qilish (qo'lda)
echo "Gunicorn test qilinmoqda..."
timeout 10 gunicorn --workers 1 --bind 127.0.0.1:8000 --timeout 300 --log-level debug config.wsgi:application 2>&1 | head -50

deactivate

# 8. Service'ni qayta ishga tushirish
sudo systemctl daemon-reload
sudo systemctl restart phoenix-backend
sleep 5
sudo systemctl status phoenix-backend --no-pager | head -20

# 9. Error log'ni ko'rish
echo ""
echo "=== Gunicorn Error Log ==="
sudo tail -30 /phonix/backend/logs/gunicorn-error.log
```
