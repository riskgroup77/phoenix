import { User, Article, Journal, Role, ArticleStatus, Transaction, ActivityLogEvent, JournalCategory, PaymentModel, JournalPricingType, Issue, TranslationRequest, TranslationStatus } from '../types';

// Test foydalanuvchilar olib tashlandi
export const MOCK_USERS: User[] = [];

export const MOCK_JOURNAL_CATEGORIES: JournalCategory[] = [
    { id: 'cat-1', name: 'Iqtisodiyot fanlari' },
    { id: 'cat-2', name: 'Texnika fanlari' },
    { id: 'cat-3', name: 'Tibbiyot fanlari' },
    { id: 'cat-4', name: 'Gumanitar fanlar' },
];

export const MOCK_JOURNALS: Journal[] = [
  {
    id: 'journal-1',
    name: 'Iqtisodiyot va Innovatsion Texnologiyalar',
    issn: '2091-5946',
    description: 'Iqtisodiyot sohasidagi ilmiy tadqiqotlar va zamonaviy texnologiyalarning iqtisodiy jarayonlarga ta\'siri.',
    journalAdminId: 'user-4',
    publicationFee: 200000,
    categoryId: 'cat-1',
    imageUrl: 'https://picsum.photos/seed/journal1/400/200',
    paymentModel: PaymentModel.PostPayment,
    pricingType: JournalPricingType.Fixed,
    additionalDocumentConfig: {
      required: true,
      label: "Taqriz fayli",
      type: 'file',
    },
    issueIds: ['issue-1'],
  },
  {
    id: 'journal-2',
    name: 'Texnika Fanlari Axborotnomasi',
    issn: '1234-5678',
    description: 'Muhandislik va texnika sohasidagi yangiliklar, ixtirolar va ilmiy-texnikaviy yechimlar tahlili.',
    journalAdminId: 'user-4',
    pricePerPage: 15000,
    categoryId: 'cat-2',
    imageUrl: 'https://picsum.photos/seed/journal2/400/200',
    paymentModel: PaymentModel.PrePayment,
    pricingType: JournalPricingType.PerPage,
    additionalDocumentConfig: {
      required: false,
      label: "",
      type: 'file',
    }
  },
  {
    id: 'journal-3',
    name: 'Tibbiyot va Salomatlik',
    issn: '8765-4321',
    description: 'Sog\'liqni saqlash sohasidagi eng so\'nggi yutuqlar, klinik tadqiqotlar va tibbiy amaliyotga oid maqolalar.',
    journalAdminId: 'user-4',
    publicationFee: 250000,
    categoryId: 'cat-3',
    imageUrl: 'https://picsum.photos/seed/journal3/400/200',
    paymentModel: PaymentModel.PostPayment,
    pricingType: JournalPricingType.Fixed,
    additionalDocumentConfig: {
      required: true,
      label: "Tavsiyanoma havolasi",
      type: 'link',
    }
  },
  {
    id: 'journal-4',
    name: 'Filologiya Masalalari',
    issn: '4567-1238',
    description: 'Tilshunoslik va adabiyotshunoslikka oid ilmiy maqolalar, tahliliy sharhlar va tadqiqotlar majmuasi.',
    journalAdminId: 'user-4',
    pricePerPage: 12000,
    categoryId: 'cat-4',
    imageUrl: 'https://picsum.photos/seed/journal4/400/200',
    paymentModel: PaymentModel.PrePayment,
    pricingType: JournalPricingType.PerPage,
    additionalDocumentConfig: {
      required: false,
      label: "",
      type: 'file',
    }
  },
];

