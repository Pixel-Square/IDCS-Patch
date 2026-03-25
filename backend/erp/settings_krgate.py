from .settings import *  # noqa: F401,F403

import os


# KR GATE backend exposes only a minimal API surface.
ROOT_URLCONF = 'erp.urls_krgate'
WSGI_APPLICATION = 'erp.wsgi_krgate.application'

_DEFAULT_KRGATE_ORIGINS = [
    'https://gate.krgi.co.in',
]


def _krgate_split_env_csv(name: str) -> list[str]:
    return [v.strip() for v in str(os.getenv(name, '') or '').split(',') if v.strip()]

# Optional explicit host list for KR GATE runtime.
_krgate_hosts = _krgate_split_env_csv('KRGATE_ALLOWED_HOSTS')
if _krgate_hosts:
    ALLOWED_HOSTS = list(dict.fromkeys(_krgate_hosts))

# Optional explicit CORS origins for KR GATE runtime.
_krgate_cors = _krgate_split_env_csv('KRGATE_CORS_ALLOWED_ORIGINS')
if _krgate_cors:
    CORS_ALLOWED_ORIGINS = list(dict.fromkeys(_krgate_cors))
else:
    CORS_ALLOWED_ORIGINS = list(dict.fromkeys(list(CORS_ALLOWED_ORIGINS) + _DEFAULT_KRGATE_ORIGINS))

_krgate_cors_extra = _krgate_split_env_csv('KRGATE_CORS_EXTRA_ORIGINS')
if _krgate_cors_extra:
    CORS_ALLOWED_ORIGINS = list(dict.fromkeys(list(CORS_ALLOWED_ORIGINS) + _krgate_cors_extra))

# Optional explicit CSRF trusted origins for KR GATE runtime.
_krgate_csrf = _krgate_split_env_csv('KRGATE_CSRF_TRUSTED_ORIGINS')
if _krgate_csrf:
    CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(_krgate_csrf))
else:
    CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(list(CSRF_TRUSTED_ORIGINS) + _DEFAULT_KRGATE_ORIGINS))

_krgate_csrf_extra = _krgate_split_env_csv('KRGATE_CSRF_EXTRA_TRUSTED_ORIGINS')
if _krgate_csrf_extra:
    CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(list(CSRF_TRUSTED_ORIGINS) + _krgate_csrf_extra))
