from django.contrib import admin
from .models import BroadcastLog, Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'message', 'read', 'created_at']
    list_filter = ['read', 'created_at']
    search_fields = ['user__first_name', 'user__last_name', 'message']


@admin.register(BroadcastLog)
class BroadcastLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'created_at', 'created_by', 'content_type', 'text_preview', 'total', 'sent_count',
                    'failed_count', 'status']
    list_filter = ['status', 'content_type', 'created_at']
    search_fields = ['text_preview', 'created_by__phone', 'created_by__first_name', 'created_by__last_name']
    readonly_fields = ['created_by', 'created_by_telegram_id', 'text_preview', 'content_type', 'button_text',
                       'button_url', 'total', 'sent_count', 'failed_count', 'status', 'created_at', 'finished_at']

    def has_add_permission(self, request):
        return False
