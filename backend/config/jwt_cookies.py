"""HttpOnly JWT cookies (optional; JSON body tokens remain for SPA compatibility)."""

from django.conf import settings


def attach_jwt_cookies(response, access_token: str, refresh_token: str):
    if not getattr(settings, 'JWT_USE_HTTPONLY_COOKIES', False):
        return response
    if not access_token or not refresh_token:
        return response
    secure = not settings.DEBUG
    max_age_access = int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
    max_age_refresh = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())
    name_access = getattr(settings, 'JWT_ACCESS_COOKIE_NAME', 'access')
    name_refresh = getattr(settings, 'JWT_REFRESH_COOKIE_NAME', 'refresh')
    common = {
        'httponly': True,
        'secure': secure,
        'samesite': 'Lax',
        'path': '/',
    }
    domain = getattr(settings, 'JWT_COOKIE_DOMAIN', None)
    if domain:
        common['domain'] = domain
    response.set_cookie(name_access, access_token, max_age=max_age_access, **common)
    response.set_cookie(name_refresh, refresh_token, max_age=max_age_refresh, **common)
    return response


def auth_body(user_data: dict, refresh) -> dict:
    """
    Login/ro'yxatdan o'tish javobi. Cookie rejimida (production) refresh token JSON'da qaytarilmaydi —
    u faqat HttpOnly cookie'da (JavaScript o'qiy olmaydi); access — frontend xotirasida qisqa vaqt.
    """
    cookie_mode = bool(getattr(settings, 'JWT_USE_HTTPONLY_COOKIES', False))
    body = {'user': user_data, 'cookie_auth': cookie_mode}
    if not getattr(settings, 'JWT_RETURN_TOKENS_IN_JSON', True):
        return body
    body['access'] = str(refresh.access_token)
    if not cookie_mode:
        body['refresh'] = str(refresh)
    return body


def clear_jwt_cookies(response):
    name_access = getattr(settings, 'JWT_ACCESS_COOKIE_NAME', 'access')
    name_refresh = getattr(settings, 'JWT_REFRESH_COOKIE_NAME', 'refresh')
    common = {'path': '/', 'samesite': 'Lax'}
    domain = getattr(settings, 'JWT_COOKIE_DOMAIN', None)
    if domain:
        common['domain'] = domain
    response.delete_cookie(name_access, **common)
    response.delete_cookie(name_refresh, **common)
    return response
