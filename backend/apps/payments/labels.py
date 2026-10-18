"""To'lov xizmatlarining foydalanuvchiga ko'rinadigan nomlari (chek, to'lovlar sahifasi, analitika)."""

SERVICE_LABELS = {
    'fast-track': "Tezkor ko'rib chiqish",
    'publication_fee': "Maqola nashri to'lovi",
    'language_editing': 'Antiplagiat tekshiruvi',
    'top_up': "Hisobni to'ldirish",
    'book_publication': 'Kitob nashri',
    'translation': 'Ilmiy tarjima',
    'udk_request': "UDK ma'lumotnoma",
    'article_sample': 'Maqola namunasi',
    'doi_request': 'DOI raqami',
}

PROVIDER_LABELS = {
    'click': 'Click',
    'payme': 'Payme',
}

STATUS_LABELS = {
    'pending': 'Kutilmoqda',
    'completed': "To'langan",
    'failed': 'Muvaffaqiyatsiz',
    'cancelled': 'Bekor qilingan',
}


# Hujjatlar (chek) uchun: (uz, ru, en). O'zbek kirill — config.doc_i18n orqali avtomatik.
SERVICE_LABELS_I18N = {
    'fast-track': ("Tezkor ko'rib chiqish", 'Ускоренное рассмотрение', 'Fast-track review'),
    'publication_fee': ("Maqola nashri to'lovi", 'Оплата публикации статьи', 'Article publication fee'),
    'language_editing': ('Antiplagiat tekshiruvi', 'Проверка на антиплагиат', 'Plagiarism check'),
    'top_up': ("Hisobni to'ldirish", 'Пополнение счёта', 'Account top-up'),
    'book_publication': ('Kitob nashri', 'Издание книги', 'Book publication'),
    'translation': ('Ilmiy tarjima', 'Научный перевод', 'Scientific translation'),
    'udk_request': ("UDK ma'lumotnoma", 'Справка УДК', 'UDC certificate'),
    'article_sample': ('Maqola namunasi', 'Образец статьи', 'Article sample'),
    'doi_request': ('DOI raqami', 'Номер DOI', 'DOI number'),
    '': ("To'lov", 'Платёж', 'Payment'),
}


def service_label(service_type: str, lang: str = 'uz') -> str:
    """Xizmat nomi. lang='uz' (standart) — API va analitika uchun avvalgidek o'zbekcha."""
    from config.doc_i18n import Dictionary, normalize_lang

    key = service_type or ''
    if normalize_lang(lang) == 'uz':
        return SERVICE_LABELS.get(key, service_type or "To'lov")
    if key not in SERVICE_LABELS_I18N:
        return service_type
    return Dictionary(SERVICE_LABELS_I18N).t(key, lang)


def receipt_number(transaction) -> str:
    """Chek raqami: CHK- + tranzaksiya UUID ning birinchi 8 belgisi (QR orqali tekshiriladi)."""
    return f'CHK-{str(transaction.pk).replace("-", "")[:8].upper()}'
