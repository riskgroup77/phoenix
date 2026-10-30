from django.conf import settings
from rest_framework import serializers
import json
import re

from .models import Journal, JournalCategory, Issue, ScientificField
from .taxonomy import is_publication_type, match_subject


class JournalCategorySerializer(serializers.ModelSerializer):
    # type — nashr turi (OAK/xalqaro/konferensiya...); subject — eski "soha" rukni (endi soha alohida maydon)
    kind = serializers.SerializerMethodField()

    class Meta:
        model = JournalCategory
        fields = '__all__'

    def get_kind(self, obj):
        if is_publication_type(obj.name):
            return 'type'
        return 'subject' if match_subject(obj.name) else 'other'


class IssueSerializer(serializers.ModelSerializer):
    journal_name = serializers.SerializerMethodField()
    articles = serializers.SerializerMethodField()
    collection_file_url = serializers.SerializerMethodField()

    class Meta:
        model = Issue
        fields = '__all__'
        extra_kwargs = {'collection_url': {'allow_blank': True, 'required': False}}

    def get_journal_name(self, obj):
        return obj.journal.name

    def get_articles(self, obj):
        """Article IDs in this issue (for author's To'plamlarim filter)."""
        return list(obj.articles.values_list('id', flat=True))

    def get_collection_file_url(self, obj):
        """Full URL to download the admin-uploaded collection file."""
        if not obj.collection_file:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.collection_file.url)
        base = getattr(settings, 'MEDIA_URL', '/media/').rstrip('/')
        return f"{base}{obj.collection_file.url}" if obj.collection_file.url else None


class JournalSerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()
    admin_name = serializers.SerializerMethodField()
    issues = IssueSerializer(many=True, read_only=True)
    additional_document_config = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    # Bosh admin o'chirishdan oldin ko'radi: maqolasi bor jurnal o'chirilmaydi — arxivlanadi
    articles_count = serializers.SerializerMethodField()
    # Soha (fan yo'nalishlari) — rukndan alohida, bir nechta bo'lishi mumkin
    scientific_fields = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=ScientificField.objects.all(),
    )
    scientific_field_names = serializers.SerializerMethodField()

    class Meta:
        model = Journal
        fields = '__all__'
        read_only_fields = ('is_archived',)
        # Standart (inglizcha) unique xabari o'rniga validate_issn — o'zbekcha va bo'sh qiymat NULL bo'ladi
        extra_kwargs = {'issn': {'validators': []}}

    ISSN_RE = re.compile(r'^\d{4}-\d{3}[\dXx]$')

    def validate_issn(self, value):
        """
        ISSN ixtiyoriy: bo'sh → NULL (bir nechta ISSN'siz jurnal bo'lishi mumkin). Kiritilgan bo'lsa — XXXX-XXXX
        formatida va boshqa jurnalda ishlatilmagan bo'lishi kerak. Mavjud jurnalning o'zgarmagan ISSN'i
        (eski / ichki qiymatlar) qayta tekshirilmaydi.
        """
        value = (value or '').strip().upper()
        if not value:
            return None
        if self.instance is not None and value == (self.instance.issn or '').upper():
            return self.instance.issn
        if not self.ISSN_RE.match(value):
            raise serializers.ValidationError("ISSN XXXX-XXXX formatida bo'lishi kerak (masalan, 2181-0001).")
        clash = Journal.objects.filter(issn__iexact=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("Bu ISSN boshqa jurnalda allaqachon ishlatilgan.")
        return value

    def validate_country(self, value):
        return ' '.join((value or '').split())[:100]

    @staticmethod
    def _normalize_website(data):
        # "jurnal.uz" kabi sxemasiz manzil — https:// qo'shiladi (URLField sxemasiz qiymatni rad etadi)
        site = str(data.get('website') or '').strip()
        if site and '://' not in site:
            data['website'] = f'https://{site}'
        elif 'website' in data:
            data['website'] = site

    # FormData (rasm bilan) yuborilganda ro'yxat/obyektlar JSON satr bo'lib keladi
    JSON_FIELDS = ('scientific_fields', 'additional_document_config')

    def to_internal_value(self, data):
        if hasattr(data, 'getlist'):
            plain = {}
            for key in data.keys():
                values = data.getlist(key)
                plain[key] = values if (key == 'scientific_fields' and len(values) > 1) else values[-1]
            data = plain
        else:
            data = dict(data)
        for key in self.JSON_FIELDS:
            raw = data.get(key)
            if isinstance(raw, str) and raw.strip()[:1] in '[{':
                try:
                    data[key] = json.loads(raw)
                except ValueError:
                    pass
        self._normalize_website(data)
        if data.get('scientific_fields') in ('', None):
            data.pop('scientific_fields', None)
        # Rasm SerializerMethodField orqali chiqadi (absolyut URL) — fayl alohida saqlanadi (views.perform_*)
        data.pop('image_url', None)
        config = data.pop('additional_document_config', None)
        # Rukn nomi bilan tanlash (8 ta nashr turi — bazada hali bo'lmasa yaratiladi)
        category_name = str(data.pop('category_name', '') or '').strip()
        if category_name and not data.get('category'):
            data['category'] = str(self._category_by_name(category_name).pk)
        validated = super().to_internal_value(data)
        if isinstance(config, dict):
            validated['additional_doc_required'] = bool(config.get('required'))
            validated['additional_doc_label'] = str(config.get('label') or '')[:200]
            if config.get('type') in ('file', 'link'):
                validated['additional_doc_type'] = config['type']
        elif 'additional_document_config' in getattr(self, 'initial_data', {}) and config is None:
            validated['additional_doc_required'] = False
        return validated

    @staticmethod
    def _category_by_name(name: str) -> JournalCategory:
        from .taxonomy import norm

        for cat in JournalCategory.objects.all():
            if norm(cat.name) == norm(name):
                return cat
        return JournalCategory.objects.create(name=name[:200])

    def get_scientific_field_names(self, obj):
        return [f.name for f in obj.scientific_fields.all()]

    def get_articles_count(self, obj):
        return obj.articles.count()
    
    def get_image_url(self, obj):
        if not obj.image_url:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.image_url.url)
        return obj.image_url.url
    
    def get_category_name(self, obj):
        return obj.category.name
    
    def get_admin_name(self, obj):
        return obj.journal_admin.get_full_name()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        from config.demo import is_demo_journal

        # Namuna (demo skript) jurnali — haqiqiy mualliflarga ko'rsatilmaydi; admin panelida belgi uchun
        data['is_sample'] = is_demo_journal(instance)
        return data
    
    def get_additional_document_config(self, obj):
        if obj.additional_doc_required:
            return {
                'required': obj.additional_doc_required,
                'label': obj.additional_doc_label,
                'type': obj.additional_doc_type
            }
        return None
