from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import CustomTokenObtainPairView, MeView


urlpatterns = [
    path('token/', CustomTokenObtainPairView.as_view(), name='krgate_token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='krgate_token_refresh'),
    path('me/', MeView.as_view(), name='krgate_me'),
]
