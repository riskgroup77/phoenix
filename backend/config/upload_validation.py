"""
Yuklanadigan fayllar turini tekshirish (kengaytma + fayl boshidagi "sehrli baytlar").

Avval fayl turi umuman tekshirilmasdi: muallif "qo'lyozma" sifatida .html yuklasa, u api. domenida
text/html bo'lib ochilardi — admin yoki taqrizchi faylni ochganda ichidagi skript uning nomidan so'rov
yuborardi (masalan muallifni super admin qilish). Endi faqat hujjat/rasm formatlari qabul qilinadi va
kengaytma fayl mazmuniga mos bo'lishi shart (.pdf deb nomlangan HTML ham rad etiladi).
"""
from __future__ import annotations

import os

from rest_framework import serializers

# Hujjat: qo'lyozma, UDK/DOI/tarjima fayllari, son to'plami
DOCUMENT_EXTENSIONS = frozenset({'.pdf', '.doc', '.docx', '.odt', '.rtf'})
# Nashr sertifikati, rasmlar
IMAGE_EXTENSIONS = frozenset({'.jpg', '.jpeg', '.png', '.webp'})

_ZIP = (b'PK\x03\x04',)
_OLE = (b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1',)
MAGIC = {
    '.pdf': (b'%PDF-',),
    '.docx': _ZIP,
    '.odt': _ZIP,
    '.doc': _OLE,
    '.rtf': (b'{\\rtf',),
    '.jpg': (b'\xff\xd8\xff',),
    '.jpeg': (b'\xff\xd8\xff',),
    '.png': (b'\x89PNG\r\n\x1a\n',),
    '.webp': (b'RIFF',),
}

DEFAULT_MAX_MB = 25
# Antiplagiat tekshiruvi va kitob qo'lyozmasi — dissertatsiya/kitob katta bo'ladi (nginx: phoenix-media.conf)
LARGE_DOCUMENT_MAX_MB = 100


def _label(extensions) -> str:
    return ', '.join(sorted(e.lstrip('.').upper() for e in extensions))


def _head(file_obj, size: int = 16) -> bytes:
    try:
        pos = file_obj.tell()
    except Exception:
        pos = 0
    try:
        file_obj.seek(0)
        head = file_obj.read(size) or b''
    finally:
        try:
            file_obj.seek(pos)
        except Exception:
            pass
    return head if isinstance(head, bytes) else head.encode('utf-8', 'ignore')


def validate_upload(file_obj, *, allowed=DOCUMENT_EXTENSIONS, max_mb: int = DEFAULT_MAX_MB, field: str = 'file'):
    """
    Fayl ruxsat etilgan turda va hajmda ekanini tekshiradi; aks holda serializers.ValidationError.
    Faqat yangi yuklangan fayl (UploadedFile) tekshiriladi — mavjud FieldFile o'tkazib yuboriladi.
    """
    if not file_obj or not hasattr(file_obj, 'read'):
        return file_obj
    if getattr(file_obj, '_committed', False):  # allaqachon saqlangan FieldFile
        return file_obj
    name = os.path.basename(getattr(file_obj, 'name', '') or '')
    ext = os.path.splitext(name)[1].lower()
    if ext not in allowed:
        raise serializers.ValidationError({field: f'Faqat {_label(allowed)} formatidagi fayl qabul qilinadi.'})
    if (file_obj.size or 0) > max_mb * 1024 * 1024:
        raise serializers.ValidationError({field: f'Fayl hajmi {max_mb} MB dan oshmasligi kerak.'})
    head = _head(file_obj)
    signatures = MAGIC.get(ext)
    if signatures and not any(head.startswith(sig) for sig in signatures):
        raise serializers.ValidationError(
            {field: f'Fayl mazmuni {ext.lstrip(".").upper()} formatiga mos emas. Asl hujjatni yuklang.'}
        )
    if ext == '.webp' and head[8:12] != b'WEBP':
        raise serializers.ValidationError({field: 'Fayl mazmuni WEBP formatiga mos emas.'})
    return file_obj


def validate_document(file_obj, field: str = 'file'):
    return validate_upload(file_obj, allowed=DOCUMENT_EXTENSIONS, field=field)


# Brauzerda faol kontent sifatida ochilishi mumkin bo'lgan kengaytmalar — hech qachon inline berilmaydi
ACTIVE_CONTENT_EXTENSIONS = frozenset({
    '.html', '.htm', '.xhtml', '.shtml', '.svg', '.svgz', '.xml', '.xsl', '.js', '.mjs', '.swf',
})


def is_active_content(name: str) -> bool:
    return os.path.splitext(name or '')[1].lower() in ACTIVE_CONTENT_EXTENSIONS
