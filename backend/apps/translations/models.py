from django.db import models
from config.uploads import RandomizedUploadPath
from django.conf import settings
import uuid


class TranslationRequest(models.Model):
    """Translation request model"""
    
    # Tarjima turi: oddiy va o'rta — AI bajaradi (to'lovdan keyin avtomatik), puxta — tarjimon qo'lda
    QUALITY_BASIC = 'basic'
    QUALITY_STANDARD = 'standard'
    QUALITY_EXPERT = 'expert'
    QUALITY_CHOICES = (
        (QUALITY_BASIC, 'Oddiy tarjima (AI)'),
        (QUALITY_STANDARD, "O'rta tarjima (AI)"),
        (QUALITY_EXPERT, 'Puxta tarjima (tarjimon)'),
    )
    AI_QUALITIES = frozenset({QUALITY_BASIC, QUALITY_STANDARD})

    STATUS_CHOICES = (
        ('Yangi', 'Yangi'),
        ('Jarayonda', 'Jarayonda'),
        ('Bajarildi', 'Bajarildi'),
        ('BekorQilindi', 'Bekor Qilindi'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='translation_requests')
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_translations')
    
    title = models.CharField(max_length=500)
    source_language = models.CharField(max_length=50)
    target_language = models.CharField(max_length=50)
    source_file_path = models.FileField(upload_to=RandomizedUploadPath('translations/source'))
    translated_file_path = models.FileField(upload_to=RandomizedUploadPath('translations/translated'), blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Yangi')
    # Avvalgi buyurtmalar qo'lda bajarilgan — standart "puxta"
    quality = models.CharField(max_length=20, choices=QUALITY_CHOICES, default=QUALITY_EXPERT)
    # AI tarjima bajarilmasa — sababi; buyurtma tarjimonlar navbatiga o'tadi
    ai_error = models.CharField(max_length=500, blank=True)
    ai_model = models.CharField(max_length=100, blank=True)
    word_count = models.IntegerField(default=0)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    submission_date = models.DateTimeField(auto_now_add=True)
    completion_date = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-submission_date']
    
    @property
    def is_ai(self) -> bool:
        return self.quality in self.AI_QUALITIES

    def __str__(self):
        return f"{self.title} - {self.source_language} to {self.target_language}"
