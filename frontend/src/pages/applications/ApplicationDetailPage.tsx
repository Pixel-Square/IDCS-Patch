import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchApplicationDetail, ApplicationDetail, ApprovalTimelineEntry } from '../../services/applications'

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
    case 'SUBMITTED': return 'Pending Review'
    case 'APPROVED': return 'Approved'
    case 'REJECTED': return 'Rejected'
    case 'DRAFT': return 'Draft'
    default: return state || '—'
  }
}

type StepStyle = {
  circle: string
  badge: string
  connector: string
  label: string
}

function stepStyle(status: ApprovalTimelineEntry['status']): StepStyle {
  switch (status) {
    case 'SUBMITTED':
      return {
        circle: 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200',
        badge: 'bg-blue-100 text-blue-700',
        connector: 'bg-blue-300',
        label: 'Submitted',
      }
    case 'APPROVED':
      return {
        circle: 'bg-green-500 border-green-500 text-white shadow-md shadow-green-200',
        badge: 'bg-green-100 text-green-700',
        connector: 'bg-green-300',
        label: 'Approved',
      }
    case 'REJECTED':
      return {
        circle: 'bg-red-500 border-red-500 text-white shadow-md shadow-red-200',
        badge: 'bg-red-100 text-red-700',
        connector: 'bg-red-200',
        label: 'Rejected',
      }
    case 'SKIPPED':
      return {
        circle: 'bg-gray-300 border-gray-300 text-gray-500',
        badge: 'bg-gray-100 text-gray-500',
        connector: 'bg-gray-200',
        label: 'Skipped',
      }
    case 'PENDING':
    default:
      return {
        circle: 'bg-white border-2 border-gray-300 text-gray-400',
        badge: 'bg-amber-50 text-amber-600 border border-amber-200',
        connector: 'bg-gray-200',
        label: 'Pending',
      }
  }
}

function TimelineStep({ entry, index, isLast }: { entry: ApprovalTimelineEntry; index: number; isLast: boolean }) {
  const s = stepStyle(entry.status)
  const isPending = entry.status === 'PENDING'

  return (
    <div className="flex-1 flex items-start min-w-0">
      {/* Left connector half */}
      <div className="flex-1 h-0.5 mt-5 self-start" style={{ backgroundColor: index > 0 ? (s.connector.includes('blue') ? '#93c5fd' : s.connector.includes('green') ? '#86efac' : s.connector.includes('red') ? '#fca5a5' : '#e5e7eb') : 'transparent' }} />

      {/* Circle + info column */}
      <div className="flex flex-col items-center flex-shrink-0 px-1">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 flex-shrink-0 ${s.circle}`}>
          {isPending ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <path strokeLinecap="round" d="M12 6v6l4 2" strokeWidth="2"/>
            </svg>
          ) : (
            <span>{entry.step_order}</span>
          )}
        </div>

        <div className="flex flex-col items-center mt-2 text-center w-full">
          {entry.step_role && (
            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
              {entry.step_role}
            </span>
          )}
          <span className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${s.badge}`}>
            {isPending && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
            )}
            {s.label}
          </span>
          {entry.acted_by ? (
            <div className="mt-1.5 text-xs text-gray-700 leading-tight font-medium">{entry.acted_by}</div>
          ) : (
            <div className="mt-1.5 text-xs text-gray-400 italic leading-tight">Awaiting</div>
          )}
          {entry.remarks && (
            <div className="mt-1 text-xs text-gray-500 italic leading-tight max-w-[100px] truncate" title={entry.remarks}>
              &ldquo;{entry.remarks}&rdquo;
            </div>
          )}
          {entry.acted_at && (
            <div className="mt-1 text-xs text-gray-400 leading-tight whitespace-nowrap">
              {new Date(entry.acted_at).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Right connector half */}
      <div className="flex-1 h-0.5 mt-5 self-start bg-gray-200" style={{ visibility: isLast ? 'hidden' : 'visible' }} />
    </div>
  )
}

