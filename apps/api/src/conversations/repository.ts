import type { ConversationDetail, ConversationSummary, WorkspaceRole } from '@grounddesk/shared'

export interface ConversationAccess {
  userId: string
  role: WorkspaceRole
}

export interface ConversationListResult {
  conversations: ConversationSummary[]
  total: number
}

export interface ConversationRepository {
  list(workspaceId: string, access: ConversationAccess): Promise<ConversationListResult>
  get(
    workspaceId: string,
    conversationId: string,
    access: ConversationAccess,
  ): Promise<ConversationDetail | null>
  close(): Promise<void>
}
