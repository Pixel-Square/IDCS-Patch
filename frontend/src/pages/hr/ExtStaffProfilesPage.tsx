import React, { useEffect, useRef, useState, useCallback } from 'react';
import { UserPlus, Trash2, Search, Copy, Check, AlertCircle, RefreshCw, GripVertical } from 'lucide-react';
import fetchWithAuth from '../../services/fetchAuth';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AvailableUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
}

interface ExtStaffProfile {
  id: number;
  ext_uid: string;
  username: string;
  email: string;
  full_name: string;
  designation: string;
  organisation: string;
  notes: string;
  is_active: boolean;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy UID"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px 4px',
        color: copied ? '#16a34a' : '#6b7280',
        transition: 'color 0.2s',
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExtStaffProfilesPage() {
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [profiles, setProfiles] = useState<ExtStaffProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [profileSearch, setProfileSearch] = useState('');
  const [addingUserId, setAddingUserId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExtStaffProfile | null>(null);

  // Drag state
  const [dragUserId, setDragUserId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const tableDropRef = useRef<HTMLDivElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadAvailableUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetchWithAuth('/api/academics/ext-staff-profiles/available-users/');
      if (!res.ok) throw new Error('Failed to load users');
      setAvailableUsers(await res.json());
    } catch (e: any) {
      setError(e?.message || 'Error loading users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const res = await fetchWithAuth('/api/academics/ext-staff-profiles/');
      if (!res.ok) throw new Error('Failed to load profiles');
      setProfiles(await res.json());
    } catch (e: any) {
      setError(e?.message || 'Error loading profiles');
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    void loadAvailableUsers();
    void loadProfiles();
  }, [loadAvailableUsers, loadProfiles]);

  // ── Add user to Ext Staff table ────────────────────────────────────────────

  const addUser = useCallback(async (userId: number) => {
    setAddingUserId(userId);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/academics/ext-staff-profiles/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as any)?.user_id?.[0] ||
          (body as any)?.detail ||
          'Failed to add user';
        throw new Error(msg);
      }
      await loadAvailableUsers();
      await loadProfiles();
    } catch (e: any) {
      setError(e?.message || 'Error adding user');
    } finally {
      setAddingUserId(null);
    }
  }, [loadAvailableUsers, loadProfiles]);

  // ── Delete ─────────────────────────────────────────────────────────────────

  const deleteProfile = useCallback(async (profile: ExtStaffProfile) => {
    setDeletingId(profile.id);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/academics/ext-staff-profiles/${profile.id}/`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setConfirmDelete(null);
      await loadAvailableUsers();
      await loadProfiles();
    } catch (e: any) {
      setError(e?.message || 'Error deleting profile');
    } finally {
      setDeletingId(null);
    }
  }, [loadAvailableUsers, loadProfiles]);

  // ── Drag ───────────────────────────────────────────────────────────────────

  const handleDragStart = (userId: number) => {
    setDragUserId(userId);
  };

  const handleDragEnd = () => {
    setDragUserId(null);
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (dragUserId != null) {
      await addUser(dragUserId);
      setDragUserId(null);
    }
  };

  // ── Filtered lists ─────────────────────────────────────────────────────────

  const filteredUsers = availableUsers.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      !q ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q)
    );
  });

  const filteredProfiles = profiles.filter((p) => {
    const q = profileSearch.toLowerCase();
    return (
      !q ||
      p.ext_uid.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.full_name.toLowerCase().includes(q)
    );
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24, maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#111827' }}>External Staff Profiles</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Select a user from the left panel (click <strong>+</strong> or drag into the table) to create an External Staff Profile with a unique 16-character UID.
        </div>
      </div>

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#b91c1c',
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          <AlertCircle size={15} />
          {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', lineHeight: 1, fontSize: 17 }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* ── Left: Available Users picker ── */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            background: '#fff',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid #f3f4f6',
              background: '#f9fafb',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 13, color: '#111827', flex: 1 }}>
              Available Users
              <span style={{ marginLeft: 6, fontWeight: 600, color: '#6b7280' }}>({filteredUsers.length})</span>
            </div>
            <button
              onClick={() => { void loadAvailableUsers(); void loadProfiles(); }}
              title="Refresh"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2 }}
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users…"
                style={{
                  width: '100%',
                  paddingLeft: 28,
                  paddingRight: 8,
                  paddingTop: 6,
                  paddingBottom: 6,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 12,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {loadingUsers ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                {userSearch ? 'No matching users' : 'All users are already assigned'}
              </div>
            ) : (
              filteredUsers.map((u) => (
                <div
                  key={u.id}
                  draggable
                  onDragStart={() => handleDragStart(u.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderBottom: '1px solid #f9fafb',
                    cursor: 'grab',
                    background: dragUserId === u.id ? '#eff6ff' : '#fff',
                    transition: 'background 0.1s',
                    userSelect: 'none',
                  }}
                >
                  <GripVertical size={13} color="#d1d5db" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.full_name || u.username}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      @{u.username} · {u.email}
                    </div>
                  </div>
                  <button
                    onClick={() => addUser(u.id)}
                    disabled={addingUserId === u.id}
                    title="Add to Ext Staff"
                    style={{
                      background: addingUserId === u.id ? '#e5e7eb' : '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: 6,
                      padding: '3px 6px',
                      cursor: addingUserId === u.id ? 'not-allowed' : 'pointer',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {addingUserId === u.id ? (
                      <span style={{ fontSize: 11 }}>…</span>
                    ) : (
                      <UserPlus size={13} />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right: Ext Staff Profiles table ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            ref={tableDropRef}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: dragOver ? '2px dashed #3b82f6' : '1px solid #e5e7eb',
              borderRadius: 12,
              background: dragOver ? '#eff6ff' : '#fff',
              overflow: 'hidden',
              transition: 'border 0.15s, background 0.15s',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f3f4f6',
                background: '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, color: '#111827', flex: 1 }}>
                Ext Staff Profiles
                <span style={{ marginLeft: 6, fontWeight: 600, color: '#6b7280' }}>({filteredProfiles.length})</span>
              </div>
              {dragOver && (
                <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 700 }}>Drop to add →</span>
              )}
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="text"
                  value={profileSearch}
                  onChange={(e) => setProfileSearch(e.target.value)}
                  placeholder="Search…"
                  style={{
                    paddingLeft: 26,
                    paddingRight: 8,
                    paddingTop: 5,
                    paddingBottom: 5,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 12,
                    outline: 'none',
                    width: 160,
                  }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {['#', 'Username', 'Full Name', 'Email', 'Ext UID (16-char)', 'Status', 'Added', 'Action'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontWeight: 800,
                          fontSize: 11,
                          color: '#374151',
                          borderBottom: '1px solid #e5e7eb',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingProfiles ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                        Loading…
                      </td>
                    </tr>
                  ) : filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                        {dragOver
                          ? 'Drop a user here to add them'
                          : profileSearch
                          ? 'No profiles match your search'
                          : 'No external staff profiles yet. Add users from the left panel.'}
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map((p, idx) => (
                      <tr
                        key={p.id}
                        style={{ background: idx % 2 === 1 ? '#f9fafb' : '#fff' }}
                      >
                        <td style={{ padding: '8px 12px', color: '#9ca3af', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#111827' }}>@{p.username}</td>
                        <td style={{ padding: '8px 12px', color: '#374151' }}>{p.full_name || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#6b7280' }}>{p.email}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <code
                              style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: 5,
                                padding: '2px 7px',
                                fontSize: 12,
                                fontFamily: 'monospace',
                                letterSpacing: 1,
                                color: '#1d4ed8',
                                fontWeight: 800,
                              }}
                            >
                              {p.ext_uid}
                            </code>
                            <CopyButton text={p.ext_uid} />
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: p.is_active ? '#dcfce7' : '#fee2e2',
                              color: p.is_active ? '#166534' : '#991b1b',
                            }}
                          >
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <button
                            onClick={() => setConfirmDelete(p)}
                            disabled={deletingId === p.id}
                            title="Remove profile"
                            style={{
                              background: 'none',
                              border: '1px solid #fecaca',
                              borderRadius: 6,
                              padding: '3px 7px',
                              cursor: deletingId === p.id ? 'not-allowed' : 'pointer',
                              color: '#dc2626',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
            Tip: Drag a user from the left panel and drop onto the table to add them.
          </div>
        </div>
      </div>

      {/* ── Confirm Delete Modal ── */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #e5e7eb',
              padding: 20,
              width: 'min(420px, 94vw)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, fontSize: 15, color: '#111827', marginBottom: 8 }}>Remove External Staff Profile</div>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
              Remove <strong>@{confirmDelete.username}</strong> and their Ext UID{' '}
              <code style={{ background: '#f3f4f6', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', fontSize: 12 }}>
                {confirmDelete.ext_uid}
              </code>
              ? The user account will not be deleted.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="obe-btn"
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId === confirmDelete.id}
              >
                Cancel
              </button>
              <button
                className="obe-btn obe-btn-danger"
                onClick={() => deleteProfile(confirmDelete)}
                disabled={deletingId === confirmDelete.id}
              >
                {deletingId === confirmDelete.id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
