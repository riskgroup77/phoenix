"""
Rukn (nashr turi) va soha ajratiladi:
- 30 ta soha (ScientificField) bazada bo'lishi ta'minlanadi (nashr turi rukni jurnal saqlanganda yaratiladi);
- rukni aslida soha bo'lgan jurnallarga (masalan "Iqtisodiyot") shu soha scientific_fields ga qo'shiladi.
"""
from django.db import migrations


def forwards(apps, schema_editor):
    from apps.journals.taxonomy import SUBJECT_AREAS, match_subject, norm

    ScientificField = apps.get_model('journals', 'ScientificField')
    Journal = apps.get_model('journals', 'Journal')

    fields = {norm(f.name): f for f in ScientificField.objects.all()}
    for name in SUBJECT_AREAS:
        if norm(name) not in fields:
            fields[norm(name)] = ScientificField.objects.create(name=name, is_active=True)

    for journal in Journal.objects.select_related('category'):
        area = match_subject(journal.category.name if journal.category_id else '')
        if area:
            journal.scientific_fields.add(fields[norm(area)])


class Migration(migrations.Migration):
    dependencies = [('journals', '0007_journal_fields_archive')]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
