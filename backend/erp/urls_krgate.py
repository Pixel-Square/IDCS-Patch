from django.http import HttpResponse
from django.urls import include, path


def health(_request):
    return HttpResponse('ok', content_type='text/plain')


urlpatterns = [
    path('', health, name='krgate-health'),
    path('health/', health, name='krgate-health-explicit'),
    path('api/accounts/', include('accounts.urls_krgate')),
    path('api/auth/', include('accounts.urls_krgate')),
    path('api/idscan/', include('idcsscan.urls')),
]
