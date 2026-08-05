from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('articles', '0011_article_co_authors'),
    ]

    operations = [
        migrations.AddField(
            model_name='article',
            name='submitted_author_name',
            field=models.CharField(blank=True, max_length=300),
        ),
        migrations.AddField(
            model_name='article',
            name='bibliography',
            field=models.TextField(blank=True),
        ),
    ]
