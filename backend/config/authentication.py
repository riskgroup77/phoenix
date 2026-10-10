from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication

SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')


class CookieAwareJWTAuthentication(JWTAuthentication):
    """
    Authorization: Bearer ... yoki HttpOnly access cookie (production).
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw = self.get_raw_token(header)
            if raw is not None:
                validated_token = self.get_validated_token(raw)
                return self.get_user(validated_token), validated_token

        if not getattr(settings, 'JWT_USE_HTTPONLY_COOKIES', False):
            return None

        cookie_name = getattr(settings, 'JWT_ACCESS_COOKIE_NAME', 'access')
        raw_cookie = request.COOKIES.get(cookie_name)
        if not raw_cookie:
            return None
        # CSRF himoyasi: cookie bilan o'zgartiruvchi so'rov faqat ilovaning o'zidan (X-Requested-With sarlavhasi
        # bilan) qabul qilinadi. Boshqa saytdagi forma/skript bu sarlavhani qo'ya olmaydi (CORS preflight).
        if request.method not in SAFE_METHODS and not request.META.get('HTTP_X_REQUESTED_WITH'):
            return None
        try:
            validated_token = self.get_validated_token(raw_cookie.encode('utf-8'))
        except Exception:
            return None
        return self.get_user(validated_token), validated_token
