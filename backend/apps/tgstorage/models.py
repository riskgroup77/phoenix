"""
Telegram kanalida saqlangan fayllar: media (yuklangan fayllar) va baza zaxiralari.

Har bir yozuv — kanaldagi bitta xabar. file_id faqat uni yuklagan botda ishonchli ishlaydi, shuning uchun
bot_id ham saqlanadi; bot almashsa fayl chat_id + message_id orqali (forward) qayta olinadi.
Katta zaxira 2 GB dan oshsa bo'laklarga bo'linadi: bir xil name, part = 0..parts_total-1.
"""
from django.db import models


class TelegramStoredFile(models.Model):
    KIND_MEDIA = 'media'
    KIND_BACKUP = 'backup'
    KIND_CHOICES = [(KIND_MEDIA, 'Media'), (KIND_BACKUP, 'Zaxira')]

    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default=KIND_MEDIA)
    # media: MEDIA_ROOT ga nisbatan yo'l (FileField.name); backup: "<label>/<fayl>.enc"
    name = models.CharField(max_length=500, db_index=True)
    part = models.PositiveIntegerField(default=0)
    parts_total = models.PositiveIntegerField(default=1)
    size = models.BigIntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True, default='')

    bot_id = models.CharField(max_length=32)
    chat_id = models.BigIntegerField()
    message_id = models.BigIntegerField()
    file_id = models.CharField(max_length=255)
    file_unique_id = models.CharField(max_length=64, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    restored_at = models.DateTimeField(null=True, blank=True)
    # Fayl saytdan o'chirilgan: Telegram'dagi nusxa TG_STORAGE_PURGE_DAYS kun saqlanadi (tasodifiy o'chirishdan himoya)
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        verbose_name = 'Telegram fayli'
        verbose_name_plural = 'Telegram fayllari'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['kind', 'name', 'part'],
                condition=models.Q(deleted_at__isnull=True),
                name='tgstorage_unique_live_part',
            ),
        ]

    def __str__(self):
        suffix = f' [{self.part + 1}/{self.parts_total}]' if self.parts_total > 1 else ''
        return f'{self.kind}: {self.name}{suffix}'
