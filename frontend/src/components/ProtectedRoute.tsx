import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import BuildingInfo from './BuildingInfo'

type User = any

interface Props {
  user: User | null
  element: React.ReactElement
  requiredRoles?: string[]
  requiredPermissions?: string[]
  requiredProfile?: 'STUDENT' | 'STAFF'
}

export default function ProtectedRoute({ user, element, requiredRoles, requiredPermissions, requiredProfile }: Props){
  const location = useLocation()
  // not authenticated -> redirect to login
  if(!user) return <Navigate to="/login" replace />

  const roles = (user.roles || []).map((r: string) => (r || '').toString().toUpperCase())
  const perms = (user.permissions || []).map((p: string) => (p || '').toString().toLowerCase())
  const profile = (user.profile_type || '').toString().toUpperCase()

  let allowed = false

  if(requiredProfile){
    if(requiredProfile === 'STUDENT' && profile === 'STUDENT') allowed = true
    if(requiredProfile === 'STAFF' && profile === 'STAFF') allowed = true
  }

  if(!allowed && requiredRoles && requiredRoles.length){
    const req = requiredRoles.map(r=> r.toString().toUpperCase())
    if(req.some(rr => roles.includes(rr))) allowed = true
  }

  if(!allowed && requiredPermissions && requiredPermissions.length){
    const req = requiredPermissions.map(p=> p.toString().toLowerCase())
    if(req.some(rp => perms.includes(rp))) allowed = true
  }

  // If no requirements provided, allow by default
  if(!requiredProfile && (!requiredRoles || requiredRoles.length===0) && (!requiredPermissions || requiredPermissions.length===0)){
    allowed = true
  }

  if(!allowed) return <Navigate to="/dashboard" replace />

  // Under-construction gate — checked after access is confirmed
  try {
    const ucState = JSON.parse(localStorage.getItem('idcs_uc_state') || '{}') as Record<string, string[]>
    const ucRoles = ucState[location.pathname] || []
    if (ucRoles.length > 0) {
      const effectiveRoles = [...roles]
      if (profile) effectiveRoles.push(profile)
      if (ucRoles.some((r) => effectiveRoles.includes(r.toUpperCase()))) {
        return <BuildingInfo />
      }
    }
  } catch {
    // ignore any UC state errors gracefully
  }

  return element
}
