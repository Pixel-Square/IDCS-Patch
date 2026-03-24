/**
 * Superuser Impersonation Page
 * Allows IQAC/superusers to log in as any other user
 */

import React, { useState } from 'react';
import { impersonateLogin } from '../../services/auth';

export default function SuperuserImpersonationPage() {
  const [formData, setFormData] = useState({
    superuser_identifier: localStorage.getItem('email') || '',
    superuser_password: '',
    target_identifier: '',
    reason: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [token, setToken] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setToken('');

    try {
      const responseData = await impersonateLogin(
        formData.superuser_identifier,
        formData.superuser_password,
        formData.target_identifier,
        formData.reason || 'Superuser access',
      );

      // Success
      setSuccess(`✅ Successfully impersonating user: ${responseData.name}`);
      setToken(responseData.access);

      // Show notice in console
      console.log('🔒 IMPERSONATION NOTICE:', responseData.impersonation_notice);

      // Clear sensitive fields
      setFormData({
        ...formData,
        superuser_password: '',
        target_identifier: ''
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);

    } catch (err: any) {
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
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">🔐 Superuser Impersonation</h1>
        <p className="text-gray-600 mb-6">Login to access another user's account for support or debugging</p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 font-medium">❌ Error</p>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-700 font-medium">✅ Success</p>
            <p className="text-green-600">{success}</p>
          </div>
        )}

        {token && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-700 font-medium">📋 Access Token</p>
            <code className="block bg-white p-3 rounded border border-blue-200 text-blue-600 text-xs mt-2 overflow-auto">
              {token.substring(0, 80)}...
            </code>
            <p className="text-blue-600 text-sm mt-2">Token copied to localStorage and will be used for authenticated requests</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Superuser Email/ID */}
          <div>
            <label htmlFor="superuser_identifier" className="block text-sm font-semibold text-gray-700 mb-2">
              Superuser Email / ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="superuser_identifier"
              name="superuser_identifier"
              value={formData.superuser_identifier}
              onChange={handleChange}
              placeholder="admin@example.com or staff_id"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Email, reg_no, or staff_id</p>
          </div>

          {/* Superuser Password */}
          <div>
            <label htmlFor="superuser_password" className="block text-sm font-semibold text-gray-700 mb-2">
              Superuser Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="superuser_password"
              name="superuser_password"
              value={formData.superuser_password}
              onChange={handleChange}
              placeholder="Your password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Target Identifier */}
          <div>
            <label htmlFor="target_identifier" className="block text-sm font-semibold text-gray-700 mb-2">
              Target (Student Reg No / Staff ID) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="target_identifier"
              name="target_identifier"
              value={formData.target_identifier}
              onChange={handleChange}
              placeholder="e.g., AD23CS001 or STAFF123"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Use student reg_no or staff_id (no DB user id needed)</p>
          </div>

          {/* Reason (Optional) */}
          <div>
            <label htmlFor="reason" className="block text-sm font-semibold text-gray-700 mb-2">
              Reason (Optional)
            </label>
            <textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Why are you Super Login this user? (for audit log)"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">This will be recorded in the audit log</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }`}
          >
            {loading ? '⏳ Processing...' : '🔓 Impersonate User'}
          </button>
        </form>

        {/* Sample Data */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">📚 Notes</h3>
          <div className="space-y-3">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-700">
                Use <strong>student reg_no</strong> or <strong>staff_id</strong> in the Target field.
                DB user ids are not required.
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>ℹ️ Note:</strong> Every impersonation is logged and auditable. The target user will see a warning banner indicating they are being impersonated.
          </p>
        </div>
      </div>
    </div>
  );
}
