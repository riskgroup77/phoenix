from django.contrib import admin
from .models import (
    ActivityLog,
    AntiplagCorpusDocument,
    AntiplagIndexedDocument,
    Article,
    ArticleOperatorMessage,
    ArticleStatusEvent,
    ArticleVersion,
)


class ArticleVersionInline(admin.TabularInline):
    model = ArticleVersion
    extra = 0


class ActivityLogInline(admin.TabularInline):
    model = ActivityLog
    extra = 0
    readonly_fields = ('timestamp', 'user', 'action', 'details')


class ArticleStatusEventInline(admin.TabularInline):
    model = ArticleStatusEvent
    extra = 0
    readonly_fields = ('created_at', 'from_status', 'to_status', 'actor', 'actor_role', 'note')
    can_delete = False


class ArticleOperatorMessageInline(admin.TabularInline):
    model = ArticleOperatorMessage
    extra = 0
    readonly_fields = ('created_at', 'sender', 'body')
    can_delete = False


@admin.register(ArticleOperatorMessage)
class ArticleOperatorMessageAdmin(admin.ModelAdmin):
    list_display = ('article', 'sender', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('article__title', 'body', 'sender__email')
    readonly_fields = ('created_at',)


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ['title', 'author', 'journal', 'status', 'submission_date', 'views_count']
    list_filter = ['status', 'journal', 'submission_date']
    search_fields = ['title', 'author__first_name', 'author__last_name', 'doi']
    readonly_fields = ['submission_date', 'views_count', 'downloads_count', 'citations_count']
    inlines = [ArticleVersionInline, ArticleStatusEventInline, ActivityLogInline, ArticleOperatorMessageInline]
    date_hierarchy = 'submission_date'


@admin.register(AntiplagCorpusDocument)
class AntiplagCorpusDocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'source_type', 'language', 'is_active', 'updated_at']
    list_filter = ['source_type', 'language', 'is_active']
    search_fields = ['title', 'external_key', 'author_names']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(AntiplagIndexedDocument)
class AntiplagIndexedDocumentAdmin(admin.ModelAdmin):
    """Indeks faqat ko'rish uchun: build_antiplag_index va signals boshqaradi."""

    list_display = ['doc_key', 'kind', 'title', 'source_type', 'is_public', 'token_count', 'indexed_at']
    list_filter = ['kind', 'source_type', 'is_public']
    search_fields = ['doc_key', 'title']
    exclude = ['text']
    readonly_fields = [
        'doc_key', 'kind', 'title', 'url', 'source_type', 'is_public', 'author_id',
        'token_count', 'content_hash', 'indexed_at',
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
