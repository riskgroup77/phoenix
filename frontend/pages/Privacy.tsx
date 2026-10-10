import React from 'react';
import { Link } from 'react-router-dom';
import LegalDocument, { LegalSection } from '../components/LegalDocument';
import { LEGAL } from '../config/legal';

/**
 * Maxfiylik siyosati — O'zbekiston Respublikasining «Shaxsga doir ma'lumotlar to'g'risida»gi Qonuni
 * (2019-yil 2-iyul, O'RQ-547) talablariga mos QORALAMA. E'lon qilishdan oldin yurist ko'rib chiqishi kerak.
 */
const sections: LegalSection[] = [
  {
    title: 'Umumiy qoidalar',
    body: (
      <p>
        Ushbu siyosat {LEGAL.name} (keyingi o'rinlarda — «Operator») {LEGAL.site} sayti va Telegram boti orqali
        foydalanuvchilarning shaxsga doir ma'lumotlarini qanday to'plashi, qayta ishlashi, saqlashi va himoya
        qilishini belgilaydi. Platformada ro'yxatdan o'tib, foydalanuvchi ushbu siyosatga muvofiq ma'lumotlarini
        qayta ishlashga rozilik beradi.
      </p>
    ),
  },
  {
    title: "Qanday ma'lumotlar to'planadi",
    body: (
      <ul>
        <li>familiya, ism, otasining ismi; telefon raqami; elektron pochta; ish joyi va lavozimi; ORCID iD;</li>
        <li>yuborilgan maqolalar, hujjatlar va ularning metama'lumotlari;</li>
        <li>to'lovlar tarixi (summa, xizmat, sana) — bank kartasi ma'lumotlari Operatorga berilmaydi;</li>
        <li>Telegram bot ulangan bo'lsa — Telegram ID va foydalanuvchi nomi;</li>
        <li>texnik ma'lumotlar: IP manzil, brauzer turi, kirish vaqti (xavfsizlik va xatolarni tuzatish uchun).</li>
      </ul>
    ),
  },
  {
    title: 'Qayta ishlash maqsadlari',
    body: (
      <ul>
        <li>hisob yaratish va kirishni ta'minlash, telefon raqamini tasdiqlash;</li>
        <li>xizmatlarni ko'rsatish: maqolani jurnalga yuborish, taqriz, antiplagiat, UDK, DOI, tarjima, nashr;</li>
        <li>to'lovlarni qabul qilish va chek berish;</li>
        <li>jarayon holati haqida xabar berish (sayt, Telegram);</li>
        <li>qonunchilikda belgilangan majburiyatlarni bajarish, firibgarlikning oldini olish.</li>
      </ul>
    ),
  },
  {
    title: "Ma'lumotlarni saqlash",
    body: (
      <>
        <p>
          Ma'lumotlar O'zbekiston Respublikasi hududida joylashgan serverlarda, qonunchilik talablariga muvofiq
          saqlanadi. Ma'lumotlar hisob faol bo'lgan davrda va hisob o'chirilgandan keyin qonunchilikda belgilangan
          muddat (moliyaviy hujjatlar uchun — buxgalteriya hisobi to'g'risidagi talablar) davomida saqlanadi.
        </p>
        <p>Ma'lumotlar bazasi muntazam zaxiralanadi; zaxira nusxalari ham shu talablar asosida himoya qilinadi.</p>
      </>
    ),
  },
  {
    title: 'Uchinchi shaxslarga berish',
    body: (
      <>
        <p>Ma'lumotlar faqat xizmat ko'rsatish uchun zarur hajmda quyidagilarga beriladi:</p>
        <ul>
          <li>jurnal tahririyati va taqrizchilar (ikki tomonlama yopiq taqrizda muallif ismi taqrizchiga ko'rsatilmaydi);</li>
          <li>to'lov tizimlari (Click, Payme) — to'lovni amalga oshirish uchun;</li>
          <li>DOI agentligi (Crossref) — maqolaga DOI berilganda nashr metama'lumotlari;</li>
          <li>qonunchilikda nazarda tutilgan hollarda — vakolatli davlat organlariga.</li>
        </ul>
        <p>Nashr etilmagan qo'lyozmalar va antiplagiat tekshiruviga yuklangan hujjatlar boshqa foydalanuvchilarga
          ko'rsatilmaydi.</p>
      </>
    ),
  },
  {
    title: 'Foydalanuvchi huquqlari',
    body: (
      <>
        <p>Foydalanuvchi quyidagi huquqlarga ega:</p>
        <ul>
          <li>o'z ma'lumotlari bilan tanishish va ularning nusxasini olish (Profil → «Ma'lumotlarimni yuklab olish»);</li>
          <li>noto'g'ri ma'lumotlarni tuzatish (Profil sahifasida);</li>
          <li>rozilikni qaytarib olish va hisobni o'chirishni so'rash (Profil → «Hisobni o'chirish so'rovi»);</li>
          <li>ma'lumotlar qonunga zid qayta ishlanganda vakolatli organga shikoyat qilish.</li>
        </ul>
        <p>So'rovlar {LEGAL.email} manziliga yoki Platforma orqali yuboriladi va 10 ish kuni ichida ko'rib chiqiladi.</p>
      </>
    ),
  },
  {
    title: 'Xavfsizlik choralari',
    body: (
      <ul>
        <li>ulanishlar HTTPS orqali shifrlangan; parollar qaytarib bo'lmaydigan ko'rinishda (hash) saqlanadi;</li>
        <li>kirish tokenlari HttpOnly cookie'da saqlanadi; maxfiy fayllar faqat muddatli imzoli havola orqali ochiladi;</li>
        <li>xodimlarning ma'lumotlarga kirishi vazifasiga qarab cheklangan; ma'lumotlar bazasi muntazam zaxiralanadi.</li>
      </ul>
    ),
  },
  {
    title: 'Cookie fayllar',
    body: (
      <p>
        Platforma faqat ishlashi uchun zarur cookie fayllardan foydalanadi: kirish sessiyasi (HttpOnly) va
        interfeys sozlamalari (til, mavzu). Reklama yoki kuzatuv cookie'lari ishlatilmaydi.
      </p>
    ),
  },
  {
    title: "Siyosatning o'zgartirilishi",
    body: (
      <p>
        Operator ushbu siyosatni o'zgartirishi mumkin; yangi tahrir Platformada e'lon qilingan kundan kuchga kiradi.
        Xizmatlar ko'rsatish shartlari <Link className="editorial-link" to="/oferta">Ommaviy oferta</Link>da
        belgilangan.
      </p>
    ),
  },
];

const Privacy: React.FC = () => (
  <LegalDocument title="Maxfiylik siyosati" subtitle="Shaxsga doir ma'lumotlarni qayta ishlash" sections={sections} />
);

export default Privacy;
