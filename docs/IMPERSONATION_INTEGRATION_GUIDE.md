# Frontend Integration Guide - Superuser Impersonation

## Overview
The frontend needs to collect **4 fields** from the superuser:
1. **Superuser Email/ID** - Email, reg_no, or staff_id
2. **Superuser Password** - Authentication
3. **Target User ID** - ID of user to impersonate
4. **Reason** (Optional) - For audit trail

## Files Created

### 1. React Component
**File:** `frontend/src/components/SuperuserImpersonationForm.jsx`

```jsx
// Usage in your app:
import SuperuserImpersonationForm from './components/SuperuserImpersonationForm';

export default function App() {
  return <SuperuserImpersonationForm />;
}
```

**Features:**
- Form validation
- Error handling
- Success feedback
- Token storage in localStorage
- Auto-redirect to dashboard
- Sample test data displayed

### 2. Standalone HTML/JavaScript
**File:** `frontend/src/components/impersonation-standalone.html`

Can be opened directly in a browser:
```bash
# Open directly
open frontend/src/components/impersonation-standalone.html

# Or serve via Python
cd frontend/src/components
python -m http.server 8001
# Then visit: http://localhost:8001/impersonation-standalone.html
```

## Integration into Existing Login Form

### Option A: Add as a Tab/Toggle on Login Page

```jsx
import { useState } from 'react';
import SuperuserImpersonationForm from './components/SuperuserImpersonationForm';
import RegularLoginForm from './components/RegularLoginForm';

export default function LoginPage() {
  const [mode, setMode] = useState('regular'); // 'regular' or 'impersonate'

  return (
    <div className="login-container">
      <div className="tabs">
        <button 
          onClick={() => setMode('regular')}
          className={mode === 'regular' ? 'active' : ''}
        >
          📱 Regular Login
        </button>
        <button 
          onClick={() => setMode('impersonate')}
          className={mode === 'impersonate' ? 'active' : ''}
        >
          🔐 Superuser Impersonate
        </button>
      </div>

      {mode === 'regular' ? (
        <RegularLoginForm />
      ) : (
        <SuperuserImpersonationForm />
      )}
    </div>
  );
}
```

### Option B: Admin Panel Integration

```jsx
// Add to admin dashboard
import SuperuserImpersonationForm from './components/SuperuserImpersonationForm';

export default function AdminPanel() {
  return (
    <div className="admin-container">
      <div className="admin-tools">
        {/* Other admin tools... */}
        
        <section className="tool-section">
          <h3>🔐 User Impersonation</h3>
          <SuperuserImpersonationForm />
        </section>
      </div>
    </div>
  );
}
```

### Option C: Modal Dialog

```jsx
import { useState } from 'react';
import SuperuserImpersonationForm from './components/SuperuserImpersonationForm';

export default function AdminHeader() {
  const [showImpersonation, setShowImpersonation] = useState(false);

  return (
    <header>
      <button onClick={() => setShowImpersonation(true)}>
        🔐 Impersonate User
      </button>

      {showImpersonation && (
        <Modal onClose={() => setShowImpersonation(false)}>
          <SuperuserImpersonationForm />
        </Modal>
      )}
    </header>
  );
}
```

## Backend API Reference

### Endpoint
```
POST /api/accounts/impersonate/
```

### Request
```json
{
  "superuser_identifier": "iqac@krct.ac.in",
  "superuser_password": "your_password",
  "target_user_id": 8665,
  "reason": "Debugging student issue"
}
```

