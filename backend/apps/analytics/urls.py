from django.urls import path

from . import views

urlpatterns = [
    path('overview/', views.overview, name='analytics_overview'),
    path('workload/', views.workload, name='analytics_workload'),
    path('public/', views.public_overview, name='analytics_public_overview'),
]
