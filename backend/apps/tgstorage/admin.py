from django.contrib import admin

from .models import TelegramStoredFile


@admin.register(TelegramStoredFile)
class TelegramStoredFileAdmin(admin.ModelAdmin):
    list_display = ('name', 'kind', 'part', 'parts_total', 'size', 'bot_id', 'created_at', 'deleted_at')
    list_filter = ('kind',)
    search_fields = ('name', 'file_unique_id')
    readonly_fields = [f.name for f in TelegramStoredFile._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
