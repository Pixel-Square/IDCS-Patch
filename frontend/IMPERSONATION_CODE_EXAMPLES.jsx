/**
 * MINIMAL IMPLEMENTATION EXAMPLES
 * Copy-paste ready code for quick integration
 */

// ============================================
// EXAMPLE 1: Minimal React Component
// ============================================

import { useState } from 'react';
import axios from 'axios';

export function QuickImpersonationForm() {
  const [form, setForm] = useState({
    superuser_identifier: 'iqac@krct.ac.in',
    superuser_password: '',
    target_user_id: 8665,
    reason: 'Testing'
  });
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        'http://localhost:8000/api/accounts/impersonate/',
        form
      );
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      setResponse(res.data);
      setError(null);
      alert('✅ Logged in as: ' + res.data.name);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error');
      setResponse(null);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        placeholder="Email/ID"
        value={form.superuser_identifier}
        onChange={(e) => setForm({ ...form, superuser_identifier: e.target.value })}
      />
      <input
        type="password"
        placeholder="Password"
        value={form.superuser_password}
        onChange={(e) => setForm({ ...form, superuser_password: e.target.value })}
      />
      <input
        type="number"
        placeholder="Target User ID"
        value={form.target_user_id}
        onChange={(e) => setForm({ ...form, target_user_id: parseInt(e.target.value) })}
      />
      <button type="submit">Login</button>
      {error && <p style={{ color: 'red' }}>❌ {error}</p>}
      {response && <p style={{ color: 'green' }}>✅ Logged in as {response.name}</p>}
    </form>
  );
}

// ============================================
// EXAMPLE 2: Simple Axios Wrapper
// ============================================

const API_URL = 'http://localhost:8000/api/accounts/impersonate/';

export async function impersonate(email, password, targetId, reason = 'Admin access') {
  try {
    const response = await axios.post(API_URL, {
      superuser_identifier: email,
      superuser_password: password,
      target_user_id: targetId,
      reason
    });

    // Store tokens
    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);
    localStorage.setItem('impersonation_notice', response.data.impersonation_notice);

    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || 'Impersonation failed';
  }
}

// Usage:
// const result = await impersonate('iqac@krct.ac.in', 'password', 8665);
// console.log('Logged in as:', result.name);

// ============================================
// EXAMPLE 3: Form Component (Styled)
// ============================================

export function StyledImpersonationForm() {
  const [email, setEmail] = useState('iqac@krct.ac.in');
  const [password, setPassword] = useState('');
  const [targetId, setTargetId] = useState('8665');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post(
        'http://localhost:8000/api/accounts/impersonate/',
        {
          superuser_identifier: email,
          superuser_password: password,
          target_user_id: parseInt(targetId)
        }
      );

      localStorage.setItem('access_token', response.data.access);
      setMessage(`✅ Successfully logged in as: ${response.data.name}`);

      // Reset form
      setPassword('');
      setTimeout(() => window.location.href = '/dashboard', 2000);
    } catch (err) {
      setMessage(`❌ Error: ${err.response?.data?.detail || 'Failed'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '20px auto', padding: '20px', border: '1px solid #ddd' }}>
      <h2>🔐 Super User</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label>Email: </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Password: </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Target User ID: </label>
          <input
            type="number"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ Processing...' : '🔓 Login'}
        </button>
      </form>
      {message && (
        <p style={{
          marginTop: '10px',
          padding: '10px',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          borderRadius: '4px'
        }}>
          {message}
        </p>
      )}
    </div>
  );
}

// ============================================
// EXAMPLE 4: Custom Hook
// ============================================

import { useCallback } from 'react';

export function useImpersonation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const impersonate = useCallback(async (email, password, targetId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        'http://localhost:8000/api/accounts/impersonate/',
        {
          superuser_identifier: email,
          superuser_password: password,
          target_user_id: targetId
        }
      );

      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);

      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Impersonation failed';
      setError(errorMsg);
      throw errorMsg;
    } finally {
      setLoading(false);
    }
  }, []);

  return { impersonate, loading, error };
}

// Usage:
// function MyComponent() {
//   const { impersonate, loading, error } = useImpersonation();
//   
//   const handleLogin = () => {
//     impersonate('iqac@krct.ac.in', 'password', 8665);
//   };
// }

// ============================================
// EXAMPLE 5: Middleware for API Calls
// ============================================

export function setupAxiosInterceptors() {
  axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = localStorage.getItem('refresh_token');
          const response = await axios.post(
            'http://localhost:8000/api/token/refresh/',
            { refresh: refreshToken }
          );

          localStorage.setItem('access_token', response.data.access);
          originalRequest.headers.Authorization = `Bearer ${response.data.access}`;

          return axios(originalRequest);
        } catch (err) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }

      return Promise.reject(error);
    }
  );
}

// Usage in main.jsx or App.jsx:
// setupAxiosInterceptors();

// ============================================
// EXAMPLE 6: Display Impersonation Banner
// ============================================

export function ImpersonationBanner() {
  const notice = localStorage.getItem('impersonation_notice');

  if (!notice) return null;

  return (
    <div style={{
      backgroundColor: '#fff3cd',
      border: '2px solid #ffc107',
      padding: '12px 20px',
      marginBottom: '20px',
      borderRadius: '4px',
      color: '#856404',
      fontWeight: 'bold',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <span>⚠️ {notice}</span>
      <button
        onClick={() => {
          localStorage.removeItem('impersonation_notice');
          window.location.reload();
        }}
        style={{
          padding: '5px 10px',
          backgroundColor: '#ffc107',
          border: 'none',
          cursor: 'pointer',
          borderRadius: '3px'
        }}
      >
        Exit Impersonation
      </button>
    </div>
  );
}

// Usage:
// <ImpersonationBanner />

// ============================================
// EXAMPLE 7: Complete Login Page
// ============================================

export default function LoginPage() {
  const [isImpersonation, setIsImpersonation] = useState(false);

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <button onClick={() => setIsImpersonation(false)}>📱 Regular Login</button>
        <button onClick={() => setIsImpersonation(true)}>🔐 Superuser</button>
      </div>

      {isImpersonation ? (
        <StyledImpersonationForm />
      ) : (
        <RegularLoginForm />
      )}
    </div>
  );
}

// ============================================
// SAMPLE TEST DATA
// ============================================

export const SAMPLE_DATA = {
  superuser: {
    email: 'iqac@krct.ac.in',
    id: 8645
  },
  targetUsers: [
    { id: 8665, name: 'AAFFRIN A R', email: 'aaffrin@krct.ac.in' },
    { id: 8666, name: 'AARYA A', email: 'aarya@krct.ac.in' },
    { id: 8667, name: 'AATHIL AHAMED H', email: 'aathil@krct.ac.in' },
    { id: 8668, name: 'ABHINAY V', email: 'abhinay@krct.ac.in' },
    { id: 8669, name: 'ADITYA_S', email: 'aditya@krct.ac.in' }
  ]
};
