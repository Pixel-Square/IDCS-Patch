import fetchWithAuth from './fetchAuth'

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    let detail = text || `HTTP ${res.status}`
    try {
      const json = text ? JSON.parse(text) : null
      detail = json?.detail || json?.error || detail
    } catch (_) {}
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export type ScannedStudent = {
  id: number
  reg_no: string
  name: string
  rfid_uid: string | null
  section: string | null
  batch: string | null
  department: string | null
  status: string
}

export type LookupResult =
  | { found: true; uid: string; student: ScannedStudent }
  | { found: false; uid: string }

export async function lookupByUID(uid: string): Promise<LookupResult> {
  return parseJson(await fetchWithAuth(`/api/idscan/lookup/?uid=${encodeURIComponent(uid)}`))
}

export async function searchStudents(q: string): Promise<ScannedStudent[]> {
  return parseJson(await fetchWithAuth(`/api/idscan/search/?q=${encodeURIComponent(q)}`))
}

export async function assignUID(studentId: number, uid: string): Promise<{ success: boolean; student: ScannedStudent }> {
  return parseJson(
    await fetchWithAuth('/api/idscan/assign-uid/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, uid }),
    })
  )
}

export async function unassignUID(studentId: number): Promise<{ success: boolean }> {
  return parseJson(
    await fetchWithAuth('/api/idscan/unassign-uid/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId }),
    })
  )
}

export type GatepassTimelineStep = {
  step_order: number
  step_role: string | null
  is_starter: boolean
  is_final: boolean
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED' | 'SUBMITTED'
  acted_by: string | null
  acted_at: string | null
  remarks: string | null
}

export type GatepassCheckResult = {
  allowed: boolean
  message: string
  reason?: 'unknown_uid' | 'already_scanned' | 'not_approved' | 'not_fully_approved' | 'no_gatepass'
  application_id?: number
  application_type?: string
  scanned_at?: string
  student?: ScannedStudent
  approval_timeline?: GatepassTimelineStep[]
}

export async function gatepassCheck(uid: string): Promise<GatepassCheckResult> {
  return parseJson(
    await fetchWithAuth('/api/idscan/gatepass-check/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    })
  )
}
