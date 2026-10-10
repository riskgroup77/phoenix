"""Yordamchi javob shablonlari (uz / ru / en). Kalitlar engine.py da ishlatiladi."""
from __future__ import annotations

TEXTS: dict[str, dict[str, str]] = {
    'greeting': {
        'uz': "Salom, {name}! Men sizning ilmiy yordamchingizman. Maqola yuborish, antiplagiat, UDK, DOI, tarjima, kitob nashri, "
              "maqola namunasi, to'lovlar va maqolalaringiz holati — barchasini shu yerda bajaramiz. Nima qilamiz?",
        'ru': "Здравствуйте, {name}! Я ваш научный помощник. Отправка статьи, антиплагиат, УДК, DOI, перевод, издание книги, "
              "образец статьи, платежи и статус статей — всё делаем здесь. С чего начнём?",
        'en': "Hello, {name}! I'm your research assistant. Article submission, plagiarism check, UDC, DOI, translation, book "
              "publishing, article samples, payments and article status — all right here. What shall we do?",
    },
    'help': {
        'uz': "Men quyidagilarni qila olaman:\n• faylingizdan sarlavha, annotatsiya va kalit so'zlarni olib, kerakli formani to'ldiraman;\n"
              "• mos jurnal tavsiya qilaman va narxni oldindan aytaman;\n• maqolalaringiz qaysi bosqichda ekanini, to'lovlaringizni ko'rsataman.\n"
              "To'lov va yuborishni doim o'zingiz tasdiqlaysiz — men faqat tayyorlab beraman.",
        'ru': "Я умею:\n• брать из файла название, аннотацию и ключевые слова и заполнять нужную форму;\n"
              "• подбирать журнал и заранее называть цену;\n• показывать этапы ваших статей и платежи.\n"
              "Оплату и отправку вы всегда подтверждаете сами — я только готовлю.",
        'en': "I can:\n• take the title, abstract and keywords from your file and fill in the right form;\n"
              "• suggest a suitable journal and quote the price up front;\n• show the stage of your articles and your payments.\n"
              "You always confirm payments and submissions yourself — I only prepare them.",
    },
    'thanks': {'uz': "Arzimaydi! Yana nima qilamiz?", 'ru': "Пожалуйста! Что ещё сделаем?", 'en': "You're welcome! What next?"},
    'cancel': {'uz': "Bekor qilindi. Boshqa ish bormi?", 'ru': "Отменено. Что-нибудь ещё?", 'en': "Cancelled. Anything else?"},
    'not_understood': {
        'uz': "Kechirasiz, tushunmadim. Masalan: «maqolamni antiplagiatdan o'tkaz», «UDK olib ber», «maqolam qayerda?». "
              "Yoki faylni biriktiring — nima qilish kerakligini taklif qilaman.",
        'ru': "Извините, не понял. Например: «проверь статью на антиплагиат», «нужен УДК», «где моя статья?». "
              "Или прикрепите файл — я предложу варианты.",
        'en': "Sorry, I didn't get that. For example: \"check my article for plagiarism\", \"get me a UDC\", \"where is my article?\". "
              "Or attach a file and I'll suggest what to do.",
    },
    'file_what': {
        'uz': "«{title}» faylini o'qidim ({words} so'z, ~{pages} bet). Bu hujjat bilan nima qilamiz?",
        'ru': "Прочитал файл «{title}» ({words} слов, ~{pages} стр.). Что сделаем с этим документом?",
        'en': "I read \"{title}\" ({words} words, ~{pages} pages). What should we do with it?",
    },
    'file_unreadable': {
        'uz': "Fayldan matnni o'qib bo'lmadi (skanerlangan PDF bo'lishi mumkin). Maydonlarni o'zingiz to'ldirasiz, fayl esa formaga biriktiriladi.",
        'ru': "Не удалось прочитать текст файла (возможно, это скан). Поля заполните вручную, файл будет прикреплён к форме.",
        'en': "I couldn't read text from the file (it may be a scan). Please fill the fields yourself; the file will be attached to the form.",
    },
    'action_ready': {
        'uz': "{label} formasini o'ngda tayyorladim{filled}. Tekshirib, tasdiqlang.",
        'ru': "Подготовил форму «{label}» справа{filled}. Проверьте и подтвердите.",
        'en': "I've prepared the {label} form on the right{filled}. Please review and confirm.",
    },
    'filled_suffix': {'uz': " — {n} ta maydon to'ldirildi", 'ru': " — заполнено полей: {n}", 'en': " — {n} fields filled"},
    'need_file': {
        'uz': "Faylni biriktiring (📎) — sarlavha va boshqa maydonlarni o'zim to'ldiraman.",
        'ru': "Прикрепите файл (📎) — остальные поля я заполню сам.",
        'en': "Attach the file (📎) and I'll fill in the rest.",
    },
    'missing': {'uz': "Yana kerak: {items}.", 'ru': "Ещё нужно: {items}.", 'en': "Still needed: {items}."},
    'price': {'uz': "Narx: {amount} so'm{note}.", 'ru': "Цена: {amount} сум{note}.", 'en': "Price: {amount} UZS{note}."},
    'journal_pick': {
        'uz': "Mos jurnallar quyida — birini tanlang.",
        'ru': "Подходящие журналы ниже — выберите один.",
        'en': "Suitable journals are below — pick one.",
    },
    'journal_limit': {
        'uz': "Diqqat: bu jurnalda plagiat chegarasi {limit}%. Yuborishdan oldin antiplagiatdan o'tkazishni tavsiya qilaman.",
        'ru': "Внимание: порог плагиата в этом журнале — {limit}%. Рекомендую сначала проверить на антиплагиат.",
        'en': "Note: this journal's plagiarism limit is {limit}%. I recommend running a plagiarism check first.",
    },
    'queue_next': {
        'uz': "Keyingi navbatda: {label}. Tayyor bo'lsangiz «davom et» deb yozing.",
        'ru': "Следующее: {label}. Напишите «дальше», когда будете готовы.",
        'en': "Next up: {label}. Type \"continue\" when ready.",
    },
    'status_none': {
        'uz': "Sizda hali maqola yo'q. Birinchi maqolani yuboramizmi?",
        'ru': "У вас пока нет статей. Отправим первую?",
        'en': "You have no articles yet. Shall we submit the first one?",
    },
    'status_list': {
        'uz': "Maqolalaringiz holati:", 'ru': "Статус ваших статей:", 'en': "Your articles:",
    },
    'status_one': {
        'uz': "«{title}» — {status}. {hint}", 'ru': "«{title}» — {status}. {hint}", 'en': "\"{title}\" — {status}. {hint}",
    },
    'payments': {
        'uz': "To'lovlaringiz: kutilayotgan — {pending} ta. Cheklarni «To'lovlarim» sahifasida yuklab olasiz.",
        'ru': "Ваши платежи: ожидают — {pending}. Чеки можно скачать на странице «Мои платежи».",
        'en': "Your payments: {pending} pending. Receipts are on the Payments page.",
    },
    'prices': {'uz': "Asosiy xizmatlar narxi:", 'ru': "Цены основных услуг:", 'en': "Service prices:"},
    'open_page': {'uz': "{label} sahifasini o'ngda ochdim.", 'ru': "Открыл справа страницу «{label}».", 'en': "Opened {label} on the right."},
    'operator': {
        'uz': "Operator bilan maqola bo'yicha yozishish uchun maqolani oching — pastda «Operator chat» bor. "
              "Umumiy savollar uchun: {contacts}.",
        'ru': "Чтобы написать оператору по статье, откройте статью — внизу есть «Чат с оператором». "
              "По общим вопросам: {contacts}.",
        'en': "To message an operator about an article, open the article — there's an operator chat at the bottom. "
              "General questions: {contacts}.",
    },
}

