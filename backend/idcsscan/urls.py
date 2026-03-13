from django.urls import path
from idcsscan.views import (
    LookupByUIDView, SearchStudentsView, AssignUIDView, UnassignUIDView, GatepassCheckView,
    SearchStaffView, AssignStaffUIDView, UnassignStaffUIDView, LookupAnyView,
)

urlpatterns = [
    path('lookup/',              LookupByUIDView.as_view(),        name='idscan-lookup'),
    path('lookup-any/',          LookupAnyView.as_view(),          name='idscan-lookup-any'),
    path('search/',              SearchStudentsView.as_view(),      name='idscan-search'),
    path('assign-uid/',          AssignUIDView.as_view(),           name='idscan-assign-uid'),
    path('unassign-uid/',        UnassignUIDView.as_view(),         name='idscan-unassign-uid'),
    path('gatepass-check/',      GatepassCheckView.as_view(),       name='idscan-gatepass-check'),
    path('search-staff/',        SearchStaffView.as_view(),         name='idscan-search-staff'),
    path('assign-staff-uid/',    AssignStaffUIDView.as_view(),      name='idscan-assign-staff-uid'),
    path('unassign-staff-uid/',  UnassignStaffUIDView.as_view(),    name='idscan-unassign-staff-uid'),
]
