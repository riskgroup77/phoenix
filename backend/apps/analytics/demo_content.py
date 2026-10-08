"""
Demo (namuna) ma'lumotlar uchun matnlar: jurnallar, maqola mavzulari, annotatsiya qismlari, odamlar.
Faqat seed_demo_data buyrug'i ishlatadi.
"""

AUTHORS = [
    ('Javohir', 'Karimov', 'Bahodir o\'g\'li', 'Toshkent davlat iqtisodiyot universiteti'),
    ('Dilnoza', 'Yusupova', 'Anvar qizi', 'O\'zbekiston Milliy universiteti'),
    ('Sardor', 'Rahimov', 'Ulug\'bek o\'g\'li', 'Muhammad al-Xorazmiy nomidagi TATU'),
    ('Malika', 'Tursunova', 'Shuhrat qizi', 'Samarqand davlat universiteti'),
    ('Jasur', 'Abdullayev', 'Rustam o\'g\'li', 'Farg\'ona davlat universiteti'),
    ('Nilufar', 'Ergasheva', 'Akmal qizi', 'Toshkent tibbiyot akademiyasi'),
    ('Bekzod', 'Qodirov', 'Ilhom o\'g\'li', 'Buxoro davlat universiteti'),
    ('Gulnoza', 'Saidova', 'Farhod qizi', 'Nizomiy nomidagi TDPU'),
    ('Otabek', 'Nurmatov', 'Alisher o\'g\'li', 'Namangan davlat universiteti'),
    ('Zarina', 'Xolmirzayeva', 'Botir qizi', 'Andijon davlat universiteti'),
    ('Shohruh', 'Islomov', 'Komil o\'g\'li', 'Toshkent davlat texnika universiteti'),
    ('Feruza', 'Mirzayeva', 'Hamid qizi', 'O\'zbekiston davlat jahon tillari universiteti'),
]

REVIEWERS = [
    ('Rustam', 'Hasanov', 'Iqtisodiyot fanlari doktori, professor', ['Iqtisodiyot', 'Moliya']),
    ('Shahnoza', 'Aliyeva', 'Pedagogika fanlari bo\'yicha falsafa doktori (PhD)', ['Pedagogika', 'Ta\'lim']),
    ('Akmal', 'Ismoilov', 'Texnika fanlari doktori, dotsent', ['Axborot texnologiyalari']),
    ('Mohira', 'Sobirova', 'Tibbiyot fanlari bo\'yicha falsafa doktori (PhD)', ['Tibbiyot']),
    ('Behruz', 'Toshpo\'latov', 'Filologiya fanlari doktori, professor', ['Filologiya', 'Tilshunoslik']),
]

JOURNAL_ADMINS = [
    ('Anvar', 'Normatov', 'Bosh muharrir'),
    ('Lola', 'Xudoyberdiyeva', 'Bosh muharrir'),
]

