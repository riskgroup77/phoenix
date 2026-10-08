"""Rolga asoslangan umumiy DRF ruxsatlari."""

from rest_framework.permissions import SAFE_METHODS, BasePermission


def is_super_admin(user) -> bool:
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    role = (getattr(user, 'role', '') or '').strip().lower()
    return role == 'super_admin' or bool(getattr(user, 'is_superuser', False))


class SuperAdminWriteAuthenticatedRead(BasePermission):
    """O'qish — tizimga kirgan har kim; yozish/o'chirish — faqat bosh administrator."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return is_super_admin(request.user)


class SuperAdminWritePublicRead(BasePermission):
    """O'qish — hamma (anonim ham); yozish/o'chirish — faqat bosh administrator."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return is_super_admin(request.user)
