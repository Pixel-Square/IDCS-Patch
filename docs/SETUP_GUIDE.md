# IDCS-Restart Setup Guide

## Quick Start

### Backend Setup (Django)

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Create a virtual environment (if not already created):

   ```bash
   python -m venv .venv
   ```

3. Activate the virtual environment:
   - Windows: `.venv\Scripts\activate`
   - Mac/Linux: `source .venv/bin/activate`

4. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

5. Run migrations:

   ```bash
   python manage.py migrate
   ```

6. Create a superuser (optional):

   ```bash
   python manage.py createsuperuser
   ```

7. Start the Django development server:
   ```bash
   python manage.py runserver
   ```

The backend should now be running at: http://localhost:8000

### Frontend Setup (React + Vite)

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend should now be running at: http://localhost:3000

## Login Page

Visit http://localhost:3000/login to access the login page.

You can log in using:

- **Email**: your college email
- **Register Number**: student registration number
- **Staff ID**: staff identifier
- **Password**: your password

## API Endpoints

The backend exposes the following authentication endpoints:

- `POST /api/accounts/token/` - Login (obtain JWT tokens)
- `POST /api/accounts/token/refresh/` - Refresh access token
- `GET /api/accounts/me/` - Get current user info
- `POST /api/accounts/register/` - Register new user

## Environment Variables

### Backend (.env)

Already configured in `backend/.env`. Uses SQLite by default.

#### SMS / OTP (mobile verification)

Mobile OTP verification uses an SMS sender backend.

- Default (dev): `SMS_BACKEND=console` which **logs** the SMS content in backend logs (no real SMS is sent).
- Production: choose one backend:
   - `SMS_BACKEND=http_get` + `SMS_GATEWAY_URL` (traditional SMS gateway)
   - `SMS_BACKEND=whatsapp` + WhatsApp microservice settings (recommended when you already run the whatsapp-web.js service)

Add to `backend/.env`:

```env
# Option A: SMS gateway (HTTP GET)
SMS_BACKEND=http_get
SMS_GATEWAY_URL=https://your-sms-provider.example/send?to={to}&message={message}

# Option B: WhatsApp (uses local whatsapp-web.js microservice)
# SMS_BACKEND=whatsapp
# OBE_WHATSAPP_API_URL=http://127.0.0.1:3000/send-whatsapp
# Optional: secondary send endpoint if the local gateway is down
# OBE_WHATSAPP_API_URL_FALLBACK=https://db.krgi.co.in/whatsapp/send-whatsapp
# Production safety: allow non-local gateway URLs (e.g. https://db.krgi.co.in)
# OBE_WHATSAPP_ALLOW_NON_LOCAL_URL=1
# Optional: explicitly set the gateway base URL used for IQAC Settings -> QR/Status.
# Useful when the gateway is hosted on a domain (e.g. https://db.krgi.co.in) or behind a sub-path.
# If not set, the backend derives a base URL from OBE_WHATSAPP_API_URL.
# OBE_WHATSAPP_GATEWAY_BASE_URL=http://127.0.0.1:3000
# Optional: secondary base URL for the IQAC Settings QR/Status page
# OBE_WHATSAPP_GATEWAY_BASE_URL_FALLBACK=https://db.krgi.co.in/whatsapp
# OBE_WHATSAPP_API_KEY=change-me
```

Notes:
- `SMS_GATEWAY_URL` must contain both `{to}` and `{message}` placeholders.
- The backend must be allowed to make outbound HTTP(S) requests to the SMS provider.

WhatsApp backend notes:
- The backend will POST JSON to `OBE_WHATSAPP_API_URL` with keys: `api_key`, `to`, `message`.
- The `to` number is normalized to digits-only with country code (e.g. `91XXXXXXXXXX`).
- The IQAC Settings QR/Status page uses `OBE_WHATSAPP_GATEWAY_BASE_URL` if set; otherwise it derives a base URL from `OBE_WHATSAPP_API_URL`.
- Quick test (replace values):

```bash
curl -sS 'http://127.0.0.1:3000/send-whatsapp' \
   -H 'Content-Type: application/json' \
   -d '{"api_key":"change-me","to":"91XXXXXXXXXX","message":"Test from IDCS"}'
```

### Frontend (.env)

Already configured in `frontend/.env`:

```
VITE_API_BASE=http://localhost:8000
```

## CORS Configuration

The backend is already configured with CORS enabled for all origins during development (`CORS_ALLOW_ALL_ORIGINS = True` in settings.py).

## Notes

- The login system supports authentication via email, student registration number, or staff ID
- JWT tokens are used for authentication
- Access tokens expire after 60 minutes (configurable)
- Refresh tokens expire after 1 day
