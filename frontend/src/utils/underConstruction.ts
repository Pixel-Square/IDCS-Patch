export const UC_STORAGE_KEY = 'idcs_uc_state'

/**
 * Persisted shape:  { [path: string]: string[] }
 * The string[] is the list of ROLE names that are currently
 * marked "Under Construction" for that path.
 * e.g. { "/student/attendance": ["STUDENT"], "/applications": ["STUDENT", "HOD"] }
 */
export type UCState = Record<string, string[]>

export function loadUCState(): UCState {
  try {
    return JSON.parse(localStorage.getItem(UC_STORAGE_KEY) || '{}') as UCState
  } catch {
    return {}
  }
}

export function saveUCState(state: UCState): void {
  try {
    localStorage.setItem(UC_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage may be unavailable in some environments
  }
}

/**
 * Returns true when the given path is marked Under Construction
 * for at least one of the supplied role/profile strings.
 *
 * Called inside ProtectedRoute with the user's effective roles.
 */
export function isPageUnderConstruction(path: string, effectiveRoles: string[]): boolean {
  try {
    const state = loadUCState()
    const ucRoles = (state[path] || []).map((r) => r.toUpperCase())
    const upper = effectiveRoles.map((r) => r.toUpperCase())
    return ucRoles.some((r) => upper.includes(r))
  } catch {
    return false
  }
}