export const MOCK_ARTICLES: Article[] = [
  {
    id: 'article-1',
    title: 'Raqamli iqtisodiyot sharoitida sun\'iy intellektning o\'rni',
    abstract: 'Ushbu maqolada raqamli iqtisodiyotning rivojlanishida sun\'iy intellekt texnologiyalarining roli va ahamiyati tahlil qilinadi.',
    keywords: ['sun\'iy intellekt', 'raqamli iqtisodiyot', 'innovatsiya'],
    status: ArticleStatus.Published,
    authorId: 'user-1',
    journalId: 'journal-1',
    doi: '10.1234/j.eco.2025.01.001',
    submissionDate: '2025-09-15',
    versions: [{ id: 'v1', versionNumber: 1, filePath: '/path/to/doc1.docx', submissionDate: '2025-09-15' }],
    analytics: { views: 1250, downloads: 450, citations: 25 },
    publishedById: 'user-4',
    certificateUrl: 'https://example.com/certificate/article-1-plagiat.pdf',
    publicationUrl: 'https://journal.example.com/article-1',
    publicationCertificateUrl: 'https://example.com/certificate/article-1-publish.pdf',
    thesisUrl: 'https://example.com/thesis/article-1.pdf',
    pageCount: 10,
    plagiarismCheckResults: {
        plagiarism: 8,
        aiContent: 5,
        checkedAt: '2025-09-15T10:05:00Z',
    }
  },
  {
    id: 'article-2',
    title: 'Kvant kompyuterlarining kriptografiyaga ta\'siri',
    abstract: 'Kvant hisoblashlarining zamonaviy kriptografik tizimlarga potentsial ta\'siri va post-kvant kriptografiya yechimlari muhokama qilinadi.',
    keywords: ['kvant kompyuter', 'kriptografiya', 'xavfsizlik'],
    status: ArticleStatus.QabulQilingan,
    authorId: 'user-1',
    journalId: 'journal-2',
    submissionDate: '2025-10-20',
    versions: [{ id: 'v2', versionNumber: 1, filePath: '/path/to/doc2.docx', submissionDate: '2025-10-20' }],
    analytics: { views: 150, downloads: 20, citations: 1 },
    reviewContent: 'Kvant hisoblashlarining joriy holati bo\'yicha bir nechta yangi manbalar qo\'shish kerak. Shuningdek, post-kvant kriptografiya algoritmlariga oid qismni kengaytirish tavsiya etiladi. Mavjud algoritmlar va ularning zaifliklari haqida ko\'proq ma\'lumot bering.',
    pageCount: 12,
    plagiarismCheckResults: {
        plagiarism: 12,
        aiContent: 18,
        checkedAt: '2025-10-20T11:25:00Z',
    },
    fastTrack: true,
  },
  {
    id: 'article-3',
    title: 'Yangi materiallarning energiya samaradorligini oshirishdagi roli',
    abstract: 'Maqolada energiya samaradorligini oshirish maqsadida yangi kompozit materiallarni ishlab chiqish va qo\'llash istiqbollari ko\'rib chiqiladi.',
    keywords: ['materialshunoslik', 'energiya samaradorligi', 'kompozitlar'],
    status: ArticleStatus.Yangi,
    authorId: 'user-1',
    journalId: 'journal-2',
    submissionDate: '2025-11-10',
    versions: [{ id: 'v3', versionNumber: 1, filePath: '/path/to/doc3.docx', submissionDate: '2025-11-10' }],
    analytics: { views: 25, downloads: 2, citations: 0 },
    pageCount: 8,
    plagiarismCheckResults: {
        plagiarism: 3,
        aiContent: 0,
        checkedAt: '2025-11-10T08:50:00Z',
    },
    fastTrack: true,
  },
  {
    id: 'article-4',
    title: 'Blokcheyn texnologiyasining moliya sektoriga integratsiyasi',
    abstract: 'Ushbu maqolada blokcheyn texnologiyasining an\'anaviy moliya tizimlariga integratsiyalashuvi, uning afzalliklari va qiyinchiliklari tahlil qilinadi.',
    keywords: ['blokcheyn', 'moliya', 'fintex', 'kriptovalyuta'],
    status: ArticleStatus.NashrgaYuborilgan,
    authorId: 'user-1',
    journalId: 'journal-1',
    submissionDate: '2025-11-15',
    versions: [{ id: 'v4', versionNumber: 1, filePath: '/path/to/doc4.docx', submissionDate: '2025-11-15' }],
    analytics: { views: 10, downloads: 1, citations: 0 },
    finalPdfPath: '/path/to/final_article_4.pdf',
    pageCount: 15,
  },
];

export const MOCK_ISSUES: Issue[] = [
    { 
        id: 'issue-1', 
        journalId: 'journal-1', 
        issueNumber: '2025-09 (Sentyabr)', 
        publicationDate: '2025-09-30', 
        articles: ['article-1'], 
        collectionUrl: 'https://example.com/collections/journal-1-sep-2025.pdf' 
    }
];


export const MOCK_TRANSACTIONS: Transaction[] = [
    {id: 't1', userId: 'user-1', articleId: 'article-2', amount: -50000, currency: 'so\'m', serviceType: 'fast-track', status: 'completed', createdAt: '2025-10-21'},
    {id: 't2', userId: 'user-1', amount: 200000, currency: 'so\'m', serviceType: 'top_up', status: 'completed', createdAt: '2025-10-20'},
    {id: 't3', userId: 'user-1', articleId: 'article-1', amount: -200000, currency: 'so\'m', serviceType: 'publication_fee', status: 'completed', createdAt: '2025-09-16'},
    {id: 't4', userId: 'user-2', amount: -100000, currency: 'so\'m', serviceType: 'language_editing', status: 'completed', createdAt: '2025-11-05'},
    {id: 't5', userId: 'user-2', articleId: 'article-3', amount: -50000, currency: 'so\'m', serviceType: 'fast-track', status: 'completed', createdAt: '2025-11-05'},
    {id: 't6', userId: 'user-1', amount: -20000, currency: 'so\'m', serviceType: 'fast-track', status: 'failed', createdAt: '2025-11-10'},
    {id: 't7', userId: 'user-1', translationRequestId: 'tr-1', amount: -250000, currency: 'so\'m', serviceType: 'translation', status: 'completed', createdAt: '2025-11-01'},
];

