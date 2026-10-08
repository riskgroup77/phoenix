#!/bin/bash
# Click To'lov Diagnostika Skripti
# Bu script Click to'lov tizimidagi muammolarni aniqlashga yordam beradi

echo "=========================================="
echo "   CLICK TO'LOV DIAGNOSTIKA SKRIPTI"
echo "=========================================="
echo ""

# 1. Backend Service Status
echo "📌 1. BACKEND SERVICE STATUS:"
echo "----------------------------------------"
if command -v systemctl &> /dev/null; then
    sudo systemctl status phoenix-backend --no-pager | head -15
else
    echo "systemctl topilmadi. Service status tekshirib bo'lmadi."
fi
echo ""

# 2. Recent Click Prepare Callbacks
echo "📌 2. RECENT CLICK PREPARE CALLBACKS (Access Log):"
echo "----------------------------------------"
if [ -f "/phonix/backend/logs/gunicorn-access.log" ]; then
    echo "So'nggi 5 ta prepare callback:"
    sudo tail -100 /phonix/backend/logs/gunicorn-access.log | grep -i "click/prepare" | tail -5
    if [ $? -ne 0 ]; then
        echo "⚠️  Hech qanday prepare callback topilmadi"
    fi
else
    echo "⚠️  gunicorn-access.log topilmadi"
fi
echo ""

# 3. Recent Click Complete Callbacks
echo "📌 3. RECENT CLICK COMPLETE CALLBACKS (Access Log):"
echo "----------------------------------------"
if [ -f "/phonix/backend/logs/gunicorn-access.log" ]; then
    echo "So'nggi 5 ta complete callback:"
    sudo tail -100 /phonix/backend/logs/gunicorn-access.log | grep -i "click/complete" | tail -5
    if [ $? -ne 0 ]; then
        echo "⚠️  Hech qanday complete callback topilmadi"
    fi
else
    echo "⚠️  gunicorn-access.log topilmadi"
fi
echo ""

# 4. Recent Click Errors
echo "📌 4. RECENT CLICK ERRORS (Error Log):"
echo "----------------------------------------"
if [ -f "/phonix/backend/logs/gunicorn-error.log" ]; then
    echo "So'nggi 10 ta Click xatosi:"
    sudo tail -200 /phonix/backend/logs/gunicorn-error.log | grep -i "click" | tail -10
    if [ $? -ne 0 ]; then
        echo "✅ Hech qanday Click xatosi topilmadi (bu yaxshi)"
    fi
else
    echo "⚠️  gunicorn-error.log topilmadi"
fi
echo ""

# 5. Last 5 Transactions
echo "📌 5. SO'NGGI 5 TA TRANSACTION:"
echo "----------------------------------------"
if [ -d "/phonix/backend" ]; then
    cd /phonix/backend
    if [ -d "venv" ]; then
        source venv/bin/activate
        python manage.py shell << 'EOF'
from apps.payments.models import Transaction
from apps.users.models import User

transactions = Transaction.objects.select_related('user').order_by('-created_at')[:5]
print("=" * 100)
for t in transactions:
    print(f"Transaction ID: {str(t.id)[:8]}...")
    print(f"  Status: {t.status}")
    print(f"  Amount: {t.amount} {t.currency}")
    print(f"  Service: {t.service_type}")
    if t.user:
        print(f"  User Phone: {t.user.phone}")
    else:
        print(f"  User: N/A")
    print(f"  Click Trans ID: {t.click_trans_id or 'N/A'}")
    print(f"  Click Paydoc ID: {t.click_paydoc_id or 'N/A'}")
    print(f"  Merchant Trans ID: {t.merchant_trans_id or 'N/A'}")
    print(f"  Created: {t.created_at}")
    print("-" * 100)
EOF
        deactivate
    else
        echo "⚠️  venv topilmadi"
    fi
else
    echo "⚠️  /phonix/backend papkasi topilmadi"
fi
echo ""

# 6. Test Click Callback URLs
echo "📌 6. CLICK CALLBACK URL'LARNI TEST QILISH:"
echo "----------------------------------------"
echo "Prepare URL'ni test qilish..."
PREPARE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/)
echo "  Prepare URL status: $PREPARE_STATUS"
if [ "$PREPARE_STATUS" == "200" ]; then
    echo "  ✅ Prepare URL ishlayapti"
