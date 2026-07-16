#!/bin/bash

# 🚀 PHONIX COMPLETE SERVER DEPLOYMENT SCRIPT
# Barcha steps otomatik yuboriladi

set -e  # Exit on any error

echo "================================"
echo "🚀 PHONIX SERVER DEPLOYMENT"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="${PROJECT_ROOT:-.}"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"
VENV_DIR="$BACKEND_DIR/venv"

echo -e "${YELLOW}[1/8]${NC} Checking directories..."
if [ ! -d "$FRONTEND_DIR" ] || [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}Error: Frontend or Backend directory not found!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Directories OK${NC}\n"

# ===== FRONTEND DEPLOYMENT =====
echo -e "${YELLOW}[2/8]${NC} Deploying Frontend..."
cd "$FRONTEND_DIR"

echo "  - Pulling latest code..."
git pull origin master

echo "  - Installing dependencies..."
npm install --legacy-peer-deps

echo "  - Building application..."
npm run build

echo -e "${GREEN}✓ Frontend deployment completed${NC}\n"

# ===== BACKEND DEPLOYMENT =====
echo -e "${YELLOW}[3/8]${NC} Deploying Backend..."
cd "$BACKEND_DIR"

echo "  - Pulling latest code..."
git pull origin master

echo -e "${YELLOW}[4/8]${NC} Setting up Python environment..."
if [ ! -d "$VENV_DIR" ]; then
    echo "  - Creating virtual environment..."
    python3 -m venv venv
fi

echo "  - Activating virtual environment..."
source venv/bin/activate

echo "  - Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo -e "${GREEN}✓ Backend setup completed${NC}\n"

# ===== MIGRATIONS =====
echo -e "${YELLOW}[5/8]${NC} Running migrations..."
python manage.py migrate --noinput
echo -e "${GREEN}✓ Migrations completed${NC}\n"

# ===== STATIC FILES =====
echo -e "${YELLOW}[6/8]${NC} Collecting static files..."
python manage.py collectstatic --noinput
echo -e "${GREEN}✓ Static files collected${NC}\n"

# ===== CREATE TEST USERS =====
echo -e "${YELLOW}[7/8]${NC} Creating test users..."
if [ -f "create_admin_editor_users.py" ]; then
    python create_admin_editor_users.py
    echo -e "${GREEN}✓ Test users created${NC}\n"
else
    echo -e "${YELLOW}⚠ User creation script not found, skipping...${NC}\n"
fi

# ===== RESTART SERVICES =====
echo -e "${YELLOW}[8/8]${NC} Restarting services..."

# Check if running with sudo
if [ "$EUID" -eq 0 ]; then
    # Nginx restart
    if systemctl is-active --quiet nginx; then
        systemctl restart nginx
        echo "  - Nginx restarted"
    fi
    
    # Gunicorn restart (multiple options)
    if systemctl is-active --quiet gunicorn; then
        systemctl restart gunicorn
        echo "  - Gunicorn restarted"
    elif systemctl is-active --quiet phonix-gunicorn; then
        systemctl restart phonix-gunicorn
        echo "  - Phonix Gunicorn restarted"
    elif systemctl is-active --quiet phonix; then
        systemctl restart phonix
        echo "  - Phonix service restarted"
    else
        echo "  - ⚠ Gunicorn service not found (manual restart needed)"
    fi
else
    echo "  - ⚠ Not running as root, services NOT restarted"
    echo "    Run with sudo: sudo bash $0"
fi

echo -e "${GREEN}✓ Service restart completed${NC}\n"

# ===== HEALTH CHECK =====
echo -e "${YELLOW}Health Check:${NC}"
echo ""

# Check if API is running
if [ -f "/tmp/phonix_api_check.done" ]; then
    rm /tmp/phonix_api_check.done
fi

echo "Testing API endpoints..."
sleep 2

if curl -s http://localhost:8000/api/health/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API is running${NC}"
else
    echo -e "${RED}✗ Backend API is NOT responding${NC}"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETED${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "📌 Test users created:"
echo "   Admin: admin@ilmiyfaoliyat.uz / Admin@123456"
echo "   Editor: editor@ilmiyfaoliyat.uz / Editor@123456"
echo ""
echo "🔍 Check logs:"
echo "   - Nginx:   sudo tail -f /var/log/nginx/error.log"
echo "   - Gunicorn: sudo journalctl -u gunicorn -f"
echo ""
echo "🌐 Access:"
echo "   - Frontend: https://ilmiyfaoliyat.uz"
echo "   - API: http://api.ilmiyfaoliyat.uz"
echo ""
