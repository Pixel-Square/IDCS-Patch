import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchApplicationTypes,
  fetchMyApplications,
  ApplicationTypeListItem,
  MyApplicationItem,
} from '../../services/applications'

function statusBadgeClass(state: string): string {
  switch (state?.toUpperCase()) {
    case 'APPROVED': return 'bg-green-100 text-green-700'
    case 'REJECTED': return 'bg-red-100 text-red-700'
    case 'IN_REVIEW':
    case 'SUBMITTED': return 'bg-blue-100 text-blue-700'
    case 'DRAFT': return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function statusLabel(state: string): string {
  switch (state?.toUpperCase()) {
    case 'IN_REVIEW':
    case 'SUBMITTED': return 'Pending'
    case 'APPROVED': return 'Approved'
    case 'REJECTED': return 'Rejected'
    case 'DRAFT': return 'Draft'
    default: return state || '—'
  }
}

function useCountdown(deadline: string | null): string | null {
  const [display, setDisplay] = useState<string | null>(null)

  useEffect(() => {
    if (!deadline) { setDisplay(null); return }
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) { setDisplay('Expired'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setDisplay(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [deadline])

  return display
}

function SlaCountdown({ deadline }: { deadline: string | null }): JSX.Element {
  const display = useCountdown(deadline)
  if (!display) return <span className="text-gray-400 text-xs">—</span>
  const isExpired = display === 'Expired'
  const diff = deadline ? new Date(deadline).getTime() - Date.now() : 0
  const isUrgent = !isExpired && diff < 3600000 // < 1 hour
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded-full ${
      isExpired ? 'bg-red-100 text-red-600' :
      isUrgent  ? 'bg-amber-100 text-amber-700' :
                  'bg-indigo-50 text-indigo-700'
    }`}>
      {!isExpired && (
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
      )}
      {display}
    </span>
  )
}

export default function ApplicationsPage(): JSX.Element {
  const navigate = useNavigate()

  const [types, setTypes] = useState<ApplicationTypeListItem[]>([])
  const [myApps, setMyApps] = useState<MyApplicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [typesRes, myRes] = await Promise.all([
          fetchApplicationTypes(),
          fetchMyApplications().catch(() => [] as MyApplicationItem[]),
        ])
        if (!mounted) return
        setTypes(typesRes)
        setMyApps(myRes)
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load applications.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-sm text-gray-500 mt-1">Submit a new application or track your existing ones.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : (
          <>
            {/* Available Application Types */}
            <section>
              <h2 className="text-base font-semibold text-gray-800 mb-3">Available Applications</h2>
              {types.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
                  No application types are currently available.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {types.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/applications/new/${t.id}`)}
                      className="rounded-2xl border border-gray-200 bg-white p-5 text-left hover:border-indigo-300 hover:shadow-sm transition-all group"
                    >
                      <div className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 mb-1">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-gray-500 line-clamp-2">{t.description}</div>
                      )}
                      <div className="mt-3 text-xs font-medium text-indigo-600 group-hover:underline">Apply →</div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* My Applications */}
            <section>
              <h2 className="text-base font-semibold text-gray-800 mb-3">My Applications</h2>
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                {myApps.length === 0 ? (
                  <div className="p-5 text-sm text-gray-500">You haven't submitted any applications yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="px-5 py-3">Application</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Current Step</th>
                          <th className="px-5 py-3">SLA Remaining</th>
                          <th className="px-5 py-3">Submitted</th>
                          <th className="px-5 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {myApps.map((app) => (
                          <tr key={app.id} className="border-b border-gray-50 last:border-0">
                            <td className="px-5 py-3 text-gray-900 font-medium">
                              #{app.id} — {app.application_type_name}
                            </td>
                            <td className="px-5 py-3">
                              {app.needs_gatepass_scan ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                  NOT LEAVED
                                </span>
                              ) : app.gatepass_scanned_at ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                  Exited
                                </span>
                              ) : (
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(app.current_state)}`}>
                                  {statusLabel(app.current_state)}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-gray-600">{app.current_step_role || '—'}</td>
                            <td className="px-5 py-3">
                              <SlaCountdown deadline={app.sla_deadline ?? null} />
                            </td>
                            <td className="px-5 py-3 text-gray-500">
                              {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-5 py-3">
                              <button
                                onClick={() => navigate(`/applications/${app.id}`)}
                                className="text-xs text-indigo-600 hover:underline font-medium"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
