import React from 'react';
import { Link } from 'react-router-dom';
import LegalDocument, { LegalSection } from '../components/LegalDocument';
import { LEGAL } from '../config/legal';

/**
 * Ommaviy oferta (O'zbekiston Respublikasi Fuqarolik kodeksining 367–370-moddalari asosida).
 * QORALAMA: e'lon qilishdan oldin yurist ko'rib chiqishi kerak.
 */
const sections: LegalSection[] = [
  {
    title: 'Umumiy qoidalar',
    body: (
      <>
        <p>
          Ushbu hujjat {LEGAL.name} (keyingi o'rinlarda — «Ijrochi») tomonidan {LEGAL.site} sayti va unga bog'liq
          Telegram bot (keyingi o'rinlarda — «Platforma») orqali xizmatlar ko'rsatish bo'yicha ommaviy oferta
          hisoblanadi.
        </p>
        <p>
          Platformada ro'yxatdan o'tish yoki biror xizmat uchun to'lov qilish ushbu oferta shartlarini to'liq va
          so'zsiz qabul qilish (aksept) hisoblanadi va Ijrochi bilan foydalanuvchi (keyingi o'rinlarda — «Buyurtmachi»)
          o'rtasida shartnoma tuzilganini bildiradi.
        </p>
      </>
    ),
  },
  {
    title: 'Shartnoma predmeti',
    body: (
      <>
        <p>Ijrochi Buyurtmachiga quyidagi pullik va bepul xizmatlarni ko'rsatadi:</p>
        <ul>
          <li>ilmiy maqolalarni jurnallarga qabul qilish, taqriz va nashr jarayonini tashkil etish;</li>
          <li>matnning originalligini tekshirish (antiplagiat) va hisobot/sertifikat berish;</li>
          <li>UDK raqamini aniqlash, DOI raqami olish, ilmiy matnlarni tarjima qilish;</li>
          <li>kitob va o'quv qo'llanmalarini nashrga tayyorlash va chop etish;</li>
          <li>Platformada ko'rsatilgan boshqa xizmatlar.</li>
        </ul>
        <p>Xizmatlarning tarkibi, muddati va narxi Platformaning tegishli sahifalarida ko'rsatiladi.</p>
      </>
    ),
  },
  {
    title: "Xizmat narxi va to'lov tartibi",
    body: (
      <>
        <p>
          Xizmat narxi buyurtma berilgan paytda Platformada ko'rsatilgan narx bo'yicha belgilanadi va so'mda
          to'lanadi. To'lov Click, Payme yoki Platformada ko'rsatilgan boshqa to'lov tizimlari orqali amalga oshiriladi.
        </p>
        <p>
          To'lov to'lov tizimi tomonidan tasdiqlangan paytdan boshlab amalga oshirilgan hisoblanadi. Har bir to'lov
          uchun Platformaning «To'lovlarim» bo'limida elektron chek (QR kod bilan) beriladi.
        </p>
        <p>Buyurtmachining bank kartasi ma'lumotlari Ijrochiga berilmaydi — ular faqat to'lov tizimida ishlanadi.</p>
      </>
    ),
  },
  {
    title: 'Tomonlarning huquq va majburiyatlari',
    body: (
      <>
        <p><b>Ijrochi:</b> xizmatni Platformada ko'rsatilgan muddat va sifatda ko'rsatadi; jarayon holati haqida
          Platforma va (ulangan bo'lsa) Telegram orqali xabar beradi; Buyurtmachi ma'lumotlarini Maxfiylik
          siyosatiga muvofiq himoya qiladi.</p>
        <p><b>Buyurtmachi:</b> o'zi haqida to'g'ri ma'lumot beradi; yuborilgan materiallar mualliflik va boshqa
          huquqlarni buzmasligini kafolatlaydi; hisobiga kirish ma'lumotlarini boshqalarga bermaydi; xizmat narxini
          o'z vaqtida to'laydi.</p>
        <p>Ijrochi jurnal talablariga, ilmiy etika qoidalariga yoki qonunchilikka zid materiallarni rad etish
          huquqiga ega. Taqriz natijasi va maqolani nashr etish to'g'risidagi qaror jurnal tahririyatiga tegishli.</p>
      </>
    ),
  },
  {
    title: "Pulni qaytarish",
    body: (
      <>
        <p>To'lov quyidagi hollarda qaytariladi:</p>
        <ul>
          <li>xizmat ko'rsatishga hali kirishilmagan bo'lsa — Buyurtmachining yozma (elektron) murojaatiga ko'ra to'liq;</li>
          <li>Ijrochi aybi bilan xizmat ko'rsatilmagan bo'lsa — to'liq;</li>
          <li>texnik nosozlik tufayli bir xizmat uchun bir necha marta to'lov yechilgan bo'lsa — ortiqcha qism.</li>
        </ul>
        <p>Taqriz yoki tekshiruv boshlangandan keyin, shuningdek maqola tahririyat qarori bilan rad etilganda
          (agar jurnal shartlarida boshqacha ko'rsatilmagan bo'lsa) to'lov qaytarilmaydi. Pul to'lov qilingan usul
          orqali 10 ish kuni ichida qaytariladi.</p>
      </>
    ),
  },
  {
    title: 'Mualliflik huquqi',
    body: (
      <p>
        Maqola va boshqa materiallarga mualliflik huquqi muallifda qoladi. Buyurtmachi maqolani nashr etish uchun
        jurnalga noeksklyuziv huquq beradi; nashr etilgan maqola jurnal sonida, Platformada va ilmiy bazalarda
        (Google Scholar va h.k.) ochiq ko'rsatilishi mumkin. Antiplagiat tekshiruviga yuklangan, nashr etilmagan
        hujjatlar boshqa foydalanuvchilarga ko'rsatilmaydi.
      </p>
    ),
  },
  {
    title: 'Javobgarlik',
    body: (
      <>
        <p>Tomonlar shartnoma bo'yicha majburiyatlarini bajarmagani uchun O'zbekiston Respublikasi qonunchiligiga
          muvofiq javob beradi. Ijrochining javobgarligi tegishli xizmat uchun to'langan summa bilan cheklanadi.</p>
        <p>Antiplagiat natijasi topilgan mosliklar asosida avtomatik hisoblanadi va ma'lumot uchun beriladi;
          yakuniy xulosani jurnal tahririyati yoki tegishli tashkilot chiqaradi.</p>
        <p>Fors-major holatlarida (tabiiy ofat, aloqa tarmoqlaridagi uzilish, davlat organlari qarorlari va h.k.)
          tomonlar javobgarlikdan ozod etiladi.</p>
      </>
    ),
  },
  {
    title: 'Nizolarni hal qilish',
    body: (
      <p>
        Nizolar avvalo muzokara yo'li bilan hal qilinadi: Buyurtmachi murojaatini {LEGAL.email} manziliga yoki
        Platformadagi operator chati orqali yuboradi, Ijrochi 10 ish kuni ichida javob beradi. Kelishuvga
        erishilmasa, nizo O'zbekiston Respublikasi qonunchiligiga muvofiq Ijrochi joylashgan joydagi sudda ko'riladi.
      </p>
    ),
  },
  {
    title: "Ofertaning amal qilishi va o'zgartirilishi",
    body: (
      <p>
        Oferta Platformada e'lon qilingan paytdan boshlab amal qiladi. Ijrochi oferta matnini o'zgartirishi mumkin;
        yangi tahrir e'lon qilingan kundan kuchga kiradi va undan keyin berilgan buyurtmalarga tatbiq etiladi.
        Shaxsga doir ma'lumotlar <Link className="editorial-link" to="/maxfiylik">Maxfiylik siyosati</Link>ga
        muvofiq qayta ishlanadi.
      </p>
    ),
  },
];

const Oferta: React.FC = () => (
  <LegalDocument title="Ommaviy oferta" subtitle="Xizmatlar ko'rsatish shartnomasi" sections={sections} />
);

export default Oferta;
