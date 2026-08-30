import type {
  Locale,
  WorkspaceMember,
  WorkspaceMembership,
  WorkspaceRole,
  WorkspaceSettings,
} from '@grounddesk/shared'

export interface WorkspaceRepository {
  getSettings(workspaceId: string): Promise<WorkspaceSettings | null>
  updateSettings(
    workspaceId: string,
    input: { name: string; defaultLocale: Locale; confidenceThreshold: number },
  ): Promise<WorkspaceSettings | null>
  listMembers(workspaceId: string): Promise<WorkspaceMember[]>
  addMember(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember | null>
  updateMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember | null>
  removeMember(workspaceId: string, userId: string): Promise<boolean>
  onboard(
    userId: string,
    input: { name: string; slug: string; defaultLocale: Locale },
  ): Promise<WorkspaceMembership | null>
  resetDemo(workspaceId: string): Promise<boolean>
  close(): Promise<void>
}
