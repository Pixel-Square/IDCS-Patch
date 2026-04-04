from django.contrib import admin

from .models import AcademicCalendarEvent, EventProposal, HodColor


@admin.register(AcademicCalendarEvent)
class AcademicCalendarEventAdmin(admin.ModelAdmin):
    list_display = ('title', 'start_date', 'end_date', 'source', 'created_by')
    list_filter = ('source',)
    search_fields = ('title', 'description', 'audience_department')


@admin.register(HodColor)
class HodColorAdmin(admin.ModelAdmin):
    list_display = ('hod', 'color', 'updated_by', 'updated_at')
    search_fields = ('hod__username',)


@admin.register(EventProposal)
class EventProposalAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'proposed_by', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('title', 'description', 'proposed_by__username')
