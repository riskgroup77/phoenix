"""
Media saqlash: oddiy disk (ProtectedMediaStorage — imzoli havolalar) + Telegram kanalidagi nusxa.

- Saqlangan fayl fon rejimida kanalga yuboriladi (services.schedule_upload).
- Diskdan o'chirilgan (evict) fayl path()/open() da Telegram'dan avtomatik qaytariladi.
- exists() Telegram'dagi faylni ham hisobga oladi — yangi fayl eski (diskda yo'q) fayl nomini egallamaydi.
Telegram sozlanmagan bo'lsa (TG_STORAGE_*) — aynan ProtectedMediaStorage kabi ishlaydi.
"""
import os

from django.core.files.storage import FileSystemStorage

from config.media_protection import ProtectedMediaStorage

from . import services


class TelegramBackedStorage(ProtectedMediaStorage):
    def local_path(self, name):
        """Telegram'dan qaytarmasdan diskdagi yo'l (ommaviy o'qishlar uchun: antiplagiat korpusi va h.k.)."""
        return FileSystemStorage.path(self, name)

    def path(self, name):
        p = self.local_path(name)
        if not os.path.exists(p):
            services.ensure_local(name)
        return p

    def exists(self, name):
        return os.path.lexists(self.local_path(name)) or services.has_record(name)

    def size(self, name):
        p = self.local_path(name)
        if not os.path.exists(p):
            rec = services.get_record(name)
            if rec is not None and rec.size:
                return rec.size
        return os.path.getsize(self.path(name))

    def delete(self, name):
        if not name:
            raise ValueError('The name must be given to delete().')
        p = self.local_path(name)
        try:
            if os.path.isdir(p):
                os.rmdir(p)
            else:
                os.remove(p)
        except FileNotFoundError:
            pass
        services.mark_deleted(name)

    def _save(self, name, content):
        name = super()._save(name, content)
        services.schedule_upload(name)
        return name
