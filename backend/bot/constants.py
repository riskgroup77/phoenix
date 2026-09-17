"""Conversation states and shared constants for the author Telegram bot."""

CANCEL = "❌ Bekor qilish"
BACK = "⬅️ Orqaga"

# Auth
LOGIN_PHONE, LOGIN_PASSWORD = range(2)
REG_FIRST, REG_LAST, REG_PHONE, REG_PASSWORD = range(4)

# Article submit
SUBMIT_JOURNAL, SUBMIT_TITLE, SUBMIT_ABSTRACT, SUBMIT_KEYWORDS, SUBMIT_PAGES, SUBMIT_FILE = range(6)

# DOI
DOI_FIRST, DOI_LAST, DOI_FILE = range(3)

# UDK
UDK_FIRST, UDK_LAST, UDK_TITLE, UDK_ABSTRACT, UDK_FILE = range(5)

# Translation
TRANS_FILE, TRANS_TARGET, TRANS_CONFIRM = range(3)

# Plagiarism
PLAG_TITLE, PLAG_FILE = range(2)

# Book
BOOK_TITLE, BOOK_ABSTRACT, BOOK_KEYWORDS, BOOK_PAGES, BOOK_FILE, BOOK_COVER = range(6)

# Article sample
SAMPLE_TOPIC, SAMPLE_PAGES, SAMPLE_QUALITY, SAMPLE_REQUIREMENTS = range(4)

SERVICE_LABELS = {
    'fast-track': 'Tezkor ko\'rib chiqish',
    'publication_fee': 'Nashr haqi',
    'language_editing': 'Antiplagiat',
    'top_up': 'Balans to\'ldirish',
    'book_publication': 'Kitob nashri',
    'translation': 'Tarjima',
    'udk_request': 'UDK buyurtmasi',
    'doi_request': 'DOI so\'rovi',
    'article_sample': 'Maqola namuna',
}

STATUS_LABELS = {
    'Draft': 'Qoralama',
    'PaymentCompleted': 'To\'lov qilingan',
    'Yangi': 'Yangi',
    'WithEditor': 'Tahrirchida',
    'PlagiarismReview': 'Antiplagiat',
    'QabulQilingan': 'Qabul qilingan',
    'Revision': 'Qayta ishlash',
    'Accepted': 'Qabul',
    'NashrgaYuborilgan': 'Nashrga yuborilgan',
    'Published': 'Nashr etilgan',
    'Rejected': 'Rad etilgan',
}