elif [ "$PREPARE_STATUS" == "405" ]; then
    echo "  ⚠️  405 Method Not Allowed (normal, chunki GET so'rov)"
else
    echo "  ❌ Prepare URL ishlamayapti (Status: $PREPARE_STATUS)"
fi

echo ""
echo "Complete URL'ni test qilish..."
COMPLETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/)
echo "  Complete URL status: $COMPLETE_STATUS"
if [ "$COMPLETE_STATUS" == "200" ]; then
    echo "  ✅ Complete URL ishlayapti"
elif [ "$COMPLETE_STATUS" == "405" ]; then
    echo "  ⚠️  405 Method Not Allowed (normal, chunki GET so'rov)"
else
    echo "  ❌ Complete URL ishlamayapti (Status: $COMPLETE_STATUS)"
fi
echo ""

# 7. Check Click Service Configuration
echo "📌 7. CLICK SERVICE KONFIGURATSIYASI:"
echo "----------------------------------------"
if [ -d "/phonix/backend" ]; then
    cd /phonix/backend
    if [ -d "venv" ]; then
        source venv/bin/activate
        python << 'EOF'
import os
import sys
import django

# Setup Django
sys.path.append('/phonix/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings

print("Backend Click konfiguratsiyasi:")
print(f"  CLICK_MERCHANT_ID: {getattr(settings, 'CLICK_MERCHANT_ID', 'NOT SET')}")
print(f"  CLICK_SERVICE_ID: {getattr(settings, 'CLICK_SERVICE_ID', 'NOT SET')}")
print(f"  CLICK_SECRET_KEY: {getattr(settings, 'CLICK_SECRET_KEY', 'NOT SET')[:5]}... (yashirilgan)")
print(f"  CLICK_MERCHANT_USER_ID: {getattr(settings, 'CLICK_MERCHANT_USER_ID', 'NOT SET')}")
EOF
        deactivate
    else
        echo "⚠️  venv topilmadi"
    fi
else
    echo "⚠️  /phonix/backend papkasi topilmadi"
fi
echo ""

# 8. Check for duplicate ClickPaymentService files
echo "📌 8. DUBLIKAT FAYLLARNI TEKSHIRISH:"
echo "----------------------------------------"
if [ -d "/phonix/backend/apps/payments" ]; then
    echo "ClickPaymentService fayllari:"
    if [ -f "/phonix/backend/apps/payments/services.py" ]; then
        echo "  ✅ services.py topildi (ISHLATILADI)"
    else
        echo "  ❌ services.py topilmadi"
    fi
    
    if [ -f "/phonix/backend/apps/payments/click_service.py" ]; then
        echo "  ⚠️  click_service.py topildi (ESKI, O'CHIRILISHI KERAK)"
    else
        echo "  ✅ click_service.py yo'q (yaxshi)"
    fi
else
    echo "⚠️  /phonix/backend/apps/payments papkasi topilmadi"
fi
echo ""

# 9. Summary
echo "=========================================="
echo "   XULOSA VA TAVSIYALAR"
echo "=========================================="
echo ""
echo "Agar muammolar mavjud bo'lsa:"
echo ""
echo "1. ⚠️  Callback'lar kelmayapti:"
echo "   → Click merchant panel'da URL'larni tekshiring"
echo "   → Prepare: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/prepare/"
echo "   → Complete: https://api.ilmiyfaoliyat.uz/api/v1/payments/click/complete/"
echo ""
echo "2. ⚠️  Invoice yaratilmayapti:"
echo "   → User telefon raqamini tekshiring (998XXXXXXXXX formatida)"
echo "   → Backend log'larni ko'ring: sudo tail -f /phonix/backend/logs/gunicorn-error.log"
echo ""
echo "3. ⚠️  click_service.py topildi:"
echo "   → Bu eski fayl, o'chirish kerak: rm /phonix/backend/apps/payments/click_service.py"
echo ""
echo "4. ⚠️  Signature mismatch:"
echo "   → Secret key va Service ID to'g'riligini tekshiring"
echo ""
echo "Batafsil ma'lumot uchun qarang:"
echo "  → CLICK-PAYMENT-COMPLETE-FIX.md"
echo ""
echo "=========================================="
echo "   DIAGNOSTIKA TUGADI"
echo "=========================================="
