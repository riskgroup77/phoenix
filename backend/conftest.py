import os

# Asosiy sozlama pytest.ini da: config.settings_test (tashqi xizmatlarsiz).
# pytest-django sozlamalarni conftest'dan OLDIN yuklashi mumkin — shuning uchun muhit
# sozlamalari bu yerda emas, config/settings_test.py da.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings_test')
