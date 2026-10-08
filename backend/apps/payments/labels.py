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


def service_label(service_type: str) -> str:
    return SERVICE_LABELS.get(service_type or '', service_type or "To'lov")


def receipt_number(transaction) -> str:
    """Chek raqami: CHK- + tranzaksiya UUID ning birinchi 8 belgisi (QR orqali tekshiriladi)."""
    return f'CHK-{str(transaction.pk).replace("-", "")[:8].upper()}'
