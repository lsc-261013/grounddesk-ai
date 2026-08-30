import type {
  AgentIntent,
  ChatCitation,
  ConversationSource,
  FeedbackRating,
  Locale,
  ToolResultStatus,
} from '@grounddesk/shared'

import type { ProviderUsage } from '../generation/types.js'

export interface PublicWorkspaceConfig {
  id: string
  slug: string
  confidenceThreshold: number
  isDemo: boolean
}

export interface ConversationRecord {
  id: string
  workspaceId: string
  locale: Locale
  status: 'active' | 'handed_off' | 'closed'
  source: ConversationSource
}

export interface SaveAssistantMessageInput {
  workspaceId: string
  conversationId: string
  content: string
  intent: AgentIntent
  refused: boolean
  handedOff: boolean
  firstTokenLatencyMs: number | null
  totalLatencyMs: number
  usage: ProviderUsage
  estimatedCostUsd: number | null
  providerRequestId: string | null
  errorType: string | null
}

export interface RetrievalLogInput {
  workspaceId: string
  conversationId: string
  messageId: string | null
  embeddingConfigId: string
  queryTextRedacted: string
  candidateChunkIds: string[]
  finalChunkIds: string[]
  filters: Record<string, unknown>
  wasEmpty: boolean
  conflictDetected: boolean
  durationMs: number
}

export interface ToolCallLogInput {
  workspaceId: string
  conversationId: string
  messageId: string | null
  toolName: 'order_lookup' | 'return_eligibility'
  argumentsRedacted: Record<string, unknown>
  status: ToolResultStatus
  resultSummary: Record<string, unknown> | null
  durationMs: number
  errorType: string | null
}

export interface HandoffInput {
  workspaceId: string
  conversationId: string
  summary: string
  reason: string
  evidenceChunkIds: string[]
  toolCallIds: string[]
  priority: 'low' | 'normal' | 'high' | 'urgent'
}

export interface UsageEventInput {
  workspaceId: string
  conversationId: string
  provider: string
  model: string
  usage: ProviderUsage
  estimatedCostUsd: number | null
  firstTokenLatencyMs: number | null
  totalLatencyMs: number
}

export interface AgentRepository {
  getPublicWorkspace(slug: string): Promise<PublicWorkspaceConfig | null>
  reserveDemoRequest(
    workspaceId: string,
    requestLimit: number,
    tokenLimit: number,
  ): Promise<boolean>
  addDemoTokens(workspaceId: string, tokens: number): Promise<void>
  getOrCreateConversation(input: {
    workspaceId: string
    sessionHash: string
    requestedConversationId: string | null
    locale: Locale
    source: ConversationSource
  }): Promise<ConversationRecord | null>
  saveUserMessage(workspaceId: string, conversationId: string, content: string): Promise<string>
  saveAssistantMessage(input: SaveAssistantMessageInput): Promise<string>
  saveCitations(workspaceId: string, messageId: string, citations: ChatCitation[]): Promise<void>
  saveRetrievalLog(input: RetrievalLogInput): Promise<void>
  saveToolCall(input: ToolCallLogInput): Promise<string>
  createHandoff(input: HandoffInput): Promise<string>
  saveUsageEvent(input: UsageEventInput): Promise<void>
  saveFeedback(input: {
    workspaceId: string
    sessionHash: string
    conversationId: string
    messageId: string
    rating: FeedbackRating
    comment: string | null
  }): Promise<boolean>
  close(): Promise<void>
}
