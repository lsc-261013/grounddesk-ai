import type { Locale, WorkspaceMembership, WorkspaceRole } from '@grounddesk/shared'

export interface AuthenticatedUser {
  userId: string
  email: string | null
}

export interface AuthVerifier {
  verifyAccessToken(accessToken: string): Promise<AuthenticatedUser>
}

export interface IdentityProfile {
  id: string
  displayName: string
  avatarUrl: string | null
  locale: Locale
}

export interface IdentityRepository {
  getProfile(userId: string): Promise<IdentityProfile | null>
  listMemberships(userId: string): Promise<WorkspaceMembership[]>
  getMembership(userId: string, workspaceId: string): Promise<WorkspaceMembership | null>
  close(): Promise<void>
}

export type RequestAuthContext = AuthenticatedUser

export interface WorkspaceAccessContext {
  workspaceId: string
  role: WorkspaceRole
}

export interface IdentityDependencies {
  authVerifier: AuthVerifier
  identityRepository: IdentityRepository
}
