"""UDK kitobi asosidagi klassifikatorni (data/udk_ozbek.json) bazaga yuklash."""
from django.db import migrations


def load(apps, schema_editor):
    from apps.udc.catalog import load_catalog

    load_catalog(apps.get_model('udc', 'UdcClass'))


def unload(apps, schema_editor):
    apps.get_model('udc', 'UdcClass').objects.filter(source='book').delete()


class Migration(migrations.Migration):
    dependencies = [('udc', '0010_udc_class')]
    operations = [migrations.RunPython(load, unload)]
