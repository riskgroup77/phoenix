# Demo kirish va Django admin

## Tizimga kirish (brauzer)

Quyidagi telefon va parol bilan kirishingiz mumkin:

| Rol | Telefon | Parol | Email |
|-----|---------|-------|--------|
| Super Admin | 998901001001 | Demo@admin1 | admin@phoenix.uz |
| Journal Admin (Tahrirchi) | 998901001002 | Demo@editor1 | editor@phoenix.uz |
| Reviewer (Taqrizchi) | 998901001003 | Demo@review1 | reviewer@phoenix.uz |
| Author (Muallif) | 998901001004 | Demo@author1 | author@phoenix.uz |
| Accountant (Buxgalter) | 998901001005 | Demo@account1 | accountant@phoenix.uz |

**Kirish:** Login sahifada telefon raqamni 9 ta raqam sifatida kiriting (masalan: `901001001`), parol: `Demo@admin1`.

---

## Django admin panel (/admin/)

Alohida hisob — boshqaruv va ma’lumotlar bazasini boshqarish uchun:

- **Telefon:** 998907863888  
- **Parol:** Admin123  

URL: `https://your-domain.com/admin/` (yoki `http://localhost:8000/admin/`)

---

## Parollarni yangilash / demo hisoblarni qayta o‘rnatish

Agar demo parollar ishlamasa yoki yangi serverda sozlash kerak bo‘lsa:

```bash
cd backend
python manage.py setup_demo_and_admin
```

Bu buyruq:
- 5 ta demo userni yaratadi yoki ularning parollarini yuqoridagi jadvalga mos yangilaydi;
- Django admin (998907863888 / Admin123) ni yaratadi yoki yangilaydi;
- **Hech qanday boshqa foydalanuvchini o‘chirmaydi.**

Alternativa (backend papkada):

```bash
python create_admin_editor_users.py
```
