from decimal import Decimal

from rest_framework import serializers
from apps.payments.models import Transaction
from .models import TranslationRequest


def _cost_requires_payment(cost) -> bool:
    try:
        return Decimal(str(cost or 0)) > 0
    except Exception:
        return False


class TranslationRequestSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    reviewer_name = serializers.SerializerMethodField()
    payment_completed = serializers.SerializerMethodField()
    payment_pending = serializers.SerializerMethodField()
    payment_status_label = serializers.SerializerMethodField()

    class Meta:
        model = TranslationRequest
        fields = (
            'id',
            'author',
            'reviewer',
            'title',
            'source_language',
            'target_language',
            'source_file_path',
            'translated_file_path',
            'status',
            'word_count',
            'cost',
            'submission_date',
            'completion_date',
            'author_name',
            'reviewer_name',
            'payment_completed',
            'payment_pending',
            'payment_status_label',
        )
        read_only_fields = (
            'id',
            'submission_date',
            'author',
            'word_count',
            'cost',
            'payment_completed',
            'payment_pending',
            'payment_status_label',
        )

    def validate(self, attrs):
        """
        So'zlar soni va narx FAYLDAN server tomonida hisoblanadi — mijoz yuborgan
        word_count/cost e'tiborsiz qoldiriladi (aks holda word_count=1 bilan 100 so'mga tarjima mumkin edi).
        """
        from apps.udc.services import get_service_amount

        from .word_count import count_words_in_upload

        if getattr(self, 'instance', None) is None:
            source = attrs.get('source_file_path')
            if not source:
                raise serializers.ValidationError({'source_file_path': 'Tarjima uchun fayl majburiy.'})
            word_count, _text, _is_estimate = count_words_in_upload(source)
            rate = float(get_service_amount('translation_per_word', 100))
            attrs['word_count'] = word_count
            attrs['cost'] = Decimal(str(int(word_count * rate)))
            # Yangi so'rov har doim "Yangi" holatda, taqrizchisiz boshlanadi
            attrs['status'] = 'Yangi'
            attrs.pop('reviewer', None)
            attrs.pop('translated_file_path', None)
            attrs.pop('completion_date', None)
        return attrs
    
    def get_author_name(self, obj):
        return obj.author.get_full_name()
    
    def get_reviewer_name(self, obj):
        return obj.reviewer.get_full_name() if obj.reviewer else None

    def get_payment_completed(self, obj):
        if not _cost_requires_payment(obj.cost):
            return True
        return Transaction.objects.filter(
            translation_request_id=obj.pk,
            service_type='translation',
            status='completed',
        ).exists()

    def get_payment_pending(self, obj):
        if not _cost_requires_payment(obj.cost):
            return False
        return Transaction.objects.filter(
            translation_request_id=obj.pk,
            service_type='translation',
            status='pending',
        ).exists()

    def get_payment_status_label(self, obj):
        if not _cost_requires_payment(obj.cost):
            return "To'lov talab qilinmaydi (narxi 0)"
        qs = Transaction.objects.filter(
            translation_request_id=obj.pk,
            service_type='translation',
        )
        if qs.filter(status='completed').exists():
            return "To'lov tasdiqlangan"
        if qs.filter(status='pending').exists():
            return "To'lov kutilmoqda — muallif Click/Payme orqali to'laydi"
        if qs.filter(status__in=('failed', 'cancelled')).exists():
            return "Oxirgi to'lov yakunlanmagan — qayta urinish kerak"
        return "To'lov qilinmagan — muallif «Xizmatlar → Tarjima»da to'lovni yakunlashi kerak"
