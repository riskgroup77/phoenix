# Server'da Deployment Buyruqlari

## 🚀 Yangi Deployment Workflow (Tavsiya etiladi)

### Local'da (Development mashinada):

```bash
# 1. Local deployment script ishga tushirish
chmod +x deploy-local.sh
./deploy-local.sh

# Bu script:
# - Backend o'zgarishlarini Git'ga push qiladi
# - Frontend o'zgarishlarini Git'ga push qiladi
```

### Server'da:

```bash
# 1. Server'ga ulanish
ssh root@YOUR_SERVER_IP

# 2. Deployment script ishga tushirish
cd / && wget -O deploy_phonix.sh https://raw.githubusercontent.com/aiziyrak-coder/phonixB/master/deploy_phonix.sh
chmod +x deploy_phonix.sh
./deploy_phonix.sh

# Bu script:
# - Git'dan yangi kodlarni oladi
# - Backend va Frontend'ni build qiladi
# - Service'ni restart qiladi
# - Boshqa dasturlarga tasir qilmaydi
```

**📚 Batafsil ma'lumot:** `DEPLOYMENT-WORKFLOW.md` faylini ko'ring

---

## 1. Server'ga ulanish (Eski usul):
```bash
ssh root@YOUR_SERVER_IP
```

## 2. Root papkasiga o'tish va scriptni yuklab olish:

**Master branch uchun:**
```bash
cd / && wget -O update_phonix.sh https://raw.githubusercontent.com/aiziyrak-coder/phonixB/master/update_phonix.sh && chmod +x update_phonix.sh && ls -la update_phonix.sh
```

**Yoki main branch uchun:**
```bash
cd / && wget -O update_phonix.sh https://raw.githubusercontent.com/aiziyrak-coder/phonixB/main/update_phonix.sh && chmod +x update_phonix.sh && ls -la update_phonix.sh
```

**Keyin scriptni ishga tushirish:**
```bash
./update_phonix.sh
```

## 3. Yoki to'g'ridan-to'g'ri scriptni yozish:

Agar wget ishlamasa, scriptni to'g'ridan-to'g'ri yaratish:

```bash
cd /
cat > update_phonix.sh << 'SCRIPT_END'
#!/bin/bash

# Phoenix Scientific Platform - Automated Update Script
set -e

DEPLOY_DIR="/phonix"
BACKEND_REPO="https://github.com/aiziyrak-coder/phonixB.git"
FRONTEND_REPO="https://github.com/aiziyrak-coder/phonixF.git"

echo "🚀 Starting Phoenix deployment update..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt-get update -qq

# Install dependencies
echo "📦 Installing dependencies..."
sudo apt-get install -y python3 python3-pip python3-venv nginx postgresql postgresql-contrib git curl certbot python3-certbot-nginx nodejs npm build-essential 2>/dev/null || true

# Create deployment directory
echo "📁 Creating directories..."
if [ ! -d "${DEPLOY_DIR}" ]; then
    echo "Creating main deployment directory: ${DEPLOY_DIR}"
    sudo mkdir -p ${DEPLOY_DIR}
    sudo chown -R $(whoami):$(whoami) ${DEPLOY_DIR}
fi

sudo mkdir -p ${DEPLOY_DIR}/backend ${DEPLOY_DIR}/frontend ${DEPLOY_DIR}/backend/logs ${DEPLOY_DIR}/backend/media ${DEPLOY_DIR}/backend/staticfiles
sudo chown -R $(whoami):$(whoami) ${DEPLOY_DIR}

# Backend setup
echo "🔽 Cloning backend..."
cd ${DEPLOY_DIR}
rm -rf backend
git clone ${BACKEND_REPO} backend
cd backend

# Setup virtual environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt gunicorn -q

# Setup environment file
if [ ! -f .env ]; then
    cp env.production.example .env
    echo "⚠️  Please configure .env file: nano ${DEPLOY_DIR}/backend/.env"
fi

# Create necessary directories
mkdir -p logs media staticfiles
chmod 755 logs media staticfiles

# Run migrations
echo "🔄 Running migrations..."
python manage.py migrate --noinput

# Collect static files
echo "📦 Collecting static files..."
python manage.py collectstatic --noinput

deactivate

# Frontend setup
echo "🔽 Cloning frontend..."
cd ${DEPLOY_DIR}
rm -rf frontend
git clone ${FRONTEND_REPO} frontend
cd frontend

# Install dependencies and build
echo "📦 Building frontend..."
npm install -q

export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1'
export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/'

npm run build

# Setup PostgreSQL database
echo "🗄️  Setting up database..."
sudo -u postgres psql -c "CREATE DATABASE phoenix_scientific;" 2>/dev/null || echo "Database exists"
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';" 2>/dev/null || echo "User exists"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE phoenix_scientific TO postgres;" 2>/dev/null || true

# Systemd service setup
echo "🔄 Setting up systemd service..."
cd ${DEPLOY_DIR}/backend

sudo tee /etc/systemd/system/phoenix-backend.service > /dev/null <<EOF
[Unit]
Description=Phoenix Scientific Platform Backend
After=network.target postgresql.service

[Service]
User=$(whoami)
Group=$(whoami)
WorkingDirectory=${DEPLOY_DIR}/backend
Environment="PATH=${DEPLOY_DIR}/backend/venv/bin"
Environment="DJANGO_SETTINGS_MODULE=config.settings"
Environment="PYTHONUNBUFFERED=1"
ExecStart=${DEPLOY_DIR}/backend/venv/bin/gunicorn --workers 4 --bind 127.0.0.1:8000 --timeout 300 --access-logfile ${DEPLOY_DIR}/backend/logs/gunicorn-access.log --error-logfile ${DEPLOY_DIR}/backend/logs/gunicorn-error.log config.wsgi:application
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Setup logs directory
sudo mkdir -p ${DEPLOY_DIR}/backend/logs
sudo chown -R $(whoami):$(whoami) ${DEPLOY_DIR}/backend/logs

# Reload systemd and enable/restart service
sudo systemctl daemon-reload
sudo systemctl enable phoenix-backend
sudo systemctl restart phoenix-backend

# Show service status
echo ""
echo "📊 Service status:"
sudo systemctl status phoenix-backend --no-pager | head -15

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Configure backend .env file: nano ${DEPLOY_DIR}/backend/.env"
echo "2. Restart service: sudo systemctl restart phoenix-backend"
echo "3. Check logs: sudo journalctl -u phoenix-backend -f"
SCRIPT_END

chmod +x update_phonix.sh
./update_phonix.sh
```
