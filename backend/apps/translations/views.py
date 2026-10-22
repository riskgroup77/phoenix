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
        from django.db.models import Q

        role = getattr(self.request.user, 'role', None) if self.request.user.is_authenticated else None
        if isinstance(role, str):
            role = role.strip().lower()
        base = TranslationRequest.objects.select_related('author', 'reviewer')
        if role == 'translator':
            # Tarjimon: to'langan (yoki bepul) puxta buyurtmalar + AI bajara olmaganlari + o'ziga biriktirilganlar.
            # AI bajarayotgan oddiy/o'rta buyurtmalar uning navbatiga tushmaydi.
            paid = Q(cost__lte=0) | Q(transactions__service_type='translation', transactions__status='completed')
            manual = Q(quality=TranslationRequest.QUALITY_EXPERT) | ~Q(ai_error='')
            return base.filter((paid & manual) | Q(reviewer=self.request.user)).distinct()
        if role == 'reviewer':
            # Avval tarjimani taqrizchi bajarardi — endi tarjimon roli; taqrizchiga faqat o'zi olgan eski buyurtmalar
            return base.filter(reviewer=self.request.user)
        if role in ('super_admin',) or (role == 'operator' and self.request.method in ('GET', 'HEAD', 'OPTIONS')):
            # Operator — faqat kuzatish (o'zgartirish update/destroy da rol bo'yicha taqiqlangan)
            return TranslationRequest.objects.select_related('author', 'reviewer').all()
        return TranslationRequest.objects.select_related('author', 'reviewer').filter(
            author=self.request.user
        )
    
    def _role(self):
        role = getattr(self.request.user, 'role', None) or ''
        return role.strip().lower() if isinstance(role, str) else role

    def perform_create(self, serializer):
        request = serializer.save(author=self.request.user)
        if request.cost <= 0:
            # Bepul buyurtma to'lovsiz ishga tushadi (pullik — to'lov tasdiqlanganda, payments.fulfillment)
            from .fulfill import start_translation_work

            start_translation_work(request)

    def update(self, request, *args, **kwargs):
        """Holat va tarjima faylini faqat tarjimon (yoki o'zi olgan eski buyurtmada taqrizchi) va bosh admin o'zgartiradi."""
        role = self._role()
        if role not in ('translator', 'reviewer', 'super_admin') and not request.user.is_superuser:
            return Response({'detail': 'Tarjima so\'rovini faqat tarjimon o\'zgartira oladi.'}, status=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        if role in ('translator', 'reviewer') and instance.reviewer_id not in (None, request.user.id):
            return Response({'detail': 'Bu buyurtmani boshqa tarjimon bajarmoqda.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        # Tarjimon faqat o'zini bajaruvchi sifatida tayinlay oladi
        if self._role() in ('translator', 'reviewer') and 'reviewer' in serializer.validated_data:
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
        from .pricing import all_prices

        word_count, text_content, is_estimate = count_words_in_upload(file_obj)
        # Narx: har bir so'z × tarjima turi narxi (ServicePrice; bosh admin «Narxlar» da o'zgartiradi)
        prices = all_prices()
        words = max(word_count, 0)
        payload = {
            'word_count': word_count,
            # Eski mijozlar uchun: puxta (avvalgi yagona tur) narxi
            'cost': words * prices[TranslationRequest.QUALITY_EXPERT],
            'price_per_word': prices[TranslationRequest.QUALITY_EXPERT],
            'qualities': [
                {'quality': q, 'label': label, 'price_per_word': prices[q], 'cost': words * prices[q],
                 'is_ai': q in TranslationRequest.AI_QUALITIES}
                for q, label in TranslationRequest.QUALITY_CHOICES
            ],
            'text_preview': (text_content[:500] if text_content else ''),
        }
        if is_estimate:
            payload['note'] = 'Hujjatdan matn ajratilmadi; fayl hajmi bo‘yicha taxminiy so‘zlar soni ishlatildi.'
        return Response(payload)
