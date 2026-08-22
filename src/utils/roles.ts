import type { UserProfile } from '@/types/api'

const ADMIN_ROLE_CODES = new Set(['ADMIN', 'BUSINESS_ADMIN', 'SYSTEM_ADMIN'])

function normalizeRoleCode(role: string) {
  return role.trim().toUpperCase().replace(/^ROLE_/, '')
}

export function getRoleCodes(user: Pick<UserProfile, 'role' | 'roles'> | null | undefined) {
  if (!user) return []

  const values = [
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(Array.isArray(user.role) ? user.role : user.role ? [user.role] : [])
  ]

  return [...new Set(values.filter(Boolean).map(normalizeRoleCode))]
}

export function normalizeUserProfile(user: UserProfile): UserProfile {
  return { ...user, roles: getRoleCodes(user) }
}

export function hasAdminRole(user: Pick<UserProfile, 'role' | 'roles'> | null | undefined) {
  return getRoleCodes(user).some((role) => ADMIN_ROLE_CODES.has(role))
}
