#!/bin/bash
# Quick Restart Script for Phoenix Backend and Frontend
# Server'da ishlatish uchun

set -e  # Xatolik bo'lsa to'xtatish

echo "🚀 Starting Phoenix Backend and Frontend Restart..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Backend Restart
echo -e "${YELLOW}📦 Restarting Backend...${NC}"
cd /phonix/backend

echo "  → Pulling latest changes..."
git pull origin master || git pull origin main

echo "  → Activating virtual environment..."
source venv/bin/activate

echo "  → Installing dependencies..."
pip install -r requirements.txt -q

echo "  → Running migrations..."
python manage.py migrate --noinput

echo "  → Collecting static files..."
python manage.py collectstatic --noinput

deactivate

echo "  → Restarting service..."
sudo systemctl restart phoenix-backend

echo -e "${GREEN}✅ Backend restarted successfully!${NC}"

# Frontend Restart
echo -e "${YELLOW}🎨 Restarting Frontend...${NC}"
cd /phonix/frontend

echo "  → Pulling latest changes..."
git pull origin master || git pull origin main

echo "  → Installing dependencies..."
npm install --silent

echo "  → Setting environment variables..."
export VITE_API_BASE_URL='https://api.ilmiyfaoliyat.uz/api/v1'
export VITE_MEDIA_URL='https://api.ilmiyfaoliyat.uz/media/'

echo "  → Building frontend..."
npm run build

echo -e "${GREEN}✅ Frontend built successfully!${NC}"

# Nginx Reload
echo -e "${YELLOW}🔄 Reloading Nginx...${NC}"
sudo nginx -t && sudo systemctl reload nginx

echo -e "${GREEN}✅ Nginx reloaded successfully!${NC}"

# Status Check
echo -e "${YELLOW}📊 Checking services status...${NC}"
echo ""
echo "Backend Status:"
sudo systemctl status phoenix-backend --no-pager | head -5

echo ""
echo "Nginx Status:"
sudo systemctl status nginx --no-pager | head -5

echo ""
echo -e "${GREEN}✅ All services restarted successfully!${NC}"
echo ""
echo "📝 Check logs:"
echo "  Backend: sudo journalctl -u phoenix-backend -f"
echo "  Nginx: sudo tail -f /var/log/nginx/error.log"
