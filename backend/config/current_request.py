"""
Joriy so'rovni (request) signal va servislardan olish uchun.

DRF autentifikatsiyadan keyin foydalanuvchini asl Django HttpRequest'ga ham yozadi
(`Request.user` setter), shuning uchun signal ishlaganda `current_user()` JWT orqali
kirgan foydalanuvchini ham qaytaradi. Celery/management buyruqlarida None bo'ladi.
"""
from __future__ import annotations

import contextvars

_current_request: contextvars.ContextVar = contextvars.ContextVar('phoenix_current_request', default=None)


class CurrentRequestMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = _current_request.set(request)
        try:
            return self.get_response(request)
        finally:
            _current_request.reset(token)


def current_request():
    return _current_request.get()


def current_user():
    request = _current_request.get()
    if request is None:
        return None
    user = getattr(request, 'user', None)
    if user is None or not getattr(user, 'is_authenticated', False):
        return None
    return user
