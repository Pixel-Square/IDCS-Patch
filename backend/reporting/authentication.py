import secrets

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ReportingApiKeyAuthentication(BaseAuthentication):
    """Allow machine-to-machine access for reporting endpoints via API key."""

    header_names = ('X-Reporting-Api-Key', 'X-API-Key')

    def authenticate(self, request):
        configured_key = str(getattr(settings, 'REPORTING_API_KEY', '') or '').strip()
        if not configured_key:
            return None

        provided_key = ''
        for header_name in self.header_names:
            candidate = str(request.headers.get(header_name, '') or '').strip()
            if candidate:
                provided_key = candidate
                break

        if not provided_key:
            return None

        if not secrets.compare_digest(provided_key, configured_key):
            raise AuthenticationFailed('Invalid reporting API key.')

        return (AnonymousUser(), {'scheme': 'reporting_api_key'})
