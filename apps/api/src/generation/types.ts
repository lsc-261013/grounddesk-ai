import type {
  AgentIntent,
  Locale,
  OrderLookupToolInput,
  RetrievalEvidence,
  ReturnEligibilityToolInput,
} from '@grounddesk/shared'

export interface ProviderUsage {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  available: boolean
}

export type AgentPlan =
  | {
      intent: 'knowledge_answer' | 'human_handoff'
      normalizedQuestion: string
      missingFields: string[]
      toolCall: null
    }
  | {
      intent: 'order_lookup'
      normalizedQuestion: string
      missingFields: string[]
      toolCall: { id: string; name: 'order_lookup'; input: OrderLookupToolInput } | null
    }
  | {
      intent: 'return_eligibility'
      normalizedQuestion: string
      missingFields: string[]
      toolCall: {
        id: string
        name: 'return_eligibility'
        input: ReturnEligibilityToolInput
      } | null
    }

export interface AgentPlanResult {
  plan: AgentPlan
  providerRequestId: string | null
  usage: ProviderUsage
}

export interface GroundedGenerationInput {
  locale: Locale
  question: string
  intent: AgentIntent
  evidence: RetrievalEvidence[]
  toolResult: Record<string, unknown> | null
  citationRepair?: boolean
}

export type GenerationStreamChunk =
  | { type: 'text'; delta: string }
  | { type: 'usage'; usage: ProviderUsage; providerRequestId: string | null }

export interface GenerationProvider {
  readonly provider: string
  readonly model: string
  plan(question: string, locale: Locale): Promise<AgentPlanResult>
  streamGroundedAnswer(
    input: GroundedGenerationInput,
  ): AsyncGenerator<GenerationStreamChunk, void, undefined>
}