export const MOCK_TRANSLATION_REQUESTS: TranslationRequest[] = [
    {
        id: 'tr-1',
        authorId: 'user-1',
        reviewerId: 'user-2',
        title: 'Kvant kompyuterlari hujjat.docx',
        sourceLanguage: 'uz_cyrl',
        targetLanguage: 'en',
        sourceFilePath: '/path/to/source/doc1.docx',
        translatedFilePath: '/path/to/translated/doc1_en.docx',
        status: TranslationStatus.Bajarildi,
        wordCount: 2500,
        cost: 250000,
        submissionDate: '2025-11-01',
        completionDate: '2025-11-04',
    },
    {
        id: 'tr-2',
        authorId: 'user-6',
        reviewerId: 'user-2',
        title: 'Iqtisodiy tahlil.pdf',
        sourceLanguage: 'uz_latn',
        targetLanguage: 'ru',
        sourceFilePath: '/path/to/source/doc2.pdf',
        status: TranslationStatus.Jarayonda,
        wordCount: 4210,
        cost: 421000,
        submissionDate: '2025-11-05',
    },
    {
        id: 'tr-3',
        authorId: 'user-1',
        title: 'Yangi tadqiqot materiallari.pptx',
        sourceLanguage: 'en',
        targetLanguage: 'uz_latn',
        sourceFilePath: '/path/to/source/doc3.pptx',
        status: TranslationStatus.Yangi,
        wordCount: 1850,
        cost: 185000,
        submissionDate: '2025-11-08',
    }
];

export const MOCK_ACTIVITY_LOG: ActivityLogEvent[] = [
    // Article 1 Log
    { id: 'log-1-1', articleId: 'article-1', timestamp: '2025-09-15T10:00:00Z', userId: 'user-1', action: 'Maqola yuborildi' },
    { id: 'log-1-2', articleId: 'article-1', timestamp: '2025-09-16T14:30:00Z', userId: 'user-2', action: `Holat o'zgartirildi: ${ArticleStatus.QabulQilingan}` },
    { id: 'log-1-3', articleId: 'article-1', timestamp: '2025-09-22T09:00:00Z', userId: 'user-2', action: `Holat o'zgartirildi: ${ArticleStatus.Accepted}` },
    { id: 'log-1-4', articleId: 'article-1', timestamp: '2025-09-22T11:00:00Z', userId: 'user-2', action: `Holat o'zgartirildi: ${ArticleStatus.NashrgaYuborilgan}` },
    { id: 'log-1-5', articleId: 'article-1', timestamp: '2025-09-25T18:00:00Z', userId: 'user-4', action: 'Maqola nashr etildi' },
    
    // Article 2 Log
    { id: 'log-2-1', articleId: 'article-2', timestamp: '2025-10-20T11:20:00Z', userId: 'user-1', action: 'Yangi so\'rov kelib tushdi' },
    { id: 'log-2-2', articleId: 'article-2', timestamp: '2025-10-21T16:00:00Z', userId: 'user-2', action: 'So\'rov qabul qilindi', details: 'Taqrizchi Gulnora Saidova' },
    { id: 'log-2-3', articleId: 'article-2', timestamp: '2025-10-21T16:05:00Z', userId: 'user-2', action: `Holat o'zgartirildi: ${ArticleStatus.QabulQilingan}` },

    // Article 3 Log
    { id: 'log-3-1', articleId: 'article-3', timestamp: '2025-11-10T08:45:00Z', userId: 'user-1', action: 'Yangi so\'rov kelib tushdi' },

    // Article 4 Log
    { id: 'log-4-1', articleId: 'article-4', timestamp: '2025-11-15T12:00:00Z', userId: 'user-1', action: 'Yangi so\'rov kelib tushdi'},
    { id: 'log-4-2', articleId: 'article-4', timestamp: '2025-11-16T10:00:00Z', userId: 'user-2', action: `Holat o'zgartirildi: ${ArticleStatus.QabulQilingan}` },
    { id: 'log-4-3', articleId: 'article-4', timestamp: '2025-11-20T15:00:00Z', userId: 'user-2', action: `Holat o'zgartirildi: ${ArticleStatus.NashrgaYuborilgan}` },
].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());