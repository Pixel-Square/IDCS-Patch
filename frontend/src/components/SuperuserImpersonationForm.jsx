/**
 * SUPERUSER IMPERSONATION - REACT COMPONENT
 * 
 * Simple form-based impersonation interface
 * Asks for: Email/ID, Password, Target User ID, and Reason
 */

import React, { useState } from 'react';
import axios from 'axios';

const SuperuserImpersonationForm = () => {
  const [formData, setFormData] = useState({
    superuser_identifier: '', // email, reg_no, or staff_id
    superuser_password: '',
    target_user_id: '',
    reason: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [token, setToken] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setToken('');

    try {
      const response = await axios.post(
        'http://localhost:8000/api/accounts/impersonate/',
        {
          superuser_identifier: formData.superuser_identifier,
          superuser_password: formData.superuser_password,
          target_user_id: parseInt(formData.target_user_id),
          reason: formData.reason || 'Superuser access'
        }
      );

      // Success
      setSuccess(`✅ Successfully impersonating user: ${response.data.name}`);
      setToken(response.data.access);

      // Store token in localStorage
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      localStorage.setItem('impersonation_notice', response.data.impersonation_notice);

      // Show notice banner
      console.log('🔒 IMPERSONATION NOTICE:', response.data.impersonation_notice);

      // Optional: Show banner in UI
      if (response.data.impersonation_notice) {
        alert(response.data.impersonation_notice);
      }

      // Clear form
      setFormData({
        superuser_identifier: '',
        superuser_password: '',
        target_user_id: '',
        reason: ''
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);

    } catch (err) {
      setError(
        err.response?.data?.detail ||
        Object.values(err.response?.data || {}).join(', ') ||
        'Failed to impersonate user'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>🔐 Superuser Impersonation</h2>
        <p style={styles.subtitle}>Login to access another user's account</p>

        {error && (
          <div style={styles.errorAlert}>
            <strong>❌ Error:</strong> {error}
          </div>
        )}

        {success && (
          <div style={styles.successAlert}>
            <strong>✅ Success:</strong> {success}
          </div>
        )}

        {token && (
          <div style={styles.tokenAlert}>
            <strong>📋 Access Token:</strong>
            <code style={styles.tokenCode}>{token.substring(0, 50)}...</code>
            <p style={styles.tokenNote}>Token copied to localStorage</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Superuser Email/ID */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Superuser Email / ID:</label>
            <input
              type="text"
              name="superuser_identifier"
              value={formData.superuser_identifier}
              onChange={handleChange}
              placeholder="admin@example.com or staff_id"
              required
              style={styles.input}
            />
            <small style={styles.hint}>Email, reg_no, or staff_id</small>
          </div>

          {/* Superuser Password */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Superuser Password:</label>
            <input
              type="password"
              name="superuser_password"
              value={formData.superuser_password}
              onChange={handleChange}
              placeholder="Your password"
              required
              style={styles.input}
            />
          </div>

          {/* Target User ID */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Target User ID:</label>
            <input
              type="number"
              name="target_user_id"
              value={formData.target_user_id}
              onChange={handleChange}
              placeholder="e.g., 8665"
              required
              style={styles.input}
            />
            <small style={styles.hint}>ID of user to Super Login</small>
          </div>

          {/* Reason (Optional) */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Reason (Optional):</label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Why are you Super Login this user?"
              style={{ ...styles.input, minHeight: '100px' }}
            />
            <small style={styles.hint}>For audit log</small>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '⏳ Processing...' : '🔓 Impersonate User'}
          </button>
        </form>

        {/* Sample Data */}
        <div style={styles.samplesSection}>
          <h4 style={styles.samplesTitle}>📚 Sample Test Data:</h4>
          <div style={styles.samplesList}>
            <div style={styles.sampleItem}>
              <strong>Superuser:</strong> iqac@krct.ac.in
            </div>
            <div style={styles.sampleItem}>
              <strong>Target Students:</strong>
              <ul style={styles.sampleList}>
                <li>ID 8665: AAFFRIN A R</li>
                <li>ID 8666: AARYA A</li>
                <li>ID 8667: AATHIL AHAMED H</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px'
  },
  card: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    padding: '40px',
    maxWidth: '500px',
    width: '100%'
  },
  title: {
    textAlign: 'center',
    color: '#333',
    marginBottom: '10px',
    fontSize: '24px'
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: '30px',
    fontSize: '14px'
  },
  form: {
    marginTop: '30px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    color: '#333',
    fontSize: '14px'
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.3s'
  },
  hint: {
    display: 'block',
    marginTop: '5px',
    fontSize: '12px',
    color: '#999'
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  },
  errorAlert: {
    padding: '12px',
    marginBottom: '20px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
    fontSize: '14px'
  },
  successAlert: {
    padding: '12px',
    marginBottom: '20px',
    backgroundColor: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb',
    borderRadius: '4px',
    fontSize: '14px'
  },
  tokenAlert: {
    padding: '12px',
    marginBottom: '20px',
    backgroundColor: '#d1ecf1',
    color: '#0c5460',
    border: '1px solid #bee5eb',
    borderRadius: '4px',
    fontSize: '13px'
  },
  tokenCode: {
    display: 'block',
    backgroundColor: '#fff',
    padding: '8px',
    borderRadius: '3px',
    marginTop: '8px',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    fontSize: '11px'
  },
  tokenNote: {
    marginTop: '8px',
    fontSize: '12px'
  },
  samplesSection: {
    marginTop: '30px',
    paddingTop: '20px',
    borderTop: '1px solid #eee'
  },
  samplesTitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '10px'
  },
  samplesList: {
    fontSize: '13px',
    color: '#666'
  },
  sampleItem: {
    marginBottom: '10px',
    padding: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '3px'
  },
  sampleList: {
    marginTop: '5px',
    marginLeft: '20px'
  }
};

export default SuperuserImpersonationForm;