# admin: 'login' — 933333333 demo hisobi; 0/1 — JOURNAL_ADMINS indeksi
JOURNALS = [
    {
        'key': 'econ', 'admin': 'login', 'category': 'Iqtisodiyot', 'issn': '0000-0108',
        'name': 'Iqtisodiyot va innovatsion texnologiyalar',
        'fee': 350000, 'udk': ('330.341', 'Iqtisodiy rivojlanish. Innovatsiyalar'),
        'keywords': ['raqamli iqtisodiyot', 'investitsiya', 'kichik biznes', 'moliyaviy barqarorlik', 'innovatsiya',
                     'bank tizimi', 'eksport', 'tadbirkorlik'],
        'context': ['so\'nggi yillarda amalga oshirilgan iqtisodiy islohotlar sharoitida',
                    'mamlakat iqtisodiyotining raqamli transformatsiyasi davrida',
                    'xalqaro tajriba va milliy amaliyot qiyosida',
                    'hududlar kesimidagi statistik ma\'lumotlar asosida'],
        'method': ['korrelyatsion-regression tahlil', 'ekonometrik modellashtirish', 'SWOT tahlil va ekspert baholash',
                   'panel ma\'lumotlar tahlili'],
        'object': ['respublikaning 14 ta hududi', '120 ta kichik va o\'rta korxona', '9 ta tijorat banki',
                   '2018–2025-yillar'],
        'result': ['raqamli vositalardan foydalanish korxonalar rentabelligini o\'rtacha 11–14 foizga oshirishini',
                   'institutsional omillar investitsion faollikka sezilarli ta\'sir ko\'rsatishini',
                   'kredit resurslariga kirish imkoniyati bandlik darajasi bilan kuchli bog\'liqligini'],
        'proposal': ['hududiy rivojlanish dasturlarini takomillashtirish', 'moliyaviy qo\'llab-quvvatlash mexanizmlarini kengaytirish',
                     'soliq imtiyozlarini maqsadli yo\'naltirish'],
        'titles': [
            'Raqamli iqtisodiyot sharoitida kichik biznes subyektlarining moliyaviy barqarorligini ta\'minlash',
            'O\'zbekistonda yashil iqtisodiyotga o\'tishning institutsional asoslari',
            'Tijorat banklarida kredit risklarini boshqarishning zamonaviy usullari',
            'Hududiy turizm klasterlarini rivojlantirishda davlat-xususiy sheriklik',
            'Elektron tijorat platformalarining iste\'mol bozoriga ta\'siri',
            'Qishloq xo\'jaligi kooperatsiyasi va fermer xo\'jaliklari daromadlari',
            'Soliq ma\'muriyatchiligini raqamlashtirishning samaradorligi',
            'Inflyatsion kutilmalar va pul-kredit siyosati transmissiyasi',
            'Erkin iqtisodiy zonalarda xorijiy investitsiyalarni jalb qilish omillari',
            'Mehnat bozorida yoshlar bandligini oshirish mexanizmlari',
            'Korxonalarda moliyaviy hisobotning xalqaro standartlariga o\'tish muammolari',
            'Islomiy moliya vositalarining bank tizimidagi istiqbollari',
            'Logistika xizmatlari bozorida raqobatbardoshlikni oshirish',
            'Oilaviy tadbirkorlikni qo\'llab-quvvatlashning mintaqaviy tajribasi',
        ],
    },
    {
        'key': 'ped', 'admin': 'login', 'category': 'Pedagogika', 'issn': '0000-0116',
        'name': 'Zamonaviy ta\'lim va pedagogika',
        'fee': 300000, 'udk': ('37.016', 'O\'qitish metodikasi'),
        'keywords': ['interfaol metod', 'raqamli kompetensiya', 'ta\'lim sifati', 'motivatsiya', 'kredit-modul',
                     'inklyuziv ta\'lim', 'tanqidiy fikrlash', 'pedagogik texnologiya'],
        'context': ['ta\'lim tizimini isloh qilish jarayonida', 'umumta\'lim maktablari amaliyotida',
                    'oliy ta\'lim muassasalarida kredit-modul tizimi joriy etilgan sharoitda',
                    'xalqaro baholash tadqiqotlari natijalariga tayangan holda'],
        'method': ['pedagogik eksperiment', 'anketa so\'rovi va kuzatuv', 'nazorat va tajriba guruhlarini qiyoslash',
                   'kontent-tahlil'],
        'object': ['Toshkent shahridagi 6 ta maktabning 280 nafar o\'quvchisi', '3 ta oliygohning 210 nafar talabasi',
                   '45 nafar o\'qituvchi', '2 o\'quv yili davomida'],
        'result': ['tajriba guruhida o\'zlashtirish ko\'rsatkichi nazorat guruhiga nisbatan 18 foizga yuqori bo\'lganini',
                   'interfaol topshiriqlar o\'quvchilarning mustaqil fikrlashini sezilarli rivojlantirishini',
                   'raqamli resurslardan muntazam foydalanish motivatsiyani oshirishini'],
        'proposal': ['o\'quv dasturlarini takomillashtirish', 'o\'qituvchilar malakasini oshirish kurslari mazmunini yangilash',
                     'baholash mezonlarini qayta ko\'rib chiqish'],
        'titles': [
            'Boshlang\'ich sinflarda o\'qish savodxonligini rivojlantirishning interfaol metodlari',
            'Oliy ta\'limda kredit-modul tizimining talabalar mustaqil ishiga ta\'siri',
            'STEAM yondashuvi asosida fizika darslarini tashkil etish',
            'Bo\'lajak o\'qituvchilarning raqamli kompetensiyasini shakllantirish',
            'Inklyuziv ta\'limda alohida ehtiyojli o\'quvchilar bilan ishlash texnologiyalari',
            'Maktabgacha ta\'limda o\'yin orqali nutqni o\'stirish',
            'Masofaviy ta\'limda o\'quvchilar motivatsiyasini oshirish yo\'llari',
            'Xalqaro baholash natijalari asosida matematika ta\'limini takomillashtirish',
            'Kasb-hunar maktablarida dual ta\'lim modelini joriy etish',
            'Ta\'lim jarayonida sun\'iy intellekt vositalaridan foydalanish etikasi',
            'O\'quvchilarda tanqidiy fikrlashni rivojlantiruvchi topshiriqlar tizimi',
            'Pedagogik amaliyotda refleksiv yondashuv',
            'Xorijiy til darslarida CLIL metodikasining samaradorligi',
            'Ota-onalar bilan hamkorlikda o\'quvchi shaxsini tarbiyalash',
        ],
    },
    {
        'key': 'it', 'admin': 0, 'category': 'Axborot texnologiyalari', 'issn': '0000-0124',
        'name': 'Axborot texnologiyalari va raqamli tizimlar',
        'fee': 400000, 'udk': ('004.8', 'Sun\'iy intellekt'),
        'keywords': ['mashinali o\'qitish', 'neyron tarmoq', 'kiberxavfsizlik', 'bulutli hisoblash', 'IoT',
                     'katta ma\'lumotlar', 'algoritm', 'dasturiy ta\'minot'],
        'context': ['raqamli xizmatlar jadal rivojlanayotgan sharoitda', 'o\'zbek tilidagi ma\'lumotlar uchun',
                    'resurslari cheklangan qurilmalar misolida', 'davlat axborot tizimlarida'],
        'method': ['chuqur o\'qitish modellari', 'qiyosiy eksperimentlar', 'simulyatsion modellashtirish',
                   'ochiq ma\'lumotlar to\'plamlarida sinov'],
        'object': ['40 ming yozuvdan iborat ma\'lumotlar to\'plami', '6 ta model arxitekturasi', '3 ta real tizim',
                   '12 ta tarmoq tugunidan iborat stend'],
        'result': ['taklif etilgan model aniqligi bazaviy usullarga nisbatan 7–9 foizga yuqori bo\'lganini',
                   'hisoblash vaqti ikki barobar qisqarganini', 'tizimning xatolarga bardoshliligi sezilarli oshganini'],
        'proposal': ['tizimni amaliyotga joriy etish', 'model parametrlarini optimallashtirish',
                     'ochiq kodli kutubxona sifatida tarqatish'],
        'titles': [
            'Mashinali o\'qitish yordamida o\'zbek tilidagi matnlarni tasniflash',
            'Kiberxavfsizlikda anomaliyalarni aniqlashning neyron tarmoq modellari',
            'Bulutli hisoblash muhitida mikroservis arxitekturasini loyihalash',
            'Aqlli shahar tizimlarida IoT sensorlari ma\'lumotlarini qayta ishlash',
            'O\'zbek tili uchun nutqni avtomatik tanish tizimlarining tahlili',
            'Blokcheyn texnologiyasi asosida hujjat aylanishini himoyalash',
            'Kompyuter ko\'rish yordamida qishloq xo\'jaligi ekinlarini monitoring qilish',
            'Mobil ilovalarda foydalanuvchi interfeysi qulayligini baholash',
            'Katta hajmli ma\'lumotlarni taqsimlangan qayta ishlash algoritmlari',
            'Elektron hukumat xizmatlarining axborot xavfsizligi',
            'Chuqur o\'qitish modellarini kichik qurilmalarda optimallashtirish',
            'Ta\'lim platformalari uchun tavsiya tizimlarini ishlab chiqish',
            'Tarmoq trafigini bashorat qilishda vaqt qatorlari modellari',
            'Ochiq kodli dasturiy ta\'minotdan davlat tashkilotlarida foydalanish',
        ],
    },
    {
        'key': 'med', 'admin': 1, 'category': 'Tibbiyot', 'issn': '0000-0132',
        'name': 'Tibbiyot va sog\'liqni saqlash',
        'fee': 380000, 'udk': ('616.1', 'Yurak-qon tomir tizimi kasalliklari'),
        'keywords': ['profilaktika', 'skrining', 'bemorlar', 'epidemiologiya', 'reabilitatsiya', 'birlamchi tibbiy yordam',
                     'xavf omillari', 'davolash samaradorligi'],
        'context': ['birlamchi tibbiy-sanitariya yordami muassasalarida', 'ko\'p tarmoqli klinika sharoitida',
                    'aholi o\'rtasida o\'tkazilgan skrining doirasida', 'retrospektiv klinik ma\'lumotlar asosida'],
        'method': ['kogort tadqiqot', 'tasodifiy tanlangan nazoratli tadqiqot', 'ko\'ndalang kesim tadqiqoti',
                   'statistik tahlil (SPSS)'],
        'object': ['312 nafar bemor', '1 240 nafar maktab o\'quvchisi', '5 ta oilaviy poliklinika',
                   '2021–2025-yillardagi kasallik tarixlari'],
        'result': ['erta aniqlash dasturi asoratlar sonini 23 foizga kamaytirganini',
                   'xavf omillari ayollarda erkaklarga nisbatan ko\'proq uchrashini',
                   'bemorlarni o\'qitish davolash natijalarini sezilarli yaxshilashini'],
        'proposal': ['profilaktik tadbirlarni kengaytirish', 'klinik protokollarni yangilash',
                     'tibbiyot xodimlari uchun o\'quv dasturlarini ishlab chiqish'],
        'titles': [
            'Qandli diabet 2-turi bilan og\'rigan bemorlarda yurak-qon tomir asoratlari xavfi',
            'Bolalarda temir tanqisligi anemiyasining tarqalishi va profilaktikasi',
            'Arterial gipertenziyani davolashda bemorlar uyushqoqligini oshirish',
            'Homiladorlikda D vitamini tanqisligining onalik va perinatal oqibatlari',
            'Antibiotiklarga rezistentlikning shifoxona ichidagi monitoringi',
            'Birlamchi tibbiy yordamda telemeditsina xizmatlarining samaradorligi',
            'Surunkali buyrak kasalligini erta aniqlashda skrining dasturlari',
            'Keksalarda osteoporoz va sinishlar xavfini baholash',
            'Tish kariyesining maktab yoshidagi bolalar orasida tarqalishi',
            'Insultdan keyingi reabilitatsiyada erta jismoniy faollik',
            'Gepatit B ga qarshi emlash qamrovini oshirish strategiyalari',
            'Tibbiyot xodimlarida kasbiy charchoq sindromi',
            'O\'smirlarda ortiqcha vazn va ovqatlanish odatlari',
            'Shoshilinch tibbiy yordam xizmatida triaj tizimini takomillashtirish',
        ],
    },
    {
        'key': 'phil', 'admin': 1, 'category': 'Filologiya', 'issn': '0000-0140',
        'name': 'Filologiya va tilshunoslik masalalari',
        'fee': 280000, 'udk': ('821.512.133', 'O\'zbek adabiyoti'),
        'keywords': ['badiiy matn', 'tarjima', 'frazeologiya', 'leksikologiya', 'poetika', 'diskurs', 'obraz',
                     'korpus lingvistikasi'],
        'context': ['mumtoz va zamonaviy o\'zbek adabiyoti qiyosida', 'qiyosiy-tipologik yondashuv asosida',
                    'til korpusi ma\'lumotlariga tayangan holda', 'badiiy tarjima amaliyotida'],
        'method': ['qiyosiy-tarixiy tahlil', 'lingvopoetik tahlil', 'korpus statistikasi', 'semantik tahlil'],
        'object': ['200 dan ortiq badiiy matn parchasi', '1,2 mln so\'zli matnlar korpusi', '3 ta tarjima varianti',
                   '15 ta muallif asarlari'],
        'result': ['ramziy obrazlar tizimi muallif dunyoqarashi bilan uzviy bog\'liqligini',
                   'tarjimada milliy kolorit ko\'pincha izohlash orqali saqlanishini',
                   'yangi so\'zlarning asosiy qismi texnologiya sohasiga tegishli ekanini'],
        'proposal': ['o\'quv qo\'llanmalarini boyitish', 'izohli lug\'atlarni yangilash', 'tarjima amaliyoti uchun tavsiyalar'],
        'titles': [
            'Alisher Navoiy g\'azallarida ramziy obrazlar tizimi',
            'Zamonaviy o\'zbek nasrida modernistik tendensiyalar',
            'O\'zbek tilidagi frazeologizmlarning ingliz tiliga tarjimasi muammolari',
            'Ommaviy axborot vositalari tilida neologizmlar',
            'Abdulla Qodiriy romanlarida milliy xarakter talqini',
            'O\'zbek shevalarida leksik-semantik o\'zgarishlar',
            'Badiiy tarjimada milliy koloritni saqlash usullari',
            'Bolalar adabiyotida tarbiyaviy g\'oyalar ifodasi',
            'Korpus lingvistikasi asosida o\'zbek tili lug\'atlarini tuzish',
            'Erkin Vohidov she\'riyatida falsafiy motivlar',
            'Ingliz va o\'zbek tillarida xushmuomalalik strategiyalari',
            'Internet diskursida o\'zbek tilining imlo me\'yorlari',
            'Qadimgi turkiy yodgorliklar tilining fonetik xususiyatlari',
            'Zamonaviy dramaturgiyada konflikt tipologiyasi',
        ],
    },
]

