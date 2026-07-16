#!/bin/bash

# Phoenix Local Deployment Script
# Bu script local'da o'zgarishlarni Git'ga push qiladi
# Keyin server'da deploy_phonix.sh ishga tushiriladi

set -e

# Ranglar
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Phoenix Local Deployment${NC}"
echo ""

# ============================================
# BACKEND
# ============================================

echo -e "${YELLOW}📦 Backend yangilanmoqda...${NC}"

if [ ! -d "backend" ]; then
    echo -e "${RED}❌ Backend papkasi topilmadi!${NC}"
    exit 1
fi

cd backend

# Git status
echo "   Git status tekshirilmoqda..."
git status

# O'zgarishlar bor-yo'qligini tekshirish
if [ -z "$(git status --porcelain)" ]; then
    echo "   O'zgarishlar yo'q, skip qilinmoqda..."
else
    # Commit message so'rash
    echo ""
    read -p "   Backend commit message: " backend_msg
    
    if [ -z "$backend_msg" ]; then
        backend_msg="Update backend"
    fi
    
    # Add va commit
    echo "   O'zgarishlar qo'shilmoqda..."
    git add .
    
    echo "   Commit qilinmoqda..."
    git commit -m "$backend_msg"
    
    # Push
    echo "   Git'ga push qilinmoqda..."
    git push origin master || git push origin main
    
    echo -e "${GREEN}✅ Backend push qilindi${NC}"
fi

cd ..

echo ""

# ============================================
# FRONTEND
# ============================================

echo -e "${YELLOW}📦 Frontend yangilanmoqda...${NC}"

if [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Frontend papkasi topilmadi!${NC}"
    exit 1
fi

cd frontend

# Git status
echo "   Git status tekshirilmoqda..."
git status

# O'zgarishlar bor-yo'qligini tekshirish
if [ -z "$(git status --porcelain)" ]; then
    echo "   O'zgarishlar yo'q, skip qilinmoqda..."
else
    # Commit message so'rash
    echo ""
    read -p "   Frontend commit message: " frontend_msg
    
    if [ -z "$frontend_msg" ]; then
        frontend_msg="Update frontend"
    fi
    
    # Add va commit
    echo "   O'zgarishlar qo'shilmoqda..."
    git add .
    
    echo "   Commit qilinmoqda..."
    git commit -m "$frontend_msg"
    
    # Push
    echo "   Git'ga push qilinmoqda..."
    git push origin master || git push origin main
    
    echo -e "${GREEN}✅ Frontend push qilindi${NC}"
fi

cd ..

# ============================================
# YAKUNIY XABAR
# ============================================

echo ""
echo -e "${GREEN}✅ Barcha o'zgarishlar Git'ga push qilindi!${NC}"
echo ""
echo -e "${YELLOW}📝 Keyingi qadamlar:${NC}"
echo "   1. Server'ga ulaning:"
echo "      ssh root@YOUR_SERVER_IP"
echo ""
echo "   2. Deployment script ishga tushiring:"
echo "      cd / && ./deploy_phonix.sh"
echo ""
echo "   Yoki:"
echo "      cd / && wget -O deploy_phonix.sh https://raw.githubusercontent.com/aiziyrak-coder/phonixB/master/deploy_phonix.sh"
echo "      chmod +x deploy_phonix.sh && ./deploy_phonix.sh"
echo ""