LABELS = {
    'submit_article': {'uz': "Maqolani jurnalga yuborish", 'ru': 'Отправка статьи в журнал', 'en': 'Journal submission'},
    'plagiarism_check': {'uz': 'Antiplagiat tekshiruvi', 'ru': 'Проверка на антиплагиат', 'en': 'Plagiarism check'},
    'udk': {'uz': 'UDK olish', 'ru': 'Получение УДК', 'en': 'UDC request'},
    'doi': {'uz': 'DOI olish', 'ru': 'Получение DOI', 'en': 'DOI request'},
    'translation': {'uz': 'Ilmiy tarjima', 'ru': 'Научный перевод', 'en': 'Scientific translation'},
    'book': {'uz': 'Kitob nashr etish', 'ru': 'Издание книги', 'en': 'Book publishing'},
    'article_sample': {'uz': 'Maqola namunasi', 'ru': 'Образец статьи', 'en': 'Article sample'},
    'articles': {'uz': 'Maqolalarim', 'ru': 'Мои статьи', 'en': 'My articles'},
    'payments': {'uz': "To'lovlarim", 'ru': 'Мои платежи', 'en': 'Payments'},
    'archive': {'uz': 'Arxiv hujjatlar', 'ru': 'Архив документов', 'en': 'Document archive'},
    'profile': {'uz': 'Profil', 'ru': 'Профиль', 'en': 'Profile'},
}