# Har jurnaldagi 14 ta maqola holati (tartib bo'yicha).
# Platforma oqimi: to'lov → Yangi → WithEditor (jurnal tekshiruvi) → QabulQilingan (taqrizda)
#                  → Revision / Accepted → NashrgaYuborilgan → Published
STATUS_PLAN = [
    'Published', 'Published', 'Published', 'Published', 'Published', 'NashrgaYuborilgan',
    'Accepted', 'QabulQilingan', 'QabulQilingan', 'Revision', 'WithEditor', 'Yangi', 'Rejected', 'Draft',
]

STATUS_CHAINS = {
    'Draft': ['Draft'],
    'Yangi': ['Yangi'],
    'WithEditor': ['Yangi', 'WithEditor'],
    'QabulQilingan': ['Yangi', 'WithEditor', 'QabulQilingan'],
    'Revision': ['Yangi', 'WithEditor', 'QabulQilingan', 'Revision'],
    'Accepted': ['Yangi', 'WithEditor', 'QabulQilingan', 'Accepted'],
    'NashrgaYuborilgan': ['Yangi', 'WithEditor', 'QabulQilingan', 'Accepted', 'NashrgaYuborilgan'],
    'Rejected': ['Yangi', 'WithEditor', 'QabulQilingan', 'Rejected'],
    'Published': ['Yangi', 'WithEditor', 'QabulQilingan', 'Accepted', 'NashrgaYuborilgan', 'Published'],
}

