# Tarjima turlari bo'yicha so'z narxi: oddiy va o'rta (AI) — yangi; puxta — avvalgi translation_per_word
from django.db import migrations

PRICES = (
    ('translation_per_word_basic', "Tarjima — oddiy, AI (1 so'z)", 30),
    ('translation_per_word_standard', "Tarjima — o'rta, AI (1 so'z)", 60),
)


def add_prices(apps, schema_editor):
    ServicePrice = apps.get_model('udc', 'ServicePrice')
    for key, label, amount in PRICES:
        ServicePrice.objects.get_or_create(service_key=key, defaults={'label': label, 'amount': amount, 'currency': 'UZS'})
    ServicePrice.objects.filter(service_key='translation_per_word').update(label="Tarjima — puxta, tarjimon (1 so'z)")


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('udc', '0012_udk_request_auto'),
    ]

    operations = [
        migrations.RunPython(add_prices, noop),
    ]
