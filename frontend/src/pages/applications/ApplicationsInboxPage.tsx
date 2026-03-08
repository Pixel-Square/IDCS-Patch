import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchApplicationsNav,
  fetchApproverInbox,
  fetchApplicationStepInfo,
  submitApplicationAction,
  ApplicationsNavResponse,
  ApproverInboxItem,
  StepInfoResponse,
} from '../../services/applications'

type ExpandedState = {
  appId: number
  stepInfo: StepInfoResponse | null
  loading: boolean
  remarks: string
  acting: boolean
  actionError: string | null
}

function statusBadgeClass(state: string): string {
  switch (state?.toUpperCase()) {
    case 'APPROVED': return 'bg-green-100 text-green-700'
    case 'REJECTED': return 'bg-red-100 text-red-700'
    case 'IN_REVIEW':
    case 'SUBMITTED': return 'bg-blue-100 text-blue-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

export default function ApplicationsInboxPage(): JSX.Element {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nav, setNav] = useState<ApplicationsNavResponse | null>(null)
  const [items, setItems] = useState<ApproverInboxItem[]>([])
  const [expanded, setExpanded] = useState<ExpandedState | null>(null)

  const loadInbox = async () => {
    setLoading(true)
    setError(null)
    try {
      const [navRes, inboxRes] = await Promise.all([
        fetchApplicationsNav(),
        fetchApproverInbox().catch(() => [] as ApproverInboxItem[]),
      ])
      setNav(navRes)
      setItems(navRes.show_applications ? inboxRes : [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load applications inbox.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInbox()
  }, [])

  const roleSummary = useMemo(() => {
    const codes = (nav?.staff_roles || []).map((r) => r.code).filter(Boolean)
    const override = (nav?.override_roles || []).filter(Boolean)
    return Array.from(new Set([...codes, ...override])).join(', ')
  }, [nav])

  const handleRowClick = async (row: ApproverInboxItem) => {
    if (expanded?.appId === row.application_id) {
      setExpanded(null)
      return
    }
    const state: ExpandedState = {
      appId: row.application_id,
      stepInfo: null,
      loading: true,
      remarks: '',
      acting: false,
      actionError: null,
    }
    setExpanded(state)
    try {
      const info = await fetchApplicationStepInfo(row.application_id)
      setExpanded((prev) => prev?.appId === row.application_id ? { ...prev, stepInfo: info, loading: false } : prev)
    } catch {
      setExpanded((prev) => prev?.appId === row.application_id ? { ...prev, loading: false } : prev)
    }
  }

  const handleAction = async (action: 'FORWARD' | 'REJECT') => {
    if (!expanded) return
    setExpanded((prev) => prev ? { ...prev, acting: true, actionError: null } : null)
    try {
      await submitApplicationAction(expanded.appId, action, expanded.remarks)
      setExpanded(null)
      await loadInbox()
    } catch (e: any) {
      setExpanded((prev) => prev ? { ...prev, acting: false, actionError: e?.message || 'Action failed.' } : null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Applications Inbox</h1>
            <p className="text-sm text-gray-500 mt-1">Pending approvals assigned to you.</p>
          </div>
          <button
            onClick={() => navigate('/applications')}
            className="text-sm text-indigo-600 hover:underline font-medium"
          >
            My Applications →
          </button>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : !nav?.show_applications ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700">
            You do not currently have any application approval roles configured.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">
                Department: <span className="font-semibold text-gray-800">{nav.staff_department?.name || '—'}</span>
                &nbsp;&nbsp;Roles: <span className="font-semibold text-gray-800">{roleSummary || '—'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Inbox ({items.length})</h3>
              </div>
              {!items.length ? (
                <div className="p-5 text-sm text-gray-500">No pending approvals.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {items.map((row) => {
                    const isExpanded = expanded?.appId === row.application_id
                    return (
                      <React.Fragment key={row.application_id}>
                        <div
                          className={`px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-indigo-50' : ''}`}
                          onClick={() => handleRowClick(row)}
                        >
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="space-y-0.5">
                              <div className="text-sm font-semibold text-gray-900">
                                #{row.application_id} — {row.application_type}
                              </div>
                              <div className="text-sm text-gray-600">{row.applicant_name}</div>
                              {row.applicant_roll_or_staff_id && (
                                <div className="text-xs text-gray-400">{row.applicant_roll_or_staff_id}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              {row.department_name && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                  {row.department_name}
                                </span>
                              )}
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadgeClass(row.current_state)}`}>
                                {row.current_state}
                              </span>
                              {row.current_step_role && (
                                <span className="text-xs text-gray-500">Step: {row.current_step_role}</span>
                              )}
                              <span className="text-xs text-gray-400">
                                {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : '—'}
                              </span>
                              <span className="text-xs text-indigo-500">{isExpanded ? '▲' : '▼'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Expanded action panel */}
                        {isExpanded && expanded && (
                          <div className="px-5 py-4 bg-indigo-50 border-t border-indigo-100">
                            {expanded.loading ? (
                              <div className="text-sm text-gray-400">Loading step info…</div>
                            ) : !expanded.stepInfo ? (
                              <div className="text-sm text-gray-500">Could not load step info.</div>
                            ) : !expanded.stepInfo.can_act ? (
                              <div className="text-sm text-gray-500 italic">
                                You are not authorized to act on this application at this step.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="text-sm text-gray-700">
                                  <span className="font-medium">Current step:</span>{' '}
                                  {expanded.stepInfo.current_step?.role_name || '—'}
                                  {expanded.stepInfo.current_step?.is_final && (
                                    <span className="ml-2 text-xs text-indigo-500 font-medium">Final step</span>
                                  )}
                                </div>
                                {expanded.stepInfo.next_step && (
                                  <div className="text-sm text-gray-500">
                                    Forwarding to: <span className="font-medium text-gray-700">{expanded.stepInfo.next_step.role_name}</span>
                                  </div>
                                )}
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Remarks (optional)</label>
                                  <textarea
                                    rows={2}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    placeholder="Add remarks…"
                                    value={expanded.remarks}
                                    onChange={(e) =>
                                      setExpanded((prev) => prev ? { ...prev, remarks: e.target.value } : null)
                                    }
                                    disabled={expanded.acting}
                                  />
                                </div>
                                {expanded.actionError && (
                                  <div className="text-sm text-red-600">{expanded.actionError}</div>
                                )}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAction('FORWARD')}
                                    disabled={expanded.acting}
                                    className="rounded-lg bg-indigo-600 text-white text-sm font-medium px-4 py-2 hover:bg-indigo-700 disabled:opacity-60"
                                  >
                                    {expanded.acting ? 'Processing…' : expanded.stepInfo.forward_label}
                                  </button>
                                  <button
                                    onClick={() => handleAction('REJECT')}
                                    disabled={expanded.acting}
                                    className="rounded-lg bg-red-500 text-white text-sm font-medium px-4 py-2 hover:bg-red-600 disabled:opacity-60"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => navigate(`/applications/${row.application_id}`)}
                                    className="rounded-lg border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-white"
                                  >
                                    View Details
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}