STATUS_NOTES = {
    'Draft': 'Maqola qoralama sifatida saqlandi, to\'lov kutilmoqda.',
    'Yangi': 'To\'lov qabul qilindi, maqola jurnalga yuborildi.',
    'WithEditor': 'Jurnal tahririyati maqolani talablar bo\'yicha tekshirmoqda.',
    'QabulQilingan': 'Maqola taqrizga yuborildi.',
    'Revision': 'Taqrizchi izohlari asosida maqolani qayta ishlash so\'raldi.',
    'Accepted': 'Taqriz ijobiy — maqola nashrga qabul qilindi.',
    'NashrgaYuborilgan': 'Maqola nashrga tayyorlanmoqda (sahifalash va korrektura).',
    'Rejected': 'Taqriz natijasiga ko\'ra maqola rad etildi.',
    'Published': 'Maqola jurnalning navbatdagi sonida nashr etildi.',
}

STRENGTHS = [
    'Mavzu dolzarb, tadqiqot maqsadi aniq qo\'yilgan.',
    'Metodologiya to\'g\'ri tanlangan, natijalar ishonchli dalillangan.',
    'Amaliy tavsiyalar asoslangan va qo\'llash mumkin.',
    'Adabiyotlar sharhi yetarli darajada keng.',
]
WEAKNESSES = [
    'Xulosalar qismini natijalar bilan yanada aniqroq bog\'lash kerak.',
    'Ba\'zi jadvallarda o\'lchov birliklari ko\'rsatilmagan.',
    'Xorijiy tadqiqotlar bilan qiyosiy tahlilni kengaytirish tavsiya etiladi.',
    'Tanlanma hajmi kichikroq, cheklovlar alohida ko\'rsatilishi lozim.',
]
COMMENTS_TO_AUTHOR = {
    'accept': 'Maqola nashrga tavsiya etiladi. Kichik uslubiy tahrirlarni amalga oshiring.',
    'minor_revision': 'Ko\'rsatilgan kichik kamchiliklar tuzatilgach, maqolani qabul qilish mumkin.',
    'major_revision': 'Metodologiya va natijalar qismini sezilarli qayta ishlash talab etiladi.',
    'reject': 'Afsuski, maqola ilmiy yangilik va metodologiya talablariga javob bermaydi.',
}

