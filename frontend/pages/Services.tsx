import React from 'react';
import { Link } from 'react-router-dom';
import EditorialPageHeader from '../components/EditorialPageHeader';
import {
  ShieldCheck,
  Library,
  Languages,
  SpellCheck,
  BarChart3,
  Microscope,
  FileText,
  Compass,
  Bot,
  Presentation,
  Lock,
  ArrowRight,
  ClipboardEdit,
  Users2,
  BookUp,
  FilePlus,
} from 'lucide-react';

const services = [
  {
    title: 'Maqola Namuna Olish',
    description: 'Turli jurnallar uchun standart maqola namunalarini oling va ular asosida maqola yozing.',
    icon: FilePlus,
    link: '/maqola-namuna-olish',
    isAvailable: true,
  },
  {
    title: 'Kitob Nashr Etish',
    description: "Tayyor qo'lyozmangizni professional kitob shaklida nashr eting va ISBN oling.",
    icon: BookUp,
    link: '/submit-book',
    isAvailable: true,
  },
  {
    title: 'Antiplagiat Tekshiruvi',
    description: "Maqolangizning o'ziga xosligini tekshiring va muvofiqlik sertifikatiga ega bo'ling.",
    icon: ShieldCheck,
    link: '/plagiarism-check',
    isAvailable: true,
  },
  {
    title: 'Ilmiy Tarjima',
    description: "Maqolalaringizni professional tarjimonlar yordamida ingliz va boshqa tillarga o'giring.",
    icon: Languages,
    link: '/translation-service',
    isAvailable: true,
  },
  {
    title: 'UDK Olish',
    description:
      "Ilmiy ishingiz uchun Universal O'nli Klassifikatsiya (teacode.com) va O'zbekiston UDK kodini tanlang va maqolaga biriktiring.",
    icon: Library,
    link: '/udk-olish',
    isAvailable: true,
  },
  {
    title: 'DOI Raqami Olish',
    description: "Maqolangiz uchun unikal raqamli obyekt identifikatorini (DOI) ro'yxatdan o'tkazish.",
    icon: Bot,
    link: '/doi-olish',
    isAvailable: true,
  },
  {
    title: 'Tahrirlash va Musahhihlik',
    description: 'Matnning grammatik, uslubiy va imlo xatolarini mutaxassislar tomonidan tekshirtiring.',
    icon: SpellCheck,
    isAvailable: false,
  },
  {
    title: 'Adabiyotlarni Formatlash',
    description: "Manbalar ro'yxatini APA, MLA, Chicago kabi xalqaro standartlarga moslashtirish.",
    icon: FileText,
    isAvailable: false,
  },
  {
    title: 'Ilmiy Illustratsiya',
    description: 'Tadqiqotingiz uchun yuqori sifatli grafik, diagramma va jadvallar yaratish.',
    icon: BarChart3,
    isAvailable: false,
  },
  {
    title: 'Dissertatsiyaga Yordam',
    description: 'Dissertatsiya va ilmiy ishlarni yozishda professional maslahat va yo\'l-yo\'riqlar.',
    icon: Microscope,
    isAvailable: false,
  },
  {
    title: 'Jurnal Tanlash Xizmati',
    description: "Sizning maqolangiz uchun eng mos bo'lgan jurnallarni topishga yordam beramiz.",
    icon: Compass,
    isAvailable: false,
  },
  {
    title: 'Taqdimot Tayyorlash',
    description: 'Konferensiyalar uchun professional slaydlar va poster taqdimotlarini yaratish.',
    icon: Presentation,
    isAvailable: false,
  },
  {
    title: 'Grant Arizasini Yozish',
    description: "Ilmiy faoliyatingizni moliyalashtirish uchun grant arizalarini yozishda ko'mak.",
    icon: ClipboardEdit,
    isAvailable: false,
  },
  {
    title: 'Taqrizchi Topish Xizmati',
    description: 'Jurnal administratorlari uchun maqolalarga mos taqrizchilarni topish tizimi.',
    icon: Users2,
    isAvailable: false,
  },
];

const ServiceCard: React.FC<{ service: (typeof services)[number] }> = ({ service }) => {
  const badge = service.isAvailable ? (
    <span className="pinm-badge pinm-badge--success absolute top-3 right-3">Mavjud</span>
  ) : (
    <span className="pinm-badge pinm-badge--warning absolute top-3 right-3 inline-flex items-center gap-1">
      <Lock size={12} aria-hidden />
      Tez Kunda
    </span>
  );

  const inner = (
    <>
      {badge}
      <div
        className={`editorial-service-icon ${service.isAvailable ? '' : 'editorial-service-icon--muted'}`}
      >
        <service.icon size={28} strokeWidth={1.75} aria-hidden />
      </div>
      <h3 className="font-serif text-base font-bold text-[var(--editorial-text)] mb-2">{service.title}</h3>
      <p className="text-sm text-[var(--editorial-muted)] leading-relaxed flex-1">{service.description}</p>
      {service.isAvailable && service.link && (
        <p className="mt-5 text-sm font-semibold text-[var(--editorial-primary)] inline-flex items-center justify-center gap-1 group-hover:gap-2 transition-all">
          Boshlash <ArrowRight className="w-4 h-4" aria-hidden />
        </p>
      )}
    </>
  );

  if (service.isAvailable && service.link) {
    return (
      <Link to={service.link} className="block group h-full">
        <div className="editorial-service-card h-full">{inner}</div>
      </Link>
    );
  }

  return (
    <div className="editorial-service-card h-full opacity-60 cursor-not-allowed" aria-disabled>
      {inner}
    </div>
  );
};

const Services = () => (
  <div className="max-w-7xl mx-auto">
    <EditorialPageHeader
      title="Xizmatlar Markazi"
      subtitle="Tadqiqot va nashr jarayonlaringizni osonlashtirish uchun mo'ljallangan keng qamrovli xizmatlarimizdan foydalaning."
    />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
      {services.map((service) => (
        <ServiceCard key={service.title} service={service} />
      ))}
    </div>
  </div>
);

export default Services;
