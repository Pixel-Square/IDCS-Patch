from django.urls import path
from idcsscan.views import LookupByUIDView, SearchStudentsView, AssignUIDView, UnassignUIDView, GatepassCheckView

urlpatterns = [
    path('lookup/',          LookupByUIDView.as_view(),    name='idscan-lookup'),
    path('search/',          SearchStudentsView.as_view(),  name='idscan-search'),
    path('assign-uid/',      AssignUIDView.as_view(),       name='idscan-assign-uid'),
    path('unassign-uid/',    UnassignUIDView.as_view(),     name='idscan-unassign-uid'),
    path('gatepass-check/',  GatepassCheckView.as_view(),   name='idscan-gatepass-check'),
]
