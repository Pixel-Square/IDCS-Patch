# Quick Reference - Superuser Impersonation Frontend

## 30-Second Setup

### For React App (Recommended)

```jsx
import SuperuserImpersonationForm from './components/SuperuserImpersonationForm';

function App() {
  return <SuperuserImpersonationForm />;
}
```

### For Standalone HTML

```bash
# 1. Open file directly
open frontend/src/components/impersonation-standalone.html

# 2. Or serve it
cd frontend && python -m http.server 3001
# Visit: http://localhost:3001/src/components/impersonation-standalone.html
```

---

## Form Fields

| Field | Type | Required | Example |
|-------|------|----------|---------|
| Superuser Email/ID | text | ✅ Yes | `iqac@krct.ac.in` |
| Superuser Password | password | ✅ Yes | (hidden) |
| Target User ID | number | ✅ Yes | `8665` |
| Reason | textarea | ❌ Optional | "Testing bug" |

---

## Sample Test Data

```
Superuser: iqac@krct.ac.in
Target IDs: 8665, 8666, 8667, 8668, 8669
```

---

## API Endpoint

```
POST /api/accounts/impersonate/

{
  "superuser_identifier": "iqac@krct.ac.in",
  "superuser_password": "password",
  "target_user_id": 8665,
  "reason": "Testing"
}
```

---

## Handle Response

### Success
```javascript
const response = await axios.post('/api/accounts/impersonate/', data);
localStorage.setItem('access_token', response.data.access);
localStorage.setItem('refresh_token', response.data.refresh);
// Redirect to dashboard
```

### Error
```javascript
try {
  // ... request
} catch (error) {
  console.error('Error:', error.response.data.detail);
}
```

---

## Use Token in Requests

```javascript
// Axios
axios.defaults.headers.common['Authorization'] = 
  `Bearer ${localStorage.getItem('access_token')}`;

// Fetch
fetch('/api/endpoint/', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
});
```

---

## Display Warning Banner

```jsx
const impersonationNotice = localStorage.getItem('impersonation_notice');

return (
  impersonationNotice && (
    <div style={{ backgroundColor: '#fff3cd', padding: '12px' }}>
      ⚠️ {impersonationNotice}
    </div>
  )
);
```

---

## Logout

```javascript
localStorage.removeItem('access_token');
localStorage.removeItem('refresh_token');
localStorage.removeItem('impersonation_notice');
// Redirect to login
```

---

## Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| `Invalid superuser credentials` | Wrong email/password | Check credentials |
| `Superuser does not have permission` | User not superuser | Use IQAC account |
| `Target user not found` | User ID doesn't exist | Use valid ID: 8665-8669 |
| `Target user is not active` | User account disabled | Use active user |

---

## File Locations

```
frontend/
├── src/components/
│   ├── SuperuserImpersonationForm.jsx       ← React component
│   └── impersonation-standalone.html        ← Standalone HTML
├── IMPERSONATION_INTEGRATION_GUIDE.md       ← Full docs
└── IMPERSONATION_QUICK_REFERENCE.md         ← This file
```

---

## Full Integration Example

```jsx
import { useState } from 'react';
import axios from 'axios';

export default function LoginPage() {
  const [mode, setMode] = useState('regular');

  return (
    <div>
      <button onClick={() => setMode('regular')}>Regular Login</button>
      <button onClick={() => setMode('impersonate')}>Superuser</button>

      {mode === 'regular' ? (
        <RegularLoginForm />
      ) : (
        <SuperuserImpersonationForm />
      )}
    </div>
  );
}
```

---

## Verification Checklist

- [ ] Form displays correctly
- [ ] Can submit with sample credentials
- [ ] Success shows user name
- [ ] Tokens stored in localStorage
- [ ] Warning banner displays
- [ ] Can make API calls with token
- [ ] Audit log visible in Django admin

---

**Backend:** `/api/accounts/impersonate/`  
**Admin Audit Log:** `/admin/accounts/superuserimpersonationlog/`  
**Documentation:** `IMPERSONATION_INTEGRATION_GUIDE.md`
