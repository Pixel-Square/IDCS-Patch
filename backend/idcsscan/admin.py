from django.contrib import admin

from .models import GatepassOfflineScan


@admin.register(GatepassOfflineScan)
class GatepassOfflineScanAdmin(admin.ModelAdmin):
    list_display = ('uid', 'direction', 'status', 'recorded_at', 'device_label', 'uploaded_at')
    list_filter = ('direction', 'status', 'recorded_at', 'uploaded_at')
    search_fields = ('uid', 'device_label')
