# Generated manually for AntiplagCorpusDocument

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('articles', '0012_article_submitted_author_bibliography'),
    ]

    operations = [
        migrations.CreateModel(
            name='AntiplagCorpusDocument',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('external_key', models.CharField(db_index=True, max_length=160, unique=True)),
                ('title', models.CharField(max_length=500)),
                ('full_text', models.TextField()),
                ('source_url', models.URLField(blank=True, max_length=500)),
                (
                    'source_type',
                    models.CharField(
                        choices=[
                            ('import', 'Import (JSON/CSV)'),
                            ('natlib', 'Milliy kutubxona'),
                            ('otm', 'OTM arxivi'),
                            ('journal', 'Jurnal arxivi'),
                            ('other', 'Boshqa'),
                        ],
                        default='import',
                        max_length=40,
                    ),
                ),
                ('author_names', models.CharField(blank=True, max_length=300)),
                ('language', models.CharField(default='uz', max_length=12)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'author_user',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='antiplag_corpus_documents',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'verbose_name': 'Antiplagiat korpus hujjati',
                'verbose_name_plural': 'Antiplagiat korpus hujjatlari',
                'ordering': ['-updated_at'],
            },
        ),
    ]
