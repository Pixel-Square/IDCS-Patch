import React, { useEffect, useMemo, useState } from 'react';

import { fetchAssessmentMasterConfig, saveAssessmentMasterConfig } from '../../services/cdapDb';

export default function AcademicControllerPublishPage(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // true  -> Regular/Basic publish (locks tables, edit request required)
  // false -> Unlimited publish (no locks, no edit requests)
  const [regularBasic, setRegularBasic] = useState<boolean>(true);
  const [loadedConfig, setLoadedConfig] = useState<any>({});

  const statusText = useMemo(() => {
    return regularBasic
      ? 'Regular / Basic publish is ON — published tables will be locked and staff must use “Request Edit”.'
      : 'Unlimited publish is ON — no table locks and no edit request is required for any exam assignments.';
  }, [regularBasic]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const cfg = await fetchAssessmentMasterConfig();
      setLoadedConfig(cfg || {});
      const enabled = (cfg as any)?.edit_requests_enabled;
      // Default to true when not explicitly false.
      setRegularBasic(enabled === false ? false : true);
    } catch (e: any) {
      setError(e?.message || 'Failed to load publish settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(nextRegularBasic: boolean) {
    setSaving(true);
    setError(null);
    try {
      const nextCfg = { ...(loadedConfig || {}), edit_requests_enabled: nextRegularBasic };
      const saved = await saveAssessmentMasterConfig(nextCfg);
      setLoadedConfig(saved || nextCfg);
      setRegularBasic(nextRegularBasic);
    } catch (e: any) {
      setError(e?.message || 'Failed to save publish settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>PUBLISH</h3>
          <div style={{ marginTop: 6, color: '#6b7280', fontSize: 13 }}>
            Controls whether publish causes table-lock + edit-request flow across all exam assignments.
          </div>
        </div>

        <button
          type="button"
          disabled={loading || saving}
          onClick={() => save(!regularBasic)}
          style={{
            minWidth: 220,
            height: 52,
            padding: '0 18px',
            borderRadius: 14,
            border: regularBasic ? '2px solid #10b981' : '2px solid #94a3b8',
            background: regularBasic ? '#ecfdf5' : '#f8fafc',
            color: '#111827',
            fontWeight: 900,
            fontSize: 15,
            cursor: loading || saving ? 'not-allowed' : 'pointer',
          }}
          title={regularBasic ? 'Click to switch to Unlimited publish (no locks)' : 'Click to switch to Regular/Basic publish (locked)'}
        >
          {regularBasic ? 'ON: Regular / Basic' : 'OFF: Unlimited'}
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        {loading ? (
          <div style={{ color: '#6b7280' }}>Loading…</div>
        ) : error ? (
          <div style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>
        ) : (
          <div style={{ color: '#111827', fontSize: 13 }}>{statusText}</div>
        )}

        {saving && <div style={{ marginTop: 8, color: '#6b7280' }}>Saving…</div>}

        <div style={{ marginTop: 12, padding: 12, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>What this changes</div>
          <div style={{ color: '#374151', fontSize: 13, lineHeight: 1.5 }}>
            <div>
              <b>ON (Regular/Basic):</b> publish turns into <b>Request Edit</b> for locked tables. Users cannot edit published tables without IQAC approval.
            </div>
            <div style={{ marginTop: 6 }}>
              <b>OFF (Unlimited):</b> publish does not lock tables globally and no edit-request approval is required.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