### Success Response (200 OK)
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "name": "AAFFRIN A R",
  "email": "student@krct.ac.in",
  "user_id": 8665,
  "impersonation_notice": "🔒 YOU ARE LOGGED IN AS: AAFFRIN A R (ID: 8665). This is an impersonated session by IQAC."
}
```

### Error Responses

**401 - Invalid Credentials**
```json
{
  "detail": "Invalid superuser credentials"
}
```

**400 - Superuser Cannot Impersonate**
```json
{
  "detail": "Superuser does not have permission to impersonate"
}
```

**404 - Target User Not Found**
```json
{
  "detail": "Target user not found"
}
```

**400 - Target User Inactive**
```json
{
  "detail": "Target user is not active"
}
```

## Token Usage After Impersonation

### Store Tokens
```javascript
localStorage.setItem('access_token', response.data.access);
localStorage.setItem('refresh_token', response.data.refresh);
localStorage.setItem('impersonation_notice', response.data.impersonation_notice);
```

### Use with API Calls
```javascript
// Axios
axios.defaults.headers.common['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`;

// Fetch
fetch('/api/endpoint/', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
});
```

### Display Warning Banner
```jsx
export default function App() {
  const impersonationNotice = localStorage.getItem('impersonation_notice');

  return (
    <div>
      {impersonationNotice && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '20px',
          color: '#856404',
          fontWeight: 'bold'
        }}>
          ⚠️ {impersonationNotice}
        </div>
      )}
      {/* Rest of app */}
    </div>
  );
}
```

## Sample Test Data

### Superuser
- **Email:** iqac@krct.ac.in
- **ID:** 8645
- **Role:** Superuser

### Target Users (Students)
| ID   | Username   | Email              | Name                |
|------|------------|-------------------|---------------------|
| 8665 | AAFFRIN    | aaffrin@krct.ac.in | AAFFRIN A R         |
| 8666 | AARYA      | aarya@krct.ac.in   | AARYA A             |
| 8667 | AATHIL     | aathil@krct.ac.in  | AATHIL AHAMED H     |
| 8668 | ABHINAY    | abhinay@krct.ac.in | ABHINAY V           |
| 8669 | ADITYA     | aditya@krct.ac.in  | ADITYA_S            |

## Testing Checklist

- [ ] Form renders without errors
- [ ] All 4 fields are visible and accessible
- [ ] Form validation works (required fields)
- [ ] Submit button is disabled during processing
- [ ] Error messages display correctly on failure
- [ ] Success message displays with user name
- [ ] Tokens are stored in localStorage
- [ ] Warning banner displays after success
- [ ] Page redirects to dashboard after 2-3 seconds
- [ ] Can make API calls with returned token
- [ ] Impersonation notice visible in all pages
- [ ] Log out properly clears tokens and notice

## Testing with curl

```bash
# Test impersonation endpoint
curl -X POST http://localhost:8000/api/accounts/impersonate/ \
  -H "Content-Type: application/json" \
  -d '{
    "superuser_identifier": "iqac@krct.ac.in",
    "superuser_password": "YOUR_PASSWORD",
    "target_user_id": 8665,
    "reason": "Testing"
  }'

# Response:
# {
#   "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
#   "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
#   "name": "AAFFRIN A R",
#   "email": "aaffrin@krct.ac.in",
#   "user_id": 8665,
#   "impersonation_notice": "🔒 YOU ARE LOGGED IN AS: AAFFRIN A R (ID: 8665)..."
# }
```

## Troubleshooting

### CORS Error
If you see: `Access to XMLHttpRequest blocked by CORS policy`

Add to Django `settings.py`:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",  # React dev server
    "http://localhost:5173",  # Vite
]
```

Ensure `django-cors-headers` is installed and added to `INSTALLED_APPS`

### Token Not Persisting
Ensure browser allows localStorage:
```javascript
try {
  localStorage.setItem('test', 'value');
  console.log('localStorage available');
} catch (e) {
  console.warn('localStorage not available', e);
}
```

### Redirects Not Working
Check that `/dashboard` route exists in your React app, or modify redirect:
```javascript
// Instead of:
window.location.href = '/dashboard';

// Use React Router:
navigate('/dashboard', { replace: true });
```

## Next Steps

1. Choose integration option (React component, standalone HTML, or embedded in login)
2. Update API endpoint URL if backend is on different domain
3. Configure CORS if frontend and backend are on different ports
4. Test with sample data provided
5. Deploy to production

---

**Files Reference:**
- React Component: `/frontend/src/components/SuperuserImpersonationForm.jsx`
- Standalone HTML: `/frontend/src/components/impersonation-standalone.html`
- Backend Endpoint: `POST /api/accounts/impersonate/`
- Audit Log: `/admin/accounts/superuserimpersonationlog/`
