from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .contact import contact_request

router = DefaultRouter()
router.register('', views.NotificationViewSet, basename='notification')

urlpatterns = [
    # router'dan oldin — aks holda 'contact/' bildirishnoma ID'si deb olinadi
    path('contact/', contact_request, name='contact_request'),
    path('', include(router.urls)),
]