FIELD_LABELS = {
    'title': {'uz': 'sarlavha', 'ru': 'название', 'en': 'title'},
    'abstract': {'uz': 'annotatsiya', 'ru': 'аннотация', 'en': 'abstract'},
    'journalId': {'uz': 'jurnal', 'ru': 'журнал', 'en': 'journal'},
    'file': {'uz': 'fayl', 'ru': 'файл', 'en': 'file'},
    'documentType': {'uz': 'hujjat turi', 'ru': 'тип документа', 'en': 'document type'},
    'targetLang': {'uz': 'qaysi tilga', 'ru': 'язык перевода', 'en': 'target language'},
    'pages': {'uz': 'betlar soni', 'ru': 'количество страниц', 'en': 'page count'},
    'copies': {'uz': 'nusxalar soni', 'ru': 'количество экземпляров', 'en': 'number of copies'},
    'topic': {'uz': 'mavzu', 'ru': 'тема', 'en': 'topic'},
    'language': {'uz': 'til', 'ru': 'язык', 'en': 'language'},
    'structure': {'uz': 'tuzilish', 'ru': 'структура', 'en': 'structure'},
    'articleType': {'uz': 'maqola turi', 'ru': 'тип статьи', 'en': 'article type'},
    'shippingRegion': {'uz': 'viloyat', 'ru': 'регион', 'en': 'region'},
}

SUGGESTIONS = {
    'start': {
        'uz': ["Maqolamni jurnalga yuborish", "Antiplagiatdan o'tkazish", "Maqolalarim qayerda?", "UDK olish", "Narxlar"],
        'ru': ["Отправить статью в журнал", "Проверить на антиплагиат", "Где мои статьи?", "Получить УДК", "Цены"],
        'en': ["Submit an article", "Run a plagiarism check", "Where are my articles?", "Get a UDC", "Prices"],
    },
    'file': {
        'uz': ["Antiplagiatdan o'tkazish", "Jurnalga yuborish", "UDK olish", "DOI olish", "Tarjima qilish"],
        'ru': ["Проверить на антиплагиат", "Отправить в журнал", "Получить УДК", "Получить DOI", "Перевести"],
        'en': ["Plagiarism check", "Submit to a journal", "Get a UDC", "Get a DOI", "Translate"],
    },
    'continue': {'uz': ["Davom et"], 'ru': ["Дальше"], 'en': ["Continue"]},
}


def say(key: str, lang: str, **kw) -> str:
    row = TEXTS[key]
    text = row.get(lang) or row['uz']
    try:
        return text.format(**kw)
    except (KeyError, IndexError):
        return text


def label(key: str, lang: str) -> str:
    row = LABELS.get(key) or {}
    return row.get(lang) or row.get('uz') or key


def field_label(key: str, lang: str) -> str:
    row = FIELD_LABELS.get(key) or {}
    return row.get(lang) or row.get('uz') or key


def suggestions(key: str, lang: str) -> list[str]:
    row = SUGGESTIONS[key]
    return list(row.get(lang) or row['uz'])
