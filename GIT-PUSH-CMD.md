# Git Push - CMD (Command Prompt) orqali

## ⚠️ Muammo
PowerShell'da Git ishlamayapti. Bu odatda platform muammosi (32-bit vs 64-bit) yoki PowerShell execution policy bilan bog'liq.

## ✅ Yechim: CMD (Command Prompt) ishlatish

### 1. CMD'ni oching:
- **Win + R** bosing
- `cmd` yozing va Enter bosing
- Yoki Start menudan "Command Prompt" qidiring

### 2. Quyidagi buyruqlarni bajaring:

```cmd
cd E:\Phonix\frontend
git add .
git commit -m "Fix: CSP xatolik va to'lov redirect muammosini hal qilish"
git push origin master
```

### 3. Agar branch nomi `main` bo'lsa:

```cmd
git push origin main
```

---

## 🔄 Alternativ: Git Bash

Agar CMD ham ishlamasa, Git Bash ishlatish:

1. **Git Bash'ni oching** (Start menudan "Git Bash" qidiring)
2. Quyidagilarni bajaring:

```bash
cd /e/Phonix/frontend
git add .
git commit -m "Fix: CSP xatolik va to'lov redirect muammosini hal qilish"
git push origin master
```

---

## 💻 VS Code Git Panel (Eng Oson)

Agar VS Code ishlatayotgan bo'lsangiz:

1. VS Code'da `E:\Phonix\frontend` papkasini oching
2. **Source Control** panelini oching (Ctrl+Shift+G yoki chap tomondagi Git ikonkasi)
3. O'zgarishlarni ko'rasiz:
   - ✅ `services/paymentService.ts`
   - ✅ `pages/SubmitBook.tsx`
   - ✅ `pages/SubmitArticle.tsx`
4. **Message** yozing: `Fix: CSP xatolik va to'lov redirect muammosini hal qilish`
5. **✓ Commit** tugmasini bosing
6. **Sync Changes** yoki **Push** tugmasini bosing

---

## 🐛 PowerShell Muammosini Hal Qilish

Agar PowerShell'da Git ishlatishni xohlasangiz:

### Variant 1: Git'ni qayta o'rnatish
1. Git'ni o'chirib tashlang
2. Eng so'nggi 64-bit versiyasini yuklab oling: https://git-scm.com/download/win
3. O'rnatishda "Add Git to PATH" ni tanlang

### Variant 2: PATH'ni yangilash
```powershell
$env:PATH = "C:\Program Files\Git\bin;$env:PATH"
```

### Variant 3: PowerShell'ni qayta ishga tushirish
PowerShell'ni yopib, yangisini oching.

---

## 📝 Eslatma

- **CMD** eng ishonchli usul
- **VS Code Git Panel** eng oson usul
- **Git Bash** ham ishlaydi

Qaysi usulni tanlaymiz?
