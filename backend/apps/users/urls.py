from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import privacy_views, verification_views, views

router = DefaultRouter()
router.register('', views.UserViewSet, basename='user')

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('phone-verify/start/', verification_views.phone_verify_start, name='phone_verify_start'),
    path('phone-verify/status/', verification_views.phone_verify_status, name='phone_verify_status'),
    path('password-reset/start/', verification_views.password_reset_start, name='password_reset_start'),
    path('password-reset/confirm/', verification_views.password_reset_confirm, name='password_reset_confirm'),
    path('my-data/', privacy_views.my_data_export, name='my_data_export'),
    path('delete-request/', privacy_views.account_deletion_request, name='account_deletion_request'),
    path('', include(router.urls)),
]
