"""
URL configuration for Phoenix Scientific Platform
"""
from django.contrib import admin
from django.urls import include, path, re_path
from django.conf import settings
from django.conf.urls.static import static
from .jwt_views import CookieTokenRefreshView
from .alerts import client_error
from .media_protection import protected_media
from .health import health_live, health_ready, metrics_prometheus
from .github_deploy_webhook import github_deploy_webhook
from apps.analytics.views import global_search
from apps.articles.scholar import robots_txt, scholar_article_page, scholar_article_pdf, sitemap_xml

urlpatterns = [
    path('health/', health_live),
    path('health/live/', health_live),
    path('health/ready/', health_ready),
    path('metrics/', metrics_prometheus),
    # GitHub Webhooks → deploy (GITHUB_DEPLOY_WEBHOOK_SECRET .env da bo‘lganda ishlaydi)
    path('hooks/github/deploy/', github_deploy_webhook),
    # Admin
    path('admin/', admin.site.urls),
    
    # API v1
    path('api/v1/auth/', include('apps.users.urls')),
    path('api/v1/articles/', include('apps.articles.urls')),
    path('api/v1/journals/', include('apps.journals.urls')),
    path('api/v1/payments/', include('apps.payments.urls')),
    path('api/v1/translations/', include('apps.translations.urls')),
    path('api/v1/reviews/', include('apps.reviews.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/udc/', include('apps.udc.urls')),
    path('api/v1/analytics/', include('apps.analytics.urls')),
    path('api/v1/assistant/', include('apps.assistant.urls')),
    path('api/v1/search/', global_search, name='global_search'),
    path('api/v1/client-errors/', client_error, name='client_error'),

    # Ochiq maqola sahifalari (Google Scholar meta-teglari) va sayt xaritasi
    path('p/article/<uuid:pk>/', scholar_article_page, name='scholar_article_page'),
    path('p/article/<uuid:pk>/pdf/', scholar_article_pdf, name='scholar_article_pdf'),
    path('sitemap.xml', sitemap_xml, name='sitemap_xml'),
    path('robots.txt', robots_txt, name='robots_txt'),
    
    # JWT token refresh
    path('api/v1/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
]

# Media: imzo/ruxsat tekshiruvi bilan (productionda nginx maxfiy papkalarni shu yerga yuboradi)
urlpatterns += [re_path(r'^media/(?P<path>.+)$', protected_media, name='protected_media')]

# Serve static files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Admin site customization
admin.site.site_header = "Phoenix Scientific Platform Admin"
admin.site.site_title = "Phoenix Scientific"
admin.site.index_title = "Welcome to Phoenix Scientific Platform"