OPERATOR_THREADS = [
    ('Assalomu alaykum! Maqolam qachon taqrizdan chiqadi?',
     'Va alaykum assalom! Maqolangiz taqrizchida, odatda 7–10 ish kuni ichida natija bo\'ladi.'),
    ('To\'lovni amalga oshirdim, lekin holat o\'zgarmadi.',
     'To\'lovingiz tasdiqlandi, maqola holati yangilandi. Rahmat!'),
    ('Sertifikatni qayerdan yuklab olsam bo\'ladi?',
     'Maqola sahifasidagi «Hujjatlar» bo\'limidan PDF ko\'rinishida yuklab olishingiz mumkin.'),
    ('Maqolaga hammuallif qo\'shsam bo\'ladimi?',
     'Ha, maqola tahrirga qaytarilganda hammuallif ma\'lumotlarini kiritishingiz mumkin.'),
]

UDK_TOPICS = [
    ('Hududiy iqtisodiyotda klaster yondashuvi', '330.341', 'Iqtisodiy rivojlanish. Innovatsiyalar'),
    ('Ingliz tili darslarida loyiha metodi', '37.016', 'O\'qitish metodikasi'),
    ('Neyron tarmoqlar asosida tasvirlarni tanish', '004.8', 'Sun\'iy intellekt'),
    ('Bolalarda allergik kasalliklar profilaktikasi', '616-053.2', 'Bolalar kasalliklari'),
    ('Navoiy ijodida tasavvufiy ramzlar', '821.512.133', 'O\'zbek adabiyoti'),
    ('Kichik biznesda soliq yuki', '336.2', 'Soliqlar'),
    ('Maktabgacha ta\'limda ekologik tarbiya', '373.2', 'Maktabgacha ta\'lim'),
    ('Ma\'lumotlar bazasini himoyalash usullari', '004.056', 'Axborot xavfsizligi'),
]

