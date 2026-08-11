from rest_framework import serializers
from .models import Transaction


class TransactionSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    udk_certificate_url = serializers.SerializerMethodField()
    journal_name = serializers.SerializerMethodField()
    article_title = serializers.SerializerMethodField()
    context_label = serializers.SerializerMethodField()
    
    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = (
            'id', 'created_at', 'completed_at', 'user', 'status',
            'click_trans_id', 'click_paydoc_id', 'merchant_trans_id', 'click_service_id',
            'payme_trans_id', 'payme_time', 'payment_provider', 'error_note', 'receipt_path',
        )
    
    def get_user_name(self, obj):
        return obj.user.get_full_name()
    
    def _extra_data(self, obj):
        raw = getattr(obj, 'extra_data', None)
        return raw if isinstance(raw, dict) else {}

    def get_journal_name(self, obj):
        article = getattr(obj, 'article', None)
        if article is not None and getattr(article, 'journal_id', None):
            journal = getattr(article, 'journal', None)
            if journal is not None:
                name = (getattr(journal, 'name', None) or '').strip()
                if name:
                    return name
        extra = self._extra_data(obj)
        for key in ('journal_name', 'journal'):
            val = extra.get(key)
            if val and isinstance(val, str) and val.strip():
                return val.strip()
        return ''

    def get_article_title(self, obj):
        article = getattr(obj, 'article', None)
        if article is not None:
            title = (getattr(article, 'title', None) or '').strip()
            if title:
                return title[:200]
        tr = getattr(obj, 'translation_request', None)
        if tr is not None:
            title = (getattr(tr, 'title', None) or '').strip()
            if title:
                return title[:200]
        extra = self._extra_data(obj)
        for key in ('book_title', 'topic', 'title', 'document_name'):
            val = extra.get(key)
            if val and str(val).strip():
                return str(val).strip()[:200]
        return ''

    def get_context_label(self, obj):
        """Buxgalteriya uchun qisqa izoh: jurnal + maqola/buyurtma."""
        journal = self.get_journal_name(obj)
        title = self.get_article_title(obj)
        if journal and title:
            return f'{journal} — {title}'
        if journal:
            return journal
        if title:
            return title
        st = getattr(obj, 'service_type', '') or ''
        labels = {
            'udk_request': "UDK ma'lumotnoma",
            'doi_request': 'DOI so\'rovi',
            'article_sample': 'Maqola namuna',
            'book_publication': 'Kitob nashri',
            'translation': 'Tarjima buyurtmasi',
            'top_up': 'Hisob to\'ldirish',
        }
        return labels.get(st, '')
    
    def get_udk_certificate_url(self, obj):
        if getattr(obj, 'service_type', None) != 'udk_request' or not obj.article_id:
            return None
        article = getattr(obj, 'article', None)
        if not article or not article.udk_certificate_path:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(article.udk_certificate_path.url)
        from django.conf import settings
        base = getattr(settings, 'MEDIA_URL', '/media/').rstrip('/')
        path = str(article.udk_certificate_path).lstrip('/')
        return f"{base}/{path}" if path else None


class CreateTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ('article', 'translation_request', 'amount', 'currency', 'service_type', 'extra_data')
        extra_kwargs = {
            'article': {'required': False, 'allow_null': True},
            'translation_request': {'required': False, 'allow_null': True},
            'currency': {'required': False},
            'amount': {'required': True},
            'service_type': {'required': True},
            'extra_data': {'required': False, 'allow_null': True},
        }

    def validate(self, attrs):
        """Set default currency if not provided"""
        if 'currency' not in attrs or not attrs['currency']:
            attrs['currency'] = 'UZS'
        if 'extra_data' not in attrs:
            attrs['extra_data'] = {}
        return attrs
