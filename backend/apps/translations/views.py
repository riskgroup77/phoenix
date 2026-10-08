from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import TranslationRequest
from .serializers import TranslationRequestSerializer
from .word_count import count_words_in_upload



class TranslationRequestViewSet(viewsets.ModelViewSet):
    queryset = TranslationRequest.objects.all()
    serializer_class = TranslationRequestSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        role = getattr(self.request.user, 'role', None) if self.request.user.is_authenticated else None
        if isinstance(role, str):
            role = role.strip().lower()
        if role in ('super_admin', 'reviewer') or (role == 'operator' and self.request.method in ('GET', 'HEAD', 'OPTIONS')):
            # Operator — faqat kuzatish (o'zgartirish update/destroy da rol bo'yicha taqiqlangan)
            return TranslationRequest.objects.select_related('author', 'reviewer').all()
        return TranslationRequest.objects.select_related('author', 'reviewer').filter(
            author=self.request.user
        )
    
    def _role(self):
        role = getattr(self.request.user, 'role', None) or ''
        return role.strip().lower() if isinstance(role, str) else role

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def update(self, request, *args, **kwargs):
        """Holat va tarjima faylini faqat taqrizchi (tarjimon) yoki bosh admin o'zgartiradi."""
        role = self._role()
        if role not in ('reviewer', 'super_admin') and not request.user.is_superuser:
            return Response({'detail': 'Tarjima so\'rovini faqat tarjimon o\'zgartira oladi.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        # Taqrizchi faqat o'zini tarjimon sifatida tayinlay oladi
        if self._role() == 'reviewer' and 'reviewer' in serializer.validated_data:
            serializer.save(reviewer=self.request.user)
        else:
            serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if self._role() != 'super_admin' and not request.user.is_superuser:
            if instance.author_id != request.user.id or instance.status != 'Yangi':
                return Response({'detail': 'Bu so\'rovni o\'chirib bo\'lmaydi.'}, status=status.HTTP_403_FORBIDDEN)
            from apps.payments.models import Transaction
            if Transaction.objects.filter(translation_request=instance, status='completed').exists():
                return Response({'detail': 'To\'lovi amalga oshirilgan so\'rovni o\'chirib bo\'lmaydi.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'])
    def analyze_file(self, request):
        """Analyze a file to determine word count"""
        if 'file' not in request.FILES:
            return Response({'error': 'Fayl taqdim etilmadi'}, status=status.HTTP_400_BAD_REQUEST)
            
        file_obj = request.FILES['file']
        from apps.udc.services import get_service_amount

        word_count, text_content, is_estimate = count_words_in_upload(file_obj)
        # Narx: har bir so‘z (ServicePrice: translation_per_word, default 100 so‘m)
        price_per_word = int(get_service_amount('translation_per_word', 100))
        payload = {
            'word_count': word_count,
            'cost': int(max(word_count, 0) * price_per_word),
            'price_per_word': price_per_word,
            'text_preview': (text_content[:500] if text_content else ''),
        }
        if is_estimate:
            payload['note'] = 'Hujjatdan matn ajratilmadi; fayl hajmi bo‘yicha taxminiy so‘zlar soni ishlatildi.'
        return Response(payload)
