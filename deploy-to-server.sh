#!/bin/bash
# Phonix Platform - Server Deploy Script
# Bu script serverda git pull, migrations va restart qiladi

set -e  # Xatolik bo'lsa to'xtash

echo "=========================================="
echo "🚀 PHONIX PLATFORM DEPLOY"
echo "=========================================="
echo ""

# Ranglar
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Backend Deploy
echo "📦 BACKEND DEPLOY"
echo "----------------------------------------"
cd /var/www/phonix/backend

echo -e "${YELLOW}Git pull...${NC}"
git pull origin master || echo "⚠️  Git pull failed, continuing..."

echo -e "${YELLOW}Virtualenv aktivlashtirish...${NC}"
source venv/bin/activate

echo -e "${YELLOW}Dependencies...${NC}"
pip install -r requirements.txt --quiet

echo -e "${YELLOW}Migrations...${NC}"
python manage.py migrate --noinput

echo -e "${YELLOW}Static files...${NC}"
python manage.py collectstatic --noinput

echo -e "${YELLOW}Test users yaratish...${NC}"
python recreate_all_users.py || echo "⚠️  Users already exist"

echo -e "${GREEN}✅ Backend tayyor!${NC}"
echo ""

# 2. Frontend Deploy
echo "📦 FRONTEND DEPLOY"
echo "----------------------------------------"
cd /var/www/phonix/frontend

echo -e "${YELLOW}Git pull...${NC}"
git pull origin master || echo "⚠️  Git pull failed, continuing..."

echo -e "${YELLOW}NPM dependencies...${NC}"
npm install --silent

echo -e "${YELLOW}Build...${NC}"
npm run build

echo -e "${YELLOW}Nginx ga copy...${NC}"
cp -r dist/* /var/www/html/phonix/ || echo "⚠️  Copy failed"

echo -e "${GREEN}✅ Frontend tayyor!${NC}"
echo ""

# 3. Services Restart
echo "🔄 SERVICES RESTART"
echo "----------------------------------------"

echo -e "${YELLOW}Gunicorn restart...${NC}"
sudo systemctl restart gunicorn
sleep 2

echo -e "${YELLOW}Nginx restart...${NC}"
sudo systemctl restart nginx
sleep 2

echo -e "${GREEN}✅ Services restarted!${NC}"
echo ""

# 4. Health Check
echo "🏥 HEALTH CHECK"
echo "----------------------------------------"

echo -e "${YELLOW}Backend API test...${NC}"
curl -s http://localhost:8000/api/health/ > /dev/null && echo -e "${GREEN}✅ Backend API: OK${NC}" || echo -e "${RED}❌ Backend API: FAILED${NC}"

echo -e "${YELLOW}Frontend test...${NC}"
curl -s http://localhost/phonix/ > /dev/null && echo -e "${GREEN}✅ Frontend: OK${NC}" || echo -e "${RED}❌ Frontend: FAILED${NC}"

echo ""
echo "=========================================="
echo "✨ DEPLOY COMPLETE!"
echo "=========================================="
echo ""
echo "📋 Test users:"
echo "  👑 Admin: 998901001001 / Admin@1234567890"
echo "  📋 Operator: 998901001007 / Operator@1234567890"
echo ""
echo "🌐 URL: https://ilmiyfaoliyat.uz"
echo ""
