#!/bin/bash
# Fix git pull divergent branches issue

cd /phonix/frontend

# Git pull strategy'ni o'rnatish (merge)
git config pull.rebase false

# Local o'zgarishlarni stash qilish
git stash

# Remote'dan yangilanishlarni olish
git pull origin master

# Stash'dan o'zgarishlarni qaytarish (agar kerak bo'lsa)
git stash pop 2>/dev/null || true

# Frontend'ni qayta build qilish
npm run build

echo "✅ Git pull va build muvaffaqiyatli yakunlandi!"
