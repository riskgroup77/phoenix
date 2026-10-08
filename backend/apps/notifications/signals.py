"""Yangi bildirishnoma → Telegram botga ham yuborish."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Notification
from .telegram import schedule_delivery


@receiver(post_save, sender=Notification)
def notification_to_telegram(sender, instance, created, **kwargs):
    from config.demo import is_seeding

    if created and not is_seeding():
        schedule_delivery(instance.pk)
