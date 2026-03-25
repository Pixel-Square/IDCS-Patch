# KR GATE Separation Structure

This document describes the clean structure introduced for KR GATE backend isolation.

Target production domain: `gate.krgi.co.in`

## New Backend Entry Points

- `backend/erp/settings_krgate.py`
  - KR GATE specific settings module.
  - Uses main settings as base and overrides:
    - `ROOT_URLCONF = 'erp.urls_krgate'`
    - `WSGI_APPLICATION = 'erp.wsgi_krgate.application'`
  - Supports env-driven host/origin overrides:
    - `KRGATE_ALLOWED_HOSTS`
    - `KRGATE_CORS_ALLOWED_ORIGINS`
    - `KRGATE_CORS_EXTRA_ORIGINS`
    - `KRGATE_CSRF_TRUSTED_ORIGINS`
    - `KRGATE_CSRF_EXTRA_TRUSTED_ORIGINS`

- `backend/erp/urls_krgate.py`
  - Minimal API surface for KR GATE runtime:
    - `/api/accounts/*` (minimal auth endpoints)
    - `/api/idscan/*`
    - `/health/`

- `backend/erp/wsgi_krgate.py`
  - WSGI entrypoint for separate KR GATE Gunicorn service.

## Minimal Account Routes for KR GATE

- `backend/accounts/urls_krgate.py`
  - `/api/accounts/token/`
  - `/api/accounts/token/refresh/`
  - `/api/accounts/me/`

## idscan Decoupling

- `backend/idcsscan/serializers.py`
  - New local `SecurityStaffProfileSerializer`.
  - Handles creation/update/list of SECURITY users without using broad academics serializer logic.

- `backend/idcsscan/views.py`
  - `ManageSecurityUsersView` and `ManageSecurityUserDetailView` now use
    `SecurityStaffProfileSerializer`.

## Desktop App Config Flexibility

- `KR-GATE-IDCS/src/renderer/src/services/apiBase.ts`
  - Production API base now respects `VITE_API_BASE` (fallback to existing default).

- `KR-GATE-IDCS/src/main/index.ts`
  - Production native-fetch allowlist now supports env var:
    - `KR_GATE_ALLOWED_API_HOSTS` (comma-separated hosts)

## Production Wiring (next step)

Run KR GATE as a separate process with:

1. A dedicated Gunicorn service using `erp.wsgi_krgate:application`
2. A dedicated Nginx server block/subdomain to that service
3. Separate env file for KR GATE service
4. Optional separate Redis DB index/prefix for KR GATE sessions/cache

This gives process-level isolation from the main IDCS runtime while sharing the same database.

## Added Deployment Templates

- `deploy/gunicorn_krgate.service`
  - Separate gunicorn process using `erp.wsgi_krgate:application`
  - Separate runtime directory/socket: `/run/gunicorn-krgate/gunicorn.sock`
  - Separate env file: `backend/.env.krgate`

- `deploy/nginx_gate.conf`
  - Nginx vhost for `gate.krgi.co.in`
  - Proxies to isolated KR GATE socket

- `backend/.env.krgate.example`
  - Starter env keys for KR GATE service

## Quick Server Steps

1. Create KR GATE env file:

```bash
cp /home/iqac/IDCS-Restart/backend/.env.krgate.example /home/iqac/IDCS-Restart/backend/.env.krgate
```

2. Install systemd unit:

```bash
sudo cp /home/iqac/IDCS-Restart/deploy/gunicorn_krgate.service /etc/systemd/system/gunicorn_krgate.service
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn_krgate.service
```

3. Install nginx site:

```bash
sudo cp /home/iqac/IDCS-Restart/deploy/nginx_gate.conf /etc/nginx/sites-available/gate
sudo ln -sf /etc/nginx/sites-available/gate /etc/nginx/sites-enabled/gate
sudo nginx -t
sudo systemctl reload nginx
```

4. Verify health endpoint:

```bash
curl -I https://gate.krgi.co.in/health/
```
