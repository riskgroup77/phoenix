"""
Test sozlamalari (pytest.ini: DJANGO_SETTINGS_MODULE = config.settings_test).

Asosiy sozlamalar + tashqi xizmatlarsiz muhit: Redis, Celery, OpenSearch, web qidiruv va
haqiqiy to'lov kalitlari ishlatilmaydi. Lokal .env yoki CI muhitidan qat'i nazar bir xil ishlaydi.
"""
import os

os.environ.setdefault('SECRET_KEY', 'test-secret-key-for-pytest-only')

from .settings import *  # noqa: E402,F401,F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'test_db.sqlite3'),  # noqa: F405
    }
}

CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'phoenix-tests'}}

# Test client http orqali so'raydi
SECURE_SSL_REDIRECT = False

# Tezlik uchun (faqat testlarda!)
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Tashqi xizmatlar o'chirilgan
ANTIPLAG_USE_CELERY = False
ANTIPLAG_OPENSEARCH_ENABLED = False
ANTIPLAG_EMBEDDINGS_ENABLED = False
ANTIPLAG_CORE_API_KEY = ''
ANTIPLAG_SEMANTIC_SCHOLAR_API_KEY = ''
GOOGLE_CSE_API_KEY = ''
GOOGLE_CSE_CX = ''
BING_SEARCH_API_KEY = ''
ANTIPLAGIAT_API_ENABLED = False
ANTIPLAG_AUTO_INDEX = False
ANTIPLAG_INDEX_SYNC = True
ANTIPLAG_FULLTEXT_ENABLED = False
ANTIPLAG_WEB_FETCH_PAGES = 0
ANTIPLAG_OAI_SOURCES = []
GEMINI_API_KEY = ''
CELERY_BROKER_URL = 'memory://'
CELERY_RESULT_BACKEND = 'cache+memory://'

# Haqiqiy to'lov kalitlari testlarga tushmasin (kerakli testlar override_settings bilan beradi)
CLICK_SECRET_KEY = ''
CLICK_SERVICE_82154_SECRET_KEY = ''
CLICK_SERVICE_82155_SECRET_KEY = ''
CLICK_SERVICE_89248_SECRET_KEY = ''
CLICK_SERVICE_88045_SECRET_KEY = ''
PAYME_MERCHANT_ID = ''
PAYME_MERCHANT_KEY = ''
PAYME_TEST_KEY = ''

TELEGRAM_BOT_TOKEN = ''
TELEGRAM_NOTIFY_SYNC = True
CROSSREF_USERNAME = ''
CROSSREF_PASSWORD = ''

MEDIA_ROOT =os.path.join(BASE_DIR, 'test_media')  # noqa: F405
# Testlarda collectstatic qilinmaydi — manifest talab qilmaydigan statik saqlash
STORAGES = {
    'default': {'BACKEND': 'config.media_protection.ProtectedMediaStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
