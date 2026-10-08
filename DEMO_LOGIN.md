# Demo kirish (sinov hisoblari)

Telefon raqamni 998 siz kiritish mumkin. Parol — rol nomi.

| Rol | Telefon | Parol | Serverda |
|---|---|---|---|
| Muallif | 911111111 | muallif | ha |
| Taqrizchi | 922222222 | taqrizchi | ha |
| Jurnal admini | 933333333 | muharrir | ha |
| Operator | 955555555 | operator | ha |
| Buxgalter | 944444444 | buxgalter | yo'q, faqat lokal |
| Bosh admin | 966666666 | admin | yo'q, faqat lokal |

Yaratish yoki parollarni tiklash (hech kim o'chirilmaydi):

```bash
cd backend
python manage.py setup_demo_and_admin
```

Deploy skripti (`deploy_phonix.sh`) bu buyruqni har deployda o'zi ishga tushiradi.

## Xavfsizlik

- Serverda (`DEBUG=False`) bosh admin, buxgalter va Django admin demo hisoblari **yaratilmaydi**.
  Oddiy parolli admin hisobi platformadagi to'lovlar va foydalanuvchilarni ochib qo'yadi.
  Serverda o'zingizning haqiqiy admin hisobingiz bilan kiring.
- Demo hisoblar `@demo.ilmiyfaoliyat.uz` emaili bilan belgilanadi. Shu telefon raqami bilan haqiqiy
  foydalanuvchi ro'yxatdan o'tgan bo'lsa, uning hisobiga tegilmaydi.
- Demo hisoblar kerak bo'lmay qolganda ularni va eski demo hisoblarni (998901001001… parollari avval
  repoda ochiq bo'lgan) yopish:

```bash
python manage.py rotate_demo_passwords          # ro'yxatni ko'rish
python manage.py rotate_demo_passwords --apply  # tasodifiy parollarga almashtirish
```

Eslatma: deploy skripti har safar demo parollarni yana oddiy holatga qaytaradi. Demo hisoblarni butunlay
o'chirish uchun deploy skriptidagi `setup_demo_and_admin` qatorini olib tashlang.

## Saytni namuna ma'lumotlar bilan to'ldirish

Barcha rollar uchun "jonli" ko'rinish: 5 jurnal (har birida 3 son), 70 maqola (barcha holatlarda, nashr
etilganlari PDF bilan), haqiqiy antiplagiat hisobotlari, taqrizlar, to'lovlar, UDK / DOI / tarjima / namuna
so'rovlari, operator chatlari, bildirishnomalar — sanalar oxirgi 12 oyga taqsimlangan.

```bash
cd backend
python manage.py seed_demo_data            # to'ldirish (qayta ishga tushirsa — eskisini o'chirib, yangidan)
python manage.py seed_demo_data --purge    # hammasini o'chirish (demo login hisoblari qoladi)
```

Namuna ma'lumotlar haqiqiy ma'lumotlardan ajratilgan:

- Google Scholar sahifalari va `sitemap.xml` ga chiqmaydi;
- haqiqiy foydalanuvchilarning antiplagiat tekshiruvida manba bo'lmaydi;
- demo to'lovlar tushum (daromad) summalariga qo'shilmaydi (ro'yxatlarda ko'rinadi);
- haqiqiy mualliflar demo jurnallarni ko'rmaydi va ularga maqola yubora olmaydi;
- to'ldirish paytida xodimlarga Telegram / bildirishnoma yuborilmaydi.
