# Kitob nashri kalkulyatori narxlari — «Narxlar» sahifasida o'zgartiriladi (avval kodga qotirilgan edi)
from django.db import migrations


def add_prices(apps, schema_editor):
    from apps.payments.pricing import book_price_defaults

    ServicePrice = apps.get_model('udc', 'ServicePrice')
    for key, label, amount in book_price_defaults():
        ServicePrice.objects.get_or_create(service_key=key, defaults={'label': label, 'amount': amount, 'currency': 'UZS'})


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('udc', '0013_translation_ai_prices'),
    ]

    operations = [
        migrations.RunPython(add_prices, noop),
    ]
