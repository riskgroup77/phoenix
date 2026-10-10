"""Muallif AI yordamchisi suhbatlari (faqat egasi ko'radi)."""
import uuid

from django.conf import settings
from django.db import models


class AssistantConversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assistant_conversations')
    title = models.CharField(max_length=120, blank=True)
    # Yordamchi holati: faol xizmat va uning maydonlari, navbat, oxirgi fayl tahlili (fayl o'zi saqlanmaydi)
    state = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'AI suhbat'
        verbose_name_plural = 'AI suhbatlar'

    def __str__(self):
        return f'{self.user_id}: {self.title or self.pk}'


class AssistantMessage(models.Model):
    ROLE_CHOICES = (('user', 'Muallif'), ('assistant', 'Yordamchi'))

    conversation = models.ForeignKey(AssistantConversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    text = models.TextField(blank=True)
    # Yordamchi javobi: action / cards / suggestions; muallif xabari: biriktirilgan fayl nomi
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
        verbose_name = 'AI xabar'
        verbose_name_plural = 'AI xabarlar'
