from django.urls import path

from . import views

urlpatterns = [
    path('conversations/', views.conversations, name='assistant_conversations'),
    path('conversations/<uuid:pk>/', views.conversation_detail, name='assistant_conversation'),
    path('conversations/<uuid:pk>/messages/', views.send_message, name='assistant_send'),
]
