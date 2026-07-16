import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import { ShieldCheck, Library, Languages, SpellCheck, BarChart3, Microscope, FileText, Compass, Bot, Presentation, Lock, ArrowRight, ClipboardEdit, Users2, BookUp, FilePlus } from 'lucide-react';

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
        description: 'Tayyor qo\'lyozmangizni professional kitob shaklida nashr eting va ISBN oling.',
        icon: BookUp,
        link: '/submit-book',
        isAvailable: true,
    },
    {
        title: 'Antiplagiat Tekshiruvi',
        description: 'Maqolangizning o\'ziga xosligini tekshiring va muvofiqlik sertifikatiga ega bo\'ling.',
        icon: ShieldCheck,
        link: '/plagiarism-check',
        isAvailable: true,
    },
    {
        title: 'Ilmiy Tarjima',
        description: 'Maqolalaringizni professional tarjimonlar yordamida ingliz va boshqa tillarga o\'giring.',
        icon: Languages,
        link: '/translation-service',
        isAvailable: true,
    },
    {
        title: 'UDK Olish',
        description: 'Ilmiy ishingiz uchun Universal O\'nli Klassifikatsiya (teacode.com) va O\'zbekiston UDK kodini tanlang va maqolaga biriktiring.',
        icon: Library,
        link: '/udk-olish',
        isAvailable: true,
    },
    {
        title: 'DOI Raqami Olish',
        description: 'Maqolangiz uchun unikal raqamli obyekt identifikatorini (DOI) ro\'yxatdan o\'tkazish.',
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
        description: 'Manbalar ro\'yxatini APA, MLA, Chicago kabi xalqaro standartlarga moslashtirish.',
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
        description: 'Sizning maqolangiz uchun eng mos bo\'lgan jurnallarni topishga yordam beramiz.',
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
        description: 'Ilmiy faoliyatingizni moliyalashtirish uchun grant arizalarini yozishda ko\'mak.',
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

// FIX: Use `(typeof services)[number]` to correctly type the service prop as a union of all possible service object shapes.
// Also, define the component as a React.FC for better type safety with props like `key`.
const ServiceCard: React.FC<{ service: (typeof services)[number] }> = ({ service }) => {
    const cardContent = (
        <div className={`h-full flex flex-col p-6 text-center transition-all duration-300 ${!service.isAvailable ? 'opacity-50' : 'group-hover:bg-slate-100/70'}`}>
            {service.isAvailable ? (
                <div className="absolute top-3 right-3 px-2 py-1 text-xs rounded-full bg-green-500/20 text-emerald-900">Mavjud</div>
            ) : (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-900">
                    <Lock size={12}/>
                    <span>Tez Kunda</span>
                </div>
            )}
            
            <div className="flex-shrink-0 mb-4">
                <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br ${service.isAvailable ? 'from-blue-500 to-cyan-400' : 'from-gray-700 to-gray-600'}`}>
                    <service.icon className="text-slate-900" size={32} />
                </div>
            </div>
            <div className="flex-grow">
                <h3 className="text-lg font-bold text-slate-900 mb-2">{service.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{service.description}</p>
            </div>
            {service.isAvailable && service.link && (
                <div className="mt-6">
                    <span className="font-semibold text-blue-800 flex items-center justify-center group-hover:text-blue-700">
                        Boshlash <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                </div>
            )}
        </div>
    );

    const commonClasses = "relative bg-white/60 backdrop-blur-2xl border border-slate-200/90 rounded-2xl shadow-lg h-full overflow-hidden";

    if (service.isAvailable && service.link) {
        return (
            <Link to={service.link} className="block group">
                 <div className={`${commonClasses} transition-all duration-300 hover:shadow-2xl hover:border-slate-300/80`}>
                    {cardContent}
                </div>
            </Link>
        );
    }

    return (
        <div className={`${commonClasses} cursor-not-allowed`}>
            {cardContent}
        </div>
    );
};

const Services = () => {
    return (
        <Card title="Xizmatlar Markazi">
            <p className="text-center text-slate-600 mb-8 -mt-4 max-w-2xl mx-auto">Tadqiqot va nashr jarayonlaringizni osonlashtirish uchun mo'ljallangan keng qamrovli xizmatlarimizdan foydalaning.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {services.map((service) => (
                    <ServiceCard key={service.title} service={service} />
                ))}
            </div>
        </Card>
    );
};

export default Services;