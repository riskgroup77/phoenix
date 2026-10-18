from django.db import models
from django.conf import settings
import uuid


class Notification(models.Model):
    """Notification model"""

    TYPE_CHOICES = (
        ('status_change', 'Status o\'zgarishi'),
        ('review_assigned', 'Taqriz tayinlandi'),
        ('review_completed', 'Taqriz yakunlandi'),
        ('payment', 'To\'lov'),
        ('plagiarism', 'Antiplagiat'),
        ('system', 'Tizim'),
        ('article', 'Maqola'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    title = models.CharField(max_length=255, default='Bildirishnoma')
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='system')
    link = models.CharField(max_length=500, blank=True)
    read = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.message[:50]}"

    @classmethod
    def notify(cls, user, title, message, notification_type='system', link='', metadata=None):
        """Helper to create a notification quickly."""
        return cls.objects.create(
            user=user,
            title=title,
            message=message,
            notification_type=notification_type,
            link=link,
            metadata=metadata or {},
        )


class BroadcastLog(models.Model):
    """Telegram bot orqali yuborilgan ommaviy reklama xabari (/reklama) jurnali."""

    STATUS_CHOICES = (
        ('running', 'Yuborilmoqda'),
        ('done', 'Yakunlandi'),
        ('failed', 'Xato bilan tugadi'),
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='broadcasts',
    )
    created_by_telegram_id = models.BigIntegerField(null=True, blank=True)
    text_preview = models.CharField(max_length=500, blank=True)
    content_type = models.CharField(max_length=30, blank=True)
    button_text = models.CharField(max_length=64, blank=True)
    button_url = models.URLField(max_length=500, blank=True)
    total = models.PositiveIntegerField(default=0)
    sent_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='running')
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Reklama xabari'
        verbose_name_plural = 'Reklama xabarlari'

    def __str__(self):
        return f'Reklama #{self.pk} ({self.sent_count}/{self.total})'
