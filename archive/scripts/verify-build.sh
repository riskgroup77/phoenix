#!/bin/bash
# Verify that new code is built correctly

cd /phonix/frontend

echo "=== Tekshirish: Yangi kod build qilinganmi? ==="
echo ""

# Yangi kodni tekshirish (flex items-center gap-2)
echo "1. Flex layout kodini tekshirish..."
if grep -r "flex items-center gap-2" dist/ 2>/dev/null | head -1; then
    echo "✅ Yangi kod topildi!"
else
    echo "❌ Yangi kod topilmadi"
fi

echo ""
echo "2. +998 span kodini tekshirish..."
if grep -r "bg-gray-700 border border-gray-600" dist/ 2>/dev/null | head -1; then
    echo "✅ +998 alohida element sifatida topildi!"
else
    echo "❌ +998 alohida element topilmadi"
fi

echo ""
echo "3. Oxirgi build vaqti:"
ls -lh dist/assets/index-*.js 2>/dev/null | tail -1

echo ""
echo "=== Tekshirish yakunlandi ==="
echo ""
echo "Agar yangi kod topilsa, browser'da hard refresh qiling:"
echo "  - Windows/Linux: Ctrl + Shift + R"
echo "  - Mac: Cmd + Shift + R"
echo "  - Yoki browser DevTools → Network → Disable cache"
