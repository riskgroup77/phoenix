"""Shaxsiy yuklamalar uchun taxmin qilib bo'lmaydigan fayl yo'llari."""
import os
import uuid

from django.utils.deconstruct import deconstructible


@deconstructible
class RandomizedUploadPath:
    """
    `<prefix>/<tasodifiy 32 belgi>/<asl fayl nomi>`.

    /media/ nginx orqali ochiq beriladi — asl nom bilan saqlangan qo'lyozmani (masalan
    articles/pdfs/maqola.docx) nomini taxmin qilib yuklab olish mumkin edi. Asl nom saqlanadi
    (yuklab olishda ko'rinadi), lekin papka nomi tasodifiy.
    """

    def __init__(self, prefix: str):
        self.prefix = prefix.strip('/')

    def __call__(self, instance, filename: str) -> str:
        stem, ext = os.path.splitext(os.path.basename(filename or 'file'))
        # FileField max_length=100: nomni qisqartiramiz, kengaytma (.pdf/.docx) saqlanadi
        name = f'{(stem or "file")[:40]}{ext[:10]}'
        return f'{self.prefix}/{uuid.uuid4().hex}/{name}'

    def __eq__(self, other):
        return isinstance(other, RandomizedUploadPath) and other.prefix == self.prefix

    def __hash__(self):
        return hash(self.prefix)
