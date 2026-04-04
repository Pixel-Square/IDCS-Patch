from django.contrib import admin
from .models import Announcement, AnnouncementReadStatus


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'target_type',
        'created_by',
        'is_active',
        'created_at',
        'expiry_date',
        'has_attachment',
    )
    list_filter = ('target_type', 'is_active', 'created_at', 'expiry_date')
    search_fields = ('title', 'content', 'created_by__username')
    readonly_fields = ('id', 'created_at')
    filter_horizontal = ('target_departments',)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('created_by')

    def has_attachment(self, obj):
        return bool(obj.attachment)
    has_attachment.boolean = True


@admin.register(AnnouncementReadStatus)
class AnnouncementReadStatusAdmin(admin.ModelAdmin):
    list_display = ('announcement', 'user', 'is_read', 'read_at', 'created_at')
    list_filter = ('is_read', 'read_at', 'created_at')
    search_fields = ('announcement__title', 'user__username')