export default function ApplicationDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slaRemaining, setSlaRemaining] = useState<string | null>(null)

  useEffect(() => {
    const state = detail?.current_state?.toUpperCase()
    if (!detail?.sla_deadline || state === 'APPROVED' || state === 'REJECTED' || state === 'DRAFT') {
      setSlaRemaining(null)
      return
    }
    const update = () => {
      const diff = Math.floor((new Date(detail.sla_deadline!).getTime() - Date.now()) / 1000)
      if (diff <= 0) { setSlaRemaining('OVERDUE'); return }
      const h = Math.floor(diff / 3600).toString().padStart(2, '0')
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
      const s = (diff % 60).toString().padStart(2, '0')
      setSlaRemaining(`${h}:${m}:${s}`)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [detail])

  useEffect(() => {
    if (!id) return
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const d = await fetchApplicationDetail(Number(id))
        if (mounted) setDetail(d)
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load application.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id])

  const timeline = detail?.approval_timeline ?? []

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <button
          onClick={() => navigate('/applications')}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          ← My Applications
        </button>

        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : !detail ? null : (
          <>
            {/* Header card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Application #{detail.id}</div>
                  <h1 className="text-xl font-bold text-gray-900">{detail.application_type}</h1>
                  <div className="text-sm text-gray-500 mt-1">
                    Submitted: {detail.submitted_at ? new Date(detail.submitted_at).toLocaleString() : '—'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${statusBadgeClass(detail.current_state)}`}>
                    {statusLabel(detail.current_state)}
                  </span>
                  {detail.current_step && (
                    <div className="text-xs text-gray-500">
                      Awaiting: <span className="font-medium text-gray-700">{detail.current_step}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Approval Timeline */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Approval Timeline</h2>
              </div>

              {/* SLA Countdown bar */}
              {slaRemaining && (
                <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 mb-5 ${
                  slaRemaining === 'OVERDUE'
                    ? 'bg-red-50 border border-red-200'
                    : parseInt(slaRemaining.split(':')[0]) < 1
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-indigo-50 border border-indigo-100'
                }`}>
                  <svg className={`w-4 h-4 shrink-0 ${
                    slaRemaining === 'OVERDUE' ? 'text-red-500' :
                    parseInt(slaRemaining.split(':')[0]) < 1 ? 'text-amber-500' : 'text-indigo-500'
                  }`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                  <span className={`text-xs font-medium ${
                    slaRemaining === 'OVERDUE' ? 'text-red-700' :
                    parseInt(slaRemaining.split(':')[0]) < 1 ? 'text-amber-700' : 'text-indigo-700'
                  }`}>
                    {slaRemaining === 'OVERDUE' ? 'SLA deadline has passed' : 'SLA time remaining'}
                  </span>
                  <span className={`ml-auto font-mono text-base font-bold tracking-widest ${
                    slaRemaining === 'OVERDUE' ? 'text-red-600' :
                    parseInt(slaRemaining.split(':')[0]) < 1 ? 'text-amber-600' : 'text-indigo-600'
                  }`}>
                    {slaRemaining === 'OVERDUE' ? 'OVERDUE' : slaRemaining}
                  </span>
                </div>
              )}

              {timeline.length === 0 ? (
                <div className="text-sm text-gray-400 italic">No flow configured. Awaiting review.</div>
              ) : (
                <div className="flex items-start w-full">
                  {timeline.map((entry, idx) => (
                    <TimelineStep
                      key={`${entry.step_order}-${idx}`}
                      entry={entry}
                      index={idx}
                      isLast={idx === timeline.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Submitted Details */}
            {detail.dynamic_fields.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Submitted Details</h2>
                <dl className="divide-y divide-gray-100">
                  {detail.dynamic_fields.map((f) => (
                    <div key={f.field_key} className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
                      <dt className="text-sm font-medium text-gray-500">{f.label}</dt>
                      <dd className="mt-0.5 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        {f.value === null || f.value === undefined || f.value === ''
                          ? <span className="text-gray-400 italic">—</span>
                          : String(f.value)
                        }
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