TRANSLATIONS = [
    ('Raqamli iqtisodiyotda inson kapitali (maqola)', 'O\'zbek', 'Ingliz', 1850),
    ('Ta\'lim sifatini baholash mezonlari', 'O\'zbek', 'Rus', 2400),
    ('Machine learning for agriculture', 'Ingliz', 'O\'zbek', 3100),
    ('Методы профилактики гипертонии', 'Rus', 'O\'zbek', 1600),
    ('Bolalar adabiyoti antologiyasiga so\'zboshi', 'O\'zbek', 'Ingliz', 900),
    ('Kiberxavfsizlik bo\'yicha qo\'llanma', 'O\'zbek', 'Rus', 4200),
]

SAMPLE_REQUESTS = [
    ('Kichik biznesni qo\'llab-quvvatlash dasturlari samaradorligi', 'orta', 6),
    ('Boshlang\'ich ta\'limda raqamli o\'yinlardan foydalanish', 'yuqori', 8),
    ('Qishloq xo\'jaligida suvni tejovchi texnologiyalar', 'quyi', 5),
    ('O\'zbek xalq maqollarining tarbiyaviy ahamiyati', 'orta', 7),
]

PUBLICATION_TYPES = [
    'journal_local', 'journal_international', 'conference_local', 'conference_international', 'scopus_journal',
]
