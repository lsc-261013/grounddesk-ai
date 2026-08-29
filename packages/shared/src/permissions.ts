import type { WorkspaceRole } from './schemas.js'

export const PERMISSIONS = [
  'workspace:read',
  'workspace:manage',
  'knowledge:read',
  'knowledge:write',
  'orders:read',
  'orders:write',
  'conversations:read',
  'tickets:read',
  'tickets:reply',
  'tickets:assign',
  'evaluations:read',
  'evaluations:run',
  'settings:manage',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ROLE_PERMISSIONS: Readonly<Record<WorkspaceRole, ReadonlySet<Permission>>> = {
  admin: new Set(PERMISSIONS),
  agent: new Set([
    'workspace:read',
    'knowledge:read',
    'orders:read',
    'conversations:read',
    'tickets:read',
    'tickets:reply',
  ]),
}

export const hasPermission = (role: WorkspaceRole, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role].has(permission)

export const getPermissionsForRole = (role: WorkspaceRole): readonly Permission[] =>
  PERMISSIONS.filter((permission) => ROLE_PERMISSIONS[role].has(permission))
