import json

from django.apps import apps
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.utils.html import format_html

from .models import (
    BrandingEventLog,
    CanvaOAuthState,
    CanvaServiceToken,
    CanvaTemplate,
    EventPosterAttachment,
)


@admin.register(BrandingEventLog)
class BrandingEventLogAdmin(admin.ModelAdmin):
    list_display = (
        'created_at',
        'event_type',
        'status',
        'event_id',
        'reference_id',
        'user',
        'request_method',
        'request_path',
    )
    list_filter = ('status', 'event_type', 'request_method', 'created_at')
    search_fields = ('event_type', 'event_id', 'reference_id', 'message', 'request_path', 'user__username')
    readonly_fields = (
        'created_at',
        'event_type',
        'status',
        'message',
        'request_path',
        'request_method',
        'ip_address',
        'user_agent',
        'user',
        'event_id',
        'reference_id',
        'formatted_request_data',
        'formatted_response_data',
        'formatted_metadata',
    )
    fields = (
        'created_at',
        'event_type',
        'status',
        'message',
        'user',
        'event_id',
        'reference_id',
        'request_method',
        'request_path',
        'ip_address',
        'user_agent',
        'formatted_request_data',
        'formatted_response_data',
        'formatted_metadata',
    )
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description='Request Data')
    def formatted_request_data(self, obj):
        return self._json_pretty(getattr(obj, 'request_data', None))

    @admin.display(description='Response Data')
    def formatted_response_data(self, obj):
        return self._json_pretty(getattr(obj, 'response_data', None))

    @admin.display(description='Metadata')
    def formatted_metadata(self, obj):
        return self._json_pretty(getattr(obj, 'metadata', None))

    def _json_pretty(self, value):
        if value in (None, '', {}):
            return '-'
        try:
            payload = json.dumps(value, indent=2, ensure_ascii=False, default=str)
        except Exception:
            payload = str(value)
        return format_html('<pre style="white-space: pre-wrap; margin: 0;">{}</pre>', payload)


@admin.register(CanvaTemplate)
class CanvaTemplateAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'canva_design_id', 'is_brand_template', 'saved_by', 'saved_at')
    search_fields = ('name', 'canva_design_id', 'saved_by')
    list_filter = ('is_brand_template', 'saved_at')


@admin.register(CanvaServiceToken)
class CanvaServiceTokenAdmin(admin.ModelAdmin):
    list_display = ('id', 'display_name', 'user_id', 'expires_at', 'updated_at')
    search_fields = ('display_name', 'user_id')
    readonly_fields = ('updated_at',)


@admin.register(CanvaOAuthState)
class CanvaOAuthStateAdmin(admin.ModelAdmin):
    list_display = ('id', 'state', 'origin', 'created_at')
    search_fields = ('state', 'origin', 'redirect_uri')
    readonly_fields = ('created_at',)


@admin.register(EventPosterAttachment)
class EventPosterAttachmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'uploaded_at', 'event_id', 'canva_design_id', 'format', 'file')
    search_fields = ('event_id', 'canva_design_id', 'source_url')
    list_filter = ('format', 'uploaded_at')
    readonly_fields = ('uploaded_at',)


# Register any remaining template_api models without explicit admin classes above.
_template_api_app_config = next((cfg for cfg in apps.get_app_configs() if cfg.name == 'template_api'), None)
if _template_api_app_config:
    for _model in _template_api_app_config.get_models():
        if _model not in admin.site._registry:
            try:
                admin.site.register(_model)
            except AlreadyRegistered:
                pass
